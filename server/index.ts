import express from "express";
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { sessionManager } from "./sessionManager.js";
import { mountSessionProxy, attachUpgrade } from "./proxy.js";
import { buildAgentPrompt, buildReviewPrompt, runAgent, buildAgentArgs } from "./agentRunner.js";
import { EventEmitter } from "events";
import { spawn, type ChildProcess } from "child_process";
import multer from "multer";
import { contextLibrary } from "./contextLibrary.js";
import {
  buildContextAgentPrompt,
  DEFAULT_CONTEXT_PROMPT,
  slugify,
  sourceNeedsChrome,
} from "./contextPrompt.js";
import type { Settings, ContextSource, ContextTier } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const PON_SKILLS_DIR = path.resolve(
  ROOT,
  "..",
  "pon-project-standards",
  "backend",
  ".github",
  "skills",
);
const DATA_DIR = path.join(ROOT, "data");
const WORKSPACE_FILE = path.join(DATA_DIR, "workspace.json");
const GENERATIONS_FILE = path.join(DATA_DIR, "generations.json");
const CONTEXT_GENERATIONS_FILE = path.join(DATA_DIR, "context-generations.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---------- skill library ----------

type SkillMeta = {
  id: string;
  name: string;
  description: string;
  category: "default" | "pon";
};

function listSkillIds(): string[] {
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => f.replace(/\.md$/, ""));
}

function parseSkill(id: string): SkillMeta {
  const raw = fs.readFileSync(path.join(SKILLS_DIR, `${id}.md`), "utf-8");
  const lines = raw.split("\n");
  let name = id;
  let description = "";
  const headingIdx = lines.findIndex((l) => l.startsWith("# "));
  if (headingIdx >= 0) {
    name = lines[headingIdx].replace(/^#\s+/, "").trim();
    for (let i = headingIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      if (line.startsWith("#")) break;
      description = line;
      break;
    }
  }
  return { id, name, description, category: "default" as const };
}

// ---------- PON backend skills ----------

function listPonSkillIds(): string[] {
  try {
    return fs
      .readdirSync(PON_SKILLS_DIR, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          fs.existsSync(path.join(PON_SKILLS_DIR, d.name, "SKILL.md")),
      )
      .map((d) => `pon--${d.name}`)
      .sort();
  } catch {
    return [];
  }
}

function parsePonSkill(id: string): SkillMeta {
  const dirName = id.replace(/^pon--/, "");
  const raw = fs.readFileSync(
    path.join(PON_SKILLS_DIR, dirName, "SKILL.md"),
    "utf-8",
  );
  let name = dirName;
  let description = "";
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim();
    if (descMatch) description = descMatch[1].trim();
  }
  return { id, name, description, category: "pon" as const };
}

function listAllSkillIds(): string[] {
  return [...listSkillIds(), ...listPonSkillIds()];
}

// ---------- workspace + generations persistence ----------

type Workspace = { installed: string[] };

type GenerationVariant = {
  sessionId: string;
  previewUrl: string;
};

type GenerationStatus = "running" | "ready" | "errored" | "stopped";

type ReviewStatus = "running" | "ready" | "errored";

type Generation = {
  id: string;
  createdAt: string;
  prompt: string;
  skillIds: string[];
  status: GenerationStatus;
  withSkills: GenerationVariant | null;
  withoutSkills: GenerationVariant | null;
  error?: string;
  review?: { status: ReviewStatus };
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readWorkspace(): Workspace {
  return { installed: listAllSkillIds() };
}

function writeWorkspace(ws: Workspace) {
  ensureDataDir();
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(ws, null, 2));
}

function readGenerations(): Generation[] {
  ensureDataDir();
  if (!fs.existsSync(GENERATIONS_FILE)) return [];
  try {
    const all = JSON.parse(
      fs.readFileSync(GENERATIONS_FILE, "utf-8"),
    ) as Generation[];
    // Migration: drop legacy entries that lack sessionId on withSkills.
    return all.filter((g) => {
      if (!g) return false;
      if (g.withSkills && !("sessionId" in g.withSkills)) return false;
      if (g.withoutSkills && !("sessionId" in g.withoutSkills)) return false;
      return true;
    });
  } catch {
    return [];
  }
}

function writeGenerations(gens: Generation[]) {
  ensureDataDir();
  fs.writeFileSync(GENERATIONS_FILE, JSON.stringify(gens, null, 2));
}

function updateGeneration(
  id: string,
  patch: (g: Generation) => Generation,
): Generation | null {
  const all = readGenerations();
  const idx = all.findIndex((g) => g.id === id);
  if (idx < 0) return null;
  all[idx] = patch(all[idx]);
  writeGenerations(all);
  return all[idx];
}

// ---------- context lab persistence ----------

type ContextVariant = {
  tierId: string;
  label: string;
  sourceIds: string[];
  sessionId: string;
  previewUrl: string;
  chrome: boolean; // this variant drives the browser (single-channel mutex key)
};

type ContextGeneration = {
  id: string;
  createdAt: string;
  prompt: string;
  status: GenerationStatus;
  variants: ContextVariant[];
  error?: string;
};

function readContextGenerations(): ContextGeneration[] {
  ensureDataDir();
  if (!fs.existsSync(CONTEXT_GENERATIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CONTEXT_GENERATIONS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeContextGenerations(gens: ContextGeneration[]) {
  ensureDataDir();
  fs.writeFileSync(CONTEXT_GENERATIONS_FILE, JSON.stringify(gens, null, 2));
}

function updateContextGeneration(
  id: string,
  patch: (g: ContextGeneration) => ContextGeneration,
) {
  const all = readContextGenerations();
  const idx = all.findIndex((g) => g.id === id);
  if (idx < 0) return;
  all[idx] = patch(all[idx]);
  writeContextGenerations(all);
}

// ---------- settings (claude flag config) ----------

const DEFAULT_SETTINGS: Settings = {
  model: "opus",
  effort: "",
  maxBudgetUsd: null,
  permissionMode: "acceptEdits",
  tools: "Edit,Write,Read,Bash",
  appendSystemPrompt: "",
  bare: false,
};

function readSettings(): Settings {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const stored = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(s: Settings) {
  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

function sanitizeSettings(input: any): Settings {
  const raw: any = { ...(input ?? {}) };
  if (typeof raw.tools !== "string" && typeof raw.allowedTools === "string") {
    raw.tools = raw.allowedTools;
  }

  const merged: Settings = { ...DEFAULT_SETTINGS, ...raw };

  if (typeof merged.model !== "string" || !merged.model.trim()) {
    merged.model = DEFAULT_SETTINGS.model;
  }
  const validEffort = ["", "low", "medium", "high", "xhigh", "max"];
  if (!validEffort.includes(merged.effort)) merged.effort = "";
  if (merged.maxBudgetUsd !== null) {
    const n = Number(merged.maxBudgetUsd);
    merged.maxBudgetUsd = Number.isFinite(n) && n > 0 ? n : null;
  }
  const validPerms = [
    "dontAsk",
    "default",
    "acceptEdits",
    "plan",
    "bypassPermissions",
    "auto",
  ];
  if (!validPerms.includes(merged.permissionMode)) {
    merged.permissionMode = DEFAULT_SETTINGS.permissionMode;
  }
  if (typeof merged.tools !== "string") merged.tools = DEFAULT_SETTINGS.tools;
  if (typeof merged.appendSystemPrompt !== "string") {
    merged.appendSystemPrompt = "";
  }
  merged.bare = Boolean(merged.bare);

  return merged;
}

// ---------- routes ----------

app.get("/api/skills", (_req, res) => {
  try {
    const defaultSkills = listSkillIds().map(parseSkill);
    const ponSkills = listPonSkillIds().map(parsePonSkill);
    res.json([...defaultSkills, ...ponSkills]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/skills/:id/content", (req, res) => {
  const id = req.params.id;
  try {
    let content: string;
    let name: string;
    if (id.startsWith("pon--")) {
      const dirName = id.replace(/^pon--/, "");
      const filePath = path.join(PON_SKILLS_DIR, dirName, "SKILL.md");
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "skill not found" });
      content = fs.readFileSync(filePath, "utf-8");
      name = parsePonSkill(id).name;
    } else {
      const filePath = path.join(SKILLS_DIR, `${id}.md`);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "skill not found" });
      content = fs.readFileSync(filePath, "utf-8");
      name = parseSkill(id).name;
    }
    res.json({ id, name, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workspace", (_req, res) => {
  try {
    res.json(readWorkspace());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/workspace/install", (req, res) => {
  const { skillId } = req.body as { skillId?: string };
  if (!skillId) return res.status(400).json({ error: "skillId required" });
  if (!listAllSkillIds().includes(skillId)) {
    return res.status(404).json({ error: `unknown skill: ${skillId}` });
  }
  const ws = readWorkspace();
  if (!ws.installed.includes(skillId)) ws.installed.push(skillId);
  writeWorkspace(ws);
  res.json(ws);
});


app.get("/api/settings", (_req, res) => {
  try {
    res.json(readSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/settings", (req, res) => {
  try {
    const next = sanitizeSettings(req.body);
    writeSettings(next);
    res.json(next);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/generations", (_req, res) => {
  try {
    res.json(readGenerations());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/generations/:id", async (req, res) => {
  const id = req.params.id;
  const all = readGenerations();
  const gen = all.find((g) => g.id === id);
  writeGenerations(all.filter((g) => g.id !== id));
  if (gen) {
    if (gen.withSkills) await sessionManager.destroy(gen.withSkills.sessionId);
    if (gen.withoutSkills)
      await sessionManager.destroy(gen.withoutSkills.sessionId);
  }
  const review = reviews.get(id);
  if (review) {
    try {
      review.agent?.kill("SIGTERM");
    } catch {}
    reviews.delete(id);
  }
  res.json({ ok: true });
});

// SSE stream for an individual session's agent transcript + live events.
app.get("/api/sessions/:sessionId/events", (req, res) => {
  const sessionId = req.params.sessionId;
  if (!sessionManager.has(sessionId)) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Replay any persisted transcript so a refreshing client catches up.
  try {
    const transcriptPath = path.join(
      ROOT,
      "data",
      "sessions",
      sessionId,
      "transcript.jsonl",
    );
    if (fs.existsSync(transcriptPath)) {
      const lines = fs
        .readFileSync(transcriptPath, "utf-8")
        .split("\n")
        .filter(Boolean);
      for (const line of lines) {
        res.write(`data: ${line}\n\n`);
      }
    }
  } catch {}

  // If the session is already in a terminal state, the bus has long since
  // emitted 'end' and a new subscriber will never receive it. Synthesize one
  // from the persisted status so the client knows to stop the spinner.
  const status = sessionManager.status(sessionId);
  if (status === "ready" || status === "errored" || status === "stopped") {
    const code = status === "ready" ? 0 : 1;
    res.write(`event: end\ndata: ${JSON.stringify({ code })}\n\n`);
    res.end();
    return;
  }

  const ee = sessionManager.bus(sessionId);
  if (!ee) {
    res.end();
    return;
  }
  const onEvent = (ev: any) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  const onEnd = (info: any) => {
    res.write(`event: end\ndata: ${JSON.stringify(info)}\n\n`);
    res.end();
  };
  ee.on("event", onEvent);
  ee.on("end", onEnd);

  req.on("close", () => {
    ee.off("event", onEvent);
    ee.off("end", onEnd);
  });
});

app.post("/api/generate", async (req, res) => {
  const { prompt, skills, compare } = req.body as {
    prompt?: string;
    skills?: string[];
    compare?: boolean;
  };

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const skillIds = Array.isArray(skills) ? skills : [];
  const ws = readWorkspace();
  const notInstalled = skillIds.filter((id) => !ws.installed.includes(id));
  if (notInstalled.length > 0) {
    return res
      .status(400)
      .json({ error: `skills not installed: ${notInstalled.join(", ")}` });
  }

  const settings = readSettings();

  try {
    const [withSkills, withoutSkills] = await Promise.all([
      launchVariant({ prompt, skillIds, settings }),
      compare
        ? launchVariant({ prompt, skillIds: [], settings })
        : Promise.resolve(null as GenerationVariant | null),
    ]);

    const gen: Generation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      prompt,
      skillIds,
      status: "running",
      withSkills,
      withoutSkills,
    };

    const all = readGenerations();
    all.unshift(gen);
    writeGenerations(all);

    // Track the agent runs and roll up final status on the Generation.
    trackVariantEnd(gen.id, withSkills.sessionId);
    if (withoutSkills) trackVariantEnd(gen.id, withoutSkills.sessionId);

    res.json(gen);
  } catch (err: any) {
    console.error("generate error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "generation failed" });
  }
});

// In-memory record of how many variants are still running per generation,
// so we know when to flip the Generation to a terminal status.
const pending: Map<string, { remaining: number; errored: boolean }> = new Map();

function trackVariantEnd(generationId: string, sessionId: string) {
  const slot = pending.get(generationId) ?? { remaining: 0, errored: false };
  slot.remaining += 1;
  pending.set(generationId, slot);

  const ee = sessionManager.bus(sessionId);
  if (!ee) return;
  const onEnd = (info: any) => {
    ee.off("end", onEnd);
    const cur = pending.get(generationId);
    if (!cur) return;
    if (info?.code !== 0) cur.errored = true;
    cur.remaining -= 1;
    if (cur.remaining <= 0) {
      pending.delete(generationId);
      updateGeneration(generationId, (g) => ({
        ...g,
        status: cur.errored ? "errored" : "ready",
      }));
    } else {
      pending.set(generationId, cur);
    }
  };
  ee.on("end", onEnd);
}

async function launchVariant(opts: {
  prompt: string;
  skillIds: string[];
  settings: Settings;
}): Promise<GenerationVariant> {
  const session = sessionManager.create();
  sessionManager.installSkills(session.id, opts.skillIds);
  // Start Vite up front so the iframe has something to load.
  await sessionManager.startVite(session.id);

  const loadedSkills = opts.skillIds
    .map((id) => {
      try {
        if (id.startsWith("pon--")) return { id, name: parsePonSkill(id).name };
        if (fs.existsSync(path.join(SKILLS_DIR, `${id}.md`)))
          return { id, name: parseSkill(id).name };
      } catch {}
      return null;
    })
    .filter((s): s is { id: string; name: string } => s !== null);

  const fullPrompt = buildAgentPrompt({
    userPrompt: opts.prompt,
    loadedSkills,
  });

  // Fire-and-forget: the agent runs in the background, posting events to
  // the session bus. SSE consumers attach via /api/sessions/:id/events.
  sessionManager.runAgent(session.id, fullPrompt, opts.settings);

  return {
    sessionId: session.id,
    previewUrl: `/api/preview/${session.id}/`,
  };
}

// ---------- context lab ----------

contextLibrary.ensureSeeds();

// Trusted-local-assets allowlist. The agent has Bash and reads these files as
// source of truth, so reject anything outside the expected doc/image types.
const ALLOWED_CONTEXT_EXT = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".xml", ".md", ".txt", ".json", ".csv",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_CONTEXT_EXT.has(ext)) return cb(null, true);
    cb(new Error(`file type not allowed: ${ext || file.originalname}`));
  },
});

app.get("/api/context/sources", (_req, res) => {
  res.json(contextLibrary.listSources());
});

app.post("/api/context/sources", (req, res) => {
  // Run multer manually so a fileFilter/limit rejection returns JSON 400,
  // not Express's default HTML 500.
  upload.array("files", 10)(req, res, (mErr: any) => {
    if (mErr) return res.status(400).json({ error: String(mErr.message ?? mErr) });
    const label = (req.body?.label ?? "").toString().trim();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!label) return res.status(400).json({ error: "label required" });
    if (files.length === 0) return res.status(400).json({ error: "at least one file required" });
    const src = contextLibrary.createFileSource(
      label,
      files.map((f) => ({ name: f.originalname, buffer: f.buffer })),
    );
    res.json(src);
  });
});

app.post("/api/context/sources/url", (req, res) => {
  const { label, urls, instructions } = req.body as {
    label?: string;
    urls?: string[];
    instructions?: string;
  };
  if (!label?.trim()) return res.status(400).json({ error: "label required" });
  const clean = (Array.isArray(urls) ? urls : [])
    .map((u) => String(u).trim())
    .filter((u) => /^https?:\/\//.test(u));
  if (clean.length === 0) return res.status(400).json({ error: "at least one http(s) url required" });
  res.json(contextLibrary.createUrlSource(label.trim(), clean, instructions?.trim() || undefined));
});

app.delete("/api/context/sources/:id", (req, res) => {
  contextLibrary.deleteSource(req.params.id);
  res.json({ ok: true });
});

app.get("/api/context/tiers", (_req, res) => {
  res.json(contextLibrary.readTiers());
});

app.put("/api/context/tiers", (req, res) => {
  const body = req.body as ContextTier[];
  if (!Array.isArray(body) || body.length !== 3) {
    return res.status(400).json({ error: "expected exactly 3 tiers" });
  }
  const known = new Set(contextLibrary.listSources().map((s) => s.id));
  const tiers = body.map((t) => ({
    id: String(t.id),
    label: String(t.label),
    sourceIds: (t.sourceIds ?? []).filter((id) => known.has(id)),
  }));
  res.json(contextLibrary.writeTiers(tiers));
});

app.get("/api/context-lab/generations", (_req, res) => {
  res.json(reconcileContextGenerations());
});

// A generation persisted as "running" is stale after a server restart (the
// SSE route already marks all sessions "stopped" on boot). Derive the real
// status from the sessions and persist the correction so the UI never shows a
// permanently-spinning card.
function reconcileContextGenerations(): ContextGeneration[] {
  const all = readContextGenerations();
  let changed = false;
  for (const g of all) {
    if (g.status !== "running") continue;
    const statuses = g.variants.map((v) => sessionManager.status(v.sessionId));
    const anyLive = statuses.some((s) => s === "agent-running" || s === "starting-vite");
    if (anyLive) continue; // genuinely still running
    const terminal = statuses.every(
      (s) => s === "ready" || s === "errored" || s === "stopped" || s === null,
    );
    if (terminal) {
      g.status = statuses.some((s) => s === "errored" || s === "stopped" || s === null)
        ? "errored"
        : "ready";
      changed = true;
    }
  }
  if (changed) writeContextGenerations(all);
  return all;
}

app.delete("/api/context-lab/generations/:id", async (req, res) => {
  const all = readContextGenerations();
  const gen = all.find((g) => g.id === req.params.id);
  writeContextGenerations(all.filter((g) => g.id !== req.params.id));
  if (gen) {
    for (const v of gen.variants) await sessionManager.destroy(v.sessionId);
  }
  res.json({ ok: true });
});

app.post("/api/context-lab/generate", async (req, res) => {
  const raw = (req.body?.prompt ?? "").toString().trim();
  const prompt = raw.length > 0 ? raw : DEFAULT_CONTEXT_PROMPT;
  const settings = readSettings();
  const tiers = contextLibrary.readTiers().filter((t) => t.sourceIds.length > 0);
  if (tiers.length === 0) {
    return res.status(400).json({
      error: "no tier has any sources — add sources to tiers first",
    });
  }

  const willUseChrome = tiers.some((t) =>
    t.sourceIds.some((id) => contextLibrary.getSource(id)?.kind === "url"),
  );

  // Single-chrome mutex: only one browser-driving generation at a time (the
  // extension is a single serial channel). Reconcile first so a stale
  // "running" from a prior boot doesn't lock the room out forever.
  if (willUseChrome) {
    const chromeBusy = reconcileContextGenerations().some(
      (g) => g.status === "running" && g.variants.some((v) => v.chrome),
    );
    if (chromeBusy) {
      return res.status(409).json({
        error:
          "a Chrome-browsing generation is still running — wait for it to finish (single browser channel)",
      });
    }
  }

  // 1) Resolve tiers → sources, create sessions, install files (fast, sync).
  const prepared = tiers.map((tier) => {
    const sources = tier.sourceIds
      .map((id) => contextLibrary.getSource(id))
      .filter((s): s is ContextSource => s !== null);
    const session = sessionManager.create();
    sessionManager.installContextFiles(
      session.id,
      sources
        .filter((s) => s.kind === "file")
        .map((s) => ({
          slug: slugify(s.label),
          files: s.files.map((name) => ({
            name,
            absPath: path.join(contextLibrary.sourceDir(s.id), name),
          })),
        })),
    );
    return {
      tier,
      sources,
      sessionId: session.id,
      chrome: sourceNeedsChrome(sources),
    };
  });

  // 2) Boot all Vite servers CONCURRENTLY (true 3-up start, not sequential).
  try {
    await Promise.all(prepared.map((p) => sessionManager.startVite(p.sessionId)));
  } catch (err: any) {
    // Partial failure: tear down every session we created so none are orphaned.
    for (const p of prepared) await sessionManager.destroy(p.sessionId);
    console.error("context generate startVite error:", err?.message ?? err);
    return res
      .status(500)
      .json({ error: err?.message ?? "failed to start preview servers" });
  }

  const variants: ContextVariant[] = prepared.map((p) => ({
    tierId: p.tier.id,
    label: p.tier.label,
    sourceIds: p.tier.sourceIds,
    sessionId: p.sessionId,
    previewUrl: `/api/preview/${p.sessionId}/`,
    chrome: p.chrome,
  }));

  const gen: ContextGeneration = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    prompt,
    status: "running",
    variants,
  };
  const all = readContextGenerations();
  all.unshift(gen);
  writeContextGenerations(all);

  // 3) Spawn each agent and attach its completion listener in the SAME
  // synchronous tick as the spawn — the child's async 'close' cannot fire
  // before the listener is registered, so no end event is ever missed.
  let remaining = prepared.length;
  let errored = false;
  const rollup = (code: number) => {
    if (code !== 0) errored = true;
    if (--remaining <= 0) {
      updateContextGeneration(gen.id, (g) => ({
        ...g,
        status: errored ? "errored" : "ready",
      }));
    }
  };
  for (const p of prepared) {
    const fullPrompt = buildContextAgentPrompt({
      userPrompt: prompt,
      sources: p.sources,
    });
    const bus = sessionManager.runAgent(p.sessionId, fullPrompt, settings, {
      chrome: p.chrome,
    });
    const onEnd = (info: any) => {
      bus.off("end", onEnd);
      rollup(info?.code ?? 1);
    };
    bus.on("end", onEnd);
  }

  res.json(gen);
});

// The preflight must exercise the SAME path the real tier-3 run does — not
// just "is the extension alive" — or it's a false-confidence canary. It opens
// a tab, navigates the configured Figma URL, screenshots it, and reports
// whether it saw the design vs a login/permission wall.
function buildPreflightPrompt(figmaUrl: string): string {
  return [
    "You are verifying the claude-in-chrome browser integration end to end.",
    "The browser tools are deferred; if a claude-in-chrome tool is not directly callable, load it first with ToolSearch (query: \"select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__computer\").",
    "Steps:",
    "1. tabs_context_mcp with createIfEmpty:true, then create a fresh tab.",
    `2. Navigate to: ${figmaUrl}`,
    "3. Wait for it to load, then take one screenshot.",
    "4. Judge what you see. If it is a Figma design/prototype, reply with exactly: OK design-visible. If it is a login page, 'request access', or permission wall, reply with exactly: FAIL login-wall. If the browser tools never responded/connected, reply with exactly: FAIL not-connected.",
    "Reply with ONLY that one line. Then close the tab.",
  ].join("\n");
}

app.post("/api/context-lab/preflight", (_req, res) => {
  // Use the first url from any tier-3 (chrome) source so the canary hits the
  // real asset. Fall back to figma.com if none configured.
  const urlSource = contextLibrary
    .listSources()
    .find((s) => s.kind === "url" && (s.urls?.length ?? 0) > 0);
  const figmaUrl = urlSource?.urls?.[0] ?? "https://www.figma.com";

  const settings = readSettings();
  // Same permission mode as the real chrome generate run, so a pass here means
  // the production configuration works.
  const args = [
    "-p",
    buildPreflightPrompt(figmaUrl),
    "--chrome",
    "--permission-mode",
    settings.permissionMode === "dontAsk" ? "acceptEdits" : settings.permissionMode,
    "--output-format",
    "json",
  ];
  const child = spawn("claude", args, {
    cwd: os.tmpdir(),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  let done = false;
  const finish = (ok: boolean, detail: string) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    res.json({ ok, detail });
  };
  const timer = setTimeout(() => {
    try { child.kill("SIGTERM"); } catch {}
    finish(false, "preflight timed out after 120s");
  }, 120_000);
  child.stdout.on("data", (b: Buffer) => (out += b.toString()));
  child.on("close", () => {
    try {
      const parsed = JSON.parse(out);
      const text = String(parsed?.result ?? "");
      if (text.includes("OK design-visible")) {
        return finish(true, "Chrome connected and the Figma design rendered");
      }
      if (text.includes("login-wall")) {
        return finish(false, "Chrome connected but the URL shows a login/permission wall — log into Figma / fix sharing");
      }
      if (text.includes("not-connected")) {
        return finish(false, "browser extension did not respond — open Chrome, connect the extension");
      }
      finish(false, text.slice(0, 300) || "inconclusive preflight");
    } catch {
      finish(false, `unparseable preflight output: ${out.slice(0, 200)}`);
    }
  });
  child.on("error", (err) => finish(false, String(err?.message ?? err)));
});

// ---------- review agent ----------

type ReviewState = {
  bus: EventEmitter;
  agent?: ChildProcess;
  status: ReviewStatus;
  transcript: string[];
};

const reviews = new Map<string, ReviewState>();

app.post("/api/generations/:id/review", (req, res) => {
  const genId = req.params.id;
  const all = readGenerations();
  const gen = all.find((g) => g.id === genId);

  if (!gen) return res.status(404).json({ error: "generation not found" });
  if (!gen.withoutSkills)
    return res.status(400).json({ error: "not a comparison generation" });
  if (gen.status !== "ready")
    return res.status(400).json({ error: "generation not ready yet" });

  if (reviews.has(genId)) {
    const r = reviews.get(genId)!;
    return res.json({ status: r.status });
  }

  let withSkillsCode: Record<string, string>;
  let withoutSkillsCode: Record<string, string>;
  let skillFiles: Record<string, string>;
  try {
    withSkillsCode = sessionManager.getSessionFiles(gen.withSkills!.sessionId);
    withoutSkillsCode = sessionManager.getSessionFiles(
      gen.withoutSkills.sessionId,
    );
    skillFiles = sessionManager.getSessionSkillFiles(
      gen.withSkills!.sessionId,
    );
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: `failed to read session files: ${err.message}` });
  }

  const reviewPrompt = buildReviewPrompt({
    skillFiles,
    withSkillsCode,
    withoutSkillsCode,
  });

  const settings = readSettings();
  const args = buildAgentArgs(
    { ...settings, tools: "", permissionMode: "plan" },
    reviewPrompt,
  );

  const child = spawn("claude", args, {
    cwd: os.tmpdir(),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const review: ReviewState = {
    bus: new EventEmitter(),
    agent: child,
    status: "running",
    transcript: [],
  };
  reviews.set(genId, review);

  updateGeneration(genId, (g) => ({
    ...g,
    review: { status: "running" },
  }));

  let buf = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const ev = JSON.parse(line);
        review.transcript.push(line);
        review.bus.emit("event", ev);
      } catch {
        const raw = { type: "raw", line };
        review.transcript.push(JSON.stringify(raw));
        review.bus.emit("event", raw);
      }
    }
  });

  child.stderr?.on("data", (b: Buffer) => {
    const ev = { type: "stderr", text: b.toString() };
    review.transcript.push(JSON.stringify(ev));
    review.bus.emit("event", ev);
  });

  child.on("close", (code) => {
    if (buf.trim()) {
      try {
        const ev = JSON.parse(buf.trim());
        review.transcript.push(buf.trim());
        review.bus.emit("event", ev);
      } catch {
        const raw = { type: "raw", line: buf.trim() };
        review.transcript.push(JSON.stringify(raw));
        review.bus.emit("event", raw);
      }
      buf = "";
    }
    review.agent = undefined;
    review.status = code === 0 ? "ready" : "errored";
    review.bus.emit("end", { code });
    updateGeneration(genId, (g) => ({
      ...g,
      review: { status: review.status },
    }));
  });

  child.on("error", (err) => {
    const ev = { type: "error", text: String(err?.message ?? err) };
    review.transcript.push(JSON.stringify(ev));
    review.bus.emit("event", ev);
  });

  res.json({ status: "running" });
});

app.get("/api/generations/:id/review/events", (req, res) => {
  const genId = req.params.id;
  const review = reviews.get(genId);

  if (!review) {
    res.status(404).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  for (const line of review.transcript) {
    res.write(`data: ${line}\n\n`);
  }

  if (review.status === "ready" || review.status === "errored") {
    const code = review.status === "ready" ? 0 : 1;
    res.write(`event: end\ndata: ${JSON.stringify({ code })}\n\n`);
    res.end();
    return;
  }

  const onEvent = (ev: any) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  const onEnd = (info: any) => {
    res.write(`event: end\ndata: ${JSON.stringify(info)}\n\n`);
    res.end();
  };
  review.bus.on("event", onEvent);
  review.bus.on("end", onEnd);

  req.on("close", () => {
    review.bus.off("event", onEvent);
    review.bus.off("end", onEnd);
  });
});

// Mount session proxy LAST so /api/* JSON routes above take precedence.
const proxyMiddleware = mountSessionProxy(app);

const PORT = Number(process.env.PORT) || 3001;
const server = http.createServer(app);
attachUpgrade(server, proxyMiddleware);
server.listen(PORT, () => {
  console.log(`ui-builder server listening on http://localhost:${PORT}`);
});

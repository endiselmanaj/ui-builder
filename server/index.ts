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
} from "./contextPrompt.js";
import {
  buildGapRevealPrompt,
  buildCompilePrompt,
  DEFAULT_READINESS_PROMPT,
} from "./readinessPrompt.js";
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
const READINESS_FILE = path.join(DATA_DIR, "readiness.json");
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

app.delete("/api/context/sources/:id", (req, res) => {
  contextLibrary.deleteSource(req.params.id);
  res.json({ ok: true });
});

app.get("/api/context/tiers", (_req, res) => {
  res.json(contextLibrary.readTiers());
});

app.put("/api/context/tiers", (req, res) => {
  const body = req.body as ContextTier[];
  if (!Array.isArray(body) || body.length !== 2) {
    return res.status(400).json({ error: "expected exactly 2 tiers" });
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

  // 1) Resolve tiers → sources, create sessions, install files (fast, sync).
  const prepared = tiers.map((tier) => {
    const sources = tier.sourceIds
      .map((id) => contextLibrary.getSource(id))
      .filter((s): s is ContextSource => s !== null);
    const session = sessionManager.create();
    sessionManager.installContextFiles(
      session.id,
      sources.map((s) => ({
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
    };
  });

  // 2) Boot all Vite servers CONCURRENTLY (true side-by-side start, not sequential).
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
    const bus = sessionManager.runAgent(p.sessionId, fullPrompt, settings);
    const onEnd = (info: any) => {
      bus.off("end", onEnd);
      rollup(info?.code ?? 1);
    };
    bus.on("end", onEnd);
  }

  res.json(gen);
});

// ---------- readiness lab ----------
//
// Part 1 of the workshop: feed the case materials, surface the gaps a builder
// would still have to guess, let a human answer them, then compile a
// downloadable Definition-of-Ready markdown that Context Lab consumes as an
// extra context source. Two throwaway doc-only sessions (no Vite): pass 1
// reveals gaps, pass 2 compiles the doc.

type ReadinessStatus =
  | "reviewing"
  | "awaiting-answers"
  | "compiling"
  | "ready"
  | "errored";

type ReadinessGap = {
  id: string;
  label: string;
  category: "covered" | "implied" | "undecided";
  detail?: string;
  question?: string;
};

type Readiness = {
  id: string;
  createdAt: string;
  status: ReadinessStatus;
  prompt: string;
  sourceIds: string[];
  pass1SessionId: string;
  pass2SessionId?: string;
  gaps?: ReadinessGap[];
  answers?: Record<string, string>;
  error?: string;
};

function readReadiness(): Readiness[] {
  ensureDataDir();
  if (!fs.existsSync(READINESS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(READINESS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeReadiness(all: Readiness[]) {
  ensureDataDir();
  fs.writeFileSync(READINESS_FILE, JSON.stringify(all, null, 2));
}

function updateReadiness(id: string, patch: (r: Readiness) => Readiness) {
  const all = readReadiness();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return;
  all[idx] = patch(all[idx]);
  writeReadiness(all);
}

function installSourcesInto(sessionId: string, sources: ContextSource[]) {
  sessionManager.installContextFiles(
    sessionId,
    sources.map((s) => ({
      slug: slugify(s.label),
      files: s.files.map((name) => ({
        name,
        absPath: path.join(contextLibrary.sourceDir(s.id), name),
      })),
    })),
  );
}

function parseGaps(raw: string | null): ReadinessGap[] | null {
  if (!raw) return null;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    // Tolerate a fenced ```json block if the agent wrapped it.
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!m) return null;
    try {
      data = JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.gaps) ? data.gaps : null;
  if (!arr) return null;
  return arr.map((g: any, i: number): ReadinessGap => {
    const category =
      g?.category === "covered" || g?.category === "implied" ? g.category : "undecided";
    return {
      id: String(g?.id ?? `gap-${i + 1}`),
      label: String(g?.label ?? `Item ${i + 1}`),
      category,
      detail: g?.detail ? String(g.detail) : undefined,
      question: g?.question ? String(g.question) : undefined,
    };
  });
}

// Correct records left mid-flight by a server restart: their session bus is
// gone, so the in-process end listener can never fire.
function reconcileReadiness(): Readiness[] {
  const all = readReadiness();
  let changed = false;
  for (const r of all) {
    if (r.status === "reviewing") {
      const st = sessionManager.status(r.pass1SessionId);
      if (st === "ready" || st === "errored" || st === "stopped") {
        const gaps = parseGaps(sessionManager.readSessionFile(r.pass1SessionId, "gaps.json"));
        if (gaps) {
          r.status = "awaiting-answers";
          r.gaps = gaps;
        } else {
          r.status = "errored";
          r.error = "gap review did not produce gaps.json";
        }
        changed = true;
      }
    } else if (r.status === "compiling" && r.pass2SessionId) {
      const st = sessionManager.status(r.pass2SessionId);
      if (st === "ready" || st === "errored" || st === "stopped") {
        const doc = sessionManager.readSessionFile(r.pass2SessionId, "definition-of-ready.md");
        r.status = doc ? "ready" : "errored";
        if (!doc) r.error = "compile did not produce definition-of-ready.md";
        changed = true;
      }
    }
  }
  if (changed) writeReadiness(all);
  return all;
}

app.get("/api/readiness", (_req, res) => {
  res.json(reconcileReadiness());
});

app.get("/api/readiness/:id", (req, res) => {
  const r = reconcileReadiness().find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  res.json(r);
});

app.post("/api/readiness/start", async (req, res) => {
  const raw = (req.body?.prompt ?? "").toString().trim();
  const prompt = raw.length > 0 ? raw : DEFAULT_READINESS_PROMPT;
  const sourceIds: string[] = Array.isArray(req.body?.sourceIds) ? req.body.sourceIds : [];
  const sources = sourceIds
    .map((id) => contextLibrary.getSource(id))
    .filter((s): s is ContextSource => s !== null);
  if (sources.length === 0) {
    return res.status(400).json({ error: "select at least one context source" });
  }

  const settings = readSettings();
  const session = sessionManager.create();
  installSourcesInto(session.id, sources);

  const readiness: Readiness = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "reviewing",
    prompt,
    sourceIds,
    pass1SessionId: session.id,
  };
  const all = readReadiness();
  all.unshift(readiness);
  writeReadiness(all);

  const bus = sessionManager.runAgent(
    session.id,
    buildGapRevealPrompt({ userPrompt: prompt, sources }),
    settings,
  );
  const onEnd = (info: any) => {
    bus.off("end", onEnd);
    if (info?.code === 0) {
      const gaps = parseGaps(sessionManager.readSessionFile(session.id, "gaps.json"));
      if (gaps) {
        updateReadiness(readiness.id, (r) => ({ ...r, status: "awaiting-answers", gaps }));
        return;
      }
    }
    updateReadiness(readiness.id, (r) => ({
      ...r,
      status: "errored",
      error: "gap review did not produce a valid gaps.json",
    }));
  };
  bus.on("end", onEnd);

  res.json(readiness);
});

app.post("/api/readiness/:id/compile", async (req, res) => {
  const all = readReadiness();
  const readiness = all.find((r) => r.id === req.params.id);
  if (!readiness) return res.status(404).json({ error: "not found" });
  if (readiness.status !== "awaiting-answers") {
    return res.status(409).json({ error: `cannot compile from status "${readiness.status}"` });
  }

  const answers: Record<string, string> =
    req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
  const sources = readiness.sourceIds
    .map((id) => contextLibrary.getSource(id))
    .filter((s): s is ContextSource => s !== null);

  const settings = readSettings();
  const session = sessionManager.create();
  installSourcesInto(session.id, sources);
  sessionManager.writeSessionFile(
    session.id,
    "gaps.json",
    JSON.stringify(readiness.gaps ?? [], null, 2),
  );
  sessionManager.writeSessionFile(session.id, "answers.json", JSON.stringify(answers, null, 2));

  updateReadiness(readiness.id, (r) => ({
    ...r,
    status: "compiling",
    answers,
    pass2SessionId: session.id,
  }));

  const bus = sessionManager.runAgent(
    session.id,
    buildCompilePrompt({ userPrompt: readiness.prompt, sources }),
    settings,
  );
  const onEnd = (info: any) => {
    bus.off("end", onEnd);
    const doc =
      info?.code === 0
        ? sessionManager.readSessionFile(session.id, "definition-of-ready.md")
        : null;
    updateReadiness(readiness.id, (r) => ({
      ...r,
      status: doc ? "ready" : "errored",
      error: doc ? undefined : "compile did not produce definition-of-ready.md",
    }));
  };
  bus.on("end", onEnd);

  res.json({ ...readiness, status: "compiling", answers, pass2SessionId: session.id });
});

app.get("/api/readiness/:id/document", (req, res) => {
  const r = readReadiness().find((x) => x.id === req.params.id);
  if (!r?.pass2SessionId) return res.status(404).json({ error: "not found" });
  const doc = sessionManager.readSessionFile(r.pass2SessionId, "definition-of-ready.md");
  if (doc === null) return res.status(404).json({ error: "document not ready" });
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="definition-of-ready-${r.id}.md"`);
  res.send(doc);
});

app.delete("/api/readiness/:id", async (req, res) => {
  const all = readReadiness();
  const r = all.find((x) => x.id === req.params.id);
  writeReadiness(all.filter((x) => x.id !== req.params.id));
  if (r) {
    await sessionManager.destroy(r.pass1SessionId);
    if (r.pass2SessionId) await sessionManager.destroy(r.pass2SessionId);
  }
  res.json({ ok: true });
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

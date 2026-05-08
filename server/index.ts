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
import type { Settings } from "./types.js";

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

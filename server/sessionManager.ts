import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import getPort from "get-port";
import { runAgent } from "./agentRunner.js";
import type { Settings } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_DIR = path.join(ROOT, "templates", "base");
const SESSIONS_DIR = path.join(ROOT, "data", "sessions");
const SKILLS_DIR = path.join(ROOT, "skills");
const PON_SKILLS_DIR = path.resolve(
  ROOT,
  "..",
  "pon-project-standards",
  "backend",
  ".github",
  "skills",
);

export type SessionStatus =
  | "idle"
  | "starting-vite"
  | "agent-running"
  | "ready"
  | "errored"
  | "stopped";

type SessionMeta = {
  id: string;
  createdAt: string;
  status: SessionStatus;
  port?: number;
};

type Session = {
  id: string;
  dir: string;
  meta: SessionMeta;
  vite?: ChildProcess;
  agent?: ChildProcess;
  bus: EventEmitter;
  // Memoized startVite promise so concurrent callers don't race.
  viteStarting?: Promise<{ port: number }>;
};

class Manager {
  private sessions = new Map<string, Session>();

  constructor() {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    // On boot, scan existing sessions and load metadata. Mark all as stopped;
    // Vite is lazily restarted on first iframe hit.
    for (const id of safeReaddir(SESSIONS_DIR)) {
      const dir = path.join(SESSIONS_DIR, id);
      if (!fs.statSync(dir).isDirectory()) continue;
      const meta = readMeta(dir) ?? {
        id,
        createdAt: new Date().toISOString(),
        status: "stopped",
      };
      meta.status = "stopped";
      meta.port = undefined;
      writeMeta(dir, meta);
      this.sessions.set(id, {
        id,
        dir,
        meta,
        bus: new EventEmitter(),
      });
    }

    // Best-effort cleanup on shutdown.
    process.on("exit", () => this.killAll());
    process.on("SIGINT", () => {
      this.killAll();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      this.killAll();
      process.exit(0);
    });
  }

  create(): { id: string; dir: string } {
    const id = crypto.randomUUID();
    const dir = path.join(SESSIONS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    copyTemplate(TEMPLATE_DIR, dir);
    linkNodeModules(dir);
    fs.mkdirSync(path.join(dir, ".claude", "skills"), { recursive: true });
    const meta: SessionMeta = {
      id,
      createdAt: new Date().toISOString(),
      status: "idle",
    };
    writeMeta(dir, meta);
    this.sessions.set(id, { id, dir, meta, bus: new EventEmitter() });
    return { id, dir };
  }

  installSkills(id: string, skillIds: string[]) {
    const s = this.must(id);
    const target = path.join(s.dir, ".claude", "skills");
    fs.mkdirSync(target, { recursive: true });
    for (const skillId of skillIds) {
      let src: string;
      if (skillId.startsWith("pon--")) {
        const dirName = skillId.slice(5);
        src = path.join(PON_SKILLS_DIR, dirName, "SKILL.md");
      } else {
        const safe = path.basename(skillId);
        src = path.join(SKILLS_DIR, `${safe}.md`);
      }
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(target, `${skillId}.md`));
    }
  }

  async startVite(id: string): Promise<{ port: number }> {
    const s = this.must(id);
    if (s.vite && s.meta.port) return { port: s.meta.port };
    if (s.viteStarting) return s.viteStarting;

    const promise = (async () => {
      this.setStatus(s, "starting-vite");
      const port = await getPort();
      const base = `/api/preview/${s.id}/`;
      const child = spawn(
        "npx",
        [
          "--no-install",
          "vite",
          "--port",
          String(port),
          "--strictPort",
          "--host",
          "127.0.0.1",
          "--base",
          base,
        ],
        {
          cwd: s.dir,
          env: { ...process.env, FORCE_COLOR: "0" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      s.vite = child;

      const ready = new Promise<void>((resolve, reject) => {
        const t = setTimeout(
          () => reject(new Error("vite did not become ready in 30s")),
          30_000,
        );
        const onData = (buf: Buffer) => {
          const txt = buf.toString();
          // Vite prints a "Local:" line once the dev server is ready.
          if (txt.includes("Local:") || txt.includes("ready in")) {
            clearTimeout(t);
            child.stdout?.off("data", onData);
            child.stderr?.off("data", onData);
            resolve();
          }
        };
        child.stdout?.on("data", onData);
        child.stderr?.on("data", onData);
        child.on("exit", (code) => {
          clearTimeout(t);
          reject(new Error(`vite exited early with code ${code}`));
        });
      });

      try {
        await ready;
      } catch (err) {
        try {
          child.kill("SIGTERM");
        } catch {}
        s.vite = undefined;
        this.setStatus(s, "errored");
        throw err;
      }

      s.meta.port = port;
      this.setStatus(s, "ready");
      writeMeta(s.dir, s.meta);

      child.on("exit", () => {
        s.vite = undefined;
        s.meta.port = undefined;
        if (s.meta.status !== "stopped") this.setStatus(s, "stopped");
      });

      return { port };
    })();

    s.viteStarting = promise;
    try {
      return await promise;
    } finally {
      s.viteStarting = undefined;
    }
  }

  proxyTarget(id: string): { port: number } | null {
    const s = this.sessions.get(id);
    if (!s || !s.meta.port) return null;
    return { port: s.meta.port };
  }

  bus(id: string): EventEmitter | null {
    return this.sessions.get(id)?.bus ?? null;
  }

  status(id: string): SessionStatus | null {
    return this.sessions.get(id)?.meta.status ?? null;
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  runAgent(id: string, fullPrompt: string, settings: Settings): EventEmitter {
    const s = this.must(id);
    this.setStatus(s, "agent-running");
    const ee = runAgent({ cwd: s.dir, prompt: fullPrompt, settings });
    s.agent = (ee as any).child as ChildProcess | undefined;

    const transcriptPath = path.join(s.dir, "transcript.jsonl");
    const transcriptStream = fs.createWriteStream(transcriptPath, {
      flags: "a",
    });

    ee.on("event", (ev: any) => {
      try {
        transcriptStream.write(JSON.stringify(ev) + "\n");
      } catch {}
      s.bus.emit("event", ev);
    });
    ee.on("end", (info: any) => {
      try {
        transcriptStream.end();
      } catch {}
      s.agent = undefined;
      this.setStatus(s, info?.code === 0 ? "ready" : "errored");
      s.bus.emit("end", info);
    });
    ee.on("error", (err: any) => {
      s.bus.emit("event", { type: "error", text: String(err?.message ?? err) });
    });

    return s.bus;
  }

  async stop(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (!s) return;
    if (s.agent) {
      try {
        s.agent.kill("SIGTERM");
      } catch {}
      s.agent = undefined;
    }
    if (s.vite) {
      try {
        s.vite.kill("SIGTERM");
      } catch {}
      s.vite = undefined;
    }
    s.meta.port = undefined;
    this.setStatus(s, "stopped");
    writeMeta(s.dir, s.meta);
  }

  getSessionFiles(id: string): Record<string, string> {
    const s = this.must(id);
    const srcDir = path.join(s.dir, "src");
    const files: Record<string, string> = {};
    function walk(dir: string, prefix: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "main.tsx") continue;
        const rel = prefix + entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, rel + "/");
        else if (/\.(tsx?|css|json)$/.test(entry.name)) {
          files[rel] = fs.readFileSync(full, "utf-8");
        }
      }
    }
    if (fs.existsSync(srcDir)) walk(srcDir, "src/");
    return files;
  }

  getSessionSkillFiles(id: string): Record<string, string> {
    const s = this.must(id);
    const skillsDir = path.join(s.dir, ".claude", "skills");
    const files: Record<string, string> = {};
    if (!fs.existsSync(skillsDir)) return files;
    for (const f of fs.readdirSync(skillsDir)) {
      if (!f.endsWith(".md")) continue;
      files[f] = fs.readFileSync(path.join(skillsDir, f), "utf-8");
    }
    return files;
  }

  async destroy(id: string): Promise<void> {
    await this.stop(id);
    const s = this.sessions.get(id);
    if (!s) return;
    try {
      fs.rmSync(s.dir, { recursive: true, force: true });
    } catch {}
    this.sessions.delete(id);
  }

  private setStatus(s: Session, status: SessionStatus) {
    s.meta.status = status;
    writeMeta(s.dir, s.meta);
  }

  private must(id: string): Session {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`unknown session: ${id}`);
    return s;
  }

  private killAll() {
    for (const s of this.sessions.values()) {
      try {
        s.vite?.kill("SIGTERM");
      } catch {}
      try {
        s.agent?.kill("SIGTERM");
      } catch {}
    }
  }
}

function copyTemplate(src: string, dest: string) {
  // Recursive copy excluding node_modules, dist, .git, .DS_Store.
  const skip = new Set(["node_modules", "dist", ".git", ".DS_Store"]);
  function walk(from: string, to: string) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const fromPath = path.join(from, entry.name);
      const toPath = path.join(to, entry.name);
      if (entry.isDirectory()) walk(fromPath, toPath);
      else if (entry.isFile()) fs.copyFileSync(fromPath, toPath);
    }
  }
  walk(src, dest);
}

function linkNodeModules(sessionDir: string) {
  const link = path.join(sessionDir, "node_modules");
  const target = path.join(TEMPLATE_DIR, "node_modules");
  if (!fs.existsSync(target)) {
    throw new Error(
      `templates/base/node_modules missing — run 'npm --prefix templates/base install' first`,
    );
  }
  if (fs.existsSync(link)) return;
  fs.symlinkSync(target, link, "dir");
}

function readMeta(dir: string): SessionMeta | null {
  try {
    const raw = fs.readFileSync(path.join(dir, ".meta.json"), "utf-8");
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

function writeMeta(dir: string, meta: SessionMeta) {
  try {
    fs.writeFileSync(path.join(dir, ".meta.json"), JSON.stringify(meta, null, 2));
  } catch {}
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

export const sessionManager = new Manager();
export type { Session };

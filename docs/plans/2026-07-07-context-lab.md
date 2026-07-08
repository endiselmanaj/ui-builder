# Context Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new "Context Lab" mode in UI Builder that runs three concurrent agent generations from the same terse prompt but with cumulatively richer context (Briefing → +Schematic → +Figma-live-browse), shown side by side, to demonstrate how preparation quality shapes AI output.

**Architecture:** A reusable Context Library (`data/context/`) stores uploaded file sources and URL sources; three fixed tiers reference source IDs. One click creates 3 sandbox sessions (existing sessionManager), copies each tier's files into `<session>/context/`, and spawns 3 concurrent `claude -p` agents. The Figma tier's agent gets `--chrome` (empirically validated: headless `claude -p --chrome` reaches the claude-in-chrome extension MCP and can drive the user's real, Figma-logged-in Chrome). Existing SSE/preview-proxy infrastructure is reused unchanged.

**Tech Stack:** Express + tsx (server), React 18 + react-router 7 + vitest/testing-library (client), `claude` CLI headless (NOT the Agent SDK — SDK forbids subscription OAuth for third-party apps), multer for uploads, claude-in-chrome MCP for live Figma browsing.

## Global Constraints

- **Stay on CLI spawning** (`spawn("claude", ["-p", ...])`). Do not migrate to `@anthropic-ai/claude-agent-sdk` (subscription-auth ToS blocker).
- **No `--bare`** — breaks subscription/OAuth auth (existing CLAUDE.md rule).
- **Chrome-enabled agent runs must NOT pass `--tools`** — a `--tools "Edit,Write,Read,Bash"` allowlist excludes the built-in `Skill`/`ToolSearch` tools that the agent needs to load the deferred `mcp__claude-in-chrome__*` browser tools. Dropping `--tools` gives the full default built-in set (Edit/Write/Read/Bash **plus** Skill/ToolSearch), so the agent can both browse and write files. (Validated: default-toolset headless run connected; the agent used Skill+ToolSearch to load the browser tools.)
- **Chrome permission mode:** chrome runs use the same `--permission-mode` as the app (default `acceptEdits`). If browser MCP calls are denied non-interactively (stdin is closed), fall back to `bypassPermissions` OR add `--allowedTools "mcp__claude-in-chrome__*"`. Task 9 verifies the exact production flag set drives Chrome end-to-end, not just that `--chrome` connects.
- **Single-chrome mutex (enforced in code, not just discipline):** only ONE chrome-enabled agent may run at a time (the extension is a single serial channel). The generate route MUST reject with `409` while any context generation that has a url source is still `running`. Only tier 3 uses chrome.
- **Uploaded files are trusted local workshop assets only.** The agent has Bash and reads every context file as source of truth, so an untrusted PDF/XML is a prompt-injection vector. Enforce a server-side file-extension allowlist on upload; do not expose this mode to untrusted users (consistent with CLAUDE.md known-gap #4).
- The held-constant experiment variables: all tiers share one prompt, one model, no skills. Only sources differ.
- **Model reality:** `DEFAULT_SETTINGS.model` in `server/index.ts` is currently `"opus"` (CLAUDE.md's "sonnet default" is stale). All tiers run on whatever `readSettings()` returns, i.e. opus by default — factor this into the wall-clock estimate (the Figma tier is the slow path).
- Nav label: **"Context Lab"**. Page subtitle: *"Same prompt, same model — only the preparation differs."* Tier labels: **"Briefing only" / "Briefing + Schematic" / "Briefing + Schematic + Figma"**.
- Default preset prompt (exact copy): `Build the car trade-in value request tool described in the provided context materials. Implement the full customer-facing flow as a working web app.`
- Server tests use vitest at repo root against real temp dirs (no fs mocking — testing.md rules). Client tests colocated `*.test.tsx` as today.
- ESM: server imports use `.js` specifiers by convention. Module resolution is `"Bundler"` (`server/tsconfig.json`, run via `tsx`), not NodeNext; vitest/vite resolve the `.js`→`.ts` mapping. Run `npx vitest run server` after Task 1 to confirm resolution empirically (no server tests exist in the repo yet).
- `data/` stays gitignored — seeds live in `data/context-seeds/` locally, never committed.

---

### Task 1: Context types + Context Library module (sources, tiers, seeding)

**Files:**
- Modify: `package.json` (root — add vitest, multer deps)
- Modify: `server/types.ts`
- Create: `server/contextLibrary.ts`
- Test: `server/contextLibrary.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Types `ContextSource { id, label, kind: "file"|"url", files: string[], urls?: string[], instructions?: string, createdAt: string }`, `ContextTier { id, label, sourceIds: string[] }` (exported from `server/types.ts`).
  - `createContextLibrary(dataDir: string)` returning `{ listSources(): ContextSource[]; getSource(id): ContextSource | null; createFileSource(label, files: {name: string; buffer: Buffer}[]): ContextSource; createUrlSource(label, urls: string[], instructions?: string): ContextSource; deleteSource(id): void; sourceDir(id): string; readTiers(): ContextTier[]; writeTiers(tiers: ContextTier[]): ContextTier[]; ensureSeeds(): void }`.
  - Default singleton `contextLibrary` bound to `<repo>/data`.

- [ ] **Step 1: Install deps and add root test script**

```bash
npm install multer && npm install -D @types/multer vitest
```

In root `package.json` scripts add:

```json
"test:server": "vitest run server"
```

- [ ] **Step 2: Add types to `server/types.ts`** (append below `Settings`)

```ts
export type ContextSourceKind = "file" | "url";

export type ContextSource = {
  id: string;
  label: string;
  kind: ContextSourceKind;
  /** filenames inside the source dir (kind=file) */
  files: string[];
  /** prototype/design URLs to browse live (kind=url) */
  urls?: string[];
  /** extra prompt guidance injected verbatim for this source */
  instructions?: string;
  createdAt: string;
};

export type ContextTier = {
  id: string;
  label: string;
  sourceIds: string[];
};
```

- [ ] **Step 3: Write the failing tests** — `server/contextLibrary.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createContextLibrary } from "./contextLibrary.js";

let dataDir: string;
let lib: ReturnType<typeof createContextLibrary>;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctxlib-"));
  lib = createContextLibrary(dataDir);
});

describe("file sources", () => {
  it("createFileSource persists files to disk and lists the source", () => {
    const src = lib.createFileSource("Briefing document", [
      { name: "briefing.pdf", buffer: Buffer.from("pdfbytes") },
    ]);
    expect(src.kind).toBe("file");
    expect(src.files).toEqual(["briefing.pdf"]);
    const onDisk = fs.readFileSync(
      path.join(lib.sourceDir(src.id), "briefing.pdf"),
    );
    expect(onDisk.toString()).toBe("pdfbytes");
    expect(lib.listSources().map((s) => s.id)).toContain(src.id);
  });

  it("survives a fresh library instance (reads meta from disk)", () => {
    const src = lib.createFileSource("Schematic", [
      { name: "a.xml", buffer: Buffer.from("<x/>") },
    ]);
    const lib2 = createContextLibrary(dataDir);
    expect(lib2.getSource(src.id)?.label).toBe("Schematic");
  });
});

describe("url sources", () => {
  it("createUrlSource stores urls and instructions", () => {
    const src = lib.createUrlSource(
      "Figma design",
      ["https://figma.com/proto/x", "https://figma.com/proto/y"],
      "Click through every screen.",
    );
    expect(src.kind).toBe("url");
    expect(src.urls).toHaveLength(2);
    expect(lib.getSource(src.id)?.instructions).toBe(
      "Click through every screen.",
    );
  });
});

describe("tiers", () => {
  it("readTiers returns the three default tiers when unset", () => {
    const tiers = lib.readTiers();
    expect(tiers.map((t) => t.label)).toEqual([
      "Briefing only",
      "Briefing + Schematic",
      "Briefing + Schematic + Figma",
    ]);
    expect(tiers.every((t) => t.sourceIds.length === 0)).toBe(true);
  });

  it("writeTiers persists and deleteSource strips the id from tiers", () => {
    const src = lib.createFileSource("Briefing document", [
      { name: "b.pdf", buffer: Buffer.from("x") },
    ]);
    const tiers = lib.readTiers();
    tiers[0].sourceIds = [src.id];
    lib.writeTiers(tiers);
    expect(lib.readTiers()[0].sourceIds).toEqual([src.id]);
    lib.deleteSource(src.id);
    expect(lib.readTiers()[0].sourceIds).toEqual([]);
    expect(lib.getSource(src.id)).toBeNull();
  });
});

describe("seeding", () => {
  it("ensureSeeds imports sources from seed.json and wires tiers by label", () => {
    const seedsDir = path.join(dataDir, "context-seeds");
    fs.mkdirSync(seedsDir, { recursive: true });
    fs.writeFileSync(path.join(seedsDir, "briefing.pdf"), "pdf");
    fs.writeFileSync(
      path.join(seedsDir, "seed.json"),
      JSON.stringify({
        sources: [
          { label: "Briefing document", kind: "file", files: ["briefing.pdf"] },
          {
            label: "Figma design",
            kind: "url",
            urls: ["https://figma.com/proto/x"],
            instructions: "Browse it.",
          },
        ],
        tiers: {
          "tier-1": ["Briefing document"],
          "tier-2": ["Briefing document"],
          "tier-3": ["Briefing document", "Figma design"],
        },
      }),
    );
    lib.ensureSeeds();
    const labels = lib.listSources().map((s) => s.label);
    expect(labels).toContain("Briefing document");
    expect(labels).toContain("Figma design");
    const tiers = lib.readTiers();
    expect(tiers[0].sourceIds).toHaveLength(1);
    expect(tiers[2].sourceIds).toHaveLength(2);
    // Idempotent: running again must not duplicate.
    lib.ensureSeeds();
    expect(lib.listSources()).toHaveLength(2);
  });

  it("ensureSeeds is a no-op without a seeds dir", () => {
    expect(() => lib.ensureSeeds()).not.toThrow();
    expect(lib.listSources()).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run server/contextLibrary.test.ts`
Expected: FAIL — `Cannot find module './contextLibrary.js'`

- [ ] **Step 5: Implement `server/contextLibrary.ts`**

```ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import type { ContextSource, ContextTier } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "..", "data");

const DEFAULT_TIERS: ContextTier[] = [
  { id: "tier-1", label: "Briefing only", sourceIds: [] },
  { id: "tier-2", label: "Briefing + Schematic", sourceIds: [] },
  { id: "tier-3", label: "Briefing + Schematic + Figma", sourceIds: [] },
];

type SeedConfig = {
  sources: Array<{
    label: string;
    kind: "file" | "url";
    files?: string[];
    urls?: string[];
    instructions?: string;
  }>;
  tiers?: Record<string, string[]>; // tierId -> source labels
};

export function createContextLibrary(dataDir: string) {
  const sourcesDir = path.join(dataDir, "context", "sources");
  const tiersFile = path.join(dataDir, "context", "tiers.json");
  const seedsDir = path.join(dataDir, "context-seeds");

  function metaPath(id: string) {
    return path.join(sourcesDir, id, "meta.json");
  }

  function readMeta(id: string): ContextSource | null {
    try {
      return JSON.parse(fs.readFileSync(metaPath(id), "utf-8"));
    } catch {
      return null;
    }
  }

  function writeMeta(src: ContextSource) {
    fs.mkdirSync(path.join(sourcesDir, src.id), { recursive: true });
    fs.writeFileSync(metaPath(src.id), JSON.stringify(src, null, 2));
  }

  function listSources(): ContextSource[] {
    let ids: string[];
    try {
      ids = fs.readdirSync(sourcesDir);
    } catch {
      return [];
    }
    return ids
      .map(readMeta)
      .filter((s): s is ContextSource => s !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function getSource(id: string): ContextSource | null {
    return readMeta(id);
  }

  function sourceDir(id: string): string {
    return path.join(sourcesDir, id);
  }

  function createFileSource(
    label: string,
    files: { name: string; buffer: Buffer }[],
  ): ContextSource {
    const src: ContextSource = {
      id: crypto.randomUUID(),
      label,
      kind: "file",
      files: files.map((f) => path.basename(f.name)),
      createdAt: new Date().toISOString(),
    };
    writeMeta(src);
    for (const f of files) {
      fs.writeFileSync(path.join(sourceDir(src.id), path.basename(f.name)), f.buffer);
    }
    return src;
  }

  function createUrlSource(
    label: string,
    urls: string[],
    instructions?: string,
  ): ContextSource {
    const src: ContextSource = {
      id: crypto.randomUUID(),
      label,
      kind: "url",
      files: [],
      urls,
      instructions,
      createdAt: new Date().toISOString(),
    };
    writeMeta(src);
    return src;
  }

  function deleteSource(id: string) {
    fs.rmSync(sourceDir(id), { recursive: true, force: true });
    const tiers = readTiers().map((t) => ({
      ...t,
      sourceIds: t.sourceIds.filter((sid) => sid !== id),
    }));
    writeTiers(tiers);
  }

  function readTiers(): ContextTier[] {
    try {
      const stored = JSON.parse(fs.readFileSync(tiersFile, "utf-8"));
      if (Array.isArray(stored) && stored.length === 3) return stored;
    } catch {}
    return DEFAULT_TIERS.map((t) => ({ ...t, sourceIds: [...t.sourceIds] }));
  }

  function writeTiers(tiers: ContextTier[]): ContextTier[] {
    fs.mkdirSync(path.dirname(tiersFile), { recursive: true });
    fs.writeFileSync(tiersFile, JSON.stringify(tiers, null, 2));
    return tiers;
  }

  function ensureSeeds() {
    const seedFile = path.join(seedsDir, "seed.json");
    if (!fs.existsSync(seedFile)) return;
    let cfg: SeedConfig;
    try {
      cfg = JSON.parse(fs.readFileSync(seedFile, "utf-8"));
    } catch {
      return;
    }
    const existingLabels = new Set(listSources().map((s) => s.label));
    const byLabel = new Map<string, ContextSource>();
    for (const s of listSources()) byLabel.set(s.label, s);

    for (const seed of cfg.sources ?? []) {
      if (existingLabels.has(seed.label)) continue;
      if (seed.kind === "file") {
        const files = (seed.files ?? [])
          .map((name) => {
            const p = path.join(seedsDir, name);
            if (!fs.existsSync(p)) return null;
            return { name, buffer: fs.readFileSync(p) };
          })
          .filter((f): f is { name: string; buffer: Buffer } => f !== null);
        if (files.length === 0) continue;
        byLabel.set(seed.label, createFileSource(seed.label, files));
      } else {
        if (!seed.urls || seed.urls.length === 0) continue;
        byLabel.set(
          seed.label,
          createUrlSource(seed.label, seed.urls, seed.instructions),
        );
      }
    }

    if (cfg.tiers) {
      const tiers = readTiers().map((t) => {
        const labels = cfg.tiers![t.id];
        if (!labels) return t;
        const ids = labels
          .map((l) => byLabel.get(l)?.id)
          .filter((id): id is string => !!id);
        // Only overwrite an empty tier — never clobber a presenter's edits.
        return t.sourceIds.length === 0 ? { ...t, sourceIds: ids } : t;
      });
      writeTiers(tiers);
    }
  }

  return {
    listSources,
    getSource,
    createFileSource,
    createUrlSource,
    deleteSource,
    sourceDir,
    readTiers,
    writeTiers,
    ensureSeeds,
  };
}

export const contextLibrary = createContextLibrary(DEFAULT_DATA_DIR);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run server/contextLibrary.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json server/types.ts server/contextLibrary.ts server/contextLibrary.test.ts
git commit -m "feat(context-lab): context library — sources, tiers, seeding"
```

---

### Task 2: Context prompt builder

**Files:**
- Create: `server/contextPrompt.ts`
- Test: `server/contextPrompt.test.ts`
- Modify: `server/agentRunner.ts` (export shared base-prompt lines)

**Interfaces:**
- Consumes: `ContextSource` from `server/types.ts`; `PROJECT_BASE_LINES` from `server/agentRunner.ts`.
- Produces:
  - `DEFAULT_CONTEXT_PROMPT: string`
  - `buildContextAgentPrompt(opts: { userPrompt: string; sources: ContextSource[] }): string`
  - `slugify(label: string): string` — also used by Task 4 for context dir names.
  - `sourceNeedsChrome(sources: ContextSource[]): boolean`

- [ ] **Step 1: Extract shared base lines in `server/agentRunner.ts`**

Add above `buildAgentPrompt` (content copied verbatim from the existing prompt so behavior is unchanged):

```ts
// Shared base sections between the skills-mode prompt and the context-lab
// prompt. Keep in sync with the session template.
export const PROJECT_BASE_LINES = [
  "You are a coding agent in a Vite + React + TypeScript + Tailwind v4 project at the current working directory.",
  "The dev server is running and HMR is live; edits to files in src/ show in the user's preview iframe immediately.",
  "",
  "# Project layout",
  "- src/main.tsx mounts <App /> from src/App.tsx — do not touch main.tsx.",
  "- src/App.tsx is your entry; replace its contents with your design.",
  "- Add components under src/components/. Use src/lib/cn.ts for class merging.",
  "- Tailwind v4 is set up via @tailwindcss/vite — use utility classes freely.",
  "- index.html and vite.config.ts are owned by the harness — don't touch them.",
  "",
  "# Pre-installed packages (use any of these freely)",
  "- react, react-dom",
  "- clsx, tailwind-merge (cn helper at src/lib/cn.ts)",
  "- recharts",
  "- react-hook-form, zod, @hookform/resolvers",
  "- lucide-react (icons)",
  "",
  "Do NOT run `npm install`. The shared node_modules is read-only across sessions; if you need a package that isn't preinstalled, work around it with the available libraries.",
];
```

Then replace the shared leading project/package block inside `buildAgentPrompt` (the run from the `"You are a coding agent..."` line down through the `"Do NOT run \`npm install\`..."` line — `server/agentRunner.ts:169-186`) with `...PROJECT_BASE_LINES,`. The `""` + `"# Skills loaded..."` lines that follow (line 187 onward) stay untouched. The returned string must be byte-identical to before — verify by eye.

- [ ] **Step 2: Write the failing tests** — `server/contextPrompt.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  buildContextAgentPrompt,
  DEFAULT_CONTEXT_PROMPT,
  slugify,
  sourceNeedsChrome,
} from "./contextPrompt.js";
import type { ContextSource } from "./types.js";

const briefing: ContextSource = {
  id: "s1",
  label: "Briefing document",
  kind: "file",
  files: ["briefing.pdf"],
  createdAt: "2026-01-01T00:00:00.000Z",
};
const figma: ContextSource = {
  id: "s2",
  label: "Figma design",
  kind: "url",
  files: [],
  urls: ["https://www.figma.com/proto/abc", "https://www.figma.com/proto/def"],
  instructions: "Prototype has desktop and mobile variants.",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("buildContextAgentPrompt", () => {
  it("lists file sources with their in-session paths", () => {
    const p = buildContextAgentPrompt({ userPrompt: "Build it", sources: [briefing] });
    expect(p).toContain("context/briefing-document/briefing.pdf");
    expect(p).toContain("Build it");
  });

  it("omits the browsing section when no url sources are present", () => {
    const p = buildContextAgentPrompt({ userPrompt: "x", sources: [briefing] });
    expect(p).not.toContain("Design references");
    expect(p).not.toContain("claude-in-chrome");
  });

  it("includes browse workflow, urls, cap, retry and per-source instructions for url sources", () => {
    const p = buildContextAgentPrompt({ userPrompt: "x", sources: [briefing, figma] });
    expect(p).toContain("https://www.figma.com/proto/abc");
    expect(p).toContain("https://www.figma.com/proto/def");
    expect(p).toContain("max 10 screenshots per URL");
    expect(p).toContain("retry once");
    expect(p).toContain("Prototype has desktop and mobile variants.");
  });

  it("shares the base project layout with the skills prompt", () => {
    const p = buildContextAgentPrompt({ userPrompt: "x", sources: [briefing] });
    expect(p).toContain("src/App.tsx is your entry");
    expect(p).toContain("Do NOT run `npm install`");
  });
});

describe("helpers", () => {
  it("slugify produces safe dir names", () => {
    expect(slugify("Briefing document")).toBe("briefing-document");
    expect(slugify("  Figma / Design!! ")).toBe("figma-design");
  });

  it("sourceNeedsChrome is true iff a url source is present", () => {
    expect(sourceNeedsChrome([briefing])).toBe(false);
    expect(sourceNeedsChrome([briefing, figma])).toBe(true);
  });
});

describe("DEFAULT_CONTEXT_PROMPT", () => {
  it("is the terse preset", () => {
    expect(DEFAULT_CONTEXT_PROMPT).toBe(
      "Build the car trade-in value request tool described in the provided context materials. Implement the full customer-facing flow as a working web app.",
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server/contextPrompt.test.ts`
Expected: FAIL — `Cannot find module './contextPrompt.js'`

- [ ] **Step 4: Implement `server/contextPrompt.ts`**

```ts
import type { ContextSource } from "./types.js";
import { PROJECT_BASE_LINES } from "./agentRunner.js";

export const DEFAULT_CONTEXT_PROMPT =
  "Build the car trade-in value request tool described in the provided context materials. Implement the full customer-facing flow as a working web app.";

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sourceNeedsChrome(sources: ContextSource[]): boolean {
  return sources.some((s) => s.kind === "url");
}

export function buildContextAgentPrompt(opts: {
  userPrompt: string;
  sources: ContextSource[];
}): string {
  const fileSources = opts.sources.filter((s) => s.kind === "file");
  const urlSources = opts.sources.filter((s) => s.kind === "url");

  const lines: string[] = [...PROJECT_BASE_LINES, ""];

  lines.push(
    "# Context materials",
    "Reference documents for this build are in ./context/. They are the source of truth for scope, flow, wording, and design. Read EVERY file below fully (one Read call per file) before planning:",
  );
  if (fileSources.length === 0) {
    lines.push("_(no context files provided — use your best judgment)_");
  }
  for (const src of fileSources) {
    for (const f of src.files) {
      lines.push(`- context/${slugify(src.label)}/${f} (${src.label})`);
    }
    if (src.instructions) lines.push(`  - Note: ${src.instructions}`);
  }
  lines.push("");

  if (urlSources.length > 0) {
    lines.push(
      "# Design references (browse live)",
      "The visual design lives at the URLs below. Use the claude-in-chrome browser MCP tools to view it BEFORE writing any code:",
      "0. The browser tools are deferred. If a claude-in-chrome tool is not directly callable, first load it with ToolSearch (query: \"select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp\").",
      "1. Call mcp__claude-in-chrome__tabs_context_mcp with createIfEmpty: true, then create a fresh tab with tabs_create_mcp.",
      "2. Navigate to each URL. Figma prototypes advance on click — click through EVERY screen of the flow.",
      "3. Take a screenshot of each distinct screen so you can reference layout, colors, spacing, and copy (max 10 screenshots per URL).",
      "4. If a browser tool fails because the extension is not connected, wait 5 seconds and retry once. If it still fails, continue without design references and say so clearly in your final summary.",
      "5. If a URL shows a login screen, a permission wall, or a 'you need access' page instead of the design, DO NOT build from it — that is not the design. Continue without design references for that URL and say so clearly in your final summary.",
      "",
      "URLs:",
    );
    for (const src of urlSources) {
      for (const u of src.urls ?? []) {
        lines.push(`- ${u} (${src.label})`);
      }
      if (src.instructions) lines.push(`  - Note: ${src.instructions}`);
    }
    lines.push(
      "",
      "Match your implementation to what you saw: layout, colors, spacing, typography, and copy.",
    );
    lines.push("");
  }

  lines.push(
    "# Task",
    opts.userPrompt,
    "",
    "# Workflow",
    "1. Read ALL context files listed above.",
  );
  if (urlSources.length > 0) {
    lines.push("2. Browse the design reference URLs and capture screenshots.");
    lines.push(
      "3. Plan: map every requirement and process step found in the context onto screens and components.",
      "4. Use Edit/Write to author src/App.tsx and helper components.",
      "5. Final assistant message: one paragraph on what you built and which context materials informed which decisions.",
    );
  } else {
    lines.push(
      "2. Plan: map every requirement and process step found in the context onto screens and components.",
      "3. Use Edit/Write to author src/App.tsx and helper components.",
      "4. Final assistant message: one paragraph on what you built and which context materials informed which decisions.",
    );
  }
  lines.push(
    "",
    "Don't run dev servers, builds, or git commands. The user already has Vite running.",
  );

  return lines.join("\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/contextPrompt.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Sanity-check the skills prompt refactor**

Run: `npx vitest run server && cd client && npx vitest run && cd ..`
Expected: all PASS (client suite unaffected).

- [ ] **Step 7: Commit**

```bash
git add server/contextPrompt.ts server/contextPrompt.test.ts server/agentRunner.ts
git commit -m "feat(context-lab): context prompt builder with live-browse workflow"
```

---

### Task 3: Chrome flag support in agent spawning

**Files:**
- Modify: `server/agentRunner.ts` (`buildAgentArgs`, `AgentOptions`, `runAgent`)
- Modify: `server/sessionManager.ts` (`runAgent` signature)
- Test: `server/agentRunner.test.ts` (new)

**Interfaces:**
- Consumes: existing `Settings`.
- Produces:
  - `buildAgentArgs(settings: Settings, prompt: string, opts?: { chrome?: boolean }): string[]`
  - `runAgent(opts: AgentOptions)` where `AgentOptions` gains `chrome?: boolean`
  - `sessionManager.runAgent(id, fullPrompt, settings, opts?: { chrome?: boolean })`

- [ ] **Step 1: Write the failing tests** — `server/agentRunner.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildAgentArgs } from "./agentRunner.js";
import type { Settings } from "./types.js";

const settings: Settings = {
  model: "opus",
  effort: "",
  maxBudgetUsd: null,
  permissionMode: "acceptEdits",
  tools: "Edit,Write,Read,Bash",
  appendSystemPrompt: "",
  bare: false,
};

describe("buildAgentArgs", () => {
  it("default run restricts tools and has no --chrome", () => {
    const args = buildAgentArgs(settings, "hi");
    expect(args).toContain("--tools");
    expect(args).not.toContain("--chrome");
  });

  it("chrome run adds --chrome and drops the --tools restriction", () => {
    const args = buildAgentArgs(settings, "hi", { chrome: true });
    expect(args).toContain("--chrome");
    // Browser MCP tools are deferred and loaded via ToolSearch; a --tools
    // allowlist would exclude them (validated empirically).
    expect(args).not.toContain("--tools");
  });

  it("chrome run keeps model/permission flags", () => {
    const args = buildAgentArgs(settings, "hi", { chrome: true });
    expect(args).toContain("--model");
    expect(args).toContain("--permission-mode");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/agentRunner.test.ts`
Expected: FAIL — chrome test: `expected [...] to contain '--chrome'`

- [ ] **Step 3: Implement**

In `server/agentRunner.ts`:

```ts
export type AgentOptions = {
  cwd: string;
  prompt: string;
  settings: Settings;
  /** attach the claude-in-chrome browser (drops --tools so MCP tools load) */
  chrome?: boolean;
};
```

In `buildAgentArgs`, change the signature to `(settings: Settings, prompt: string, opts?: { chrome?: boolean })` and replace the `--tools` push block with:

```ts
  if (opts?.chrome) {
    // Chrome runs need the full default toolset. A --tools "Edit,Write,Read,Bash"
    // allowlist would exclude the built-in Skill/ToolSearch tools, which the
    // agent uses to load the deferred mcp__claude-in-chrome__* browser tools.
    // Omitting --tools yields all built-ins (incl. Edit/Write/Read/Bash), so the
    // agent can browse AND write files.
    args.push("--chrome");
  } else {
    const tools =
      settings.tools && settings.tools.trim().length > 0
        ? settings.tools
        : "Edit,Write,Read,Bash";
    args.push("--tools", tools);
  }
```

In `runAgent`, pass through: `const args = buildAgentArgs(opts.settings, opts.prompt, { chrome: opts.chrome });`

In `server/sessionManager.ts`, change:

```ts
  runAgent(
    id: string,
    fullPrompt: string,
    settings: Settings,
    opts?: { chrome?: boolean },
  ): EventEmitter {
    const s = this.must(id);
    this.setStatus(s, "agent-running");
    const ee = runAgent({
      cwd: s.dir,
      prompt: fullPrompt,
      settings,
      chrome: opts?.chrome,
    });
```

(rest of the method unchanged).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server`
Expected: PASS (all server tests, including Tasks 1–2 suites)

- [ ] **Step 5: Commit**

```bash
git add server/agentRunner.ts server/agentRunner.test.ts server/sessionManager.ts
git commit -m "feat(context-lab): --chrome agent runs with unrestricted toolset"
```

---

### Task 4: Copy context files into sessions

**Files:**
- Create: `server/contextFiles.ts` (pure, testable copy helper)
- Test: `server/contextFiles.test.ts`
- Modify: `server/sessionManager.ts` (new method `installContextFiles` delegating to the helper)

**Interfaces:**
- Consumes: `slugify` naming convention from Task 2 (caller passes pre-built slugs).
- Produces:
  - `type ContextInstallEntry = { slug: string; files: { name: string; absPath: string }[] }`
  - `copyContextEntries(destBaseDir: string, entries: ContextInstallEntry[]): void` — creates `<destBaseDir>/context/<slug>/<name>` for each existing file; skips missing sources.
  - `sessionManager.installContextFiles(id: string, entries: ContextInstallEntry[]): void` — resolves the session dir and delegates to `copyContextEntries`.

The pure helper is what carries the test cycle; the manager method is a one-line adapter (covered end-to-end in Task 9). This gives Task 4 an independently-testable deliverable.

- [ ] **Step 1: Write the failing test** — `server/contextFiles.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { copyContextEntries } from "./contextFiles.js";

let base: string;
let srcDir: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "ctxfiles-dest-"));
  srcDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctxfiles-src-"));
});

describe("copyContextEntries", () => {
  it("copies each file into context/<slug>/<name>", () => {
    fs.writeFileSync(path.join(srcDir, "briefing.pdf"), "PDF");
    fs.writeFileSync(path.join(srcDir, "proc.xml"), "<x/>");
    copyContextEntries(base, [
      {
        slug: "briefing-document",
        files: [{ name: "briefing.pdf", absPath: path.join(srcDir, "briefing.pdf") }],
      },
      {
        slug: "process-schematic",
        files: [{ name: "proc.xml", absPath: path.join(srcDir, "proc.xml") }],
      },
    ]);
    expect(
      fs.readFileSync(path.join(base, "context", "briefing-document", "briefing.pdf"), "utf-8"),
    ).toBe("PDF");
    expect(
      fs.readFileSync(path.join(base, "context", "process-schematic", "proc.xml"), "utf-8"),
    ).toBe("<x/>");
  });

  it("skips missing source files without throwing", () => {
    expect(() =>
      copyContextEntries(base, [
        { slug: "x", files: [{ name: "gone.pdf", absPath: path.join(srcDir, "gone.pdf") }] },
      ]),
    ).not.toThrow();
    expect(fs.existsSync(path.join(base, "context", "x", "gone.pdf"))).toBe(false);
  });

  it("uses basename to avoid path traversal in the file name", () => {
    fs.writeFileSync(path.join(srcDir, "evil.pdf"), "E");
    copyContextEntries(base, [
      { slug: "s", files: [{ name: "../../evil.pdf", absPath: path.join(srcDir, "evil.pdf") }] },
    ]);
    expect(fs.existsSync(path.join(base, "context", "s", "evil.pdf"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/contextFiles.test.ts`
Expected: FAIL — `Cannot find module './contextFiles.js'`

- [ ] **Step 3: Implement `server/contextFiles.ts`**

```ts
import fs from "fs";
import path from "path";

export type ContextInstallEntry = {
  slug: string;
  files: { name: string; absPath: string }[];
};

export function copyContextEntries(
  destBaseDir: string,
  entries: ContextInstallEntry[],
): void {
  for (const entry of entries) {
    const dir = path.join(destBaseDir, "context", entry.slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of entry.files) {
      if (!fs.existsSync(f.absPath)) continue;
      fs.copyFileSync(f.absPath, path.join(dir, path.basename(f.name)));
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/contextFiles.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the manager adapter** (below `installSkills` in the `Manager` class of `server/sessionManager.ts`)

Add import at top: `import { copyContextEntries, type ContextInstallEntry } from "./contextFiles.js";`

```ts
  installContextFiles(id: string, entries: ContextInstallEntry[]) {
    const s = this.must(id);
    copyContextEntries(s.dir, entries);
  }
```

- [ ] **Step 6: Verify the module still imports cleanly**

Run: `npx vitest run server`
Expected: PASS (all server suites).

- [ ] **Step 7: Commit**

```bash
git add server/contextFiles.ts server/contextFiles.test.ts server/sessionManager.ts
git commit -m "feat(context-lab): install context files into session sandboxes"
```

---

### Task 5: Server routes — sources CRUD, tiers, generate, preflight

**Files:**
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `contextLibrary` (Task 1), `buildContextAgentPrompt`/`DEFAULT_CONTEXT_PROMPT`/`slugify`/`sourceNeedsChrome` (Task 2), `sessionManager.runAgent(..., { chrome }): EventEmitter` (Task 3), `sessionManager.installContextFiles` + `ContextInstallEntry` (Task 4), `sessionManager.status`/`destroy`.
- Produces HTTP API (all JSON):
  - `GET /api/context/sources` → `ContextSource[]`
  - `POST /api/context/sources` — multipart (`label` field + `files[]`) → `ContextSource`
  - `POST /api/context/sources/url` — `{ label, urls: string[], instructions? }` → `ContextSource`
  - `DELETE /api/context/sources/:id` → `{ ok: true }`
  - `GET /api/context/tiers` → `ContextTier[]`
  - `PUT /api/context/tiers` — `ContextTier[]` → `ContextTier[]`
  - `GET /api/context-lab/generations` → `ContextGeneration[]` (newest first)
  - `POST /api/context-lab/generate` — `{ prompt?: string }` → `ContextGeneration` (or `409` if a Chrome-browsing run is still active)
  - `DELETE /api/context-lab/generations/:id` → `{ ok: true }`
  - `POST /api/context-lab/preflight` → `{ ok: boolean, detail: string }` — spawns a throwaway `--chrome` run using the SAME permission-mode as generation, navigates the first tier-3 Figma URL, screenshots it, and checks for a login wall
  - `ContextGeneration = { id, createdAt, prompt, status: GenerationStatus, variants: ContextVariant[], error? }`, `ContextVariant = { tierId, label, sourceIds, sessionId, previewUrl, chrome }`

- [ ] **Step 1: Add imports and persistence helpers to `server/index.ts`**

Top of file, extend imports:

```ts
import multer from "multer";
import { contextLibrary } from "./contextLibrary.js";
import {
  buildContextAgentPrompt,
  DEFAULT_CONTEXT_PROMPT,
  slugify,
  sourceNeedsChrome,
} from "./contextPrompt.js";
import type { ContextSource, ContextTier } from "./types.js";
```

Below the `GENERATIONS_FILE` const add:

```ts
const CONTEXT_GENERATIONS_FILE = path.join(DATA_DIR, "context-generations.json");
```

Below the `Generation` type add:

```ts
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
```

- [ ] **Step 2: Add the routes** (insert before the `// ---------- review agent ----------` section; boot-time seed call + multer near the top of the routes area)

```ts
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
```

- [ ] **Step 3: Verify server boots and routes respond**

Run: `npm run server` (background), then:

```bash
curl -s localhost:3001/api/context/sources | head -c 200
curl -s localhost:3001/api/context/tiers | python3 -m json.tool
curl -s -X POST localhost:3001/api/context/sources/url -H 'Content-Type: application/json' -d '{"label":"smoke url","urls":["https://example.com"]}'
curl -s localhost:3001/api/context/sources | python3 -m json.tool
curl -s -X DELETE localhost:3001/api/context/sources/<id-from-previous-output>
```

Expected: `[]` then three default tiers, then created source echo, then list containing it, then `{"ok":true}`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat(context-lab): API — sources CRUD, tiers, 3-tier generate, chrome preflight"
```

---

### Task 6: Client — types, nav, route, page skeleton

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/Nav.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/ContextLabPage.tsx`

**Interfaces:**
- Consumes: server API from Task 5.
- Produces:
  - Client types `ContextSource`, `ContextTier`, `ContextVariant`, `ContextGeneration` in `client/src/types.ts` (same shapes as the server API above).
  - Route `/context-lab` rendering `<ContextLabPage />` (self-contained data fetching, like `ComparePage`).
  - Page exposes state + handlers consumed by Tasks 7–8 components: `sources: ContextSource[]`, `tiers: ContextTier[]`, `generations: ContextGeneration[]`, `refreshSources(): Promise<void>`, `saveTiers(next: ContextTier[]): Promise<void>`.

- [ ] **Step 1: Add types to `client/src/types.ts`** (append)

```ts
export type ContextSource = {
  id: string;
  label: string;
  kind: "file" | "url";
  files: string[];
  urls?: string[];
  instructions?: string;
  createdAt: string;
};

export type ContextTier = {
  id: string;
  label: string;
  sourceIds: string[];
};

export type ContextVariant = {
  tierId: string;
  label: string;
  sourceIds: string[];
  sessionId: string;
  previewUrl: string;
  chrome: boolean; // this variant drives the browser (single-channel mutex key)
};

export type ContextGeneration = {
  id: string;
  createdAt: string;
  prompt: string;
  status: GenerationStatus;
  variants: ContextVariant[];
  error?: string;
};
```

- [ ] **Step 2: Add the nav tab in `client/src/Nav.tsx`** (after the Skills link)

```tsx
        <Link
          to="/context-lab"
          className={`nav-tab${pathname === "/context-lab" ? " active" : ""}`}
        >
          Context Lab
        </Link>
```

- [ ] **Step 3: Add the route in `client/src/App.tsx`**

Import: `import { ContextLabPage } from "./pages/ContextLabPage";`
After the `/skills` route: `<Route path="/context-lab" element={<ContextLabPage />} />`

- [ ] **Step 4: Create `client/src/pages/ContextLabPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { PromptInput } from "../PromptInput";
import { ContextSourcePanel } from "../ContextSourcePanel";
import { TierConfigRow } from "../TierConfigRow";
import { ContextGenerationCard } from "../ContextGenerationCard";
import type {
  ContextGeneration,
  ContextSource,
  ContextTier,
} from "../types";

export const DEFAULT_CONTEXT_PROMPT =
  "Build the car trade-in value request tool described in the provided context materials. Implement the full customer-facing flow as a working web app.";

export function ContextLabPage() {
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [tiers, setTiers] = useState<ContextTier[]>([]);
  const [generations, setGenerations] = useState<ContextGeneration[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_CONTEXT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<
    { state: "idle" } | { state: "running" } | { state: "done"; ok: boolean; detail: string }
  >({ state: "idle" });

  async function refreshSources() {
    const [s, t] = await Promise.all([
      fetch("/api/context/sources").then((r) => r.json()),
      fetch("/api/context/tiers").then((r) => r.json()),
    ]);
    setSources(s);
    setTiers(t);
  }

  async function refreshGenerations() {
    const g = await fetch("/api/context-lab/generations").then((r) => r.json());
    setGenerations(g);
  }

  useEffect(() => {
    Promise.all([refreshSources(), refreshGenerations()]).catch((e) =>
      setError(`init: ${e.message}`),
    );
  }, []);

  const anyRunning = generations.some((g) => g.status === "running");

  // While any run is active, poll the list so the page-level status (and the
  // Generate lockout) tracks completion. The server reconciles terminal status,
  // so this also unsticks the button after a run finishes or after a restart.
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => {
      refreshGenerations().catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [anyRunning]);

  async function saveTiers(next: ContextTier[]) {
    setTiers(next);
    const res = await fetch("/api/context/tiers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) setTiers(await res.json());
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/context-lab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setGenerations((prev) => [body as ContextGeneration, ...prev]);
    } catch (e: any) {
      setError(e.message ?? "generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteGen(id: string) {
    await fetch(`/api/context-lab/generations/${id}`, { method: "DELETE" });
    setGenerations((prev) => prev.filter((g) => g.id !== id));
  }

  async function testChrome() {
    setPreflight({ state: "running" });
    try {
      const res = await fetch("/api/context-lab/preflight", { method: "POST" });
      const body = await res.json();
      setPreflight({ state: "done", ok: !!body.ok, detail: body.detail ?? "" });
    } catch (e: any) {
      setPreflight({ state: "done", ok: false, detail: e.message });
    }
  }

  const anyChromeTier = tiers.some((t) =>
    t.sourceIds.some((id) => sources.find((s) => s.id === id)?.kind === "url"),
  );
  const busy = loading || anyRunning;

  return (
    <div className="page page-context-lab">
      <header className="ctx-header">
        <h1>Context Lab</h1>
        <p className="muted">
          Same prompt, same model — only the preparation differs.
        </p>
      </header>

      <div className="compose">
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          disabled={loading}
          onSubmit={generate}
        />

        <TierConfigRow sources={sources} tiers={tiers} onTiersChange={saveTiers} />

        <div className="compose-row">
          {anyChromeTier && (
            <button
              className="ghost"
              onClick={testChrome}
              disabled={preflight.state === "running" || busy}
            >
              {preflight.state === "running"
                ? "Testing Chrome…"
                : preflight.state === "done"
                  ? preflight.ok
                    ? "✓ Chrome connected"
                    : "✗ Chrome not connected"
                  : "Test Chrome"}
            </button>
          )}
          <div className="grow" />
          <button
            className="primary"
            onClick={generate}
            disabled={busy || prompt.trim().length === 0}
          >
            {busy ? "Generating…" : "Generate 3 variants"}
          </button>
          {busy && <div className="spinner" aria-label="Generating" />}
        </div>
        {anyRunning && (
          <div className="muted">
            A run is in progress — only one generation at a time (the Figma tier
            uses the shared browser).
          </div>
        )}

        {preflight.state === "done" && !preflight.ok && (
          <div className="error">Chrome preflight: {preflight.detail}</div>
        )}
        {error && <div className="error">Error: {error}</div>}
      </div>

      <ContextSourcePanel sources={sources} onChanged={refreshSources} />

      <section className="feed">
        <h2 className="feed-title">
          Runs
          {generations.length > 0 && <span className="count">{generations.length}</span>}
        </h2>
        {generations.length === 0 ? (
          <div className="empty empty-large">
            No runs yet. Configure tier sources above and hit Generate.
          </div>
        ) : (
          generations.map((g) => (
            <ContextGenerationCard key={g.id} gen={g} onDelete={() => deleteGen(g.id)} />
          ))
        )}
      </section>
    </div>
  );
}
```

(This references `ContextSourcePanel`, `TierConfigRow`, `ContextGenerationCard` — created in Tasks 7–8. To keep the app compiling after THIS task, create the three files as minimal stubs now; Tasks 7–8 replace them.)

Stub `client/src/ContextSourcePanel.tsx`:

```tsx
import type { ContextSource } from "./types";
export function ContextSourcePanel(_props: {
  sources: ContextSource[];
  onChanged: () => Promise<void>;
}) {
  return null;
}
```

Stub `client/src/TierConfigRow.tsx`:

```tsx
import type { ContextSource, ContextTier } from "./types";
export function TierConfigRow(_props: {
  sources: ContextSource[];
  tiers: ContextTier[];
  onTiersChange: (next: ContextTier[]) => Promise<void>;
}) {
  return null;
}
```

Stub `client/src/ContextGenerationCard.tsx`:

```tsx
import type { ContextGeneration } from "./types";
export function ContextGenerationCard(_props: {
  gen: ContextGeneration;
  onDelete: () => void;
}) {
  return null;
}
```

- [ ] **Step 5: Verify it compiles and the tab renders**

Run: `cd client && npx tsc -b --clean && npx tsc -b && npx vitest run && cd ..`
Expected: build PASS, existing tests PASS. Manually: `./start.sh`, open http://localhost:5173/context-lab — header + prompt box render.

- [ ] **Step 6: Commit**

```bash
git add client/src/types.ts client/src/Nav.tsx client/src/App.tsx client/src/pages/ContextLabPage.tsx client/src/ContextSourcePanel.tsx client/src/TierConfigRow.tsx client/src/ContextGenerationCard.tsx
git commit -m "feat(context-lab): page skeleton, nav tab, route, client types"
```

---

### Task 7: Client — source panel + tier configuration

**Files:**
- Modify: `client/src/ContextSourcePanel.tsx` (replace stub)
- Modify: `client/src/TierConfigRow.tsx` (replace stub)
- Test: `client/src/TierConfigRow.test.tsx`

**Interfaces:**
- Consumes: props defined in Task 6 stubs (signatures unchanged).
- Produces: working library management + tier chips UI.

- [ ] **Step 1: Write the failing test** — `client/src/TierConfigRow.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierConfigRow } from "./TierConfigRow";
import type { ContextSource, ContextTier } from "./types";

const sources: ContextSource[] = [
  { id: "a", label: "Briefing", kind: "file", files: ["b.pdf"], createdAt: "" },
  { id: "b", label: "Figma", kind: "url", files: [], urls: ["https://x"], createdAt: "" },
];
const tiers: ContextTier[] = [
  { id: "tier-1", label: "Briefing only", sourceIds: ["a"] },
  { id: "tier-2", label: "Briefing + Schematic", sourceIds: [] },
  { id: "tier-3", label: "Briefing + Schematic + Figma", sourceIds: [] },
];

describe("TierConfigRow", () => {
  it("renders a column per tier with its source chips", () => {
    render(<TierConfigRow sources={sources} tiers={tiers} onTiersChange={vi.fn()} />);
    expect(screen.getByText("Briefing only")).toBeInTheDocument();
    expect(screen.getByText("Briefing + Schematic + Figma")).toBeInTheDocument();
    expect(screen.getByText("Briefing")).toBeInTheDocument();
  });

  it("removing a chip calls onTiersChange without that source id", () => {
    const onChange = vi.fn();
    render(<TierConfigRow sources={sources} tiers={tiers} onTiersChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove Briefing/i }));
    expect(onChange).toHaveBeenCalledWith([
      { id: "tier-1", label: "Briefing only", sourceIds: [] },
      tiers[1],
      tiers[2],
    ]);
  });

  it("adding a source via the select calls onTiersChange with it appended", () => {
    const onChange = vi.fn();
    render(<TierConfigRow sources={sources} tiers={tiers} onTiersChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith([
      tiers[0],
      { id: "tier-2", label: "Briefing + Schematic", sourceIds: ["b"] },
      tiers[2],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/TierConfigRow.test.tsx`
Expected: FAIL — stub renders null, `getByText("Briefing only")` not found.

- [ ] **Step 3: Implement `client/src/TierConfigRow.tsx`**

```tsx
import type { ContextSource, ContextTier } from "./types";

export function TierConfigRow({
  sources,
  tiers,
  onTiersChange,
}: {
  sources: ContextSource[];
  tiers: ContextTier[];
  onTiersChange: (next: ContextTier[]) => Promise<void> | void;
}) {
  function updateTier(tierId: string, sourceIds: string[]) {
    onTiersChange(
      tiers.map((t) => (t.id === tierId ? { ...t, sourceIds } : t)),
    );
  }

  return (
    <div className="tier-row">
      {tiers.map((tier) => {
        const chips = tier.sourceIds
          .map((id) => sources.find((s) => s.id === id))
          .filter((s): s is ContextSource => !!s);
        const addable = sources.filter((s) => !tier.sourceIds.includes(s.id));
        return (
          <div key={tier.id} className="tier-config">
            <div className="tier-config-label">{tier.label}</div>
            <div className="tier-config-chips">
              {chips.map((s) => (
                <span key={s.id} className={`src-chip src-chip-${s.kind}`}>
                  {s.kind === "url" ? "🔗 " : "📄 "}
                  {s.label}
                  <button
                    className="src-chip-x"
                    aria-label={`remove ${s.label}`}
                    onClick={() =>
                      updateTier(tier.id, tier.sourceIds.filter((id) => id !== s.id))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              {chips.length === 0 && <span className="muted">no sources</span>}
            </div>
            <select
              className="tier-add"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  updateTier(tier.id, [...tier.sourceIds, e.target.value]);
                }
              }}
            >
              <option value="">+ add source…</option>
              {addable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/TierConfigRow.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement `client/src/ContextSourcePanel.tsx`**

```tsx
import { useRef, useState } from "react";
import type { ContextSource } from "./types";

export function ContextSourcePanel({
  sources,
  onChanged,
}: {
  sources: ContextSource[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [urlLabel, setUrlLabel] = useState("");
  const [urls, setUrls] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0 || !label.trim()) {
      setErr("pick file(s) and a label");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("label", label.trim());
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch("/api/context/sources", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addUrlSource() {
    const list = urls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urlLabel.trim() || list.length === 0) {
      setErr("url source needs a label and at least one url");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/context/sources/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: urlLabel.trim(),
          urls: list,
          instructions: instructions.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      setUrlLabel("");
      setUrls("");
      setInstructions("");
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/context/sources/${id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <section className="ctx-sources">
      <button className="ghost" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} Context library ({sources.length})
      </button>
      {open && (
        <div className="ctx-sources-body">
          <ul className="ctx-source-list">
            {sources.map((s) => (
              <li key={s.id}>
                <span className={`src-chip src-chip-${s.kind}`}>
                  {s.kind === "url" ? "🔗 " : "📄 "}
                  {s.label}
                </span>
                <span className="muted">
                  {s.kind === "url" ? (s.urls ?? []).join(", ") : s.files.join(", ")}
                </span>
                <button className="ghost" onClick={() => remove(s.id)}>
                  delete
                </button>
              </li>
            ))}
            {sources.length === 0 && <li className="muted">library is empty</li>}
          </ul>

          <div className="ctx-source-forms">
            <div className="ctx-form">
              <strong>Upload files</strong>
              <input
                placeholder="label, e.g. Briefing document"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xml,.md,.txt" />
              <button onClick={uploadFiles} disabled={busy}>Add file source</button>
            </div>
            <div className="ctx-form">
              <strong>Add URL source (browsed live)</strong>
              <input
                placeholder="label, e.g. Figma design"
                value={urlLabel}
                onChange={(e) => setUrlLabel(e.target.value)}
              />
              <textarea
                placeholder="one URL per line"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={2}
              />
              <textarea
                placeholder="extra instructions for the agent (optional)"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
              />
              <button onClick={addUrlSource} disabled={busy}>Add URL source</button>
            </div>
          </div>
          {err && <div className="error">{err}</div>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Run the full client suite**

Run: `cd client && npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 7: Commit**

```bash
git add client/src/TierConfigRow.tsx client/src/TierConfigRow.test.tsx client/src/ContextSourcePanel.tsx
git commit -m "feat(context-lab): source library panel + tier chip configuration"
```

---

### Task 8: Client — 3-up generation card with focus mode

**Files:**
- Modify: `client/src/GenerationCard.tsx` (export `StatusPill` only)
- Modify: `client/src/ContextGenerationCard.tsx` (replace stub)
- Modify: `client/src/styles.css` (append Context Lab styles)
- Test: `client/src/ContextGenerationCard.test.tsx`

**Interfaces:**
- Consumes: `useAgentEvents(sessionId): { events, ended, endInfo }`; `ActivityLog({ events, ended })` (from `./ActivityLog`); `StatusPill({ status })` (add `export` in `GenerationCard.tsx`); `Preview({ previewUrl, title })` — **already exported from its own module `./Preview`**, import it from there.
- Produces: `ContextGenerationCard({ gen: ContextGeneration; onDelete: () => void })`.

- [ ] **Step 1: Export `StatusPill` from `client/src/GenerationCard.tsx`**

`GenerationCard.tsx:22` declares `function StatusPill(...)` (currently un-exported). Add `export` in front of it. Do NOT touch `Preview` — it lives in `client/src/Preview.tsx` and is already exported; `GenerationCard.tsx` imports it via `import { Preview } from "./Preview"` (`GenerationCard.tsx:3`). Run `cd client && npx vitest run src/GenerationCard.test.tsx` — Expected: PASS.

- [ ] **Step 2: Write the failing test** — `client/src/ContextGenerationCard.test.tsx`

`ContextGenerationCard` renders `useAgentEvents`, which constructs `EventSource` — absent in jsdom — so stub it (same pattern as `GenerationCard.test.tsx`). The test:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextGenerationCard } from "./ContextGenerationCard";
import type { ContextGeneration } from "./types";

beforeEach(() => {
  vi.stubGlobal(
    "EventSource",
    class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      close = vi.fn();
      constructor(_url: string) {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const gen: ContextGeneration = {
  id: "g1",
  createdAt: "2026-07-07T10:00:00.000Z",
  prompt: "Build the tool",
  status: "running",
  variants: [
    { tierId: "tier-1", label: "Briefing only", sourceIds: ["a"], sessionId: "s1", previewUrl: "/api/preview/s1/", chrome: false },
    { tierId: "tier-2", label: "Briefing + Schematic", sourceIds: ["a", "b"], sessionId: "s2", previewUrl: "/api/preview/s2/", chrome: false },
    { tierId: "tier-3", label: "Briefing + Schematic + Figma", sourceIds: ["a", "b", "c"], sessionId: "s3", previewUrl: "/api/preview/s3/", chrome: true },
  ],
};

describe("ContextGenerationCard", () => {
  it("renders one column per variant with its tier label", () => {
    render(<ContextGenerationCard gen={gen} onDelete={vi.fn()} />);
    expect(screen.getByText("Briefing only")).toBeInTheDocument();
    expect(screen.getByText("Briefing + Schematic")).toBeInTheDocument();
    expect(screen.getByText("Briefing + Schematic + Figma")).toBeInTheDocument();
  });

  it("clicking a column header focuses it; clicking again unfocuses", () => {
    const { container } = render(<ContextGenerationCard gen={gen} onDelete={vi.fn()} />);
    const header = screen.getByRole("button", { name: /focus Briefing only/i });
    fireEvent.click(header);
    expect(container.querySelector(".ctx-grid.has-focus")).not.toBeNull();
    expect(container.querySelector(".ctx-col.focused")).not.toBeNull();
    fireEvent.click(header);
    expect(container.querySelector(".ctx-grid.has-focus")).toBeNull();
  });

  it("delete button calls onDelete", () => {
    const onDelete = vi.fn();
    render(<ContextGenerationCard gen={gen} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/ContextGenerationCard.test.tsx`
Expected: FAIL — stub renders null.

- [ ] **Step 4: Implement `client/src/ContextGenerationCard.tsx`**

```tsx
import { useState } from "react";
import { ActivityLog } from "./ActivityLog";
import { StatusPill } from "./GenerationCard";
import { Preview } from "./Preview";
import { useAgentEvents } from "./hooks/useAgentEvents";
import type {
  ContextGeneration,
  ContextVariant,
  GenerationStatus,
} from "./types";

function VariantColumn({
  variant,
  initialStatus,
  focused,
  anyFocused,
  onToggleFocus,
}: {
  variant: ContextVariant;
  initialStatus: GenerationStatus;
  focused: boolean;
  anyFocused: boolean;
  onToggleFocus: () => void;
}) {
  const stream = useAgentEvents(variant.sessionId);
  const liveStatus: GenerationStatus = stream.ended
    ? stream.endInfo?.code === 0
      ? "ready"
      : "errored"
    : initialStatus;

  return (
    <div
      className={`ctx-col${focused ? " focused" : ""}${anyFocused && !focused ? " dimmed" : ""}`}
    >
      <button
        className="ctx-col-header"
        aria-label={`focus ${variant.label}`}
        onClick={onToggleFocus}
        title="Click to focus this column"
      >
        <span className="ctx-col-label">{variant.label}</span>
        <StatusPill status={liveStatus} />
      </button>
      <Preview previewUrl={variant.previewUrl} title={variant.sessionId} />
      <details className="ctx-log">
        <summary>Activity</summary>
        <ActivityLog events={stream.events} ended={stream.ended} />
      </details>
    </div>
  );
}

export function ContextGenerationCard({
  gen,
  onDelete,
}: {
  gen: ContextGeneration;
  onDelete: () => void;
}) {
  const [focusedTier, setFocusedTier] = useState<string | null>(null);
  const focusedIdx = gen.variants.findIndex((v) => v.tierId === focusedTier);

  // Drive the column widths from the focused INDEX, not DOM child position, so
  // focusing any column (incl. the last) always widens the right one. Columns
  // stay in natural order; the focused track gets 1fr, the rest go slim.
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns:
      focusedIdx < 0
        ? `repeat(${gen.variants.length}, minmax(0, 1fr))`
        : gen.variants
            .map((_, i) => (i === focusedIdx ? "minmax(0, 1fr)" : "minmax(0, 140px)"))
            .join(" "),
  };

  return (
    <article className="gen-card ctx-card">
      <header className="gen-card-header">
        <div className="gen-prompt" title={gen.prompt}>
          {gen.prompt}
        </div>
        <StatusPill status={gen.status} />
        <time className="muted">{new Date(gen.createdAt).toLocaleString()}</time>
        <button className="ghost" aria-label="delete run" onClick={onDelete}>
          delete
        </button>
      </header>
      <div
        className={`ctx-grid${focusedIdx >= 0 ? " has-focus" : ""}`}
        style={gridStyle}
      >
        {gen.variants.map((v) => (
          <VariantColumn
            key={v.tierId}
            variant={v}
            initialStatus={gen.status}
            focused={focusedTier === v.tierId}
            anyFocused={focusedTier !== null}
            onToggleFocus={() =>
              setFocusedTier((cur) => (cur === v.tierId ? null : v.tierId))
            }
          />
        ))}
      </div>
    </article>
  );
}
```

(`StatusPill` prop is `{ status }`, `Preview` prop is `{ previewUrl, title }` — confirmed against the current files. If either differs, match the existing declaration; do not change those components.)

- [ ] **Step 5: Append styles to `client/src/styles.css`**

```css
/* ---------- Context Lab ---------- */
.ctx-header h1 { margin: 0 0 4px; }
.ctx-header { margin-bottom: 16px; }

.tier-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0; }
.tier-config { border: 1px solid var(--border, #333); border-radius: 8px; padding: 10px; }
.tier-config-label { font-weight: 600; margin-bottom: 6px; }
.tier-config-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; min-height: 24px; }
.src-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border, #333); }
.src-chip-x { border: none; background: none; cursor: pointer; font-size: 13px; padding: 0 2px; }
.tier-add { font-size: 12px; }

.ctx-sources { margin: 14px 0; }
.ctx-sources-body { border: 1px solid var(--border, #333); border-radius: 8px; padding: 12px; margin-top: 8px; }
.ctx-source-list { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 6px; }
.ctx-source-list li { display: flex; align-items: center; gap: 10px; }
.ctx-source-forms { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ctx-form { display: flex; flex-direction: column; gap: 6px; }

/* Grid track widths are set inline by ContextGenerationCard (from the focused
   INDEX), so focusing any column — including the last — widens the right one.
   These rules only handle gaps and the de-emphasis of non-focused columns. */
.ctx-grid { display: grid; gap: 10px; transition: grid-template-columns 0.2s ease; }
.ctx-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ctx-col.dimmed { opacity: 0.55; }
/* When a column is focused, collapse the others' activity logs so the slim
   thumbnails stay compact; the focused column keeps its full detail. */
.ctx-grid.has-focus .ctx-col:not(.focused) .ctx-log { display: none; }
.ctx-col-header { display: flex; align-items: center; gap: 8px; justify-content: space-between; cursor: pointer; background: none; border: 1px solid var(--border, #333); border-radius: 6px; padding: 6px 10px; text-align: left; }
.ctx-col-label { font-weight: 600; font-size: 13px; }
.ctx-log summary { cursor: pointer; font-size: 12px; }
```

(Adapt `var(--border, #333)` fallbacks to the variables actually defined at the top of `styles.css` — reuse the project's existing tokens.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd client && npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 7: Commit**

```bash
git add client/src/GenerationCard.tsx client/src/ContextGenerationCard.tsx client/src/ContextGenerationCard.test.tsx client/src/styles.css
git commit -m "feat(context-lab): 3-up generation card with focus mode"
```

---

### Task 9: Seed the workshop assets + full end-to-end verification

**Files:**
- Create: `data/context-seeds/seed.json` (local only — `data/` is gitignored)
- Create: `docs/workshop-context-lab-checklist.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a walk-in-ready workshop setup, verified end to end.

- [ ] **Step 1: Copy the assets into the seeds dir**

```bash
mkdir -p data/context-seeds
cp "/Users/endi/Downloads/Briefing Document Trade-in Value Request English.pdf" data/context-seeds/briefing.pdf
cp "/Users/endi/Downloads/AIDD workshop Test Diagrams - Business Process V2 (1).xml" data/context-seeds/business-process-v2.xml
cp "/Users/endi/Downloads/AIDD workshop Test Diagrams - Business Process V2.pdf" data/context-seeds/business-process-v2.pdf
```

- [ ] **Step 2: Write `data/context-seeds/seed.json`**

```json
{
  "sources": [
    {
      "label": "Briefing document",
      "kind": "file",
      "files": ["briefing.pdf"],
      "instructions": "Business briefing: goals, requirements, systems, constraints."
    },
    {
      "label": "Process schematic",
      "kind": "file",
      "files": ["business-process-v2.xml", "business-process-v2.pdf"],
      "instructions": "BPMN business process. The XML is machine-readable and primary; the PDF is the rendered view for visual reference."
    },
    {
      "label": "Figma design",
      "kind": "url",
      "urls": [
        "https://www.figma.com/proto/MUWHUzLsDmolE2qpVELNS8/-TX-0000--Trade-in-value?node-id=5801-6355&t=c3VjcBdrsnTvtABY-0&scaling=min-zoom&content-scaling=fixed&page-id=5784%3A3591&starting-point-node-id=5807%3A7747&show-proto-sidebar=1",
        "https://www.figma.com/proto/MUWHUzLsDmolE2qpVELNS8/-TX-0000--Inruilwaarde?node-id=5784-4706&p=f&t=c3VjcBdrsnTvtABY-0&scaling=scale-down&content-scaling=fixed&page-id=3257%3A383&starting-point-node-id=5784%3A4706&show-proto-sidebar=1"
      ],
      "instructions": "First URL is the desktop prototype, second is mobile. Click through every screen of the trade-in flow before building."
    }
  ],
  "tiers": {
    "tier-1": ["Briefing document"],
    "tier-2": ["Briefing document", "Process schematic"],
    "tier-3": ["Briefing document", "Process schematic", "Figma design"]
  }
}
```

**Verify both Figma URLs open in Chrome first** (the desktop URL's name segment was reconstructed from a line-wrapped PDF — the `node-id`/`page-id` params are what matter; fix from the original briefing if Figma 404s).

- [ ] **Step 3: Boot and verify seeding**

```bash
npm run server &
sleep 3
curl -s localhost:3001/api/context/sources | python3 -m json.tool
curl -s localhost:3001/api/context/tiers | python3 -m json.tool
```

Expected: 3 sources; tier-1 has 1 sourceId, tier-2 has 2, tier-3 has 3.

- [ ] **Step 4: Preflight + full run**

Preconditions: Chrome open with the Claude extension connected; figma.com allowed in the extension's site permissions; you're logged into Figma.

```bash
curl -s -X POST localhost:3001/api/context-lab/preflight | python3 -m json.tool
```

Expected: `{ "ok": true, "detail": "Chrome connected and the Figma design rendered" }`. If it says `login-wall`, log into Figma in that Chrome / fix the prototype's link-sharing before continuing — this is the #1 silent demo-killer.

Then in the UI (http://localhost:5173/context-lab): hit **Generate 3 variants**. Verify:
1. Three columns appear, all `running`, previews load (Vite splash).
2. Tier-3: a fresh tab group opens in Chrome and navigates to the Figma prototype; screenshots happen (watch the Activity feed for `mcp__claude-in-chrome__*` tool calls).
3. All three flip to `ready`; previews show three different implementations.
4. Tier-3 transcript (`data/sessions/<id>/transcript.jsonl`) contains `mcp__claude-in-chrome__navigate` and screenshot tool calls: `grep -c "claude-in-chrome" data/sessions/<tier3-session-id>/transcript.jsonl` > 0.
5. Focus mode expands a column (try focusing the **third/Figma** column specifically — it must widen, not stay slim); delete removes the run.
6. Reload the page mid-run — the run persists and its status keeps updating (poll). After a server restart, a previously-`running` run reconciles to `ready`/`errored` (not stuck spinning).
7. **Concurrency lock:** while a run is active, the Generate button is disabled; a direct `POST /api/context-lab/generate` returns `409` if the active run uses Chrome.
8. **Permission-mode check (do this once, pre-workshop):** confirm the tier-3 agent actually *navigated and screenshotted* under the production flag set — not just that `--chrome` connected. If the transcript shows browser tool calls being denied, switch chrome runs to `bypassPermissions` or add `--allowedTools "mcp__claude-in-chrome__*"` in `buildAgentArgs` (Task 3) and re-verify.

- [ ] **Step 5: Write `docs/workshop-context-lab-checklist.md`**

```markdown
# Context Lab — workshop day checklist

Run through this ~30 min before presenting.

0. **CLI flag sanity**: `claude --help | grep -- --chrome` returns a line. If a
   CLI update dropped/renamed the flag, the Figma tier won't browse — stop and fix.
1. **Model check**: the demo runs on whatever the app's Settings say. Default is
   **opus** (`DEFAULT_SETTINGS.model`), which is slower/pricier. Decide before the
   room: opus for max quality, or switch to **sonnet** (gear icon) for a snappier
   run. All three tiers use the same model — that's the point.
2. **Chrome**: open Chrome, confirm the Claude extension is installed and
   connected (extension icon → connected state). Log into Figma.
3. **Figma renders, not a login wall**: open BOTH prototype URLs manually in that
   Chrome and confirm you see the *design*, not a "request access"/login page.
   Expired Figma sessions are the #1 silent demo-killer.
4. **Extension site permissions**: allow `figma.com` (and `www.figma.com`)
   so browser actions never block on approval.
5. **Start the app**: `./start.sh`, open http://localhost:5173/context-lab.
6. **Seeds**: the Context library should show 3 sources and the three tiers
   should show 1 / 2 / 3 chips. If empty: check `data/context-seeds/`.
7. **Briefing richness (one-time)**: confirm `briefing.pdf` is prose/requirements
   with NO UI mockups or screenshots. If it contains the finished design, tier 1
   already looks great and the "preparation matters" contrast collapses.
8. **Test Chrome**: click "Test Chrome" — must show "✓ Chrome connected". It now
   navigates the real Figma URL and screenshots it, so a green result means the
   design actually rendered. If red with a login-wall message, fix step 3.
9. **Warm-up run**: fire one full generation end to end. On opus expect the Figma
   tier to be the slow path (navigate 2 URLs, click through screens, up to ~20
   screenshots, then build) — budget **~6–12 min**, less on sonnet. This warms
   caches and validates auth. Delete the run after.
10. **During the demo**: one generation at a time — the button locks while a run
    is active (the Figma tier owns the shared browser). Don't touch Chrome while
    tier 3 is browsing.
11. **Recovery**: if tier 3 fails on browser access, it degrades to ~tier-2 output
    and still finishes; tiers 1–2 are never affected by Chrome problems. Hit Test
    Chrome, fix, and re-run.
```

- [ ] **Step 6: Commit**

```bash
git add docs/workshop-context-lab-checklist.md
git commit -m "docs(context-lab): workshop day checklist"
```

---

### Task 10: Documentation — CLAUDE.md + README

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update `CLAUDE.md`** (per its own maintenance rule)

- File map — add:
  ```
  server/contextLibrary.ts — context sources (files/urls) + tiers, data/context/
  server/contextPrompt.ts  — context-lab agent prompt builder
  client/src/pages/ContextLabPage.tsx — context lab page (3-tier compare)
  client/src/ContextSourcePanel.tsx   — context library upload/manage panel
  client/src/TierConfigRow.tsx        — per-tier source chips
  client/src/ContextGenerationCard.tsx — 3-up preview card with focus mode
  ```
  ```
  server/contextFiles.ts   — pure copy helper: files → session context/<slug>/
  ```
- Concepts — add: `**Context source** — a file bundle or URL set in data/context/ used as agent input. **Tier** — ordered source list; Context Lab runs one session per non-empty tier.`
- API — add the ten new endpoints (same list as Task 5 Interfaces).
- How the agent runs — add: `Context Lab tier with a url source runs with --chrome and WITHOUT --tools (dropping --tools yields the full default built-in set incl. Skill/ToolSearch, which load the deferred mcp__claude-in-chrome__* tools; a --tools allowlist would exclude them). One chrome run at a time — enforced by a server-side 409 mutex.`
- Known gaps — add: `Context Lab preflight spawns a throwaway --chrome run that navigates/screenshots the real Figma URL (~30-90s); chrome-enabled agents require Chrome + extension + Figma login on the host. Uploaded context files are trusted-local-assets only — the agent reads them with Bash available, so an untrusted PDF/XML is a prompt-injection vector (do not expose Context Lab uploads to untrusted users; extends known-gap #4).`

- [ ] **Step 2: Update `README.md`** — add to "How to use it":

```markdown
6. Open **Context Lab** to run the "preparation matters" demo: the same
   prompt is built three times with increasingly rich context (briefing →
   +process schematic → +live Figma design browse) and shown side by side.
   Upload your own PDFs/images/XML or add URL sources for the agent to
   browse live via the Claude Chrome extension.
```

- [ ] **Step 3: Final full check + commit**

```bash
npx vitest run server && cd client && npx vitest run && npx tsc -b && cd ..
git add CLAUDE.md README.md
git commit -m "docs(context-lab): architecture + usage documentation"
```

---

## Self-review notes (already applied)

- **Spec coverage**: dedicated mode ✓ (Task 6 route/nav), 3 cumulative tiers ✓ (Task 1 defaults + seed), terse shared prompt ✓ (Task 2 preset, Task 6 prefill), library + uploads ✓ (Tasks 1/5/7), live Figma via claude-in-chrome ✓ (Tasks 2/3/5/9), XML+PDF schematic ✓ (Task 9 seed), concurrent 3-up + focus ✓ (Tasks 5/8), preflight + retry + checklist ✓ (Tasks 2/5/9), no judge ✓ (absent by design), no SDK migration ✓ (global constraints), skills-later ✓ (nothing blocks adding a skills field to the tier model later).
- **Known deliberate gaps** (v1): no cancel button for context runs (same gap as existing generations); tier labels not editable in UI (edit `data/context/tiers.json`); preview iframes assume responsive generated apps.
- **Type consistency**: `ContextSource/ContextTier` defined once in `server/types.ts` (Task 1), mirrored in `client/src/types.ts` (Task 6); `ContextVariant` carries `chrome: boolean` on both sides; `copyContextEntries`/`ContextInstallEntry` in `server/contextFiles.ts` (Task 4) is consumed by `sessionManager.installContextFiles` and the Task 5 caller, which builds entries with `slugify` from Task 2, matching prompt paths (`context/<slug>/<file>`).

## Review-pass fixes (applied after 3 verifier subagents + Codex review)

- **[blocker] Preview import** — Task 8 exports only `StatusPill` from `GenerationCard.tsx`; `Preview` is imported from its real module `./Preview`.
- **[blocker] completion-tracking race** — Task 5 spawns each agent and attaches its `end` listener in the same synchronous tick (child `close` is async, so no event is missed); removed the after-the-loop tracker.
- **[blocker] single-chrome mutex** — Task 5 `/generate` returns `409` if a url-source generation is still running; Task 6 disables Generate while any run is active and polls for completion.
- **[blocker] partial-failure cleanup** — Task 5 `Promise.all`s Vite starts and destroys all created sessions if any fail before responding.
- **[should-fix] true concurrency** — Task 5 creates all sessions, boots Vite concurrently, then spawns all agents (was sequential per-tier).
- **[should-fix] preflight parity + depth** — Task 5 preflight uses the same `--permission-mode` as generation and actually navigates the real Figma URL + screenshots + detects a login wall.
- **[should-fix] Figma login-wall + ToolSearch** — Task 2 prompt tells the agent to ToolSearch-load browser tools and to skip a URL that shows a login/permission wall.
- **[should-fix] focus CSS for 3rd column** — Task 8 drives grid track widths from the focused index (inline style), not DOM child position; dead rules removed.
- **[should-fix] boot/list reconciliation** — Task 5 `GET /generations` reconciles stale `running` from session statuses.
- **[should-fix] upload allowlist + prompt-injection note** — Task 5 multer `fileFilter` extension allowlist; "trusted local assets only" documented (Task 10, global constraints).
- **[nit] Task 4 testability** — extracted pure `copyContextEntries` with its own unit test.
- **[nits] doc/comment** — `--tools`-drop comment mechanism corrected; "Bundler" not NodeNext; Task 4 tsconfig path; `PROJECT_BASE_LINES` phrasing; inline EventSource stub.
- **Judgment calls resolved with the user:** (1) model = opus by default, changeable in the UI (no code change — all tiers use `readSettings()`); (2) preset reworded to drop "polished" and add "full" ("...Implement the **full** customer-facing flow as a working web app") so low-context tiers look visibly rougher and missing flow steps are legible to non-technical viewers, while staying fair (all still asked for a working app).

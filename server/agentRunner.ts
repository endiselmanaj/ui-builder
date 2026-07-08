import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import type { Settings } from "./types.js";

export type AgentOptions = {
  cwd: string;
  prompt: string;
  settings: Settings;
};

// EventEmitter the orchestrator subscribes to. Carries the spawned child
// in case callers want to terminate it.
export type AgentEmitter = EventEmitter & { child: ChildProcess };

export function runAgent(opts: AgentOptions): AgentEmitter {
  const args = buildAgentArgs(opts.settings, opts.prompt);

  // stdin: "ignore" closes the child's stdin so claude doesn't print the
  // "no stdin data received in 3s" warning and we save 3s on every cold call.
  const child = spawn("claude", args, {
    cwd: opts.cwd,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ee = new EventEmitter() as AgentEmitter;
  ee.child = child;

  let buf = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        ee.emit("event", JSON.parse(line));
      } catch {
        ee.emit("event", { type: "raw", line });
      }
    }
  });

  child.stderr?.on("data", (b: Buffer) => {
    ee.emit("event", { type: "stderr", text: b.toString() });
  });

  child.on("close", (code) => {
    // Drain any tail bytes that didn't end with a newline.
    if (buf.trim()) {
      try {
        ee.emit("event", JSON.parse(buf.trim()));
      } catch {
        ee.emit("event", { type: "raw", line: buf.trim() });
      }
      buf = "";
    }
    ee.emit("end", { code });
  });

  child.on("error", (err) => {
    ee.emit("error", err);
  });

  return ee;
}

export function buildAgentArgs(
  settings: Settings,
  prompt: string,
): string[] {
  const args: string[] = [];
  if (settings.bare) args.push("--bare");
  args.push("-p", prompt);
  args.push("--output-format", "stream-json");
  args.push("--include-partial-messages");
  args.push("--verbose");
  args.push("--model", settings.model);
  // Agent mode auto-approves edits in the session sandbox.
  args.push(
    "--permission-mode",
    settings.permissionMode === "dontAsk"
      ? "acceptEdits"
      : settings.permissionMode,
  );
  // Default to a real tool set in agent mode; only respect a non-empty
  // override if it actually has tools (settings.tools "" was the old "no
  // tools" pattern from the one-shot pipeline).
  const tools =
    settings.tools && settings.tools.trim().length > 0
      ? settings.tools
      : "Edit,Write,Read,Bash";
  args.push("--tools", tools);
  if (settings.effort) args.push("--effort", settings.effort);
  if (settings.maxBudgetUsd !== null) {
    args.push("--max-budget-usd", String(settings.maxBudgetUsd));
  }
  if (settings.appendSystemPrompt.trim()) {
    args.push("--append-system-prompt", settings.appendSystemPrompt);
  }
  return args;
}

export function buildReviewPrompt(opts: {
  skillFiles: Record<string, string>;
  withSkillsCode: Record<string, string>;
  withoutSkillsCode: Record<string, string>;
}): string {
  const skillSection = Object.entries(opts.skillFiles)
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n");

  const withCode = Object.entries(opts.withSkillsCode)
    .map(([path, content]) => `### ${path}\n\`\`\`tsx\n${content}\n\`\`\``)
    .join("\n\n");

  const withoutCode = Object.entries(opts.withoutSkillsCode)
    .map(([path, content]) => `### ${path}\n\`\`\`tsx\n${content}\n\`\`\``)
    .join("\n\n");

  return [
    "You are a design system review agent. Two React + Tailwind codebases were generated from the same prompt:",
    "one with design skill rules loaded, one without. Your job is to evaluate how well the skills were followed",
    "and highlight the differences.",
    "",
    "# Skills that were loaded",
    skillSection,
    "",
    "# Code: With Skills",
    withCode,
    "",
    "# Code: Without Skills",
    withoutCode,
    "",
    "# Your task",
    "",
    "## 1. Skill Adherence",
    "For each loaded skill, evaluate how well the \"With Skills\" code follows it:",
    "- List specific rules that were followed (with code evidence)",
    "- List rules that were missed or violated",
    "- Rate: Fully followed / Mostly followed / Partially followed / Not followed",
    "",
    "## 2. Side-by-Side Comparison",
    "Call out the key differences between the two versions:",
    "- Visual/styling differences (colors, spacing, typography, layout)",
    "- Structural differences (component organization, patterns used)",
    "- Quality differences (accessibility, responsiveness, code cleanliness)",
    "",
    "## 3. Verdict",
    "- Overall skill adherence grade (A/B/C/D/F with percentage)",
    "- Top 3 improvements the skills drove",
    "- Top 3 things the skilled version could still improve",
    "",
    "Be concise. Use headings and bullet points. Do not use any tools.",
  ].join("\n");
}

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

export function buildAgentPrompt(opts: {
  userPrompt: string;
  loadedSkills: { id: string; name: string }[];
}): string {
  const skillBullets =
    opts.loadedSkills.length === 0
      ? "_(none)_"
      : opts.loadedSkills
          .map((s) => `- ${s.name} (.claude/skills/${s.id}.md)`)
          .join("\n");

  return [
    ...PROJECT_BASE_LINES,
    "",
    "# Skills loaded for this generation",
    "The following skill rule sheets are in .claude/skills/. Read EVERY skill file listed below before writing any code; their guidance overrides your defaults.",
    "When multiple skills are loaded, read each one individually and combine their guidance:",
    skillBullets,
    "",
    "# Task",
    opts.userPrompt,
    "",
    "# Workflow",
    "1. Briefly plan the layout.",
    "2. Read ALL skill files listed above (one Read call per file). Apply every skill's rules when writing code.",
    "3. Use Edit/Write to author src/App.tsx and any helper components.",
    "4. When done, write a one-paragraph summary of what you built as your final assistant message.",
    "",
    "Don't run dev servers, builds, or git commands. The user already has Vite running.",
  ].join("\n");
}

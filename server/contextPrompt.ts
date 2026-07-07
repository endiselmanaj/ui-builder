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

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

export function buildContextAgentPrompt(opts: {
  userPrompt: string;
  sources: ContextSource[];
}): string {
  const lines: string[] = [...PROJECT_BASE_LINES, ""];

  lines.push(
    "# Context materials",
    "Reference documents for this build are in ./context/. They are the source of truth for scope, flow, wording, and design. Read EVERY file below fully (one Read call per file) before planning:",
  );
  if (opts.sources.length === 0) {
    lines.push("_(no context files provided — use your best judgment)_");
  }
  for (const src of opts.sources) {
    for (const f of src.files) {
      lines.push(`- context/${slugify(src.label)}/${f} (${src.label})`);
    }
    if (src.instructions) lines.push(`  - Note: ${src.instructions}`);
  }
  lines.push("");

  lines.push(
    "# Task",
    opts.userPrompt,
    "",
    "# Workflow",
    "1. Read ALL context files listed above.",
    "2. Plan: map every requirement and process step found in the context onto screens and components.",
    "3. Use Edit/Write to author src/App.tsx and helper components.",
    "4. Final assistant message: one paragraph on what you built and which context materials informed which decisions.",
    "",
    "Don't run dev servers, builds, or git commands. The user already has Vite running.",
  );

  return lines.join("\n");
}

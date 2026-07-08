import type { ContextSource } from "./types.js";
import { slugify } from "./contextPrompt.js";

export const DEFAULT_READINESS_PROMPT =
  "Assess whether the provided materials are ready to build. Identify what a builder would still have to guess.";

/** List the in-session paths of every context file, one bullet per file. */
function fileList(sources: ContextSource[]): string[] {
  const lines: string[] = [];
  for (const src of sources) {
    for (const f of src.files) {
      lines.push(`- context/${slugify(src.label)}/${f} (${src.label})`);
    }
    if (src.instructions) lines.push(`  - Note: ${src.instructions}`);
  }
  if (lines.length === 0) lines.push("_(no context files provided)_");
  return lines;
}

/**
 * Pass 1 — the readiness gap reveal. The agent reads every context file and
 * writes gaps.json: an array of the open decisions a builder would face,
 * each tagged covered / implied / undecided.
 */
export function buildGapRevealPrompt(opts: {
  userPrompt: string;
  sources: ContextSource[];
}): string {
  return [
    "You are a solution architect running a readiness review on a set of business materials.",
    "You are NOT building an application. Do not touch src/ or write any code. Your only job is to analyse the materials and write one JSON file.",
    "",
    "# Materials",
    "The reference documents are in ./context/. Read EVERY file below fully (one Read call per file) before analysing:",
    ...fileList(opts.sources),
    "",
    "# Task",
    opts.userPrompt,
    "",
    "Ask the one question that matters: what would a builder still have to guess here? Go through scope, the happy path, every branch and error path, inputs and their validation, the systems/APIs touched (fields, auth, errors), non-functional behaviour (timeouts, retries, load), data handling (PII, consent, retention), and ownership.",
    "",
    "# Output",
    "Write your findings to a file named `gaps.json` in the current working directory. Write ONLY valid JSON — no markdown, no prose around it. The JSON is an array of items, each:",
    "{",
    '  "id": "<short-kebab-slug>",',
    '  "label": "<one short phrase naming the decision>",',
    '  "category": "covered" | "implied" | "undecided",',
    '  "detail": "<one sentence: why it matters / what is unclear>",',
    '  "question": "<the precise question a builder needs answered — omit for covered items>"',
    "}",
    "",
    "Category rules:",
    "- covered — the materials specify it clearly; a builder needs to guess nothing.",
    "- implied — shown or hinted but not explicitly specified; a builder would likely infer it, possibly wrong.",
    "- undecided — genuinely open; a builder must guess or ask.",
    "",
    "Aim for 12–20 items across the three categories. Be specific to THESE materials, not generic.",
    "After writing gaps.json, reply with a one-line summary of how many items you found in each category.",
  ].join("\n");
}

/**
 * Pass 2 — compile the Definition of Ready. A fresh run in a sandbox that has
 * the same context files plus gaps.json and answers.json on disk. The agent
 * folds the human answers back in (or documents assumptions) and writes the
 * final markdown artifact.
 */
export function buildCompilePrompt(opts: {
  userPrompt: string;
  sources: ContextSource[];
}): string {
  return [
    "You are a solution architect compiling a one-page Definition of Ready from a completed readiness review.",
    "You are NOT building an application. Do not touch src/ or write any code. Your only job is to write one markdown file.",
    "",
    "# Materials",
    "Reference documents are in ./context/. Read every file below:",
    ...fileList(opts.sources),
    "",
    "# Review inputs (in the current working directory)",
    "- gaps.json — the readiness gaps you identified earlier (covered / implied / undecided).",
    "- answers.json — the human answers to the open questions, keyed by gap id. It MAY be empty or missing some ids. For any implied/undecided item without an answer, make a sensible default decision and mark it clearly as an assumption.",
    "Read both files.",
    "",
    "# Task",
    opts.userPrompt,
    "",
    "# Output",
    "Write a file named `definition-of-ready.md` in the current working directory: a crisp, one-page Definition of Ready for this case that a build agent can consume as its clarifications input. Use these sections:",
    "1. **Summary** — one paragraph: what is being built and for whom.",
    "2. **Acceptance criteria** — the testable criteria (Given/When/Then where useful).",
    "3. **Resolved decisions** — each formerly-open item with its resolution. Mark human answers plainly and prefix any gap you had to decide yourself with `ASSUMED:`.",
    "4. **Constraints & dependencies** — systems/APIs, their contracts (fields, auth, errors), limits.",
    "5. **Non-functional** — timeouts, retries, load behaviour, PII/consent/retention.",
    "6. **Out of scope** — what this build explicitly does not cover.",
    "7. **Open risks** — anything still unresolved that the team must watch.",
    "",
    "Write clean markdown only. After writing the file, reply with a one-line confirmation.",
  ].join("\n");
}

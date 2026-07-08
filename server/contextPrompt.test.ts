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

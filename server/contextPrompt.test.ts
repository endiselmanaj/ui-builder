import { describe, it, expect } from "vitest";
import {
  buildContextAgentPrompt,
  DEFAULT_CONTEXT_PROMPT,
  slugify,
} from "./contextPrompt.js";
import type { ContextSource } from "./types.js";

const briefing: ContextSource = {
  id: "s1",
  label: "Briefing document",
  files: ["briefing.pdf"],
  createdAt: "2026-01-01T00:00:00.000Z",
};
const schematic: ContextSource = {
  id: "s2",
  label: "Process schematic",
  files: ["process.xml"],
  instructions: "The XML is machine-readable and primary.",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("buildContextAgentPrompt", () => {
  it("lists file sources with their in-session paths", () => {
    const p = buildContextAgentPrompt({ userPrompt: "Build it", sources: [briefing] });
    expect(p).toContain("context/briefing-document/briefing.pdf");
    expect(p).toContain("Build it");
  });

  it("includes per-source instructions when present", () => {
    const p = buildContextAgentPrompt({ userPrompt: "x", sources: [briefing, schematic] });
    expect(p).toContain("context/process-schematic/process.xml");
    expect(p).toContain("The XML is machine-readable and primary.");
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
    expect(slugify("  Process / Schematic!! ")).toBe("process-schematic");
  });
});

describe("DEFAULT_CONTEXT_PROMPT", () => {
  it("is the terse preset", () => {
    expect(DEFAULT_CONTEXT_PROMPT).toBe(
      "Build the car trade-in value request tool described in the provided context materials. Implement the full customer-facing flow as a working web app.",
    );
  });
});

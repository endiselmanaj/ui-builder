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

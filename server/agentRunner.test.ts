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
  it("restricts tools to the configured allowlist", () => {
    const args = buildAgentArgs(settings, "hi");
    expect(args).toContain("--tools");
    expect(args[args.indexOf("--tools") + 1]).toBe("Edit,Write,Read,Bash");
  });

  it("passes the model and permission-mode flags", () => {
    const args = buildAgentArgs(settings, "hi");
    expect(args).toContain("--model");
    expect(args).toContain("--permission-mode");
  });
});

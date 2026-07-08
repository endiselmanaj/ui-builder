export type Skill = {
  id: string;
  name: string;
  description: string;
  category: "default" | "pon";
};

export type Workspace = {
  installed: string[];
};

export type GenerationVariant = {
  sessionId: string;
  previewUrl: string;
};

export type GenerationStatus = "running" | "ready" | "errored" | "stopped";

export type ReviewStatus = "running" | "ready" | "errored";

export type Generation = {
  id: string;
  createdAt: string;
  prompt: string;
  skillIds: string[];
  status: GenerationStatus;
  withSkills: GenerationVariant | null;
  withoutSkills: GenerationVariant | null;
  error?: string;
  review?: { status: ReviewStatus };
};

export type Settings = {
  model: string;
  effort: string;
  maxBudgetUsd: number | null;
  permissionMode: string;
  tools: string;
  appendSystemPrompt: string;
  bare: boolean;
};

// One event from `claude --output-format stream-json`. The shape varies by
// type; we keep a loose discriminated union and let the UI inspect at runtime.
export type AgentEvent =
  | { type: "system"; [k: string]: unknown }
  | { type: "user"; message?: any; [k: string]: unknown }
  | { type: "assistant"; message?: any; [k: string]: unknown }
  | { type: "tool_use"; [k: string]: unknown }
  | { type: "tool_result"; [k: string]: unknown }
  | { type: "result"; [k: string]: unknown }
  | { type: "stderr"; text: string }
  | { type: "error"; text: string }
  | { type: "raw"; line: string }
  | { type: string; [k: string]: unknown };

export type ContextSource = {
  id: string;
  label: string;
  files: string[];
  instructions?: string;
  createdAt: string;
};

export type ContextTier = {
  id: string;
  label: string;
  sourceIds: string[];
};

export type ReadinessStatus =
  | "reviewing"
  | "awaiting-answers"
  | "compiling"
  | "ready"
  | "errored";

export type ReadinessGap = {
  id: string;
  label: string;
  category: "covered" | "implied" | "undecided";
  detail?: string;
  question?: string;
};

export type Readiness = {
  id: string;
  createdAt: string;
  status: ReadinessStatus;
  prompt: string;
  sourceIds: string[];
  pass1SessionId: string;
  pass2SessionId?: string;
  gaps?: ReadinessGap[];
  answers?: Record<string, string>;
  error?: string;
};

export type ContextVariant = {
  tierId: string;
  label: string;
  sourceIds: string[];
  sessionId: string;
  previewUrl: string;
};

export type ContextGeneration = {
  id: string;
  createdAt: string;
  prompt: string;
  status: GenerationStatus;
  variants: ContextVariant[];
  error?: string;
};

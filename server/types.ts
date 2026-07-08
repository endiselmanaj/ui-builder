export type Settings = {
  model: string;
  effort: string;
  maxBudgetUsd: number | null;
  permissionMode: string;
  tools: string;
  appendSystemPrompt: string;
  bare: boolean;
};

export type ContextSource = {
  id: string;
  label: string;
  /** filenames inside the source dir */
  files: string[];
  /** extra prompt guidance injected verbatim for this source */
  instructions?: string;
  createdAt: string;
};

export type ContextTier = {
  id: string;
  label: string;
  sourceIds: string[];
};

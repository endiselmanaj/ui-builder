export type Settings = {
  model: string;
  effort: string;
  maxBudgetUsd: number | null;
  permissionMode: string;
  tools: string;
  appendSystemPrompt: string;
  bare: boolean;
};

export type ContextSourceKind = "file" | "url";

export type ContextSource = {
  id: string;
  label: string;
  kind: ContextSourceKind;
  /** filenames inside the source dir (kind=file) */
  files: string[];
  /** prototype/design URLs to browse live (kind=url) */
  urls?: string[];
  /** extra prompt guidance injected verbatim for this source */
  instructions?: string;
  createdAt: string;
};

export type ContextTier = {
  id: string;
  label: string;
  sourceIds: string[];
};

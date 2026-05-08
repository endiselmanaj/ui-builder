import { PromptInput } from "../PromptInput";
import { GenerationCard } from "../GenerationCard";
import { SkillPicker } from "../SkillPicker";
import type {
  Generation,
  Settings as SettingsType,
  Skill,
  Workspace,
} from "../types";

const MODEL_QUICK_OPTIONS = [
  { value: "sonnet", label: "sonnet" },
  { value: "opus", label: "opus" },
  { value: "haiku", label: "haiku" },
];

export function GeneratePage({
  prompt,
  onPromptChange,
  loaded,
  onLoadedChange,
  compare,
  onCompareChange,
  loading,
  onGenerate,
  generations,
  onDeleteGeneration,
  skills,
  workspace,
  settings,
  onSettingsChange,
  error,
}: {
  prompt: string;
  onPromptChange: (next: string) => void;
  loaded: string[];
  onLoadedChange: (next: string[]) => void;
  compare: boolean;
  onCompareChange: (next: boolean) => void;
  loading: boolean;
  onGenerate: () => void;
  generations: Generation[];
  onDeleteGeneration: (id: string) => void;
  skills: Skill[];
  workspace: Workspace;
  settings: SettingsType | null;
  onSettingsChange: (next: SettingsType) => void;
  error: string | null;
}) {
  async function changeModel(next: string) {
    if (!settings) return;
    const updated = { ...settings, model: next };
    onSettingsChange(updated);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) onSettingsChange(await res.json());
    } catch {
      // best-effort; the next /api/settings load will reconcile
    }
  }

  // Show the model in the dropdown. If the saved model isn't one of the
  // quick options, append it as a one-off so users on a pinned id don't get
  // silently switched off it.
  const modelOptions = settings
    ? MODEL_QUICK_OPTIONS.some((o) => o.value === settings.model)
      ? MODEL_QUICK_OPTIONS
      : [
          ...MODEL_QUICK_OPTIONS,
          { value: settings.model, label: settings.model },
        ]
    : MODEL_QUICK_OPTIONS;

  return (
    <div className="page page-generate">
      <div className="compose">
        <PromptInput
          value={prompt}
          onChange={onPromptChange}
          disabled={loading}
          onSubmit={onGenerate}
        />

        <div className="compose-row">
          <SkillPicker
            skills={skills}
            workspace={workspace}
            loaded={loaded}
            onLoadedChange={onLoadedChange}
            disabled={loading}
          />

          <label className="compose-pill compose-toggle">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => onCompareChange(e.target.checked)}
              disabled={loading}
            />
            <span>Compare</span>
          </label>

          <label className="compose-pill compose-model">
            <span className="muted">Model</span>
            <select
              value={settings?.model ?? "sonnet"}
              onChange={(e) => changeModel(e.target.value)}
              disabled={loading || !settings}
            >
              {modelOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grow" />

          <button
            className="primary"
            onClick={onGenerate}
            disabled={loading || prompt.trim().length === 0}
          >
            {loading ? "Generating…" : "Generate"}
          </button>
          {loading && <div className="spinner" aria-label="Generating" />}
        </div>

        {error && <div className="error">Error: {error}</div>}
      </div>

      <section className="feed">
        <h2 className="feed-title">
          Generations
          {generations.length > 0 && (
            <span className="count">{generations.length}</span>
          )}
        </h2>
        {generations.length === 0 ? (
          <div className="empty empty-large">
            No generations yet. Type a prompt above and hit Generate.
          </div>
        ) : (
          generations.map((g) => (
            <GenerationCard
              key={g.id}
              gen={g}
              onDelete={() => onDeleteGeneration(g.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { PromptInput } from "../PromptInput";
import { ContextSourcePanel } from "../ContextSourcePanel";
import { TierConfigRow } from "../TierConfigRow";
import { ContextGenerationCard } from "../ContextGenerationCard";
import type {
  ContextGeneration,
  ContextSource,
  ContextTier,
} from "../types";

export const DEFAULT_CONTEXT_PROMPT =
  "Build the car trade-in value request tool described in the provided context materials. Implement the full customer-facing flow as a working web app.";

export function ContextLabPage() {
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [tiers, setTiers] = useState<ContextTier[]>([]);
  const [generations, setGenerations] = useState<ContextGeneration[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_CONTEXT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshSources() {
    const [s, t] = await Promise.all([
      fetch("/api/context/sources").then((r) => r.json()),
      fetch("/api/context/tiers").then((r) => r.json()),
    ]);
    setSources(s);
    setTiers(t);
  }

  async function refreshGenerations() {
    const g = await fetch("/api/context-lab/generations").then((r) => r.json());
    setGenerations(g);
  }

  useEffect(() => {
    Promise.all([refreshSources(), refreshGenerations()]).catch((e) =>
      setError(`init: ${e.message}`),
    );
  }, []);

  const anyRunning = generations.some((g) => g.status === "running");

  // While any run is active, poll the list so the page-level status (and the
  // Generate lockout) tracks completion. The server reconciles terminal status,
  // so this also unsticks the button after a run finishes or after a restart.
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => {
      refreshGenerations().catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [anyRunning]);

  async function saveTiers(next: ContextTier[]) {
    setTiers(next);
    const res = await fetch("/api/context/tiers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) setTiers(await res.json());
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/context-lab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setGenerations((prev) => [body as ContextGeneration, ...prev]);
    } catch (e: any) {
      setError(e.message ?? "generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteGen(id: string) {
    await fetch(`/api/context-lab/generations/${id}`, { method: "DELETE" });
    setGenerations((prev) => prev.filter((g) => g.id !== id));
  }

  const busy = loading || anyRunning;

  return (
    <div className="page page-context-lab">
      <header className="ctx-header">
        <h1>Context Lab</h1>
        <p className="muted">
          Same prompt, same model — only the preparation differs.
        </p>
      </header>

      <div className="compose">
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          disabled={busy}
          onSubmit={generate}
        />

        <TierConfigRow sources={sources} tiers={tiers} onTiersChange={saveTiers} />

        <div className="compose-row">
          <div className="grow" />
          <button
            className="primary"
            onClick={generate}
            disabled={busy || prompt.trim().length === 0}
          >
            {busy ? "Generating…" : "Generate"}
          </button>
          {busy && <div className="spinner" aria-label="Generating" />}
        </div>
        {anyRunning && (
          <div className="muted">
            A run is in progress — only one generation at a time.
          </div>
        )}

        {error && <div className="error">Error: {error}</div>}
      </div>

      <ContextSourcePanel sources={sources} onChanged={refreshSources} />

      <section className="feed">
        <h2 className="feed-title">
          Runs
          {generations.length > 0 && <span className="count">{generations.length}</span>}
        </h2>
        {generations.length === 0 ? (
          <div className="empty empty-large">
            No runs yet. Configure tier sources above and hit Generate.
          </div>
        ) : (
          generations.map((g) => (
            <ContextGenerationCard key={g.id} gen={g} onDelete={() => deleteGen(g.id)} />
          ))
        )}
      </section>
    </div>
  );
}

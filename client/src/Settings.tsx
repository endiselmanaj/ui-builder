import { useEffect, useState } from "react";
import type { Settings as SettingsType } from "./types";

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "sonnet", label: "sonnet (latest Sonnet)" },
  { value: "opus", label: "opus (latest Opus)" },
  { value: "haiku", label: "haiku (latest Haiku)" },
  { value: "opusplan", label: "opusplan (Opus plans, Sonnet executes)" },
  { value: "sonnet[1m]", label: "sonnet[1m] (1M-token context)" },
  { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6 (pinned)" },
  { value: "claude-opus-4-7", label: "claude-opus-4-7 (pinned)" },
  { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5 (pinned)" },
];

const EFFORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "off (CLI default)" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "xhigh", label: "xhigh (Opus 4.7 only)" },
  { value: "max", label: "max" },
];

const PERMISSION_OPTIONS: { value: string; label: string; hint: string }[] = [
  {
    value: "dontAsk",
    label: "dontAsk",
    hint: "auto-deny anything not in allowedTools (recommended for headless)",
  },
  {
    value: "default",
    label: "default",
    hint: "interactive defaults — may try to prompt; not great for a server",
  },
  { value: "acceptEdits", label: "acceptEdits", hint: "auto-approve safe edits" },
  { value: "plan", label: "plan", hint: "propose without executing" },
  {
    value: "bypassPermissions",
    label: "bypassPermissions",
    hint: "skip all checks (unsafe — only in containers)",
  },
];

export function Settings({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (s: SettingsType) => void;
}) {
  const [draft, setDraft] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setDraft)
      .catch((e) => setError(`load: ${e.message}`));
  }, [open]);

  if (!open) return null;
  if (!draft) {
    return (
      <div className="drawer-backdrop" onClick={onClose}>
        <div className="drawer" onClick={(e) => e.stopPropagation()}>
          <div className="empty">Loading settings…</div>
        </div>
      </div>
    );
  }

  function update<K extends keyof SettingsType>(key: K, value: SettingsType[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as SettingsType;
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "save failed");
    } finally {
      setSaving(false);
    }
  }

  const permHint = PERMISSION_OPTIONS.find(
    (p) => p.value === draft.permissionMode
  )?.hint;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <header className="drawer-head">
          <h2>Settings</h2>
          <button className="ghost mini" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <p className="hint">
          These flags are passed to <code>claude -p</code> on every generation.
          Defaults are tuned for safe, single-shot text generation on a
          headless server.
        </p>

        <div className="form">
          <div className="field">
            <label>Model (<code>--model</code>)</label>
            <select
              value={draft.model}
              onChange={(e) => update("model", e.target.value)}
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="hint">
              Aliases auto-resolve to the latest version. Pinned IDs are
              reproducible across CLI updates.
            </div>
          </div>

          <div className="field">
            <label>Reasoning effort (<code>--effort</code>)</label>
            <select
              value={draft.effort}
              onChange={(e) => update("effort", e.target.value)}
            >
              {EFFORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="hint">
              Controls extended thinking. Higher = better reasoning, slower,
              more expensive. <code>xhigh</code> is Opus 4.7 only.
            </div>
          </div>

          <div className="field">
            <label>
              Max budget USD (<code>--max-budget-usd</code>)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              placeholder="no cap"
              value={draft.maxBudgetUsd ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                update("maxBudgetUsd", v === "" ? null : Number(v));
              }}
            />
            <div className="hint">
              Aborts the call if cumulative cost would exceed the cap. Leave
              blank for no cap.
            </div>
          </div>

          <div className="field">
            <label>
              Permission mode (<code>--permission-mode</code>)
            </label>
            <select
              value={draft.permissionMode}
              onChange={(e) => update("permissionMode", e.target.value)}
            >
              {PERMISSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {permHint && <div className="hint">{permHint}</div>}
          </div>

          <div className="field">
            <label>
              Tools (<code>--tools</code>)
            </label>
            <input
              type="text"
              placeholder='"" disables all tools (recommended for pure text gen)'
              value={draft.tools}
              onChange={(e) => update("tools", e.target.value)}
            />
            <div className="hint">
              <code>""</code> = no tools. <code>default</code> = all built-in
              tools. Or a comma list, e.g. <code>Bash,Edit,Read</code>. Pure
              text generation needs none.
            </div>
          </div>

          <div className="field">
            <label>
              Append system prompt (<code>--append-system-prompt</code>)
            </label>
            <textarea
              rows={4}
              placeholder="Optional extra system instructions appended after the default."
              value={draft.appendSystemPrompt}
              onChange={(e) => update("appendSystemPrompt", e.target.value)}
            />
            <div className="hint">
              Useful for tone/role tweaks without rewriting the whole system
              prompt.
            </div>
          </div>

          <div className="field">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.bare}
                onChange={(e) => update("bare", e.target.checked)}
              />
              <span>
                Bare mode (<code>--bare</code>)
              </span>
            </label>
            <div className="hint">
              Skip hooks, skills, plugins, MCP, auto-memory, and CLAUDE.md
              auto-discovery. Faster and reproducible — but{" "}
              <strong>
                requires <code>ANTHROPIC_API_KEY</code> in the server's env
              </strong>
              ; bare mode never reads OAuth/keychain, so Claude Code
              subscription auth will fail. Leave off if you're using{" "}
              <code>claude login</code>.
            </div>
          </div>
        </div>

        {error && <div className="error">Error: {error}</div>}

        <footer className="drawer-foot">
          <button className="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </footer>
      </div>
    </div>
  );
}

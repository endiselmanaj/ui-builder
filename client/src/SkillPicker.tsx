import { useEffect, useRef, useState } from "react";
import type { Skill, Workspace } from "./types";

export function SkillPicker({
  skills,
  workspace,
  loaded,
  onLoadedChange,
  disabled,
}: {
  skills: Skill[];
  workspace: Workspace;
  loaded: string[];
  onLoadedChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const installedSet = new Set(workspace.installed);
  const installed = skills.filter((s) => installedSet.has(s.id));
  const filtered = installed.filter((s) =>
    query.trim()
      ? `${s.name} ${s.description} ${s.id}`
          .toLowerCase()
          .includes(query.toLowerCase())
      : true,
  );

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(id: string) {
    onLoadedChange(
      loaded.includes(id) ? loaded.filter((l) => l !== id) : [...loaded, id],
    );
  }

  const label = labelFor(loaded, skills);

  return (
    <div className="picker" ref={wrapRef}>
      <button
        type="button"
        className={`compose-pill${loaded.length > 0 ? " filled" : ""}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title="Choose which installed skills to load into this generation"
      >
        {label}
      </button>

      {open && (
        <div className="popover" role="dialog" aria-label="Pick skills">
          <input
            className="popover-search"
            placeholder="Search skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {installed.length === 0 ? (
            <div className="popover-empty">
              No installed skills. Open the Skills tab to install some.
            </div>
          ) : filtered.length === 0 ? (
            <div className="popover-empty">No skills match "{query}".</div>
          ) : (
            <ul className="popover-list">
              {filtered.map((s) => (
                <li key={s.id}>
                  <label className="popover-row">
                    <input
                      type="checkbox"
                      checked={loaded.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    <div>
                      <div className="popover-name">{s.name}</div>
                      <div className="popover-desc">{s.description}</div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {loaded.length > 0 && (
            <div className="popover-footer">
              <button
                className="ghost mini"
                type="button"
                onClick={() => onLoadedChange([])}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function labelFor(loaded: string[], skills: Skill[]): string {
  if (loaded.length === 0) return "+ Skills";
  const byId = new Map(skills.map((s) => [s.id, s]));
  const names = loaded.map((id) => byId.get(id)?.id ?? id);
  if (names.length <= 2) return `Skills: ${names.join(", ")}`;
  return `Skills: ${names.slice(0, 2).join(", ")} (+${names.length - 2})`;
}

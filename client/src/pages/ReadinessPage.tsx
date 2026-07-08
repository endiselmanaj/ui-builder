import { useEffect, useState } from "react";
import { ActivityLog } from "../ActivityLog";
import { useAgentEvents } from "../hooks/useAgentEvents";
import type { ContextSource, Readiness, ReadinessGap } from "../types";

const DEFAULT_READINESS_PROMPT =
  "Assess whether the provided materials are ready to build. Identify what a builder would still have to guess.";

const CATEGORY_META: Record<
  ReadinessGap["category"],
  { dot: string; label: string; answerable: boolean }
> = {
  covered: { dot: "🟢", label: "Covered by the materials", answerable: false },
  implied: { dot: "🟡", label: "Implied — not specified", answerable: true },
  undecided: { dot: "🔴", label: "Undecided — a builder must guess", answerable: true },
};

function ActivityPanel({ sessionId, title }: { sessionId: string; title: string }) {
  const stream = useAgentEvents(sessionId);
  return (
    <details className="ctx-log" open={!stream.ended}>
      <summary>
        {title}
        {stream.ended ? " — done" : " — running…"}
      </summary>
      <ActivityLog events={stream.events} ended={stream.ended} />
    </details>
  );
}

export function ReadinessPage() {
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState(DEFAULT_READINESS_PROMPT);
  const [current, setCurrent] = useState<Readiness | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<Readiness[]>([]);
  const [docText, setDocText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshSources() {
    const s: ContextSource[] = await fetch("/api/context/sources").then((r) => r.json());
    setSources(s);
    setSelected((prev) => (prev.size === 0 ? new Set(s.map((x) => x.id)) : prev));
  }
  async function refreshRuns() {
    setRuns(await fetch("/api/readiness").then((r) => r.json()));
  }

  useEffect(() => {
    Promise.all([refreshSources(), refreshRuns()]).catch((e) =>
      setError(`init: ${e.message}`),
    );
  }, []);

  // Poll the active run while an agent pass is in flight.
  const polling = current?.status === "reviewing" || current?.status === "compiling";
  useEffect(() => {
    if (!current || !polling) return;
    const t = setInterval(async () => {
      const r: Readiness = await fetch(`/api/readiness/${current.id}`).then((x) => x.json());
      setCurrent(r);
      if (r.status === "awaiting-answers" && r.gaps) {
        setAnswers((prev) => {
          const next = { ...prev };
          for (const g of r.gaps!) if (!(g.id in next)) next[g.id] = "";
          return next;
        });
      }
      if (r.status === "ready" || r.status === "errored") refreshRuns();
    }, 3000);
    return () => clearInterval(t);
  }, [current?.id, polling]);

  // Fetch the compiled doc for preview once ready.
  useEffect(() => {
    if (current?.status !== "ready") return;
    fetch(`/api/readiness/${current.id}/document`)
      .then((r) => (r.ok ? r.text() : null))
      .then(setDocText)
      .catch(() => {});
  }, [current?.status, current?.id]);

  async function start() {
    setError(null);
    setDocText(null);
    setAnswers({});
    try {
      const res = await fetch("/api/readiness/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds: Array.from(selected), prompt }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body?.error ?? `HTTP ${res.status}`);
      setCurrent(body as Readiness);
      refreshRuns();
    } catch (e: any) {
      setError(e.message ?? "failed to start");
    }
  }

  async function compile(useAssumptions: boolean) {
    if (!current) return;
    setError(null);
    try {
      const res = await fetch(`/api/readiness/${current.id}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: useAssumptions ? {} : answers }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body?.error ?? `HTTP ${res.status}`);
      setCurrent(body as Readiness);
    } catch (e: any) {
      setError(e.message ?? "failed to compile");
    }
  }

  async function openRun(id: string) {
    setDocText(null);
    setAnswers({});
    const r: Readiness = await fetch(`/api/readiness/${id}`).then((x) => x.json());
    setCurrent(r);
    if (r.gaps) {
      const seed: Record<string, string> = {};
      for (const g of r.gaps) seed[g.id] = r.answers?.[g.id] ?? "";
      setAnswers(seed);
    }
  }

  async function deleteRun(id: string) {
    await fetch(`/api/readiness/${id}`, { method: "DELETE" });
    if (current?.id === id) setCurrent(null);
    refreshRuns();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const gaps = current?.gaps ?? [];
  const byCat = (c: ReadinessGap["category"]) => gaps.filter((g) => g.category === c);

  return (
    <div className="page page-readiness">
      <header className="ctx-header">
        <h1>Readiness</h1>
        <p className="muted">
          Is it ready to build? Reveal the gaps, answer the open decisions, and export a
          Definition of Ready you can feed into Context Lab.
        </p>
      </header>

      <div className="compose">
        <label className="muted">Materials to review</label>
        <div className="readiness-sources">
          {sources.length === 0 && <span className="muted">library is empty — add sources in Context Lab</span>}
          {sources.map((s) => (
            <label key={s.id} className={`src-chip${selected.has(s.id) ? " selected" : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
              />
              📄 {s.label}
            </label>
          ))}
        </div>

        <textarea
          className="readiness-prompt"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="compose-row">
          <div className="grow" />
          <button
            className="primary"
            onClick={start}
            disabled={selected.size === 0 || polling}
          >
            {current?.status === "reviewing" ? "Reviewing…" : "Run readiness check"}
          </button>
        </div>
        {error && <div className="error">Error: {error}</div>}
      </div>

      {current && (
        <section className="feed">
          {current.status === "reviewing" && (
            <ActivityPanel sessionId={current.pass1SessionId} title="Reviewing the materials" />
          )}
          {current.status === "errored" && (
            <div className="error">{current.error ?? "readiness run failed"}</div>
          )}

          {(current.status === "awaiting-answers" ||
            current.status === "compiling" ||
            current.status === "ready") &&
            gaps.length > 0 && (
              <div className="readiness-board">
                <div className="readiness-legend">
                  <span>🟢 covered</span>
                  <span>🟡 implied</span>
                  <span>🔴 undecided</span>
                </div>
                {(["undecided", "implied", "covered"] as const).map((cat) => {
                  const items = byCat(cat);
                  if (items.length === 0) return null;
                  const meta = CATEGORY_META[cat];
                  return (
                    <div key={cat} className={`readiness-group readiness-group-${cat}`}>
                      <h3>
                        {meta.dot} {meta.label} ({items.length})
                      </h3>
                      {items.map((g) => (
                        <div key={g.id} className="readiness-item">
                          <div className="readiness-item-label">{g.label}</div>
                          {g.detail && <div className="muted">{g.detail}</div>}
                          {meta.answerable && g.question && (
                            <div className="readiness-q">{g.question}</div>
                          )}
                          {meta.answerable && current.status === "awaiting-answers" && (
                            <input
                              className="readiness-answer"
                              placeholder="your answer (blank = let the agent assume)"
                              value={answers[g.id] ?? ""}
                              onChange={(e) =>
                                setAnswers((prev) => ({ ...prev, [g.id]: e.target.value }))
                              }
                            />
                          )}
                          {meta.answerable &&
                            current.status !== "awaiting-answers" &&
                            answers[g.id] && (
                              <div className="readiness-answer-shown">→ {answers[g.id]}</div>
                            )}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {current.status === "awaiting-answers" && (
                  <div className="compose-row">
                    <button className="ghost" onClick={() => compile(true)}>
                      Skip &amp; use assumptions
                    </button>
                    <div className="grow" />
                    <button className="primary" onClick={() => compile(false)}>
                      Compile Definition of Ready
                    </button>
                  </div>
                )}
              </div>
            )}

          {current.status === "compiling" && current.pass2SessionId && (
            <ActivityPanel
              sessionId={current.pass2SessionId}
              title="Compiling the Definition of Ready"
            />
          )}

          {current.status === "ready" && (
            <div className="readiness-result">
              <div className="compose-row">
                <strong>Definition of Ready is ready.</strong>
                <div className="grow" />
                <a
                  className="primary button-link"
                  href={`/api/readiness/${current.id}/document`}
                >
                  ⬇ Download .md
                </a>
              </div>
              <p className="muted">
                Upload this file as a source in Context Lab, then run Gen 1 (briefing) vs Gen 2
                (briefing + schematic + this).
              </p>
              {docText && <pre className="readiness-doc">{docText}</pre>}
            </div>
          )}
        </section>
      )}

      <section className="feed">
        <h2 className="feed-title">
          Past runs
          {runs.length > 0 && <span className="count">{runs.length}</span>}
        </h2>
        {runs.length === 0 ? (
          <div className="empty">No readiness runs yet.</div>
        ) : (
          <ul className="readiness-runs">
            {runs.map((r) => (
              <li key={r.id}>
                <button className="ghost" onClick={() => openRun(r.id)}>
                  {new Date(r.createdAt).toLocaleString()} · {r.status}
                </button>
                {r.status === "ready" && (
                  <a className="ghost button-link" href={`/api/readiness/${r.id}/document`}>
                    download
                  </a>
                )}
                <button className="ghost" onClick={() => deleteRun(r.id)}>
                  delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

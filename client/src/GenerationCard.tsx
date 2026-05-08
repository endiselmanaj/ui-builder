import { useState } from "react";
import { Link } from "react-router-dom";
import { Preview } from "./Preview";
import { ActivityLog } from "./ActivityLog";
import { ReviewPanel } from "./ReviewPanel";
import { useAgentEvents } from "./hooks/useAgentEvents";
import type {
  Generation,
  GenerationStatus,
  GenerationVariant,
  ReviewStatus,
} from "./types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StatusPill({ status }: { status: GenerationStatus }) {
  const map: Record<GenerationStatus, { label: string; className: string }> = {
    running: { label: "⏱ running", className: "status running" },
    ready: { label: "✓ ready", className: "status ready" },
    errored: { label: "✗ errored", className: "status errored" },
    stopped: { label: "⏸ stopped", className: "status stopped" },
  };
  const m = map[status];
  return <span className={m.className}>{m.label}</span>;
}

function VariantPane({
  label,
  variant,
  initialStatus,
}: {
  label: string | null;
  variant: GenerationVariant;
  initialStatus: GenerationStatus;
}) {
  const stream = useAgentEvents(variant.sessionId);

  // The persisted Generation status is the source of truth on initial load,
  // but a live `end` event tells us before the next /api/generations refetch.
  const liveStatus: GenerationStatus = stream.ended
    ? stream.endInfo?.code === 0
      ? "ready"
      : "errored"
    : initialStatus === "ready" || initialStatus === "errored"
    ? initialStatus
    : "running";

  return (
    <div className="pane">
      <div className="pane-head">
        {label ? <div className="pane-label">{label}</div> : <span />}
        <div className="pane-meta">
          <StatusPill status={liveStatus} />
          <a
            href={variant.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ghost mini pane-open"
            title="Open this preview in a new tab"
          >
            Open ↗
          </a>
        </div>
      </div>
      <Preview previewUrl={variant.previewUrl} title={variant.sessionId} />
      <ActivityLog events={stream.events} ended={stream.ended} />
    </div>
  );
}

export function GenerationCard({
  gen,
  onDelete,
}: {
  gen: Generation;
  onDelete: () => void;
}) {
  const isComparison = gen.withoutSkills !== null;
  const isFailed = !gen.withSkills;
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(
    gen.review?.status ?? null,
  );

  async function startReview() {
    try {
      const res = await fetch(`/api/generations/${gen.id}/review`, {
        method: "POST",
      });
      const body = await res.json();
      if (res.ok) setReviewStatus(body.status ?? "running");
    } catch {}
  }

  if (isFailed) {
    return (
      <article className="card card-failed">
        <header className="card-head">
          <div className="card-title">{gen.prompt}</div>
          <button
            className="ghost mini"
            onClick={onDelete}
            title="Delete this generation"
            aria-label="Delete generation"
          >
            ✕
          </button>
        </header>

        <div className="card-meta">
          <span className="muted">{formatTime(gen.createdAt)}</span>
          {gen.skillIds.length > 0 ? (
            <div className="chips">
              {gen.skillIds.map((id) => (
                <span key={id} className="chip">
                  {id}
                </span>
              ))}
            </div>
          ) : (
            <span className="muted italic">no skills loaded</span>
          )}
          <span className="badge danger">failed</span>
        </div>

        <div className="failure">
          <div className="failure-message">
            {gen.error ?? "generation failed"}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">{gen.prompt}</div>
        <button
          className="ghost mini"
          onClick={onDelete}
          title="Delete this generation"
          aria-label="Delete generation"
        >
          ✕
        </button>
      </header>

      <div className="card-meta">
        <span className="muted">{formatTime(gen.createdAt)}</span>
        {gen.skillIds.length > 0 ? (
          <div className="chips">
            {gen.skillIds.map((id) => (
              <span key={id} className="chip">
                {id}
              </span>
            ))}
          </div>
        ) : (
          <span className="muted italic">no skills loaded</span>
        )}
        {isComparison && <span className="badge accent">comparison</span>}
        {isComparison && gen.status === "ready" && (
          <Link
            to={`/compare/${gen.id}`}
            target="_blank"
            className="ghost mini pane-open"
          >
            Open both ↗
          </Link>
        )}
        {isComparison && gen.status === "ready" && !reviewStatus && (
          <button className="ghost mini" onClick={startReview}>
            Review
          </button>
        )}
      </div>

      <div className={isComparison ? "split" : "single"}>
        <VariantPane
          label={isComparison ? "With skills" : null}
          variant={gen.withSkills!}
          initialStatus={gen.status}
        />
        {gen.withoutSkills && (
          <VariantPane
            label="Without skills"
            variant={gen.withoutSkills}
            initialStatus={gen.status}
          />
        )}
      </div>

      {reviewStatus && (
        <ReviewPanel generationId={gen.id} status={reviewStatus} />
      )}
    </article>
  );
}

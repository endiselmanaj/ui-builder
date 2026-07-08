import { useState, type CSSProperties } from "react";
import { ActivityLog } from "./ActivityLog";
import { StatusPill } from "./GenerationCard";
import { Preview } from "./Preview";
import { useAgentEvents } from "./hooks/useAgentEvents";
import type {
  ContextGeneration,
  ContextVariant,
  GenerationStatus,
} from "./types";

function VariantColumn({
  variant,
  initialStatus,
  focused,
  anyFocused,
  onToggleFocus,
}: {
  variant: ContextVariant;
  initialStatus: GenerationStatus;
  focused: boolean;
  anyFocused: boolean;
  onToggleFocus: () => void;
}) {
  const stream = useAgentEvents(variant.sessionId);
  const liveStatus: GenerationStatus = stream.ended
    ? stream.endInfo?.code === 0
      ? "ready"
      : "errored"
    : initialStatus;

  return (
    <div
      className={`ctx-col${focused ? " focused" : ""}${anyFocused && !focused ? " dimmed" : ""}`}
    >
      <button
        className="ctx-col-header"
        aria-label={`focus ${variant.label}`}
        onClick={onToggleFocus}
        title="Click to focus this column"
      >
        <span className="ctx-col-label">{variant.label}</span>
        <StatusPill status={liveStatus} />
      </button>
      <Preview previewUrl={variant.previewUrl} title={variant.sessionId} />
      <details className="ctx-log">
        <summary>Activity</summary>
        <ActivityLog events={stream.events} ended={stream.ended} />
      </details>
    </div>
  );
}

export function ContextGenerationCard({
  gen,
  onDelete,
}: {
  gen: ContextGeneration;
  onDelete: () => void;
}) {
  const [focusedTier, setFocusedTier] = useState<string | null>(null);
  const focusedIdx = gen.variants.findIndex((v) => v.tierId === focusedTier);

  // Drive the column widths from the focused INDEX, not DOM child position, so
  // focusing any column (incl. the last) always widens the right one. Columns
  // stay in natural order; the focused track gets 1fr, the rest go slim.
  const gridStyle: CSSProperties = {
    gridTemplateColumns:
      focusedIdx < 0
        ? `repeat(${gen.variants.length}, minmax(0, 1fr))`
        : gen.variants
            .map((_, i) => (i === focusedIdx ? "minmax(0, 1fr)" : "minmax(0, 140px)"))
            .join(" "),
  };

  return (
    <article className="gen-card ctx-card">
      <header className="gen-card-header">
        <div className="gen-prompt" title={gen.prompt}>
          {gen.prompt}
        </div>
        <StatusPill status={gen.status} />
        <time className="muted">{new Date(gen.createdAt).toLocaleString()}</time>
        <button className="ghost" aria-label="delete run" onClick={onDelete}>
          delete
        </button>
      </header>
      <div
        className={`ctx-grid${focusedIdx >= 0 ? " has-focus" : ""}`}
        style={gridStyle}
      >
        {gen.variants.map((v) => (
          <VariantColumn
            key={v.tierId}
            variant={v}
            initialStatus={gen.status}
            focused={focusedTier === v.tierId}
            anyFocused={focusedTier !== null}
            onToggleFocus={() =>
              setFocusedTier((cur) => (cur === v.tierId ? null : v.tierId))
            }
          />
        ))}
      </div>
    </article>
  );
}

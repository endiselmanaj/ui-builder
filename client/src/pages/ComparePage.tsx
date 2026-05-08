import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDivider } from "../hooks/useDivider";
import type { Generation, GenerationStatus } from "../types";

const statusMap: Record<GenerationStatus, { label: string; className: string }> = {
  running: { label: "⏱ running", className: "status running" },
  ready: { label: "✓ ready", className: "status ready" },
  errored: { label: "✗ errored", className: "status errored" },
  stopped: { label: "⏸ stopped", className: "status stopped" },
};

export function ComparePage() {
  const { generationId } = useParams<{ generationId: string }>();
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { leftPercent, isDragging, containerProps, dividerProps } = useDivider();

  useEffect(() => {
    fetch("/api/generations")
      .then((res) => res.json())
      .then((generations: Generation[]) => {
        const found = generations.find((g) => g.id === generationId);
        if (!found) {
          setError("not found");
        } else if (!found.withoutSkills) {
          setError("not a comparison");
        } else {
          setGeneration(found);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load generations");
        setLoading(false);
      });
  }, [generationId]);

  if (loading) {
    return <div className="compare-loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="compare-error">
        <p>{error}</p>
        <Link to="/" className="ghost mini">← Back to feed</Link>
      </div>
    );
  }

  if (!generation || !generation.withSkills || !generation.withoutSkills) {
    return null;
  }

  const s = statusMap[generation.status];

  return (
    <div className="compare-page">
      <div className="compare-topbar">
        <Link to="/" className="ghost mini">← Back to feed</Link>
        <span className="compare-prompt">{generation.prompt}</span>
        <span className={s.className}>{s.label}</span>
      </div>
      <div
        className="compare-body"
        {...containerProps}
        style={containerProps.style}
      >
        <div className="compare-pane" style={{ width: `${leftPercent}%` }}>
          <div className="compare-pane-head">
            <span className="pane-label">With skills</span>
            <a
              href={generation.withSkills.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ghost mini pane-open"
            >
              Open ↗
            </a>
          </div>
          <iframe
            title="With skills preview"
            src={generation.withSkills.previewUrl}
            className="compare-iframe"
            style={isDragging ? { pointerEvents: "none" } : undefined}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
        <div className="compare-divider" {...dividerProps} />
        <div className="compare-pane" style={{ width: `${100 - leftPercent}%` }}>
          <div className="compare-pane-head">
            <span className="pane-label">Without skills</span>
            <a
              href={generation.withoutSkills.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ghost mini pane-open"
            >
              Open ↗
            </a>
          </div>
          <iframe
            title="Without skills preview"
            src={generation.withoutSkills.previewUrl}
            className="compare-iframe"
            style={isDragging ? { pointerEvents: "none" } : undefined}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      </div>
    </div>
  );
}

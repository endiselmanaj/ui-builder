import { ActivityLog } from "./ActivityLog";
import { useReviewEvents } from "./hooks/useReviewEvents";
import type { ReviewStatus } from "./types";

function ReviewStatusPill({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, { label: string; className: string }> = {
    running: { label: "reviewing...", className: "status running" },
    ready: { label: "review done", className: "status ready" },
    errored: { label: "review failed", className: "status errored" },
  };
  const m = map[status];
  return <span className={m.className}>{m.label}</span>;
}

export function ReviewPanel({
  generationId,
  status,
}: {
  generationId: string;
  status: ReviewStatus;
}) {
  const stream = useReviewEvents(generationId);

  const liveStatus: ReviewStatus = stream.ended
    ? stream.endInfo?.code === 0
      ? "ready"
      : "errored"
    : status === "ready" || status === "errored"
    ? status
    : "running";

  return (
    <div className="review-panel">
      <div className="review-head">
        <div className="review-label">Skill Adherence Review</div>
        <ReviewStatusPill status={liveStatus} />
      </div>
      <ActivityLog
        events={stream.events}
        ended={stream.ended}
        empty="Review agent is analyzing both versions..."
      />
    </div>
  );
}

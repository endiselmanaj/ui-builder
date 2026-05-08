import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "../types";

export type ReviewStreamState = {
  events: AgentEvent[];
  ended: boolean;
  endInfo: { code?: number } | null;
};

export function useReviewEvents(
  generationId: string | null,
): ReviewStreamState {
  const [state, setState] = useState<ReviewStreamState>({
    events: [],
    ended: false,
    endInfo: null,
  });
  const buffer = useRef<AgentEvent[]>([]);
  const flushTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!generationId) return;
    setState({ events: [], ended: false, endInfo: null });
    buffer.current = [];

    const es = new EventSource(
      `/api/generations/${generationId}/review/events`,
    );

    function flush() {
      if (buffer.current.length === 0) return;
      const batch = buffer.current;
      buffer.current = [];
      setState((prev) => ({
        ...prev,
        events: prev.events.concat(batch),
      }));
    }

    function scheduleFlush() {
      if (flushTimer.current != null) return;
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null;
        flush();
      }, 60);
    }

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as AgentEvent;
        buffer.current.push(ev);
        scheduleFlush();
      } catch {}
    };

    es.addEventListener("end", (e: MessageEvent) => {
      flush();
      let info: { code?: number } | null = null;
      try {
        info = e.data ? JSON.parse(e.data) : null;
      } catch {}
      setState((prev) => ({ ...prev, ended: true, endInfo: info }));
      es.close();
    });

    es.onerror = () => {};

    return () => {
      if (flushTimer.current != null) {
        window.clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      es.close();
    };
  }, [generationId]);

  return state;
}

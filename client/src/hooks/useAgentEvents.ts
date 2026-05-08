import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "../types";

export type AgentStreamState = {
  events: AgentEvent[];
  ended: boolean;
  endInfo: { code?: number } | null;
};

export function useAgentEvents(sessionId: string | null): AgentStreamState {
  const [state, setState] = useState<AgentStreamState>({
    events: [],
    ended: false,
    endInfo: null,
  });
  // Buffer events between renders so we don't thrash setState on a fast
  // event burst.
  const buffer = useRef<AgentEvent[]>([]);
  const flushTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setState({ events: [], ended: false, endInfo: null });
    buffer.current = [];

    const es = new EventSource(`/api/sessions/${sessionId}/events`);

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
      } catch {
        // Ignore malformed lines; the server sends valid JSON.
      }
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

    es.onerror = () => {
      // Browser auto-retries by default; close on definitive failure when the
      // server has already sent the end event.
    };

    return () => {
      if (flushTimer.current != null) {
        window.clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      es.close();
    };
  }, [sessionId]);

  return state;
}

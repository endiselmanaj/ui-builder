import { useEffect, useMemo, useRef } from "react";
import type { AgentEvent } from "./types";

type Item =
  | { kind: "text"; text: string; key: string }
  | {
      kind: "tool";
      key: string;
      toolUseId: string;
      name: string;
      summary: string;
      status: "pending" | "ok" | "err";
      resultPreview?: string;
    }
  | { kind: "info"; key: string; text: string }
  | { kind: "error"; key: string; text: string };

export function ActivityLog({
  events,
  ended,
  empty,
}: {
  events: AgentEvent[];
  ended: boolean;
  empty?: string;
}) {
  const items = useMemo(() => deriveItems(events), [events]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length, ended]);

  if (items.length === 0) {
    return (
      <div className="activity-log empty-log">
        {empty ?? "Waiting for the agent…"}
      </div>
    );
  }

  return (
    <div className="activity-log" ref={scrollRef}>
      {items.map((it) => {
        if (it.kind === "text") {
          return (
            <div key={it.key} className="log-text">
              {it.text}
            </div>
          );
        }
        if (it.kind === "info") {
          return (
            <div key={it.key} className="log-info">
              {it.text}
            </div>
          );
        }
        if (it.kind === "error") {
          return (
            <div key={it.key} className="log-error">
              {it.text}
            </div>
          );
        }
        const icon =
          it.status === "ok" ? "✓" : it.status === "err" ? "✗" : "▸";
        return (
          <div key={it.key} className={`log-tool log-tool-${it.status}`}>
            <span className="log-tool-icon">{icon}</span>
            <span className="log-tool-name">{it.name}</span>
            <span className="log-tool-summary">{it.summary}</span>
            {it.status === "err" && it.resultPreview && (
              <details className="log-tool-detail">
                <summary>output</summary>
                <pre>{it.resultPreview}</pre>
              </details>
            )}
          </div>
        );
      })}
      {!ended && <div className="log-cursor">…</div>}
    </div>
  );
}

function deriveItems(events: AgentEvent[]): Item[] {
  const items: Item[] = [];
  // Map tool_use_id → index in `items` so we can mark results.
  const toolIdx = new Map<string, number>();

  events.forEach((ev, i) => {
    const t = (ev as any).type;

    if (t === "system") {
      const sub = (ev as any).subtype;
      if (sub === "init") {
        // Skip the init blob; it's noisy. Could surface model/tools later.
      }
      return;
    }

    if (t === "assistant") {
      const content = (ev as any).message?.content;
      if (!Array.isArray(content)) return;
      for (let j = 0; j < content.length; j++) {
        const block = content[j];
        if (!block || typeof block !== "object") continue;
        if (block.type === "text" && typeof block.text === "string") {
          const text = block.text.trim();
          if (text) {
            items.push({
              kind: "text",
              text,
              key: `${i}-text-${j}`,
            });
          }
        } else if (block.type === "tool_use") {
          const id = String(block.id ?? `${i}-${j}`);
          const name = String(block.name ?? "tool");
          const summary = summarizeToolUse(name, block.input);
          items.push({
            kind: "tool",
            key: `${i}-tool-${j}`,
            toolUseId: id,
            name,
            summary,
            status: "pending",
          });
          toolIdx.set(id, items.length - 1);
        }
      }
      return;
    }

    if (t === "user") {
      const content = (ev as any).message?.content;
      if (!Array.isArray(content)) return;
      for (const block of content) {
        if (!block || block.type !== "tool_result") continue;
        const id = String(block.tool_use_id ?? "");
        const idx = toolIdx.get(id);
        const isErr = Boolean(block.is_error);
        if (idx != null) {
          const item = items[idx];
          if (item.kind === "tool") {
            item.status = isErr ? "err" : "ok";
            if (isErr) {
              item.resultPreview = previewOf(block.content);
            }
          }
        }
      }
      return;
    }

    if (t === "result") {
      const isErr = Boolean((ev as any).is_error);
      const result = (ev as any).result;
      const cost = (ev as any).total_cost_usd;
      const dur = (ev as any).duration_ms;
      const parts: string[] = ["Done"];
      if (typeof dur === "number") parts.push(`${(dur / 1000).toFixed(1)}s`);
      if (typeof cost === "number") parts.push(`$${cost.toFixed(4)}`);
      const text =
        parts.join(" · ") +
        (isErr && typeof result === "string" ? ` — ${result.slice(0, 200)}` : "");
      items.push({
        kind: isErr ? "error" : "info",
        key: `${i}-result`,
        text,
      });
      return;
    }

    if (t === "stderr" || t === "error") {
      const text = String((ev as any).text ?? "").trim();
      if (text) {
        items.push({ kind: "error", key: `${i}-${t}`, text });
      }
      return;
    }

    if (t === "raw") {
      // Don't surface raw lines; they only happen if Claude emits non-JSON.
      return;
    }

    // Partial streaming events (stream_event with --include-partial-messages)
    // and anything else — ignored for v1.
  });

  return items;
}

function summarizeToolUse(name: string, input: any): string {
  if (!input || typeof input !== "object") return "";
  switch (name) {
    case "Edit": {
      const fp = input.file_path ?? input.filePath;
      return fp ? short(String(fp)) : "";
    }
    case "Write": {
      const fp = input.file_path ?? input.filePath;
      return fp ? short(String(fp)) : "";
    }
    case "Read": {
      const fp = input.file_path ?? input.filePath;
      return fp ? short(String(fp)) : "";
    }
    case "Bash": {
      const cmd = input.command ?? input.cmd;
      return cmd ? truncate(String(cmd), 80) : "";
    }
    case "Glob":
    case "Grep": {
      const pat = input.pattern ?? input.query;
      return pat ? truncate(String(pat), 60) : "";
    }
    default:
      return "";
  }
}

function short(filePath: string): string {
  // Trim absolute prefix, keep at most 2 trailing path segments.
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length <= 2) return filePath;
  return ".../" + parts.slice(-2).join("/");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function previewOf(content: any): string {
  if (typeof content === "string") return truncate(content, 400);
  if (Array.isArray(content)) {
    const text = content
      .map((b: any) => (b?.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
    return truncate(text, 400);
  }
  try {
    return truncate(JSON.stringify(content), 400);
  } catch {
    return "";
  }
}

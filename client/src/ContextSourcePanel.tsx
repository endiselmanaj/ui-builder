import { useRef, useState } from "react";
import type { ContextSource } from "./types";

export function ContextSourcePanel({
  sources,
  onChanged,
}: {
  sources: ContextSource[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [urlLabel, setUrlLabel] = useState("");
  const [urls, setUrls] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0 || !label.trim()) {
      setErr("pick file(s) and a label");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("label", label.trim());
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch("/api/context/sources", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addUrlSource() {
    const list = urls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urlLabel.trim() || list.length === 0) {
      setErr("url source needs a label and at least one url");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/context/sources/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: urlLabel.trim(),
          urls: list,
          instructions: instructions.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      setUrlLabel("");
      setUrls("");
      setInstructions("");
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/context/sources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
      await onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ctx-sources">
      <button className="ghost" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} Context library ({sources.length})
      </button>
      {open && (
        <div className="ctx-sources-body">
          <ul className="ctx-source-list">
            {sources.map((s) => (
              <li key={s.id}>
                <span className={`src-chip src-chip-${s.kind}`}>
                  {s.kind === "url" ? "🔗 " : "📄 "}
                  {s.label}
                </span>
                <span className="muted">
                  {s.kind === "url" ? (s.urls ?? []).join(", ") : s.files.join(", ")}
                </span>
                <button className="ghost" onClick={() => remove(s.id)}>
                  delete
                </button>
              </li>
            ))}
            {sources.length === 0 && <li className="muted">library is empty</li>}
          </ul>

          <div className="ctx-source-forms">
            <div className="ctx-form">
              <strong>Upload files</strong>
              <input
                placeholder="label, e.g. Briefing document"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xml,.md,.txt" />
              <button onClick={uploadFiles} disabled={busy}>Add file source</button>
            </div>
            <div className="ctx-form">
              <strong>Add URL source (browsed live)</strong>
              <input
                placeholder="label, e.g. Figma design"
                value={urlLabel}
                onChange={(e) => setUrlLabel(e.target.value)}
              />
              <textarea
                placeholder="one URL per line"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={2}
              />
              <textarea
                placeholder="extra instructions for the agent (optional)"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
              />
              <button onClick={addUrlSource} disabled={busy}>Add URL source</button>
            </div>
          </div>
          {err && <div className="error">{err}</div>}
        </div>
      )}
    </section>
  );
}

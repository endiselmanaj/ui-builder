// Iframe-based preview pointing at a session's Vite dev server (proxied).
// HMR keeps the iframe in sync as the agent edits files in the session.
export function Preview({
  previewUrl,
  title,
}: {
  previewUrl: string;
  title?: string;
}) {
  return (
    <iframe
      src={previewUrl}
      title={title ?? "preview"}
      style={{
        width: "100%",
        height: 480,
        border: "1px solid #e5e5e5",
        borderRadius: 8,
        background: "#fff",
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    />
  );
}

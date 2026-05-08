import { useEffect, useRef } from "react";

export function PromptInput({
  value,
  onChange,
  disabled,
  onSubmit,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Autosize: grow with content, capped at ~360px.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="compose-textarea"
      placeholder='Describe the UI to build, e.g. "A dashboard with three KPI tiles and a weekly orders bar chart"'
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSubmit?.();
        }
      }}
      rows={3}
    />
  );
}

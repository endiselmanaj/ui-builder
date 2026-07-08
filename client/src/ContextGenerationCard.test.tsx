import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextGenerationCard } from "./ContextGenerationCard";
import type { ContextGeneration } from "./types";

beforeEach(() => {
  vi.stubGlobal(
    "EventSource",
    class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      close = vi.fn();
      constructor(_url: string) {}
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const gen: ContextGeneration = {
  id: "g1",
  createdAt: "2026-07-07T10:00:00.000Z",
  prompt: "Build the tool",
  status: "running",
  variants: [
    { tierId: "tier-1", label: "Briefing only", sourceIds: ["a"], sessionId: "s1", previewUrl: "/api/preview/s1/", chrome: false },
    { tierId: "tier-2", label: "Briefing + Schematic", sourceIds: ["a", "b"], sessionId: "s2", previewUrl: "/api/preview/s2/", chrome: false },
    { tierId: "tier-3", label: "Briefing + Schematic + Figma", sourceIds: ["a", "b", "c"], sessionId: "s3", previewUrl: "/api/preview/s3/", chrome: true },
  ],
};

describe("ContextGenerationCard", () => {
  it("renders one column per variant with its tier label", () => {
    render(<ContextGenerationCard gen={gen} onDelete={vi.fn()} />);
    expect(screen.getByText("Briefing only")).toBeInTheDocument();
    expect(screen.getByText("Briefing + Schematic")).toBeInTheDocument();
    expect(screen.getByText("Briefing + Schematic + Figma")).toBeInTheDocument();
  });

  it("clicking a column header focuses it; clicking again unfocuses", () => {
    const { container } = render(<ContextGenerationCard gen={gen} onDelete={vi.fn()} />);
    const header = screen.getByRole("button", { name: /focus Briefing only/i });
    fireEvent.click(header);
    expect(container.querySelector(".ctx-grid.has-focus")).not.toBeNull();
    expect(container.querySelector(".ctx-col.focused")).not.toBeNull();
    fireEvent.click(header);
    expect(container.querySelector(".ctx-grid.has-focus")).toBeNull();
  });

  it("delete button calls onDelete", () => {
    const onDelete = vi.fn();
    render(<ContextGenerationCard gen={gen} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});

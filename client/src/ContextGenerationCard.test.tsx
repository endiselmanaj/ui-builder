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
    { tierId: "tier-1", label: "Briefing only", sourceIds: ["a"], sessionId: "s1", previewUrl: "/api/preview/s1/" },
    { tierId: "tier-2", label: "Briefing + Schematic", sourceIds: ["a", "b"], sessionId: "s2", previewUrl: "/api/preview/s2/" },
  ],
};

describe("ContextGenerationCard", () => {
  it("renders one column per variant with its tier label", () => {
    render(<ContextGenerationCard gen={gen} onDelete={vi.fn()} />);
    expect(screen.getByText("Briefing only")).toBeInTheDocument();
    expect(screen.getByText("Briefing + Schematic")).toBeInTheDocument();
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

  it("focusing the last column widens its track and marks only that column focused", () => {
    const { container } = render(<ContextGenerationCard gen={gen} onDelete={vi.fn()} />);
    const header = screen.getByRole("button", { name: /focus Briefing \+ Schematic/i });
    fireEvent.click(header);

    const grid = container.querySelector(".ctx-grid") as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.style.gridTemplateColumns.endsWith("minmax(0, 1fr)")).toBe(true);
    expect(grid.style.gridTemplateColumns).toBe(
      "minmax(0, 140px) minmax(0, 1fr)",
    );

    const cols = container.querySelectorAll(".ctx-col");
    expect(cols).toHaveLength(2);
    expect(cols[0].className).not.toContain("focused");
    expect(cols[1].className).toContain("focused");
  });

  it("delete button calls onDelete", () => {
    const onDelete = vi.fn();
    render(<ContextGenerationCard gen={gen} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});

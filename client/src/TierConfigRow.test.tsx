import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierConfigRow } from "./TierConfigRow";
import type { ContextSource, ContextTier } from "./types";

const sources: ContextSource[] = [
  { id: "a", label: "Briefing", kind: "file", files: ["b.pdf"], createdAt: "" },
  { id: "b", label: "Figma", kind: "url", files: [], urls: ["https://x"], createdAt: "" },
];
const tiers: ContextTier[] = [
  { id: "tier-1", label: "Briefing only", sourceIds: ["a"] },
  { id: "tier-2", label: "Briefing + Schematic", sourceIds: [] },
  { id: "tier-3", label: "Briefing + Schematic + Figma", sourceIds: [] },
];

describe("TierConfigRow", () => {
  it("renders a column per tier with its source chips", () => {
    render(<TierConfigRow sources={sources} tiers={tiers} onTiersChange={vi.fn()} />);
    expect(screen.getByText("Briefing only")).toBeInTheDocument();
    expect(screen.getByText("Briefing + Schematic + Figma")).toBeInTheDocument();
    expect(screen.getByText("Briefing")).toBeInTheDocument();
  });

  it("removing a chip calls onTiersChange without that source id", () => {
    const onChange = vi.fn();
    render(<TierConfigRow sources={sources} tiers={tiers} onTiersChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove Briefing/i }));
    expect(onChange).toHaveBeenCalledWith([
      { id: "tier-1", label: "Briefing only", sourceIds: [] },
      tiers[1],
      tiers[2],
    ]);
  });

  it("adding a source via the select calls onTiersChange with it appended", () => {
    const onChange = vi.fn();
    render(<TierConfigRow sources={sources} tiers={tiers} onTiersChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith([
      tiers[0],
      { id: "tier-2", label: "Briefing + Schematic", sourceIds: ["b"] },
      tiers[2],
    ]);
  });
});

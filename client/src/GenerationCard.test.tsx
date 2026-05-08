import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GenerationCard } from "./GenerationCard";
import type { Generation, GenerationVariant } from "./types";

// Mock EventSource so VariantPane's useAgentEvents doesn't throw in jsdom
beforeEach(() => {
  vi.stubGlobal(
    "EventSource",
    class MockEventSource {
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      close = vi.fn();
      constructor() {}
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeVariant(overrides: Partial<GenerationVariant> = {}): GenerationVariant {
  return {
    sessionId: "sess-" + Math.random().toString(36).slice(2, 8),
    previewUrl: "/api/preview/test/",
    ...overrides,
  };
}

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-123",
    createdAt: new Date().toISOString(),
    prompt: "Build a counter app",
    skillIds: [],
    status: "ready",
    withSkills: makeVariant(),
    withoutSkills: null,
    ...overrides,
  };
}

function renderCard(gen: Generation) {
  return render(
    <MemoryRouter>
      <GenerationCard gen={gen} onDelete={vi.fn()} />
    </MemoryRouter>
  );
}

describe("GenerationCard 'Open both' link", () => {
  it("shows 'Open both' link when generation is a comparison and status is ready", () => {
    const gen = makeGeneration({
      status: "ready",
      withSkills: makeVariant(),
      withoutSkills: makeVariant(),
    });

    renderCard(gen);

    const link = screen.getByRole("link", { name: /open both/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", `/compare/${gen.id}`);
  });

  it("does not show 'Open both' when generation is a comparison but status is running", () => {
    const gen = makeGeneration({
      status: "running",
      withSkills: makeVariant(),
      withoutSkills: makeVariant(),
    });

    renderCard(gen);

    expect(screen.queryByRole("link", { name: /open both/i })).not.toBeInTheDocument();
  });

  it("does not show 'Open both' when generation is a solo (withoutSkills is null)", () => {
    const gen = makeGeneration({
      status: "ready",
      withSkills: makeVariant(),
      withoutSkills: null,
    });

    renderCard(gen);

    expect(screen.queryByRole("link", { name: /open both/i })).not.toBeInTheDocument();
  });

  it("renders 'Open both' link with target='_blank'", () => {
    const gen = makeGeneration({
      status: "ready",
      withSkills: makeVariant(),
      withoutSkills: makeVariant(),
    });

    renderCard(gen);

    const link = screen.getByRole("link", { name: /open both/i });
    expect(link).toHaveAttribute("target", "_blank");
  });
});

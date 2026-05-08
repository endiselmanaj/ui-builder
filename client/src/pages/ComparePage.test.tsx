import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ComparePage } from "./ComparePage";
import type { Generation } from "../types";

const mockGeneration: Generation = {
  id: "test-gen-id",
  createdAt: "2026-01-01T00:00:00Z",
  prompt: "Build a dashboard",
  skillIds: ["tailwind"],
  status: "ready",
  withSkills: { sessionId: "s1", previewUrl: "/api/preview/s1/" },
  withoutSkills: { sessionId: "s2", previewUrl: "/api/preview/s2/" },
};

function renderWithRouter(generationId = "test-gen-id") {
  return render(
    <MemoryRouter initialEntries={[`/compare/${generationId}`]}>
      <Routes>
        <Route path="/compare/:generationId" element={<ComparePage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockFetchGenerations(generations: Generation[]) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => generations,
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ComparePage", () => {
  it("shows loading state while fetching generations", () => {
    // fetch that never resolves keeps us in loading state
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));

    renderWithRouter();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows both variant iframes when generation is a comparison", async () => {
    mockFetchGenerations([mockGeneration]);

    renderWithRouter();

    await waitFor(() => {
      const iframes = screen.getAllByTitle(/preview/i);
      expect(iframes).toHaveLength(2);
    });

    const iframes = screen.getAllByTitle(/preview/i);
    expect(iframes[0]).toHaveAttribute("src", "/api/preview/s1/");
    expect(iframes[1]).toHaveAttribute("src", "/api/preview/s2/");
  });

  it("shows 'With skills' and 'Without skills' labels", async () => {
    mockFetchGenerations([mockGeneration]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("With skills")).toBeInTheDocument();
    });
    expect(screen.getByText("Without skills")).toBeInTheDocument();
  });

  it("shows the prompt text in the top bar", async () => {
    mockFetchGenerations([mockGeneration]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/Build a dashboard/)).toBeInTheDocument();
    });
  });

  it("shows error with link back to / when generation is not found", async () => {
    mockFetchGenerations([]);

    renderWithRouter("nonexistent-id");

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });

    const backLink = screen.getByRole("link", { name: /back/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("shows error when generation exists but is not a comparison", async () => {
    const soloGeneration: Generation = {
      ...mockGeneration,
      id: "solo-gen",
      withoutSkills: null,
    };
    mockFetchGenerations([soloGeneration]);

    renderWithRouter("solo-gen");

    await waitFor(() => {
      expect(screen.getByText(/not a comparison/i)).toBeInTheDocument();
    });

    const backLink = screen.getByRole("link", { name: /back/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("shows 'Back to feed' link pointing to /", async () => {
    mockFetchGenerations([mockGeneration]);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/Back to feed/i)).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /Back to feed/i });
    expect(link).toHaveAttribute("href", "/");
  });
});

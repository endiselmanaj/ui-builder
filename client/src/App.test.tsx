import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

function mockFetch() {
  const defaultSettings = {
    model: "sonnet",
    effort: "",
    maxBudgetUsd: null,
    permissionMode: "acceptEdits",
    tools: "",
    appendSystemPrompt: "",
    bare: false,
  };

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/skills")) {
      return { ok: true, json: async () => [] } as Response;
    }
    if (url.includes("/api/workspace")) {
      return { ok: true, json: async () => ({ installed: [] }) } as Response;
    }
    if (url.includes("/api/generations")) {
      return { ok: true, json: async () => [] } as Response;
    }
    if (url.includes("/api/settings")) {
      return { ok: true, json: async () => defaultSettings } as Response;
    }

    return { ok: true, json: async () => ({}) } as Response;
  });
}

function renderApp(initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App routing", () => {
  it("renders GeneratePage at / route", async () => {
    mockFetch();
    renderApp("/");

    await waitFor(() => {
      // GeneratePage contains the prompt input area
      expect(
        screen.getByPlaceholderText(/describe|build|generate|prompt/i)
      ).toBeInTheDocument();
    });
  });

  it("renders SkillsPage at /skills route", async () => {
    mockFetch();
    renderApp("/skills");

    await waitFor(() => {
      // SkillsPage shows the skills library heading or content area
      expect(screen.getByText(/skills/i)).toBeInTheDocument();
    });

    // GeneratePage prompt input should NOT be present
    expect(
      screen.queryByPlaceholderText(/describe|build|generate|prompt/i)
    ).not.toBeInTheDocument();
  });

  it("renders ComparePage at /compare/:generationId route", async () => {
    mockFetch();
    renderApp("/compare/test-gen-123");

    // ComparePage fetches generations and shows a loading indicator
    // It should NOT show the GeneratePage prompt input
    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    expect(
      screen.queryByPlaceholderText(/describe|build|generate|prompt/i)
    ).not.toBeInTheDocument();
  });
});

describe("Nav active state", () => {
  it("marks Generate link as active when on /", async () => {
    mockFetch();
    renderApp("/");

    await waitFor(() => {
      const generateLink = screen.getByRole("link", { name: /generate/i });
      expect(generateLink).toHaveClass("active");
    });
  });

  it("marks Skills link as active when on /skills", async () => {
    mockFetch();
    renderApp("/skills");

    await waitFor(() => {
      const skillsLink = screen.getByRole("link", { name: /skills/i });
      expect(skillsLink).toHaveClass("active");
    });
  });
});

describe("Nav navigation", () => {
  it("navigates from Generate to Skills via nav link", async () => {
    mockFetch();
    const user = userEvent.setup();
    renderApp("/");

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /generate/i })).toBeInTheDocument();
    });

    // Click Skills link
    const skillsLink = screen.getByRole("link", { name: /skills/i });
    await user.click(skillsLink);

    // Skills page should now be rendered, Generate page content should be gone
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText(/describe|build|generate|prompt/i)
      ).not.toBeInTheDocument();
    });

    // Skills link should now be active
    expect(screen.getByRole("link", { name: /skills/i })).toHaveClass("active");
  });
});

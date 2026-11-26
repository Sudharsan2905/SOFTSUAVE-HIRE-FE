import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import ScoreFilterPage from "./ScoreFilterPage";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (_e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title }: { title: string }) => <h1 data-testid="header-title">{title}</h1>,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ workspaceId: "ws-1" }) };
});

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

const ASSESSMENTS = [
  { id: "a1", name: "Python" },
  { id: "a2", name: "SQL" },
  { id: "a3", name: "React" },
];

function row(
  id: string,
  name: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    candidate: { id, name, email: `${id}@example.com` },
    completed_count: 2,
    combined_score: 12,
    combined_total: 20,
    combined_percentage: 60,
    result: null,
    breakdown: [
      { assessment_id: "a1", status: "completed", score: 8, total: 10, percentage: 80 },
      { assessment_id: "a2", status: "completed", score: 4, total: 10, percentage: 40 },
    ],
    ...overrides,
  };
}

function scoreFilterBody(candidates: object[], overrides: Record<string, unknown> = {}) {
  return {
    data: {
      data: {
        assessments: [ASSESSMENTS[0], ASSESSMENTS[1]],
        pass_percentage: null,
        summary: { total: candidates.length, completed: 0, passed: 0, failed: 0, incomplete: 0 },
        candidates,
        pagination: {
          total: candidates.length,
          page: 1,
          page_size: 20,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
        ...overrides,
      },
    },
  };
}

function scoreFilterCalls(): URL[] {
  return mockGet.mock.calls
    .map((c) => c[0] as string)
    .filter((u) => u.includes("/score-filter"))
    .map((u) => new URL(u, "http://test"));
}

function lastScoreFilterCall(): URL {
  const calls = scoreFilterCalls();
  return calls[calls.length - 1];
}

/** Respond to the assessments list and to score-filter requests. */
function mockApi(scoreFilter: () => unknown = () => scoreFilterBody([row("c1", "Asha K")])) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes("/score-filter")) return Promise.resolve(scoreFilter());
    return Promise.resolve({ data: { data: { assessments: ASSESSMENTS } } });
  });
}

async function pick(...names: string[]) {
  await screen.findByRole("button", { name: "Assessments" }); // options loaded after mount
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
  fireEvent.click(screen.getByLabelText("Assessments"));
  for (const name of names) {
    fireEvent.click(await screen.findByRole("option", { name }));
  }
  fireEvent.keyDown(document, { key: "Escape" });
}

function typePass(value: string) {
  fireEvent.change(screen.getByLabelText("Pass percentage"), { target: { value } });
}

describe("ScoreFilterPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockToastError.mockReset();
    mockApi();
  });

  it("shows the title and an empty state until an assessment is picked", async () => {
    renderWithProviders(<ScoreFilterPage />);

    expect(screen.getByTestId("header-title")).toHaveTextContent("Score Filter");
    expect(screen.getByText("Select one or more assessments")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/api/workspaces/ws-1/assessments?")
      )
    );
    expect(scoreFilterCalls()).toHaveLength(0);
  });

  it("loads candidates for every selected assessment, with no pass percentage by default", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");

    await screen.findByText("Asha K");
    const url = lastScoreFilterCall();
    expect(url.pathname).toBe("/api/workspaces/ws-1/assessments/score-filter");
    expect(url.searchParams.getAll("assessment_ids")).toEqual(["a1", "a2"]);
    expect(url.searchParams.has("pass_percentage")).toBe(false);
    expect(url.searchParams.has("result")).toBe(false);
    expect(url.searchParams.get("sort_by")).toBe("combined_percentage");
    expect(url.searchParams.get("sort_order")).toBe("desc");
    expect(screen.getByText("12 / 20")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows each assessment's percentage in the breakdown", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");

    await screen.findByText("Asha K");
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("sends the typed pass percentage and shows Passed / Failed", async () => {
    mockApi(() =>
      scoreFilterBody(
        [row("c1", "Asha K", { result: "passed" }), row("c2", "Ravi S", { result: "failed" })],
        {
          pass_percentage: 60,
          summary: { total: 2, completed: 2, passed: 1, failed: 1, incomplete: 0 },
        }
      )
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");
    await screen.findByText("Asha K");

    typePass("60");

    await waitFor(() =>
      expect(lastScoreFilterCall().searchParams.get("pass_percentage")).toBe("60")
    );
    // "Passed" / "Failed" are also summary-card labels, so look inside the table only
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("Passed")).toBeInTheDocument();
    expect(within(table).getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Passed", { selector: "p" }).nextElementSibling).toHaveTextContent("1");
  });

  it("shows summary counts as dashes until a pass percentage is applied", async () => {
    mockApi(() =>
      scoreFilterBody([row("c1", "Asha K")], {
        summary: { total: 5, completed: 4, passed: 0, failed: 0, incomplete: 1 },
      })
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");

    await screen.findByText("Asha K");
    expect(screen.getByText("Candidates").nextElementSibling).toHaveTextContent("5");
    expect(screen.getByText("Passed").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("Failed").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("Incomplete").nextElementSibling).toHaveTextContent("1");
  });

  it("rejects a percentage outside 0-100 without sending it", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");
    const before = scoreFilterCalls().length;

    typePass("150");

    expect(screen.getByText("Enter a value between 0 and 100")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 600)); // longer than the debounce
    expect(scoreFilterCalls().length).toBe(before);
    expect(lastScoreFilterCall().searchParams.has("pass_percentage")).toBe(false);
  });

  it("offers Passed / Failed in the result filter only once a percentage is entered", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    fireEvent.click(screen.getByLabelText("Result"));
    expect(screen.queryByRole("button", { name: "Passed" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Incomplete" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.body);

    typePass("50");
    await waitFor(() =>
      expect(lastScoreFilterCall().searchParams.get("pass_percentage")).toBe("50")
    );
    fireEvent.click(screen.getByLabelText("Result"));

    expect(await screen.findByRole("button", { name: "Passed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Failed" })).toBeInTheDocument();
  });

  it("filters by result and goes back to all when the percentage is cleared", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");
    typePass("50");
    await waitFor(() =>
      expect(lastScoreFilterCall().searchParams.get("pass_percentage")).toBe("50")
    );

    fireEvent.click(screen.getByLabelText("Result"));
    fireEvent.click(await screen.findByRole("button", { name: "Failed" }));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("result")).toBe("failed"));

    typePass("");

    await waitFor(() => expect(lastScoreFilterCall().searchParams.has("result")).toBe(false));
    expect(lastScoreFilterCall().searchParams.has("pass_percentage")).toBe(false);
  });

  it("shows incomplete candidates with the state of each assessment", async () => {
    mockApi(() =>
      scoreFilterBody([
        row("c1", "Ravi S", {
          completed_count: 1,
          combined_score: null,
          combined_total: null,
          combined_percentage: null,
          result: "incomplete",
          breakdown: [
            { assessment_id: "a1", status: "completed", score: 8, total: 10, percentage: 80 },
            {
              assessment_id: "a2",
              status: "in_progress",
              score: null,
              total: null,
              percentage: null,
            },
          ],
        }),
      ])
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");

    await screen.findByText("Ravi S");
    expect(screen.getByText("Incomplete", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("sorts by name when the Candidate header is clicked, then toggles direction", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    fireEvent.click(screen.getByRole("button", { name: /^Candidate/ }));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("sort_by")).toBe("name"));
    expect(lastScoreFilterCall().searchParams.get("sort_order")).toBe("asc");

    fireEvent.click(screen.getByRole("button", { name: /^Candidate/ }));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("sort_order")).toBe("desc"));
  });

  it("sends the search text", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "asha" } });

    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("search")).toBe("asha"));
  });

  it("restarts from page 1 whenever a filter changes", async () => {
    mockApi(() =>
      scoreFilterBody([row("c1", "Asha K")], {
        pagination: {
          total: 45,
          page: 1,
          page_size: 20,
          total_pages: 3,
          has_next: true,
          has_prev: false,
        },
      })
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("page")).toBe("2"));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "x" } });

    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("search")).toBe("x"));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("page")).toBe("1"));
  });

  it("shows an empty message when nobody matches", async () => {
    mockApi(() => scoreFilterBody([]));
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");

    expect(
      await screen.findByText("No candidates have taken the selected assessments yet")
    ).toBeInTheDocument();
  });

  it("reports a failed request", async () => {
    mockGet.mockImplementation((url: string) =>
      url.includes("/score-filter")
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ data: { data: { assessments: ASSESSMENTS } } })
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to load score filter results")
    );
  });

  it("clears the table when every assessment is deselected", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    fireEvent.click(screen.getByLabelText("Assessments"));
    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(await screen.findByText("Select one or more assessments")).toBeInTheDocument();
    expect(screen.queryByText("Asha K")).not.toBeInTheDocument();
  });

  it("keeps the selection when the table is for a different page of the same filter", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");
    await screen.findByText("Asha K");

    const trigger = screen.getByLabelText("Assessments");

    expect(within(trigger).getByText("2 selected")).toBeInTheDocument();
  });
});

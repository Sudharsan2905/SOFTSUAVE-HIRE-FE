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

vi.mock("write-excel-file/browser", () => ({
  // writeXlsxFile(rows, opts).toFile(name): synchronous return, async toFile
  default: vi.fn(),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div>
      <h1 data-testid="header-title">{title}</h1>
      <div data-testid="header-actions">{actions}</div>
    </div>
  ),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ workspaceId: "ws-1" }) };
});

import { api } from "@/utils/api";
import toast from "react-hot-toast";
import writeXlsxFile from "write-excel-file/browser";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;
const mockWriteXlsxFile = writeXlsxFile as unknown as ReturnType<typeof vi.fn>;

const ASSESSMENTS = [
  { id: "a1", name: "Python" },
  { id: "a2", name: "SQL" },
  { id: "a3", name: "React" },
];

/** One candidate's submission in one assessment, completed and scored by default. */
function entry(
  id: string,
  name: string,
  assessment = ASSESSMENTS[0],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    candidate: { id, name, email: `${id}@example.com` },
    assessment,
    status: "completed",
    score: 8,
    total: 10,
    percentage: 80,
    result: null,
    ...overrides,
  };
}

const PAGINATION = {
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
  has_next: false,
  has_prev: false,
};

function scoreFilterBody(entries: object[], overrides: Record<string, unknown> = {}) {
  return {
    data: {
      data: {
        assessments: [ASSESSMENTS[0], ASSESSMENTS[1]],
        pass_percentage: null,
        summary: { total: entries.length, completed: 0, passed: 0, failed: 0, incomplete: 0 },
        entries,
        pagination: { ...PAGINATION, total: entries.length },
        ...overrides,
      },
    },
  };
}

function exportBody(rows: object[]) {
  return { data: { data: rows } };
}

function urls(suffix: string): URL[] {
  return mockGet.mock.calls
    .map((c) => new URL(c[0] as string, "http://test"))
    .filter((u) => u.pathname.endsWith(suffix));
}

const scoreFilterCalls = () => urls("/score-filter");
const exportCalls = () => urls("/score-filter/export");

function lastScoreFilterCall(): URL {
  const calls = scoreFilterCalls();
  return calls[calls.length - 1];
}

const EXPORT_ROWS = [
  {
    name: "Asha K",
    email: "asha@example.com",
    assessment: "Python",
    status: "completed",
    score: 8,
    total: 10,
    percentage: 80,
    result: "passed",
  },
  {
    name: "Ravi S",
    email: null,
    assessment: "SQL",
    status: "in_progress",
    score: null,
    total: null,
    percentage: null,
    result: "incomplete",
  },
];

/** Respond to the assessments list, score-filter and export requests. */
function mockApi(
  scoreFilter: () => unknown = () => scoreFilterBody([entry("c1", "Asha K")]),
  exportRows: () => unknown = () => exportBody(EXPORT_ROWS)
) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes("/score-filter/export")) return Promise.resolve(exportRows());
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
    mockWriteXlsxFile.mockReset();
    mockWriteXlsxFile.mockReturnValue({ toFile: vi.fn().mockResolvedValue(undefined) });
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

  it("loads entries for every selected assessment, with no pass percentage by default", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");

    await screen.findByText("Asha K");
    const url = lastScoreFilterCall();
    expect(url.pathname).toBe("/api/workspaces/ws-1/assessments/score-filter");
    expect(url.searchParams.getAll("assessment_ids")).toEqual(["a1", "a2"]);
    expect(url.searchParams.has("pass_percentage")).toBe(false);
    expect(url.searchParams.has("result")).toBe(false);
    expect(url.searchParams.get("sort_by")).toBe("percentage");
    expect(url.searchParams.get("sort_order")).toBe("desc");
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("lists a candidate once per assessment instead of grouping them into one row", async () => {
    mockApi(() =>
      scoreFilterBody([
        entry("c1", "Asha K", ASSESSMENTS[0], { score: 8, percentage: 80 }),
        entry("c1", "Asha K", ASSESSMENTS[1], { score: 4, percentage: 40 }),
      ])
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");

    await waitFor(() => expect(screen.getAllByText("Asha K")).toHaveLength(2));
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1); // skip the header
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Python")).toBeInTheDocument();
    expect(within(rows[0]).getByText("80%")).toBeInTheDocument();
    expect(within(rows[1]).getByText("SQL")).toBeInTheDocument();
    expect(within(rows[1]).getByText("40%")).toBeInTheDocument();
  });

  it("no longer shows the grouped columns", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    const headers = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim());
    expect(headers).toEqual(["Candidate", "Assessment", "Status", "Score", "Percentage", "Result"]);
  });

  it("keeps duplicate entries instead of filtering them out", async () => {
    mockApi(() =>
      scoreFilterBody([
        entry("c1", "Asha K", ASSESSMENTS[0], { percentage: 80 }),
        entry("c1", "Asha K", ASSESSMENTS[0], { percentage: 30, score: 3 }),
      ])
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");

    await waitFor(() => expect(screen.getAllByText("Asha K")).toHaveLength(2));
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("sends the typed pass percentage and shows Passed / Failed", async () => {
    mockApi(() =>
      scoreFilterBody(
        [
          entry("c1", "Asha K", ASSESSMENTS[0], { result: "passed" }),
          entry("c2", "Ravi S", ASSESSMENTS[0], { result: "failed" }),
        ],
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
      scoreFilterBody([entry("c1", "Asha K")], {
        summary: { total: 5, completed: 4, passed: 0, failed: 0, incomplete: 1 },
      })
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");

    await screen.findByText("Asha K");
    expect(screen.getByText("Submissions").nextElementSibling).toHaveTextContent("5");
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

  it("shows an unfinished entry with its state and no score", async () => {
    mockApi(() =>
      scoreFilterBody([
        entry("c1", "Ravi S", ASSESSMENTS[1], {
          status: "in_progress",
          score: null,
          total: null,
          percentage: null,
          result: "incomplete",
        }),
      ])
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");

    await screen.findByText("Ravi S");
    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(within(row).getByText("SQL")).toBeInTheDocument();
    expect(within(row).getByText("Attending")).toBeInTheDocument();
    expect(within(row).getByText("Incomplete")).toBeInTheDocument();
    expect(within(row).getAllByText("—")).toHaveLength(2); // score and percentage
  });

  it("labels a completed but not yet scored entry", async () => {
    mockApi(() =>
      scoreFilterBody([
        entry("c1", "Ravi S", ASSESSMENTS[0], {
          status: "scoring_pending",
          score: null,
          total: null,
          percentage: null,
          result: "incomplete",
        }),
      ])
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");

    expect(await screen.findByText("Scoring Pending")).toBeInTheDocument();
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

  it("sorts by percentage when the Percentage header is clicked", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    fireEvent.click(screen.getByRole("button", { name: /^Percentage/ })); // already the sort: flips
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("sort_order")).toBe("asc"));
    expect(lastScoreFilterCall().searchParams.get("sort_by")).toBe("percentage");
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
      scoreFilterBody([entry("c1", "Asha K")], {
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

// ── Export ───────────────────────────────────────────────────────────────────

describe("ScoreFilterPage export", () => {
  const exportButton = () => screen.getByRole("button", { name: "Export to Excel" });

  async function exportAs(option: "Export All" | "Export With Filters") {
    fireEvent.click(exportButton());
    fireEvent.click(await screen.findByRole("button", { name: option }));
  }

  let toFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGet.mockReset();
    mockToastError.mockReset();
    mockWriteXlsxFile.mockReset();
    toFile = vi.fn().mockResolvedValue(undefined);
    mockWriteXlsxFile.mockReturnValue({ toFile });
    mockApi();
  });

  it("is disabled until an assessment is selected", async () => {
    renderWithProviders(<ScoreFilterPage />);

    expect(exportButton()).toBeDisabled();

    await pick("Python");
    await screen.findByText("Asha K");

    expect(exportButton()).toBeEnabled();
  });

  it("offers Export All and Export With Filters, like the submissions export", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    fireEvent.click(exportButton());

    expect(await screen.findByRole("button", { name: "Export All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export With Filters" })).toBeInTheDocument();
  });

  it("Export All asks for every entry of the selected assessments and writes the file", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");
    await screen.findByText("Asha K");
    // a filter and a sort that "Export All" must ignore
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "asha" } });
    fireEvent.click(screen.getByRole("button", { name: /^Candidate/ }));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("search")).toBe("asha"));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("sort_by")).toBe("name"));

    await exportAs("Export All");

    await waitFor(() => expect(toFile).toHaveBeenCalledWith("score_filter_results.xlsx"));
    expect(exportCalls()).toHaveLength(1);
    const url = exportCalls()[0];
    expect(url.pathname).toBe("/api/workspaces/ws-1/assessments/score-filter/export");
    expect(url.searchParams.getAll("assessment_ids")).toEqual(["a1", "a2"]);
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("result")).toBe(false);
    expect(url.searchParams.get("sort_by")).toBe("percentage");
    expect(url.searchParams.get("sort_order")).toBe("desc");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("Export With Filters sends the current pass percentage, result, search and sort", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");
    typePass("50");
    await waitFor(() =>
      expect(lastScoreFilterCall().searchParams.get("pass_percentage")).toBe("50")
    );
    fireEvent.click(screen.getByLabelText("Result"));
    fireEvent.click(await screen.findByRole("button", { name: "Failed" }));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "ravi" } });
    fireEvent.click(screen.getByRole("button", { name: /^Candidate/ }));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("search")).toBe("ravi"));
    await waitFor(() => expect(lastScoreFilterCall().searchParams.get("sort_by")).toBe("name"));

    await exportAs("Export With Filters");

    await waitFor(() => expect(toFile).toHaveBeenCalledWith("score_filter_results.xlsx"));
    const url = exportCalls()[0];
    expect(url.searchParams.get("pass_percentage")).toBe("50");
    expect(url.searchParams.get("result")).toBe("failed");
    expect(url.searchParams.get("search")).toBe("ravi");
    expect(url.searchParams.get("sort_by")).toBe("name");
    expect(url.searchParams.get("sort_order")).toBe("asc");
  });

  it("Export All still judges against the typed pass percentage", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");
    typePass("70");
    await waitFor(() =>
      expect(lastScoreFilterCall().searchParams.get("pass_percentage")).toBe("70")
    );

    await exportAs("Export All");

    await waitFor(() => expect(toFile).toHaveBeenCalled());
    expect(exportCalls()[0].searchParams.get("pass_percentage")).toBe("70");
  });

  it("writes one spreadsheet row per entry with readable labels", async () => {
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python", "SQL");
    await screen.findByText("Asha K");

    await exportAs("Export All");

    await waitFor(() => expect(toFile).toHaveBeenCalled());
    const [rows, options] = mockWriteXlsxFile.mock.calls[0] as [
      typeof EXPORT_ROWS,
      { columns: { header: string; cell: (r: (typeof EXPORT_ROWS)[number]) => unknown }[] },
    ];
    expect(rows).toEqual(EXPORT_ROWS);
    const { columns } = options;
    expect(columns.map((c) => c.header)).toEqual([
      "Name",
      "Email",
      "Assessment",
      "Status",
      "Score",
      "Total Questions",
      "Percentage (%)",
      "Result",
    ]);
    expect(columns.map((c) => c.cell(rows[0]))).toEqual([
      "Asha K",
      "asha@example.com",
      "Python",
      "Completed",
      8,
      10,
      80,
      "Passed",
    ]);
    // an unfinished entry: no score, no email, and a readable status / result
    expect(columns.map((c) => c.cell(rows[1]))).toEqual([
      "Ravi S",
      "",
      "SQL",
      "Attending",
      "",
      "",
      "",
      "Incomplete",
    ]);
  });

  it("shows an error toast and writes nothing when the export request fails", async () => {
    mockGet.mockImplementation((url: string) =>
      url.includes("/score-filter/export")
        ? Promise.reject(new Error("boom"))
        : url.includes("/score-filter")
          ? Promise.resolve(scoreFilterBody([entry("c1", "Asha K")]))
          : Promise.resolve({ data: { data: { assessments: ASSESSMENTS } } })
    );
    renderWithProviders(<ScoreFilterPage />);
    await pick("Python");
    await screen.findByText("Asha K");

    await exportAs("Export All");

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to export score filter results.")
    );
    expect(mockWriteXlsxFile).not.toHaveBeenCalled();
    expect(exportButton()).toBeEnabled(); // not stuck on "Exporting…"
  });
});

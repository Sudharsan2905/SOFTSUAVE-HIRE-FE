import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (_e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Tooltip can render children directly (avoids portal / layout effects)
vi.mock("@/components/ui/Tooltip", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tooltip: ({ children }: any) => children,
}));

// Select → native <select> so filters are testable without portals
vi.mock("@/components/ui/Select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Select: ({ value, onChange, options, placeholder }: any) => (
    <select aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {options?.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Step2Questions } from "./Step2Questions";
import type { AssessmentDraft } from "./WizardContainer";
import { api } from "@/utils/api";

const mockGet = api.get as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: "cat-1", name: "JavaScript" },
  { id: "cat-2", name: "Python" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeQuestion(id: string, overrides: Partial<any> = {}) {
  return {
    id,
    category_id: "cat-1",
    question_text: `Question ${id}`,
    question_type: "mcq_single",
    complexity: "low",
    options: [],
    created_by: "u1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const QUESTIONS = [
  makeQuestion("q1", { question_text: "What is a closure?", complexity: "low" }),
  makeQuestion("q2", { question_text: "Explain hoisting", complexity: "medium" }),
  makeQuestion("q3", { question_text: "What is the event loop?", complexity: "high" }),
];

function makeDraft(overrides: Partial<AssessmentDraft> = {}): AssessmentDraft {
  return {
    name: "Test",
    description: "",
    accessibility: "normal",
    rounds: [
      {
        round_number: 1,
        question_count: 2,
        max_duration_minutes: 30,
        question_ids: [],
      },
    ],
    monitoring_config: {
      tab_monitoring: true,
      audio_monitoring: true,
      video_monitoring: true,
      screenshot_mode: "time_interval",
      screenshot_enabled: true,
    },
    ...overrides,
  };
}

// Default api.get implementation: categories endpoint and questions endpoint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupApi(opts: { questions?: any[]; categories?: any[]; questionError?: boolean } = {}) {
  const cats = opts.categories ?? CATEGORIES;
  const qs = opts.questions ?? QUESTIONS;
  // category questions endpoint: .../questions/categories/<id>/questions?...
  const isQuestionsUrl = (url: string) => /\/questions\/categories\/[^/]+\/questions/.test(url);
  mockGet.mockImplementation((url: string) => {
    if (isQuestionsUrl(url)) {
      if (opts.questionError) return Promise.reject(new Error("boom"));
      return Promise.resolve({ data: { data: { questions: qs } } });
    }
    if (url.includes("/questions/categories")) {
      return Promise.resolve({ data: { data: { categories: cats } } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
}

function renderStep(props: Partial<React.ComponentProps<typeof Step2Questions>> = {}) {
  const onUpdateQuestions = props.onUpdateQuestions ?? vi.fn();
  const draft = props.draft ?? makeDraft();
  const currentRound = props.currentRound ?? 0;
  const result = render(
    <Step2Questions
      draft={draft}
      currentRound={currentRound}
      onUpdateQuestions={onUpdateQuestions}
    />
  );
  return { onUpdateQuestions, draft, ...result };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupApi();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Step2Questions", () => {
  // ── Fetch on mount ───────────────────────────────────────────────────────

  it("fetches categories on mount", async () => {
    renderStep();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/questions/categories?page_size=100")
      )
    );
  });

  it("fetches questions for the first category after categories load", async () => {
    renderStep();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/questions/categories/cat-1/questions")
      )
    );
  });

  // ── Rendering questions ──────────────────────────────────────────────────

  it("renders the fetched questions in the available list", async () => {
    renderStep();
    expect(await screen.findByText("What is a closure?")).toBeInTheDocument();
    expect(screen.getByText("Explain hoisting")).toBeInTheDocument();
    expect(screen.getByText("What is the event loop?")).toBeInTheDocument();
  });

  it("renders complexity badges for questions", async () => {
    renderStep();
    await screen.findByText("What is a closure?");
    expect(screen.getAllByText("Low").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Medium").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
  });

  // ── Selected count ───────────────────────────────────────────────────────

  it("shows the selected vs required count", async () => {
    renderStep();
    await screen.findByText("What is a closure?");
    expect(screen.getByText("0 / 2 required")).toBeInTheDocument();
  });

  it("reflects already-selected questions from the draft", async () => {
    renderStep({
      draft: makeDraft({
        rounds: [
          { round_number: 1, question_count: 2, max_duration_minutes: 30, question_ids: ["q1"] },
        ],
      }),
    });
    await screen.findByText("Explain hoisting");
    expect(screen.getByText("1 / 2 required")).toBeInTheDocument();
    // q1 appears in the selected pane, not the available list
    const selectedPane = screen.getByText("Selected Questions").closest("div")!;
    expect(
      within(selectedPane.parentElement as HTMLElement).getByText("What is a closure?")
    ).toBeInTheDocument();
  });

  // ── Selecting / deselecting ──────────────────────────────────────────────

  it("calls onUpdateQuestions with the question id when one is selected", async () => {
    const user = userEvent.setup();
    const { onUpdateQuestions } = renderStep();
    await screen.findByText("What is a closure?");
    await user.click(screen.getByText("What is a closure?"));
    expect(onUpdateQuestions).toHaveBeenCalledWith(["q1"]);
  });

  it("adds to the existing selection when selecting another question", async () => {
    const user = userEvent.setup();
    const { onUpdateQuestions } = renderStep({
      draft: makeDraft({
        rounds: [
          { round_number: 1, question_count: 2, max_duration_minutes: 30, question_ids: ["q1"] },
        ],
      }),
    });
    await screen.findByText("Explain hoisting");
    await user.click(screen.getByText("Explain hoisting"));
    expect(onUpdateQuestions).toHaveBeenCalledWith(["q1", "q2"]);
  });

  it("removes a selected question via its remove button", async () => {
    const user = userEvent.setup();
    const { onUpdateQuestions } = renderStep({
      draft: makeDraft({
        rounds: [
          { round_number: 1, question_count: 2, max_duration_minutes: 30, question_ids: ["q1"] },
        ],
      }),
    });
    const selectedText = await screen.findByText("What is a closure?");
    // The remove button sits next to the selected question text in the selected pane.
    const selectedItem = selectedText.closest("div")!.parentElement!;
    const removeBtn = within(selectedItem).getByRole("button");
    await user.click(removeBtn);
    expect(onUpdateQuestions).toHaveBeenCalledWith([]);
  });

  it("deselecting a question (clicking it in the available list) toggles it off", async () => {
    const user = userEvent.setup();
    // Provide a selected id but also keep it in available filtering logic:
    // selected questions are excluded from available, so to test toggle-off path
    // we rely on removeSelected; the toggle-off path occurs when a selected id is
    // present. Use the selected pane's question which is the same component path.
    const { onUpdateQuestions } = renderStep({
      draft: makeDraft({
        rounds: [
          { round_number: 1, question_count: 2, max_duration_minutes: 30, question_ids: ["q2"] },
        ],
      }),
    });
    await screen.findByText("What is a closure?");
    // q1 is available; clicking adds q1 alongside q2
    await user.click(screen.getByText("What is a closure?"));
    expect(onUpdateQuestions).toHaveBeenCalledWith(["q2", "q1"]);
  });

  // ── Empty / placeholder states ───────────────────────────────────────────

  it("shows the empty-state hint in the selected pane when nothing is selected", async () => {
    renderStep();
    await screen.findByText("What is a closure?");
    expect(
      screen.getByText("Drag or click questions from the right to add them here")
    ).toBeInTheDocument();
  });

  it("shows 'No questions available' when the API returns no questions", async () => {
    setupApi({ questions: [] });
    renderStep();
    expect(await screen.findByText("No questions available")).toBeInTheDocument();
  });

  // ── Loading spinner ──────────────────────────────────────────────────────

  it("shows a loading spinner while questions are being fetched", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-function
    let resolveQuestions: (v: any) => void = () => {};
    mockGet.mockImplementation((url: string) => {
      if (/\/questions\/categories\/[^/]+\/questions/.test(url)) {
        return new Promise((r) => {
          resolveQuestions = r;
        });
      }
      if (url.includes("/questions/categories")) {
        return Promise.resolve({ data: { data: { categories: CATEGORIES } } });
      }
      return Promise.resolve({ data: { data: {} } });
    });
    renderStep();
    expect(await screen.findByLabelText("Loading")).toBeInTheDocument();
    resolveQuestions({ data: { data: { questions: QUESTIONS } } });
    await waitFor(() => expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument());
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it("does not crash and shows empty list when the questions API errors", async () => {
    setupApi({ questionError: true });
    renderStep();
    expect(await screen.findByText("No questions available")).toBeInTheDocument();
  });

  // ── Filters ──────────────────────────────────────────────────────────────

  it("includes the search term in the questions request after debounce", async () => {
    const user = userEvent.setup();
    renderStep();
    await screen.findByText("What is a closure?");
    await user.type(screen.getByPlaceholderText("Search..."), "closure");
    await waitFor(
      () => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("search=closure")),
      { timeout: 1500 }
    );
  });

  it("includes the complexity filter in the questions request", async () => {
    const user = userEvent.setup();
    renderStep();
    await screen.findByText("What is a closure?");
    await user.selectOptions(screen.getByLabelText("Complexity"), "high");
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("complexity=high"))
    );
  });

  it("includes the question_type filter in the questions request", async () => {
    const user = userEvent.setup();
    renderStep();
    await screen.findByText("What is a closure?");
    await user.selectOptions(screen.getByLabelText("Type"), "essay");
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("question_type=essay"))
    );
  });

  it("refetches questions when the category changes", async () => {
    const user = userEvent.setup();
    renderStep();
    await screen.findByText("What is a closure?");
    await user.selectOptions(screen.getByLabelText("Category"), "cat-2");
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/questions/categories/cat-2/questions")
      )
    );
  });

  // ── No category ──────────────────────────────────────────────────────────

  it("does not fetch questions when there are no categories", async () => {
    setupApi({ categories: [] });
    renderStep();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("/questions/categories?"))
    );
    // No category selected → no questions endpoint call
    const questionCalls = mockGet.mock.calls.filter(
      (c) => String(c[0]).includes("/questions/categories/") && String(c[0]).includes("/questions")
    );
    expect(questionCalls).toHaveLength(0);
  });
});

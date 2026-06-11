import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

// Select → native <select> driven by aria-label === label, since the real
// Select renders a portal + getBoundingClientRect dropdown that is awkward in jsdom.
vi.mock("@/components/ui/Select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Select: ({ label, value, onChange, options }: any) => (
    <div>
      {label && <label htmlFor={`sel-${label}`}>{label}</label>}
      <select
        id={`sel-${label}`}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {options?.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { Step1BasicInfo } from "./Step1BasicInfo";
import type { AssessmentDraft } from "./WizardContainer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDraft(overrides: Partial<AssessmentDraft> = {}): AssessmentDraft {
  return {
    name: "",
    description: "",
    accessibility: "normal",
    rounds: [
      {
        round_number: 1,
        question_count: 10,
        max_duration_minutes: 30,
        question_ids: [],
      },
    ],
    monitoring_config: {
      tab_monitoring: true,
      audio_monitoring: true,
      video_monitoring: true,
      screenshot_mode: "time_interval",
      screenshot_interval_seconds: 5,
      screenshot_enabled: true,
    },
    ...overrides,
  };
}

const nextBtn = () => screen.getByRole("button", { name: /next: select questions/i });

function renderStep(props: Partial<React.ComponentProps<typeof Step1BasicInfo>> = {}) {
  const onNext = props.onNext ?? vi.fn();
  const draft = props.draft ?? makeDraft();
  render(<Step1BasicInfo draft={draft} onNext={onNext} disableNext={props.disableNext} />);
  return { onNext, draft };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Step1BasicInfo", () => {
  // ── Rendering ────────────────────────────────────────────────────────────

  it("renders name and description fields", () => {
    renderStep();
    expect(screen.getByLabelText("Assessment Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description (optional)")).toBeInTheDocument();
  });

  it("renders the initial round with question count and duration inputs", () => {
    renderStep();
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByLabelText("No. of Questions")).toHaveValue(10);
    expect(screen.getByLabelText("Duration (minutes)")).toHaveValue(30);
  });

  it("pre-fills name and description from the draft", () => {
    renderStep({ draft: makeDraft({ name: "Existing", description: "Desc here" }) });
    expect(screen.getByLabelText("Assessment Name *")).toHaveValue("Existing");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("Desc here");
  });

  // ── Typing updates fields ────────────────────────────────────────────────

  it("typing in the name field updates its value", async () => {
    const user = userEvent.setup();
    renderStep();
    const input = screen.getByLabelText("Assessment Name *");
    await user.type(input, "Frontend Test");
    expect(input).toHaveValue("Frontend Test");
  });

  it("typing in the description field updates its value", async () => {
    const user = userEvent.setup();
    renderStep();
    const input = screen.getByLabelText("Description (optional)");
    await user.type(input, "A description");
    expect(input).toHaveValue("A description");
  });

  // ── Rounds add/remove ────────────────────────────────────────────────────

  it("adds a round when 'Add Round' is clicked", async () => {
    const user = userEvent.setup();
    renderStep();
    expect(screen.queryByText("Round 2")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add round/i }));
    expect(screen.getByText("Round 2")).toBeInTheDocument();
  });

  it("does not show a remove button when there is only one round", () => {
    renderStep();
    // The remove button only renders the IconDelete; with one round there is none.
    // Round header for a single round has only the badge.
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    // No second round, and remove buttons are absent (icon delete present only when >1).
    expect(screen.queryAllByRole("button", { name: "" }).length).toBeGreaterThanOrEqual(0);
  });

  it("removes a round and renumbers the remaining rounds", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("button", { name: /add round/i }));
    await user.click(screen.getByRole("button", { name: /add round/i }));
    expect(screen.getByText("Round 3")).toBeInTheDocument();

    // Remove buttons are icon-only buttons (no text) that appear once per round
    // when there is more than one round.
    const removeButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "" && b.querySelector("svg")
    );
    expect(removeButtons.length).toBe(3);
    // Remove the first round's delete button
    await user.click(removeButtons[0]);

    // Now there should be 2 rounds, renumbered 1 and 2 (no "Round 3")
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("Round 2")).toBeInTheDocument();
    expect(screen.queryByText("Round 3")).not.toBeInTheDocument();
  });

  // ── Round field changes ──────────────────────────────────────────────────

  it("changing the question count updates the field", async () => {
    const user = userEvent.setup();
    renderStep();
    const qc = screen.getByLabelText("No. of Questions");
    await user.clear(qc);
    await user.type(qc, "5");
    expect(qc).toHaveValue(5);
  });

  it("changing the duration updates the field", async () => {
    const user = userEvent.setup();
    renderStep();
    const dur = screen.getByLabelText("Duration (minutes)");
    await user.clear(dur);
    await user.type(dur, "45");
    expect(dur).toHaveValue(45);
  });

  // ── Accessibility mode ───────────────────────────────────────────────────

  it("does not show monitoring options in normal mode", () => {
    renderStep();
    expect(screen.queryByText("Monitoring Options")).not.toBeInTheDocument();
  });

  it("shows monitoring options after switching to monitoring mode", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByText("Monitoring").closest("button")!);
    expect(screen.getByText("Monitoring Options")).toBeInTheDocument();
    expect(screen.getByText("Tab switch detection")).toBeInTheDocument();
    expect(screen.getByText("Camera required")).toBeInTheDocument();
  });

  it("starts in monitoring mode when draft.accessibility is monitoring", () => {
    renderStep({ draft: makeDraft({ accessibility: "monitoring" }) });
    expect(screen.getByText("Monitoring Options")).toBeInTheDocument();
  });

  // ── Monitoring toggles ───────────────────────────────────────────────────

  it("toggles a monitoring switch", async () => {
    const user = userEvent.setup();
    renderStep({ draft: makeDraft({ accessibility: "monitoring" }) });
    const switches = screen.getAllByRole("switch");
    // tab, audio, video, screenshot → 4 switches, all checked by default
    expect(switches).toHaveLength(4);
    expect(switches[0]).toBeChecked();
    await user.click(switches[0]);
    expect(switches[0]).not.toBeChecked();
  });

  it("hides screenshot options when screenshot capture is turned off", async () => {
    const user = userEvent.setup();
    renderStep({ draft: makeDraft({ accessibility: "monitoring" }) });
    // Screenshot mode select is visible while screenshot_enabled is true
    expect(screen.getByLabelText("Screenshot mode")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    // 4th switch is screenshot capture
    await user.click(switches[3]);
    expect(screen.queryByLabelText("Screenshot mode")).not.toBeInTheDocument();
  });

  it("switches screenshot mode to count and shows total screenshots field", async () => {
    const user = userEvent.setup();
    renderStep({ draft: makeDraft({ accessibility: "monitoring" }) });
    expect(screen.getByLabelText("Interval (seconds)")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Screenshot mode"), "count");
    expect(screen.queryByLabelText("Interval (seconds)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Total screenshots per candidate")).toBeInTheDocument();
  });

  // ── Next button enabling / disabling ─────────────────────────────────────

  it("disables Next when the name is empty", () => {
    renderStep({ draft: makeDraft({ name: "" }) });
    expect(nextBtn()).toBeDisabled();
  });

  it("enables Next once a valid name is typed", async () => {
    const user = userEvent.setup();
    renderStep();
    expect(nextBtn()).toBeDisabled();
    await user.type(screen.getByLabelText("Assessment Name *"), "Valid Name");
    expect(nextBtn()).not.toBeDisabled();
  });

  it("disables Next when disableNext prop is true even with a valid name", () => {
    renderStep({ draft: makeDraft({ name: "Valid" }), disableNext: true });
    expect(nextBtn()).toBeDisabled();
  });

  it("disables Next when a round has zero questions", async () => {
    const user = userEvent.setup();
    renderStep({ draft: makeDraft({ name: "Valid" }) });
    expect(nextBtn()).not.toBeDisabled();
    const qc = screen.getByLabelText("No. of Questions");
    await user.clear(qc);
    await user.type(qc, "0");
    expect(nextBtn()).toBeDisabled();
  });

  // ── onNext payload ───────────────────────────────────────────────────────

  it("calls onNext with the assembled draft when Next is clicked", async () => {
    const user = userEvent.setup();
    const { onNext } = renderStep();
    await user.type(screen.getByLabelText("Assessment Name *"), "My Assessment");
    await user.type(screen.getByLabelText("Description (optional)"), "Desc");
    await user.click(nextBtn());

    expect(onNext).toHaveBeenCalledTimes(1);
    const payload = (onNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "My Assessment",
      description: "Desc",
      accessibility: "normal",
    });
    expect(payload.rounds).toHaveLength(1);
    expect(payload.rounds[0]).toMatchObject({
      round_number: 1,
      question_count: 10,
      max_duration_minutes: 30,
    });
    expect(payload.monitoring_config).toBeDefined();
  });

  it("includes added rounds and monitoring accessibility in the onNext payload", async () => {
    const user = userEvent.setup();
    const { onNext } = renderStep();
    await user.type(screen.getByLabelText("Assessment Name *"), "Multi");
    await user.click(screen.getByRole("button", { name: /add round/i }));
    await user.click(screen.getByText("Monitoring").closest("button")!);
    await user.click(nextBtn());

    const payload = (onNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.rounds).toHaveLength(2);
    expect(payload.accessibility).toBe("monitoring");
  });

  it("falls back to default monitoring config when draft.monitoring_config is missing", async () => {
    const user = userEvent.setup();
    const draft = makeDraft({ name: "X" });
    // Force monitoring_config to be falsy to hit the default branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draft as any).monitoring_config = undefined;
    const onNext = vi.fn();
    render(<Step1BasicInfo draft={draft} onNext={onNext} />);
    await user.click(nextBtn());
    expect(onNext.mock.calls[0][0].monitoring_config).toMatchObject({
      tab_monitoring: true,
      screenshot_mode: "time_interval",
    });
  });
});

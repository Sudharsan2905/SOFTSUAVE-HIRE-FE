import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { RoundInstructions } from "./index";
import { renderWithProviders } from "@/test/utils";
import type { RoundConfig } from "@/types";

function makeRoundConfig(overrides: Partial<RoundConfig> = {}): RoundConfig {
  return {
    id: "r1",
    round_number: 1,
    question_count: 10,
    max_duration_minutes: 30,
    ...overrides,
  } as RoundConfig;
}

describe("RoundInstructions", () => {
  it("renders nothing when roundConfig is null", () => {
    const { container } = renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={1}
        roundConfig={null}
        totalRounds={2}
        onStart={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal title for current round", () => {
    renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={1}
        roundConfig={makeRoundConfig()}
        totalRounds={2}
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText(/Round 1 — Instructions/i)).toBeInTheDocument();
  });

  it("renders question count", () => {
    renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={1}
        roundConfig={makeRoundConfig({ question_count: 15 })}
        totalRounds={2}
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("renders time limit in minutes", () => {
    renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={1}
        roundConfig={makeRoundConfig({ max_duration_minutes: 45 })}
        totalRounds={2}
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText("45 minutes")).toBeInTheDocument();
  });

  it("renders start round button", () => {
    renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={1}
        roundConfig={makeRoundConfig()}
        totalRounds={2}
        onStart={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /start round 1/i })).toBeInTheDocument();
  });

  it("calls onStart when start button clicked", () => {
    const onStart = vi.fn();
    renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={1}
        roundConfig={makeRoundConfig()}
        totalRounds={2}
        onStart={onStart}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /start round 1/i }));
    expect(onStart).toHaveBeenCalled();
  });

  it("renders progress steps for all rounds", () => {
    renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={2}
        roundConfig={makeRoundConfig({ round_number: 2 })}
        totalRounds={3}
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("Round 2")).toBeInTheDocument();
    expect(screen.getByText("Round 3")).toBeInTheDocument();
  });

  it("renders hours format for long duration", () => {
    renderWithProviders(
      <RoundInstructions
        isOpen={true}
        roundNumber={1}
        roundConfig={makeRoundConfig({ max_duration_minutes: 90 })}
        totalRounds={1}
        onStart={vi.fn()}
      />
    );
    expect(screen.getByText(/1h 30m/i)).toBeInTheDocument();
  });
});

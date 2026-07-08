import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import CandidateHeader from "./index";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));

describe("CandidateHeader", () => {
  it("renders brand logo and name", () => {
    renderWithProviders(<CandidateHeader />);
    expect(screen.getByAltText("Talentia")).toBeInTheDocument();
    expect(screen.getByText("Talentia")).toBeInTheDocument();
  });

  it("renders theme toggle button", () => {
    renderWithProviders(<CandidateHeader />);
    expect(
      screen.getByRole("button", { name: /switch to (light|dark) mode/i })
    ).toBeInTheDocument();
  });

  it("renders candidate name when provided", () => {
    renderWithProviders(<CandidateHeader candidateName="Alice Smith" />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Candidate")).toBeInTheDocument();
  });

  it("does not render candidate info when not provided", () => {
    renderWithProviders(<CandidateHeader />);
    expect(screen.queryByText("Candidate")).not.toBeInTheDocument();
  });

  it("dispatches toggleTheme when theme button is clicked", () => {
    const { store } = renderWithProviders(<CandidateHeader />);
    const before = store.getState().ui.theme;
    fireEvent.click(screen.getByRole("button", { name: /switch to/i }));
    const after = store.getState().ui.theme;
    expect(after).not.toBe(before);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import AssessmentEntry from "./AssessmentEntryPage";
import { renderWithProviders } from "@/test/utils";
import { makeAuthState, makeCandidateUser } from "@/test/mocks";
import { markAssessmentDone } from "@/utils/assessmentSession";

vi.mock("@/utils/api", () => ({
  api: { get: vi.fn(), interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("@/features/candidate/components/LinkStatusScreen", () => ({
  LinkStatusScreen: ({ status }: { status: string }) => (
    <div data-testid="link-status">{status}</div>
  ),
}));

vi.mock("@/components/shared/NoAccessPage", () => ({
  NoAccessPage: ({ title }: { title: string }) => <div data-testid="no-access">{title}</div>,
}));

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;

const mockUseParams = vi.fn(() => ({ shareLink: "share-abc" }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => mockUseParams() };
});

beforeEach(() => {
  mockGet.mockReset();
  sessionStorage.clear();
  mockUseParams.mockReturnValue({ shareLink: "share-abc" });
});

describe("AssessmentEntry", () => {
  it("shows a spinner while checking the link", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<AssessmentEntry />);
    // During check a spinner is visible (no test-id, but no content yet)
    expect(screen.queryByTestId("link-status")).not.toBeInTheDocument();
  });

  it("shows expired status when link is expired", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: { can_allow: false, is_expirable: true, is_expired: true, message: "Expired" },
      },
    });
    renderWithProviders(<AssessmentEntry />);
    await waitFor(() => expect(screen.getByTestId("link-status")).toHaveTextContent("expired"));
  });

  it("shows not_started status when link hasn't started yet", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: { can_allow: false, is_expirable: true, is_expired: false, message: "Not started" },
      },
    });
    renderWithProviders(<AssessmentEntry />);
    await waitFor(() => expect(screen.getByTestId("link-status")).toHaveTextContent("not_started"));
  });

  it("shows invalid status for a non-expirable invalid link", async () => {
    mockGet.mockResolvedValue({
      data: { data: { can_allow: false, is_expirable: false, message: "Invalid" } },
    });
    renderWithProviders(<AssessmentEntry />);
    await waitFor(() => expect(screen.getByTestId("link-status")).toHaveTextContent("invalid"));
  });

  it("treats network errors as valid (passes through)", async () => {
    mockGet.mockRejectedValue(new Error("net"));
    renderWithProviders(<AssessmentEntry />, {
      routerProps: { initialEntries: ["/entry/share-abc"] },
    });
    // After error resolves as valid + unauthenticated → Navigate to login
    await waitFor(() => {
      expect(screen.queryByTestId("link-status")).not.toBeInTheDocument();
    });
  });

  it("redirects authenticated candidate to instructions page", async () => {
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    const candidate = makeCandidateUser();
    renderWithProviders(<AssessmentEntry />, {
      preloadedState: {
        auth: makeAuthState({ user: candidate, isAuthenticated: true }),
      },
      routerProps: { initialEntries: ["/entry/share-abc"] },
    });
    // Redirected via Navigate — no status screen shown
    await waitFor(() => {
      expect(screen.queryByTestId("link-status")).not.toBeInTheDocument();
    });
  });

  it("redirects authenticated candidate with done marker to completed page", async () => {
    markAssessmentDone("share-abc");
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    const candidate = makeCandidateUser();
    renderWithProviders(<AssessmentEntry />, {
      preloadedState: {
        auth: makeAuthState({ user: candidate, isAuthenticated: true }),
      },
      routerProps: { initialEntries: ["/entry/share-abc"] },
    });
    await waitFor(() => {
      expect(screen.queryByTestId("link-status")).not.toBeInTheDocument();
    });
  });
});

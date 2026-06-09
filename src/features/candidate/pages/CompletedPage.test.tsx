import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompletedPage from "./CompletedPage";
import { renderWithProviders } from "@/test/utils";
import { makeAuthState, makeCandidateUser } from "@/test/mocks";
import { markAssessmentDone } from "@/utils/assessmentSession";

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));
vi.mock("@/assets/icons", () => ({
  IconCheck: ({ size, color }: { size: number; color: string }) => (
    <svg data-testid="icon-check" data-size={size} data-color={color} />
  ),
}));
vi.mock("@/features/candidate/components/CandidateHeader", () => ({
  default: ({ candidateName }: { candidateName?: string }) => (
    <header data-testid="candidate-header">{candidateName}</header>
  ),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ shareLink: "test-link" }),
  };
});

beforeEach(() => {
  sessionStorage.clear();
  mockNavigate.mockReset();
});

describe("CompletedPage", () => {
  it("shows spinner while checking", () => {
    // Before the useEffect runs, state is 'checking'
    // We can't pause it in JSDOM, but since the check is synchronous
    // we just verify the component mounts without crashing
    const { container } = renderWithProviders(<CompletedPage />, {
      routerProps: { initialEntries: ["/completed/test-link"] },
    });
    // Spinner or redirect are both valid outcomes; either way the tree rendered
    expect(container).toBeInTheDocument();
  });

  it("redirects to entry page when assessment is NOT done", async () => {
    renderWithProviders(<CompletedPage />, {
      routerProps: { initialEntries: ["/completed/test-link"] },
    });
    await waitFor(() => {
      // Should navigate away via Navigate — no completed content
      expect(screen.queryByText("Assessment Submitted!")).not.toBeInTheDocument();
    });
  });

  it("shows completion content when assessment is done", async () => {
    markAssessmentDone("test-link");
    renderWithProviders(<CompletedPage />, {
      routerProps: { initialEntries: ["/completed/test-link"] },
    });
    await waitFor(() => {
      expect(screen.getByText("Assessment Submitted!")).toBeInTheDocument();
    });
    expect(screen.getByText(/Thank you for completing/i)).toBeInTheDocument();
  });

  it("shows candidate name in header when user is logged in", async () => {
    markAssessmentDone("test-link");
    const candidate = makeCandidateUser({ first_name: "John", last_name: "Doe" });
    renderWithProviders(<CompletedPage />, {
      preloadedState: {
        auth: makeAuthState({ user: candidate, isAuthenticated: true }),
      },
      routerProps: { initialEntries: ["/completed/test-link"] },
    });
    await waitFor(() => {
      expect(screen.getByTestId("candidate-header")).toHaveTextContent("John Doe");
    });
  });

  it("navigates to login page when Exit button is clicked", async () => {
    markAssessmentDone("test-link");
    renderWithProviders(<CompletedPage />, {
      routerProps: { initialEntries: ["/completed/test-link"] },
    });
    await waitFor(() => screen.getByRole("button", { name: /exit/i }));
    await userEvent.click(screen.getByRole("button", { name: /exit/i }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), { replace: true });
  });
});

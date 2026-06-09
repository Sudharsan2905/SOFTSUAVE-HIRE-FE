/**
 * CandidateRoute — route guard tests.
 *
 * CandidateRoute enforces two layers of protection:
 *   1. Authentication  → unauthenticated users are sent to /candidate/login?share=<shareLink>
 *   2. Role check      → non-candidates see a NoAccessPage
 *   3. Submission status (fetched from the API):
 *       COMPLETED    → redirect to /assessment/:shareLink/completed
 *       ON_HOLD      → NoAccessPage ("paused")
 *       TERMINATED   → NoAccessPage ("terminated")
 *       MALPRACTICE  → NoAccessPage ("policy violation")
 *       null/PENDING/IN_PROGRESS → render children
 *   4. /completed page → status check skipped entirely (terminal destination)
 *   5. API failure     → fail-open (let children handle errors)
 *
 * Dependencies stubbed:
 *   @/utils/api                                          (api.get)
 *   @/utils/assessmentSession                            (markAssessmentDone)
 *   @/features/candidate/context/InterviewSessionContext  (InterviewSessionProvider)
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";

import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeCandidateUser, makeAuthState } from "@/test/mocks";
import { CandidateRoute } from "./index";
import { SubmissionStatus } from "@/constants/enums";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/utils/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock("@/features/candidate/context/InterviewSessionContext", () => ({
  InterviewSessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/utils/assessmentSession", () => ({
  markAssessmentDone: vi.fn(),
}));

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;

import { markAssessmentDone } from "@/utils/assessmentSession";
const mockMarkDone = markAssessmentDone as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helper — builds the minimal route tree needed to test redirects
// ---------------------------------------------------------------------------

function renderCandidateRoute(
  authState: ReturnType<typeof makeAuthState>,
  path = "/assessment/abc123/instructions"
) {
  return renderWithProviders(
    <Routes>
      <Route element={<CandidateRoute />}>
        <Route
          path="/assessment/:shareLink/instructions"
          element={<div>Instructions Page</div>}
        />
        <Route
          path="/assessment/:shareLink/completed"
          element={<div>Completed Page</div>}
        />
      </Route>

      {/* Redirect targets */}
      <Route path="/candidate/login" element={<div>Candidate Login</div>} />
    </Routes>,
    {
      preloadedState: { auth: authState },
      routerProps: { initialEntries: [path] },
    }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CandidateRoute", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockMarkDone.mockReset();
  });

  // ── 1. Authentication checks ──────────────────────────────────────────────

  describe("authentication", () => {
    it("redirects unauthenticated users to /candidate/login", async () => {
      renderCandidateRoute(makeAuthState({ isAuthenticated: false, user: null }));

      await waitFor(() => {
        expect(screen.getByText("Candidate Login")).toBeInTheDocument();
      });
    });

    it("does not call the status API for unauthenticated users", async () => {
      renderCandidateRoute(makeAuthState({ isAuthenticated: false, user: null }));

      await waitFor(() => {
        expect(screen.getByText("Candidate Login")).toBeInTheDocument();
      });

      expect(mockGet).not.toHaveBeenCalled();
    });

    it("shows NoAccessPage with 'Candidate Access Only' title for a non-candidate user", async () => {
      // Admin tries to access a candidate route
      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeAdminUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Candidate Access Only")).toBeInTheDocument();
      });
    });
  });

  // ── 2. Loading state ─────────────────────────────────────────────────────

  describe("loading state", () => {
    it("does not show the child page while fetching submission status", () => {
      // Never resolves — keeps the component in its loading state
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockGet.mockReturnValue(new Promise(() => {}));

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      // Child should not have appeared yet
      expect(screen.queryByText("Instructions Page")).not.toBeInTheDocument();
    });
  });

  // ── 3. Submission-status routing ─────────────────────────────────────────

  describe("submission status — allowed statuses", () => {
    it("renders children when status is IN_PROGRESS", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.IN_PROGRESS } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Instructions Page")).toBeInTheDocument();
      });
    });

    it("renders children when status is PENDING", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.PENDING } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Instructions Page")).toBeInTheDocument();
      });
    });

    it("renders children when no submission exists (null status)", async () => {
      mockGet.mockResolvedValueOnce({ data: { data: null } });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Instructions Page")).toBeInTheDocument();
      });
    });
  });

  describe("submission status — blocked statuses", () => {
    it("redirects to /completed when status is COMPLETED", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.COMPLETED } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Completed Page")).toBeInTheDocument();
      });
    });

    it("calls markAssessmentDone when redirecting to completed", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.COMPLETED } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(mockMarkDone).toHaveBeenCalledWith("abc123");
      });
    });

    it("shows 'Interview Temporarily Paused' NoAccessPage for ON_HOLD", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.ON_HOLD } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Interview Temporarily Paused")).toBeInTheDocument();
      });
    });

    it("does not show a back button on the ON_HOLD page", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.ON_HOLD } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Interview Temporarily Paused")).toBeInTheDocument();
      });

      expect(screen.queryByRole("link", { name: /back/i })).not.toBeInTheDocument();
    });

    it("shows 'Interview Session Terminated' NoAccessPage for TERMINATED", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.TERMINATED } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Interview Session Terminated")).toBeInTheDocument();
      });
    });

    it("shows 'Assessment Ended — Policy Violation' NoAccessPage for MALPRACTICE", async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: { status: SubmissionStatus.MALPRACTICE } },
      });

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Assessment Ended — Policy Violation")).toBeInTheDocument();
      });
    });
  });

  // ── 4. Completed page is a terminal destination ────────────────────────────

  describe("/completed page (terminal destination)", () => {
    it("renders the completed page without fetching submission status", async () => {
      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() }),
        "/assessment/abc123/completed"
      );

      await waitFor(() => {
        expect(screen.getByText("Completed Page")).toBeInTheDocument();
      });

      // Status endpoint must NOT have been called for the completed page
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ── 5. Error handling — fail open ─────────────────────────────────────────

  describe("error handling", () => {
    it("renders children (fail-open) when the submission status API call throws", async () => {
      mockGet.mockRejectedValueOnce(new Error("Network Error"));

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Instructions Page")).toBeInTheDocument();
      });
    });

    it("renders children when the API returns an unexpected shape", async () => {
      mockGet.mockResolvedValueOnce({ data: {} }); // no data.data property

      renderCandidateRoute(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );

      await waitFor(() => {
        expect(screen.getByText("Instructions Page")).toBeInTheDocument();
      });
    });
  });
});

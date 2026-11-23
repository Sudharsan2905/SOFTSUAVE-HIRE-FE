import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useAppSelector } from "@/store";
import { NoAccessPage } from "@/components/shared/NoAccessPage";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { UserRole, SubmissionStatus, type SubmissionStatusResponse } from "@/types";
import { IconAlertTriangle, IconShield } from "@/assets/icons";
import { InterviewSessionProvider } from "@/features/candidate/context/InterviewSessionContext";
import { markAssessmentDone } from "@/utils/assessmentSession";

/**
 * Outlet-based route guard for candidate assessment pages.
 *
 * Auth rules:
 *  1. Not authenticated → redirect to candidate login, preserving share link.
 *  2. Authenticated but wrong role → No Access page.
 *
 * Submission-status rules (skipped for the /completed route):
 *  - COMPLETED        → redirect to /assessment/:shareLink/completed
 *  - ON_HOLD          → No Access page (paused by admin)
 *  - TERMINATED       → No Access page (ended by admin)
 *  - MALPRACTICE      → No Access page (policy violation)
 *  - null / PENDING / IN_PROGRESS → allow through
 *
 * Fail-closed: if the status call fails (after one retry) the candidate is NOT passed through;
 * a "could not verify your session — Retry" screen is shown instead, so a terminated,
 * on-hold or malpractice session can't slip by on a network error.
 *
 * Wraps all allowed children in InterviewSessionProvider so InstructionsPage and
 * InterviewPage share a single WebSocket connection lifetime.
 */

const StatusSpinner = (): ReactElement => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
    }}
  >
    <Spinner size="lg" />
  </div>
);

/**
 * Maps a fetched submission status to a blocking/redirect element, or returns
 * null when the candidate is allowed to proceed. Extracted to keep the route
 * component's cognitive complexity low.
 */
function resolveStatusRouting(
  status: SubmissionStatus | undefined,
  shareLink: string | undefined
): ReactElement | null {
  switch (status) {
    case SubmissionStatus.COMPLETED:
      markAssessmentDone(shareLink!);
      return <Navigate to={ROUTES.ASSESSMENT.completed(shareLink!)} replace />;
    case SubmissionStatus.ON_HOLD:
      return (
        <NoAccessPage
          title="Interview Temporarily Paused"
          description="Your interview session is currently on hold. Please wait for administrator approval to resume your assessment."
          showBackButton={false}
          icon={IconShield}
        />
      );
    case SubmissionStatus.TERMINATED:
      return (
        <NoAccessPage
          title="Interview Session Terminated"
          description="Your interview session has been terminated. Please contact support or the administrator for further assistance."
          showBackButton={false}
          icon={IconAlertTriangle}
        />
      );
    case SubmissionStatus.MALPRACTICE:
      return (
        <NoAccessPage
          title="Assessment Ended — Policy Violation"
          description="Your assessment session was ended due to repeated policy violations. Please contact the administrator if you believe this is an error or to request re-access."
          showBackButton={false}
          icon={IconAlertTriangle}
        />
      );
    default:
      return null;
  }
}

const STATUS_RETRY_DELAY_MS = 800;

const StatusCheckFailed = ({ onRetry }: { onRetry: () => void }): ReactElement => (
  <div
    role="alert"
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      minHeight: "100vh",
      padding: 24,
      textAlign: "center",
    }}
  >
    <h2 style={{ margin: 0 }}>We couldn&apos;t verify your session</h2>
    <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: 420 }}>
      Please check your internet connection and try again. You will not lose any saved answers.
    </p>
    <Button onClick={onRetry}>Retry</Button>
  </div>
);

export function CandidateRoute() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const location = useLocation();

  const isCompletedPage = location.pathname.endsWith("/completed");

  // undefined = not fetched yet; null = no submission exists
  const [submissionStatus, setSubmissionStatus] = useState<
    SubmissionStatusResponse | null | undefined
  >(undefined);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const hasStatusRef = useRef(false);

  const fetchStatus = useCallback(
    async (silent = false) => {
      if (!shareLink || !isAuthenticated || user?.role !== UserRole.CANDIDATE || isCompletedPage) {
        return;
      }
      if (!silent) {
        setStatusLoading(true);
        setStatusError(false);
      }
      const url = `${API_ENDPOINTS.CANDIDATE.SUBMISSION_STATUS}?share_link=${shareLink}`;
      try {
        let data: { data?: SubmissionStatusResponse | null };
        try {
          data = (await api.get(url)).data;
        } catch {
          await new Promise((r) => setTimeout(r, STATUS_RETRY_DELAY_MS));
          data = (await api.get(url)).data;
        }
        setSubmissionStatus(data.data ?? null);
        hasStatusRef.current = true;
        setStatusError(false);
      } catch {
        // Fail CLOSED. A silent background refresh keeps the last known status instead.
        if (!silent) setStatusError(true);
      } finally {
        if (!silent) setStatusLoading(false);
      }
    },
    [shareLink, isAuthenticated, user?.role, isCompletedPage]
  );

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // The status is otherwise fetched once per mount; refresh it quietly on in-guard navigation
  // (e.g. interview -> instructions after a termination) so a stale IN_PROGRESS is not reused.
  useEffect(() => {
    if (hasStatusRef.current) void fetchStatus(true);
  }, [location.pathname, fetchStatus]);

  // ── 1. Auth checks ────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    const loginTarget = shareLink
      ? `${ROUTES.CANDIDATE.LOGIN}?share=${shareLink}`
      : ROUTES.CANDIDATE.LOGIN;
    return <Navigate to={loginTarget} replace />;
  }

  if (user?.role !== UserRole.CANDIDATE) {
    return (
      <NoAccessPage
        title="Candidate Access Only"
        description="This assessment area is restricted to candidates. Please sign in with a candidate account."
        backTo={ROUTES.ADMIN.QUESTION_BANK}
        backLabel="Back to Admin Dashboard"
      />
    );
  }

  // ── 2. Submission-status routing ──────────────────────────────────────────

  // Completed page is a terminal destination — never redirect or block it
  if (!isCompletedPage) {
    if (statusError) {
      return <StatusCheckFailed onRetry={() => void fetchStatus()} />;
    }
    const isStatusPending = statusLoading || submissionStatus === undefined;
    if (isStatusPending) {
      return <StatusSpinner />;
    }

    const statusElement = resolveStatusRouting(submissionStatus?.status, shareLink);
    if (statusElement) {
      return statusElement;
    }
  }

  // ── 3. Authenticated candidate with allowed status → render children ──────

  return (
    <InterviewSessionProvider>
      <Outlet />
    </InterviewSessionProvider>
  );
}

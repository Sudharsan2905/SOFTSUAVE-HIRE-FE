import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useAppSelector } from "@/store";
import { NoAccessPage } from "@/components/shared/NoAccessPage";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/utils/api";
import { UserRole, type SubmissionStatusResponse } from "@/types";
import { IconAlertTriangle, IconShield } from "@/assets/icons";
import { InterviewSessionProvider } from "@/features/candidate/context/InterviewSessionContext";

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
 * Wraps all allowed children in InterviewSessionProvider so InstructionsPage and
 * InterviewPage share a single WebSocket connection lifetime.
 */
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

  const fetchStatus = useCallback(async () => {
    if (!shareLink || !isAuthenticated || user?.role !== UserRole.CANDIDATE || isCompletedPage) {
      return;
    }
    setStatusLoading(true);
    try {
      const { data } = await api.get(`/api/candidate/submission/status?share_link=${shareLink}`);
      setSubmissionStatus(data.data ?? null);
    } catch {
      // Fail open — let the child page surface any real errors
      setSubmissionStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [shareLink, isAuthenticated, user?.role, isCompletedPage]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // ── 1. Auth checks ────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    const loginTarget = shareLink ? `/candidate/login?share=${shareLink}` : "/candidate/login";
    return <Navigate to={loginTarget} replace />;
  }

  if (user?.role !== UserRole.CANDIDATE) {
    return (
      <NoAccessPage
        title="Candidate Access Only"
        description="This assessment area is restricted to candidates. Please sign in with a candidate account."
        backTo="/question-bank"
        backLabel="Back to Admin Dashboard"
      />
    );
  }

  // ── 2. Submission-status routing ──────────────────────────────────────────

  // Completed page is a terminal destination — never redirect or block it
  if (!isCompletedPage) {
    if (statusLoading || submissionStatus === undefined) {
      return (
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
    }

    const status = submissionStatus?.status;

    if (status === "completed") {
      return <Navigate to={`/assessment/${shareLink ?? ""}/completed`} replace />;
    }

    if (status === "on_hold") {
      return (
        <NoAccessPage
          title="Interview Temporarily Paused"
          description="Your interview session is currently on hold. Please wait for administrator approval to resume your assessment."
          showBackButton={false}
          icon={IconShield}
        />
      );
    }

    if (status === "terminated") {
      return (
        <NoAccessPage
          title="Interview Session Terminated"
          description="Your interview session has been terminated. Please contact support or the administrator for further assistance."
          showBackButton={false}
          icon={IconAlertTriangle}
        />
      );
    }

    if (status === "malpractice") {
      return (
        <NoAccessPage
          title="Assessment Ended — Policy Violation"
          description="Your assessment session was ended due to repeated policy violations. Please contact the administrator if you believe this is an error or to request re-access."
          showBackButton={false}
          icon={IconAlertTriangle}
        />
      );
    }
  }

  // ── 3. Authenticated candidate with allowed status → render children ──────

  return (
    <InterviewSessionProvider>
      <Outlet />
    </InterviewSessionProvider>
  );
}

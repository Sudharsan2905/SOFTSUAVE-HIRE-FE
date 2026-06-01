import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { Spinner } from "@/components/ui/Spinner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { NoAccessPage } from "@/components/shared/NoAccessPage";
import { CandidateRoute } from "@/features/candidate/components/CandidateRoute";
import { LinkStatusScreen, LinkStatus } from "@/features/candidate/components/LinkStatusScreen";
import { useAppSelector } from "@/store";
import { api } from "@/utils/api";
import { isAssessmentDone } from "@/utils/assessmentSession";

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAppSelector((s) => s.auth.user);
  if (user?.role !== "super_admin") {
    return (
      <NoAccessPage
        title="Super Admin Only"
        description="This area is restricted to Super Admins. Contact your administrator if you require access."
        backTo="/question-bank"
        backLabel="Back to Dashboard"
      />
    );
  }
  return <>{children}</>;
};

function CandidateDashboard() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        flexDirection: "column",
        gap: 12,
        color: "var(--text-secondary)",
      }}
    >
      <h2 style={{ color: "var(--text-primary)" }}>No Assessment Linked</h2>
      <p>Please use your assessment link to access your assessment.</p>
    </div>
  );
}

function AssessmentEntry() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const isCandidate = isAuthenticated && user?.role === "candidate";

  const [checking, setChecking] = useState(true);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | "valid" | null>(null);
  const [linkMessage, setLinkMessage] = useState("");
  const [linkStartTime, setLinkStartTime] = useState("");

  useEffect(() => {
    if (!shareLink) {
      setLinkStatus("invalid");
      setChecking(false);
      return;
    }
    api
      .get(`/api/assessments/share/validate?link=${shareLink}`)
      .then((res) => {
        const v = res.data.data;
        if (v.can_allow) {
          setLinkStatus("valid");
        } else {
          setLinkStatus(v.is_expired ? "expired" : "not_started");
          setLinkMessage(v.message || "");
          if (v.start_time) setLinkStartTime(v.start_time);
        }
      })
      .catch(() => {
        // Network error — don't block the candidate
        setLinkStatus("valid");
      })
      .finally(() => setChecking(false));
  }, [shareLink]);

  if (checking) return <Loading />;

  if (linkStatus === "not_started" || linkStatus === "expired" || linkStatus === "invalid") {
    return (
      <LinkStatusScreen status={linkStatus} message={linkMessage} startTime={linkStartTime} />
    );
  }

  if (!isCandidate) {
    return <Navigate to={`/candidate/login?share=${shareLink}`} replace />;
  }

  // If this session already completed the assessment, go straight to the done screen.
  if (shareLink && isAssessmentDone(shareLink)) {
    return <Navigate to={`/assessment/${shareLink}/completed`} replace />;
  }

  // Authenticated candidate with a valid link — proceed to instructions.
  return <Navigate to={`/assessment/${shareLink}/instructions`} replace />;
}

// Lazy-loaded admin pages
const AdminLoginPage = lazy(() => import("@/features/auth/pages/AdminLoginPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const CategoriesPage = lazy(() => import("@/features/questionBank/pages/CategoriesPage"));
const QuestionsPage = lazy(() => import("@/features/questionBank/pages/QuestionsPage"));
const AssessmentsPage = lazy(() => import("@/features/assessments/pages/AssessmentsPage"));
const AssessmentDetailPage = lazy(
  () => import("@/features/assessments/pages/AssessmentDetailPage")
);
const LiveInterviewsPage = lazy(() => import("@/features/liveInterviews/pages/LiveInterviewsPage"));
const UsersPage = lazy(() => import("@/features/users/pages/UsersPage"));
const UserProfilePage = lazy(() => import("@/features/profile/pages/UserProfilePage"));
const NotificationsPage = lazy(() => import("@/features/notifications/pages/NotificationsPage"));

// Lazy-loaded candidate pages
const CandidateLoginPage = lazy(() => import("@/features/candidate/pages/CandidateLoginPage"));
const RegisterPage = lazy(() => import("@/features/candidate/pages/RegisterPage"));
const InstructionsPage = lazy(() => import("@/features/candidate/pages/InstructionsPage"));
const InterviewPage = lazy(() => import("@/features/candidate/pages/InterviewPage"));
const CompletedPage = lazy(() => import("@/features/candidate/pages/CompletedPage"));

const Loading = () => (
  <div
    style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}
  >
    <Spinner size="lg" />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public candidate routes */}
        <Route path="/candidate/login" element={<CandidateLoginPage />} />
        <Route path="/candidate/register" element={<RegisterPage />} />
        <Route path="/candidate/dashboard" element={<CandidateDashboard />} />

        {/* Assessment flow — entry is public, protected pages require candidate auth */}
        <Route path="/assessment/:shareLink" element={<AssessmentEntry />} />
        <Route element={<CandidateRoute />}>
          <Route path="/assessment/:shareLink/instructions" element={<InstructionsPage />} />
          <Route path="/assessment/:shareLink/interview/:submissionId" element={<InterviewPage />} />
          <Route path="/assessment/:shareLink/completed" element={<CompletedPage />} />
        </Route>

        {/* Admin auth */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Admin protected routes */}
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/question-bank" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/question-bank" element={<CategoriesPage />} />
          <Route path="/question-bank/:categoryId" element={<QuestionsPage />} />
          <Route path="/workspaces/:workspaceId/assessments" element={<AssessmentsPage />} />
          <Route
            path="/workspaces/:workspaceId/assessments/:id"
            element={<AssessmentDetailPage />}
          />
          <Route path="/live-interviews" element={<LiveInterviewsPage />} />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route
            path="/profile/:userId"
            element={
              <SuperAdminRoute>
                <UserProfilePage />
              </SuperAdminRoute>
            }
          />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/users"
            element={
              <SuperAdminRoute>
                <UsersPage />
              </SuperAdminRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/question-bank" replace />} />
      </Routes>
    </Suspense>
  );
}

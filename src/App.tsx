import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { Spinner } from "@/components/ui/Spinner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { NoAccessPage } from "@/components/shared/NoAccessPage";
import { useAppSelector } from "@/store";

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
  const isCandidate = isAuthenticated && user?.role !== "admin" && user?.role !== "super_admin";

  if (isCandidate) return <Navigate to={`/assessment/${shareLink}/instructions`} replace />;
  return <Navigate to={`/candidate/login?share=${shareLink}`} replace />;
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

        {/* Assessment flow */}
        <Route path="/assessment/:shareLink" element={<AssessmentEntry />} />
        <Route path="/assessment/:shareLink/instructions" element={<InstructionsPage />} />
        <Route path="/assessment/:shareLink/interview/:submissionId" element={<InterviewPage />} />
        <Route path="/assessment/:shareLink/completed" element={<CompletedPage />} />

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

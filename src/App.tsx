import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Spinner } from "@/components/ui/Spinner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { NoAccessPage } from "@/components/shared/NoAccessPage";
import { CandidateRoute } from "@/features/candidate/components/CandidateRoute";
import { useAppSelector } from "@/store";
import { UserRole } from "@/types";
import NeonLoader from "./components/ui/NeonLoader";

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAppSelector((s) => s.auth.user);
  if (user?.role !== UserRole.SUPER_ADMIN) {
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

// Lazy-loaded admin pages
const AdminLoginPage = lazy(() => import("@/features/auth/pages/AdminLoginPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const CategoriesPage = lazy(() => import("@/features/questionBank/pages/CategoriesPage"));
const QuestionsPage = lazy(() => import("@/features/questionBank/pages/QuestionsPage"));
const AssessmentsPage = lazy(() => import("@/features/assessments/pages/AssessmentsPage"));
const AssessmentDetailPage = lazy(
  () => import("@/features/assessments/pages/AssessmentDetailPage")
);
const CandidateDetailsPage = lazy(() => import("@/features/candidate/pages/CandidateDetailsPage"));
const LiveMonitoringPage = lazy(() => import("@/features/liveMonitoring/pages/LiveMonitoringPage"));
const UsersPage = lazy(() => import("@/features/users/pages/UsersPage"));
const UserProfilePage = lazy(() => import("@/features/profile/pages/UserProfilePage"));
const NotificationsPage = lazy(() => import("@/features/notifications/pages/NotificationsPage"));

// Lazy-loaded candidate pages
const AssessmentEntryPage = lazy(() => import("@/features/candidate/pages/AssessmentEntryPage"));
// const AssessmentAccessPage = lazy(() => import("@/features/candidate/pages/AssessmentAccessPage"));
const CandidateDashboard = lazy(() =>
  import("@/features/candidate/pages/AssessmentEntryPage").then((m) => ({
    default: m.CandidateDashboard,
  }))
);
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
        <Route path="/assessment/:shareLink" element={<AssessmentEntryPage />} />
        <Route element={<CandidateRoute />}>
          <Route path="/assessment/:shareLink/instructions" element={<InstructionsPage />} />
          <Route
            path="/assessment/:shareLink/interview/:submissionId"
            element={<InterviewPage />}
          />
          <Route path="/assessment/:shareLink/completed" element={<CompletedPage />} />
        </Route>

        {/* Admin auth */}
        <Route path="/loader" element={<NeonLoader />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin/no-access"
          element={<NoAccessPage backTo="/admin/login" backLabel="Go to Admin Login" />}
        />

        {/* Admin protected routes */}
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/question-bank" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/question-bank" element={<CategoriesPage />} />
          <Route path="/question-bank/:categoryId" element={<QuestionsPage />} />
          <Route path="/workspaces/:workspaceId/assessments" element={<AssessmentsPage />} />
          <Route path="/live-interviews" element={<LiveMonitoringPage />} />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/workspaces/:workspaceId/assessments/:id"
            element={<AssessmentDetailPage />}
          />
          <Route
            path="/workspaces/:workspaceId/assessments/:id/submissions/:submissionId"
            element={<CandidateDetailsPage />}
          />
          <Route
            path="/workspaces/:workspaceId/assessments/:assessmentId/candidates/:candidateId"
            element={<CandidateDetailsPage />}
          />
          <Route
            element={
              <SuperAdminRoute>
                <Outlet />
              </SuperAdminRoute>
            }
          >
            <Route path="/users" element={<UsersPage />} />
            <Route path="/profile/:userId" element={<UserProfilePage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/question-bank" replace />} />
      </Routes>
    </Suspense>
  );
}

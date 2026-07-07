import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Spinner } from "@/components/ui/Spinner";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { NoAccessPage } from "@/components/shared/NoAccessPage";
import { CandidateRoute } from "@/features/candidate/components/CandidateRoute";
import { useAppSelector } from "@/store";
import { UserRole } from "@/types";
import NeonLoader from "./components/ui/NeonLoader";
import { ROUTES } from "@/constants/routes";

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAppSelector((s) => s.auth.user);
  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <NoAccessPage
        title="Super Admin Only"
        description="This area is restricted to Super Admins. Contact your administrator if you require access."
        backTo={ROUTES.ADMIN.QUESTION_BANK}
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
const CandidatesPage = lazy(() => import("@/features/candidates/pages/CandidatesPage"));
const CandidateProfilePage = lazy(
  () => import("@/features/candidates/pages/CandidateProfilePage")
);
const UserProfilePage = lazy(() => import("@/features/profile/pages/UserProfilePage"));
const NotificationsPage = lazy(() => import("@/features/notifications/pages/NotificationsPage"));

// Lazy-loaded candidate pages
const AssessmentEntryPage = lazy(() => import("@/features/candidate/pages/AssessmentEntryPage"));
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
        <Route path={ROUTES.CANDIDATE.LOGIN} element={<CandidateLoginPage />} />
        <Route path={ROUTES.CANDIDATE.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.CANDIDATE.DASHBOARD} element={<CandidateDashboard />} />

        {/* Assessment flow — entry is public, protected pages require candidate auth */}
        <Route path={ROUTES.ASSESSMENT.ENTRY} element={<AssessmentEntryPage />} />
        <Route element={<CandidateRoute />}>
          <Route path={ROUTES.ASSESSMENT.INSTRUCTIONS} element={<InstructionsPage />} />
          <Route path={ROUTES.ASSESSMENT.INTERVIEW} element={<InterviewPage />} />
          <Route path={ROUTES.ASSESSMENT.COMPLETED} element={<CompletedPage />} />
        </Route>

        {/* Admin auth */}
        <Route path={ROUTES.ADMIN.LOADER} element={<NeonLoader />} />
        <Route path={ROUTES.ADMIN.LOGIN} element={<AdminLoginPage />} />
        <Route
          path={ROUTES.ADMIN.NO_ACCESS}
          element={<NoAccessPage backTo={ROUTES.ADMIN.LOGIN} backLabel="Go to Admin Login" />}
        />

        {/* Admin protected routes */}
        <Route element={<AdminLayout />}>
          <Route
            path={ROUTES.ROOT}
            element={<Navigate to={ROUTES.ADMIN.QUESTION_BANK} replace />}
          />
          <Route path={ROUTES.ADMIN.DASHBOARD} element={<DashboardPage />} />
          <Route path={ROUTES.ADMIN.QUESTION_BANK} element={<CategoriesPage />} />
          <Route path={ROUTES.ADMIN.QUESTION_BANK_CATEGORY} element={<QuestionsPage />} />
          <Route path={ROUTES.ADMIN.ASSESSMENTS} element={<AssessmentsPage />} />
          <Route path={ROUTES.ADMIN.LIVE_INTERVIEWS} element={<LiveMonitoringPage />} />
          <Route path={ROUTES.ADMIN.PROFILE} element={<UserProfilePage />} />
          <Route path={ROUTES.ADMIN.NOTIFICATIONS} element={<NotificationsPage />} />
          <Route path={ROUTES.ADMIN.ASSESSMENT_DETAIL} element={<AssessmentDetailPage />} />
          <Route path={ROUTES.ADMIN.CANDIDATE_DETAIL} element={<CandidateDetailsPage />} />
          <Route path={ROUTES.ADMIN.CANDIDATES} element={<CandidatesPage />} />
          <Route path={ROUTES.ADMIN.CANDIDATE_PROFILE} element={<CandidateProfilePage />} />
          <Route
            element={
              <SuperAdminRoute>
                <Outlet />
              </SuperAdminRoute>
            }
          >
            <Route path={ROUTES.ADMIN.USERS} element={<UsersPage />} />
            <Route path={ROUTES.ADMIN.PROFILE_BY_ID} element={<UserProfilePage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTES.ADMIN.QUESTION_BANK} replace />} />
      </Routes>
    </Suspense>
  );
}

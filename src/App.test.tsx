import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import App from "./App";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeSuperAdminUser, makeAuthState } from "@/test/mocks";

// Lazy-loaded pages need to be mocked to avoid loading all dependencies
vi.mock("@/features/auth/pages/AdminLoginPage", () => ({
  default: () => <div data-testid="admin-login-page">Admin Login</div>,
}));
vi.mock("@/features/dashboard/DashboardPage", () => ({
  default: () => <div data-testid="dashboard-page">Dashboard</div>,
}));
vi.mock("@/features/questionBank/pages/CategoriesPage", () => ({
  default: () => <div data-testid="categories-page">Categories</div>,
}));
vi.mock("@/features/questionBank/pages/QuestionsPage", () => ({
  default: () => <div data-testid="questions-page">Questions</div>,
}));
vi.mock("@/features/assessments/pages/AssessmentsPage", () => ({
  default: () => <div data-testid="assessments-page">Assessments</div>,
}));
vi.mock("@/features/assessments/pages/AssessmentDetailPage", () => ({
  default: () => <div data-testid="assessment-detail-page">Assessment Detail</div>,
}));
vi.mock("@/features/candidate/pages/CandidateDetailsPage", () => ({
  default: () => <div data-testid="candidate-details-page">Candidate Details</div>,
}));
vi.mock("@/features/liveMonitoring/pages/LiveMonitoringPage", () => ({
  default: () => <div data-testid="live-monitoring-page">Live Monitoring</div>,
}));
vi.mock("@/features/users/pages/UsersPage", () => ({
  default: () => <div data-testid="users-page">Users</div>,
}));
vi.mock("@/features/profile/pages/UserProfilePage", () => ({
  default: () => <div data-testid="user-profile-page">User Profile</div>,
}));
vi.mock("@/features/notifications/pages/NotificationsPage", () => ({
  default: () => <div data-testid="notifications-page">Notifications</div>,
}));
vi.mock("@/features/candidate/pages/AssessmentEntryPage", () => ({
  default: () => <div data-testid="entry-page">Entry</div>,
  CandidateDashboard: () => <div data-testid="candidate-dashboard">Dashboard</div>,
}));
vi.mock("@/features/candidate/pages/CandidateLoginPage", () => ({
  default: () => <div data-testid="candidate-login-page">Candidate Login</div>,
}));
vi.mock("@/features/candidate/pages/RegisterPage", () => ({
  default: () => <div data-testid="register-page">Register</div>,
}));
vi.mock("@/features/candidate/pages/InstructionsPage", () => ({
  default: () => <div data-testid="instructions-page">Instructions</div>,
}));
vi.mock("@/features/candidate/pages/InterviewPage", () => ({
  default: () => <div data-testid="interview-page">Interview</div>,
}));
vi.mock("@/features/candidate/pages/CompletedPage", () => ({
  default: () => <div data-testid="completed-page">Completed</div>,
}));
vi.mock("@/components/ui/NeonLoader", () => ({
  default: () => <div data-testid="neon-loader">Loading...</div>,
}));
vi.mock("@/components/layout/AdminLayout", () => ({
  AdminLayout: () => (
    <div data-testid="admin-layout">
      <div />
    </div>
  ),
}));
vi.mock("@/features/candidate/components/CandidateRoute", () => ({
  CandidateRoute: () => (
    <div data-testid="candidate-route">
      <div />
    </div>
  ),
}));
vi.mock("@/components/shared/NoAccessPage", () => ({
  NoAccessPage: ({ title }: { title: string }) => <div data-testid="no-access-page">{title}</div>,
}));

const adminUser = makeAdminUser();
const _superAdmin = makeSuperAdminUser();

describe("App", () => {
  it("renders candidate login page at /candidate/login route", async () => {
    renderWithProviders(<App />, {
      routerProps: { initialEntries: ["/candidate/login"] },
      preloadedState: {
        auth: makeAuthState({ user: null, isAuthenticated: false }),
      },
    });
    expect(await screen.findByTestId("candidate-login-page")).toBeInTheDocument();
  });

  it("renders register page at /candidate/register route", async () => {
    renderWithProviders(<App />, {
      routerProps: { initialEntries: ["/candidate/register"] },
      preloadedState: {
        auth: makeAuthState({ user: null, isAuthenticated: false }),
      },
    });
    expect(await screen.findByTestId("register-page")).toBeInTheDocument();
  });

  it("renders admin login page at /admin/login route", async () => {
    renderWithProviders(<App />, {
      routerProps: { initialEntries: ["/admin/login"] },
      preloadedState: {
        auth: makeAuthState({ user: null, isAuthenticated: false }),
      },
    });
    expect(await screen.findByTestId("admin-login-page")).toBeInTheDocument();
  });

  it("renders no-access page at /admin/no-access route", async () => {
    renderWithProviders(<App />, {
      routerProps: { initialEntries: ["/admin/no-access"] },
      preloadedState: {
        auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      },
    });
    expect(await screen.findByTestId("no-access-page")).toBeInTheDocument();
  });
});

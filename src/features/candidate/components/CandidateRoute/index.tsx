import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAppSelector } from "@/store";
import { NoAccessPage } from "@/components/shared/NoAccessPage";

/**
 * Outlet-based route guard for candidate assessment pages.
 *
 * Rules:
 *  1. Not authenticated → redirect to candidate login, preserving the share link so
 *     the user lands back on the right assessment after signing in.
 *  2. Authenticated but not a candidate (e.g. admin navigated manually) → No Access page.
 *  3. Authenticated candidate → render the child route.
 */
export function CandidateRoute() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  if (!isAuthenticated) {
    const loginTarget = shareLink
      ? `/candidate/login?share=${shareLink}`
      : "/candidate/login";
    return <Navigate to={loginTarget} replace />;
  }

  if (user?.role !== "candidate") {
    return (
      <NoAccessPage
        title="Candidate Access Only"
        description="This assessment area is restricted to candidates. Please sign in with a candidate account."
        backTo="/question-bank"
        backLabel="Back to Admin Dashboard"
      />
    );
  }

  return <Outlet />;
}

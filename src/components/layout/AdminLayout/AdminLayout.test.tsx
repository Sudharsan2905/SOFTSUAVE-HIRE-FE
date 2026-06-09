/**
 * AdminLayout — route guard tests.
 *
 * AdminLayout wraps protected admin pages and enforces:
 *   1. Authentication  → unauthenticated users go to /admin/login
 *   2. Role check      → candidates go to /admin/no-access
 *                        unknown roles go to /admin/login
 *   3. Happy path      → admin / super_admin users see the layout + outlet
 *
 * Heavy child components (Sidebar, AppHeader, BottomNav) are mocked with
 * lightweight stubs so tests focus solely on guard logic rather than on
 * the internal dependencies of those components.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";

import { renderWithProviders } from "@/test/utils";
import {
  makeAdminUser,
  makeSuperAdminUser,
  makeCandidateUser,
  makeAuthState,
} from "@/test/mocks";
import { AdminLayout } from "./index";

// ---------------------------------------------------------------------------
// Stub heavy layout children so only the guard logic is under test
// ---------------------------------------------------------------------------

vi.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));
vi.mock("@/components/layout/AppHeader", () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));
vi.mock("@/components/layout/BottomNav", () => ({
  BottomNav: () => <div data-testid="bottom-nav" />,
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderAdminLayout(
  authState: ReturnType<typeof makeAuthState>,
  initialPath = "/dashboard"
) {
  return renderWithProviders(
    <Routes>
      {/* Protected zone */}
      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        <Route path="/question-bank" element={<div>Question Bank</div>} />
      </Route>

      {/* Redirect targets */}
      <Route path="/admin/login" element={<div>Admin Login</div>} />
      <Route path="/admin/no-access" element={<div>No Access</div>} />
    </Routes>,
    {
      preloadedState: { auth: authState },
      routerProps: { initialEntries: [initialPath] },
    }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminLayout", () => {
  // ── Unauthenticated ────────────────────────────────────────────────────────

  describe("unauthenticated access", () => {
    it("redirects to /admin/login when the user is not authenticated", () => {
      renderAdminLayout(makeAuthState({ isAuthenticated: false, user: null }));
      expect(screen.getByText("Admin Login")).toBeInTheDocument();
    });

    it("does not render dashboard content for unauthenticated users", () => {
      renderAdminLayout(makeAuthState({ isAuthenticated: false, user: null }));
      expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
    });
  });

  // ── Role-based access control ─────────────────────────────────────────────

  describe("role-based access control", () => {
    it("redirects a candidate to /admin/no-access", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );
      expect(screen.getByText("No Access")).toBeInTheDocument();
    });

    it("does not render layout shell for a candidate", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeCandidateUser() })
      );
      expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    });

    it("redirects an unknown / undefined role to /admin/login", () => {
      renderAdminLayout(
        makeAuthState({
          isAuthenticated: true,
          user: { ...makeCandidateUser(), role: "unknown" as never },
        })
      );
      expect(screen.getByText("Admin Login")).toBeInTheDocument();
    });

    it("allows access for the admin role", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeAdminUser() })
      );
      expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    });

    it("allows access for the super_admin role", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeSuperAdminUser() })
      );
      expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    });
  });

  // ── Layout structure ──────────────────────────────────────────────────────

  describe("layout structure for authenticated admins", () => {
    it("renders the Sidebar", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeAdminUser() })
      );
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    it("renders the AppHeader", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeAdminUser() })
      );
      expect(screen.getByTestId("app-header")).toBeInTheDocument();
    });

    it("renders the BottomNav", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeAdminUser() })
      );
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });

    it("renders the Outlet (child route) inside the layout", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeAdminUser() })
      );
      expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    });

    it("renders the correct outlet for a different child route", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: makeAdminUser() }),
        "/question-bank"
      );
      expect(screen.getByText("Question Bank")).toBeInTheDocument();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("redirects to /admin/login when authenticated but user object is null", () => {
      renderAdminLayout(
        makeAuthState({ isAuthenticated: true, user: null })
      );
      // user.role is undefined — the else-if(!isAdmin) branch fires
      expect(screen.getByText("Admin Login")).toBeInTheDocument();
    });
  });
});

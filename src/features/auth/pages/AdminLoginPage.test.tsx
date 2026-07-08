/**
 * AdminLoginPage tests.
 *
 * Renders the real component inside a real Redux store and MemoryRouter.
 * The axios instance and react-hot-toast are mocked so no actual HTTP
 * requests occur and no DOM nodes are created for toasts.
 *
 * Route tree used in tests:
 *   /admin/login  → AdminLoginPage (component under test)
 *   /question-bank → <div>Question Bank</div>   (redirect target)
 *
 * All user interactions use @testing-library/user-event v14 (userEvent.setup).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";

import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeSuperAdminUser, makeAuthState, makeAuthPayload } from "@/test/mocks";
import AdminLoginPage from "./AdminLoginPage";

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

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import { api } from "@/utils/api";
const mockPost = api.post as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helper — renders the full route tree at /admin/login
// ---------------------------------------------------------------------------

function setup(preloadedState: Record<string, unknown> = {}) {
  const user = userEvent.setup();
  const result = renderWithProviders(
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/question-bank" element={<div>Question Bank</div>} />
    </Routes>,
    {
      preloadedState,
      routerProps: { initialEntries: ["/admin/login"] },
    }
  );
  return { user, ...result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminLoginPage", () => {
  beforeEach(() => mockPost.mockReset());

  // ── Rendering ─────────────────────────────────────────────────────────────

  describe("Rendering", () => {
    it("renders the Talentia logo", () => {
      setup();
      expect(screen.getByAltText("Talentia")).toBeInTheDocument();
    });

    it("renders the application name and portal label", () => {
      setup();
      expect(screen.getByText("Talentia")).toBeInTheDocument();
      expect(screen.getByText("Administrator Portal")).toBeInTheDocument();
    });

    it("renders the email input field", () => {
      setup();
      expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument();
    });

    it("renders the password input field", () => {
      setup();
      expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
    });

    it("renders the Sign In submit button", () => {
      setup();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("renders the password visibility toggle button", () => {
      setup();
      expect(screen.getByRole("button", { name: /show password/i })).toBeInTheDocument();
    });

    it("renders the welcome hero section", () => {
      setup();
      expect(screen.getByText("Welcome Back!")).toBeInTheDocument();
      expect(screen.getByText("Please sign in to your account")).toBeInTheDocument();
    });

    it("does not show validation errors on initial render", () => {
      setup();
      expect(screen.queryByText("Enter a valid email")).not.toBeInTheDocument();
      expect(screen.queryByText("Password must be at least 6 characters")).not.toBeInTheDocument();
    });
  });

  // ── Password toggle ────────────────────────────────────────────────────────

  describe("Password visibility toggle", () => {
    it("password field starts as type='password'", () => {
      setup();
      expect(screen.getByPlaceholderText("Enter password")).toHaveAttribute("type", "password");
    });

    it("changes field type to 'text' when the toggle is clicked", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: /show password/i }));
      expect(screen.getByPlaceholderText("Enter password")).toHaveAttribute("type", "text");
    });

    it("updates toggle aria-label to 'Hide password' after first click", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: /show password/i }));
      expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();
    });

    it("reverts field type back to 'password' on second click", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: /show password/i }));
      await user.click(screen.getByRole("button", { name: /hide password/i }));
      expect(screen.getByPlaceholderText("Enter password")).toHaveAttribute("type", "password");
    });

    it("toggle button has type='button' so it never submits the form", () => {
      setup();
      expect(screen.getByRole("button", { name: /show password/i })).toHaveAttribute(
        "type",
        "button"
      );
    });
  });

  // ── Form validation ────────────────────────────────────────────────────────

  describe("Form validation", () => {
    it("shows 'Enter a valid email' when a non-email value is submitted", async () => {
      const { user } = setup();
      const emailInput = screen.getByPlaceholderText("Enter email");
      await user.type(emailInput, "not-an-email");

      // jsdom's native HTML5 constraint validation intercepts click-based submission
      // when <input type="email"> holds an invalid value (the submit event never reaches
      // react-hook-form). fireEvent.submit bypasses that check and lets react-hook-form
      // run its own Zod-based validation.
      fireEvent.submit(emailInput.closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
      });
    });

    it("shows password length error when password is fewer than 6 characters", async () => {
      const { user } = setup();
      await user.type(screen.getByPlaceholderText("Enter email"), "valid@example.com");
      await user.type(screen.getByPlaceholderText("Enter password"), "abc");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
      });
    });

    it("shows both errors when both fields are empty on submit", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
        expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
      });
    });

    it("does not call the API when the form is invalid", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
      });

      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  // ── Form submission ────────────────────────────────────────────────────────

  describe("Form submission", () => {
    it("authenticates and updates Redux state on a successful login", async () => {
      const admin = makeAdminUser();
      mockPost.mockResolvedValueOnce({ data: { data: makeAuthPayload(admin) } });

      const { user, store } = setup();
      await user.type(screen.getByPlaceholderText("Enter email"), "admin@example.com");
      await user.type(screen.getByPlaceholderText("Enter password"), "secret123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(store.getState().auth.isAuthenticated).toBe(true);
        expect(store.getState().auth.user?.email).toBe(admin.email);
      });
    });

    it("navigates to /question-bank after a successful admin login", async () => {
      const admin = makeAdminUser();
      mockPost.mockResolvedValueOnce({ data: { data: makeAuthPayload(admin) } });

      const { user } = setup();
      await user.type(screen.getByPlaceholderText("Enter email"), "admin@example.com");
      await user.type(screen.getByPlaceholderText("Enter password"), "secret123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText("Question Bank")).toBeInTheDocument();
      });
    });
  });

  // ── Authentication redirect ────────────────────────────────────────────────

  describe("Authentication redirect", () => {
    it("redirects to /question-bank immediately when already authenticated as admin", () => {
      setup({
        auth: makeAuthState({ isAuthenticated: true, user: makeAdminUser() }),
      });
      expect(screen.getByText("Question Bank")).toBeInTheDocument();
    });

    it("redirects to /question-bank when already authenticated as super_admin", () => {
      setup({
        auth: makeAuthState({ isAuthenticated: true, user: makeSuperAdminUser() }),
      });
      expect(screen.getByText("Question Bank")).toBeInTheDocument();
    });

    it("stays on the login page when not authenticated", () => {
      setup({ auth: makeAuthState({ isAuthenticated: false }) });
      expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument();
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe("Accessibility", () => {
    it("email input has type='email' and autocomplete='email'", () => {
      setup();
      const emailInput = screen.getByPlaceholderText("Enter email");
      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("autocomplete", "email");
    });

    it("password input has autocomplete='current-password'", () => {
      setup();
      expect(screen.getByPlaceholderText("Enter password")).toHaveAttribute(
        "autocomplete",
        "current-password"
      );
    });

    it("submit button has type='submit'", () => {
      setup();
      expect(screen.getByRole("button", { name: /sign in/i })).toHaveAttribute("type", "submit");
    });

    it("toggle button has an aria-label describing its action", () => {
      setup();
      const toggleBtn = screen.getByRole("button", { name: /show password/i });
      expect(toggleBtn).toHaveAttribute("aria-label");
    });
  });
});

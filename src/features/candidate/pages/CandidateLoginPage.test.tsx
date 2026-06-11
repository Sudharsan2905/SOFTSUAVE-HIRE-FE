import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateLoginPage from "./CandidateLoginPage";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));
vi.mock("@/utils/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (r: unknown) => void }) => (
    <button data-testid="google-login" onClick={() => onSuccess({ credential: "tok" })}>
      Sign in with Google
    </button>
  ),
}));
vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

import { api } from "@/utils/api";
const mockPost = api.post as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockPost.mockReset();
  mockNavigate.mockReset();
});

describe("CandidateLoginPage", () => {
  it("renders username and password inputs", () => {
    renderWithProviders(<CandidateLoginPage />);
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  });

  it("renders a login button", () => {
    renderWithProviders(<CandidateLoginPage />);
    expect(screen.getByRole("button", { name: /login now/i })).toBeInTheDocument();
  });

  it("renders Google sign-in button", () => {
    renderWithProviders(<CandidateLoginPage />);
    expect(screen.getByTestId("google-login")).toBeInTheDocument();
  });

  it("shows email validation error on empty submit", async () => {
    renderWithProviders(<CandidateLoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /login now/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it("shows password validation error when only email filled", async () => {
    renderWithProviders(<CandidateLoginPage />);
    await userEvent.type(screen.getByPlaceholderText("Username"), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /login now/i }));
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it("toggles password visibility", async () => {
    renderWithProviders(<CandidateLoginPage />);
    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: /show password/i });
    await userEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
  });

  it("submits credentials and calls API on success", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          access_token: "tok",
          refresh_token: "ref",
          user: { id: "1", role: "candidate", first_name: "Jane", email: "j@x.com" },
        },
      },
    });
    renderWithProviders(<CandidateLoginPage />);
    await userEvent.type(screen.getByPlaceholderText("Username"), "user@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "Password1!");
    await userEvent.click(screen.getByRole("button", { name: /login now/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
  });
});

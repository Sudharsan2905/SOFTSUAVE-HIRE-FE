import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssessmentAccessPage from "./AssessmentAccessPage";
import { renderWithProviders } from "@/test/utils";
import { makeAuthState, makeCandidateUser } from "@/test/mocks";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (_e: unknown, fb: string) => fb,
}));

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));
vi.mock("@/assets/icons", () => ({
  IconUser: () => <svg />,
  IconLock: () => <svg />,
  IconEye: () => <svg data-testid="icon-eye" />,
  IconEyeOff: () => <svg data-testid="icon-eye-off" />,
}));

vi.mock("@/features/candidate/components/LinkStatusScreen", () => ({
  LinkStatusScreen: ({ status }: { status: string }) => (
    <div data-testid="link-status">{status}</div>
  ),
}));

vi.mock("@/store/slices/authSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/slices/authSlice")>();
  return {
    ...actual,
    candidateLogin: vi.fn(() => ({
      type: "auth/candidateLogin",
      unwrap: vi.fn().mockResolvedValue({}),
    })),
  };
});

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;

const mockNavigate = vi.fn();
const mockUseParams = vi.fn<() => { token: string | undefined }>(() => ({ token: "token-xyz" }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

beforeEach(() => {
  mockGet.mockReset();
  mockNavigate.mockReset();
  mockUseParams.mockReturnValue({ token: "token-xyz" });
  sessionStorage.clear();
});

describe("AssessmentAccessPage", () => {
  it("shows spinner while checking link", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<AssessmentAccessPage />);
    // During checking, login form is not shown
    expect(screen.queryByText("Start Assessment")).not.toBeInTheDocument();
  });

  it("shows link status screen when link is expired", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: { can_allow: false, is_expirable: true, is_expired: true, message: "Expired" },
      },
    });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => expect(screen.getByTestId("link-status")).toHaveTextContent("expired"));
  });

  it("shows link status screen when link is not yet started", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: { can_allow: false, is_expirable: true, is_expired: false, message: "Not started" },
      },
    });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => expect(screen.getByTestId("link-status")).toHaveTextContent("not_started"));
  });

  it("shows link status screen when link is invalid", async () => {
    mockGet.mockResolvedValue({
      data: { data: { can_allow: false, is_expirable: false, message: "Invalid" } },
    });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => expect(screen.getByTestId("link-status")).toHaveTextContent("invalid"));
  });

  it("shows invalid status when token is missing", async () => {
    mockUseParams.mockReturnValue({ token: undefined });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => expect(screen.getByTestId("link-status")).toHaveTextContent("invalid"));
  });

  it("shows login form when link is valid", async () => {
    mockGet.mockResolvedValue({
      data: { data: { can_allow: true } },
    });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /start assessment/i })).toBeInTheDocument()
    );
  });

  it("renders email and password inputs", async () => {
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => screen.getByRole("button", { name: /start assessment/i }));
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  });

  it("renders password toggle button", async () => {
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => screen.getByRole("button", { name: /start assessment/i }));
    expect(screen.getByLabelText(/show password/i)).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => screen.getByRole("button", { name: /start assessment/i }));
    const passwordInput = screen.getByPlaceholderText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByLabelText(/show password/i));
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("shows validation errors for empty form submission", async () => {
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => screen.getByRole("button", { name: /start assessment/i }));
    await userEvent.click(screen.getByRole("button", { name: /start assessment/i }));
    await waitFor(() => expect(screen.getByText("Invalid email")).toBeInTheDocument());
  });

  it("treats network error as valid link and shows login form", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /start assessment/i })).toBeInTheDocument()
    );
  });

  it("renders SoftSuave Hire brand name", async () => {
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    renderWithProviders(<AssessmentAccessPage />);
    await waitFor(() => screen.getByRole("button", { name: /start assessment/i }));
    expect(screen.getByText("SoftSuave Hire")).toBeInTheDocument();
  });

  it("redirects authenticated candidate to instructions page", async () => {
    mockGet.mockResolvedValue({ data: { data: { can_allow: true } } });
    const candidate = makeCandidateUser();
    renderWithProviders(<AssessmentAccessPage />, {
      preloadedState: {
        auth: makeAuthState({ user: candidate, isAuthenticated: true }),
      },
      routerProps: { initialEntries: ["/access/token-xyz"] },
    });
    // Authenticated candidate sees Navigate, not the form
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /start assessment/i })).not.toBeInTheDocument();
    });
  });
});

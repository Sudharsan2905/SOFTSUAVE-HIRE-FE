import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "./RegisterPage";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));
vi.mock("@/utils/api", () => ({
  api: { post: vi.fn(), interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));
vi.mock("@/components/ui/DatePicker", () => ({
  DatePicker: ({ onChange }: { onChange: (v: string) => void }) => (
    <input type="date" data-testid="date-picker" onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/components/ui/Select", () => ({
  Select: ({
    onChange,
    label,
    error,
  }: {
    onChange: (v: string) => void;
    label?: string;
    error?: string;
  }) => (
    <div>
      {label && <label>{label}</label>}
      <select
        data-testid="gender-select"
        onChange={(e) => onChange(e.target.value)}
        defaultValue=""
      >
        <option value="">Select gender</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
      {error && <p>{error}</p>}
    </div>
  ),
}));

vi.mock("@/store/slices/authSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/slices/authSlice")>();
  return { ...actual, candidateRegister: vi.fn() };
});

const mockNavigate = vi.fn();
const mockUseSearchParams = vi.hoisted(() => vi.fn(() => [new URLSearchParams(), vi.fn()]));
const mockUseLocation = vi.hoisted(() =>
  vi.fn(() => ({ state: null, pathname: "/register", search: "", hash: "", key: "default" }))
);

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: mockUseSearchParams,
    useLocation: mockUseLocation,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={String(to)}>{children}</a>
    ),
  };
});

import { api } from "@/utils/api";
import { candidateRegister } from "@/store/slices/authSlice";

const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockCandidateRegister = candidateRegister as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockPost.mockReset();
  mockNavigate.mockReset();
  mockCandidateRegister.mockReset();
  mockUseSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
  mockUseLocation.mockReturnValue({
    state: null,
    pathname: "/register",
    search: "",
    hash: "",
    key: "default",
  });
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("John"), "John");
  await user.type(screen.getByPlaceholderText("john@email.com"), "john@test.com");
  await user.type(screen.getByPlaceholderText("+91 9876543210"), "+919876543210");
  await user.selectOptions(screen.getByTestId("gender-select"), "male");
  await user.type(screen.getByPlaceholderText("Min 8 characters"), "Password123!");
  await user.type(screen.getByPlaceholderText("Repeat password"), "Password123!");
}

describe("RegisterPage", () => {
  it("renders first name and email fields", () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByPlaceholderText("John")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("john@email.com")).toBeInTheDocument();
  });

  it("renders the Create Account button", () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    renderWithProviders(<RegisterPage />);
    const submitBtn = screen.getByRole("button", { name: /create account/i });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(document.querySelector("[class*=error]")).toBeTruthy();
    });
  });

  it("renders password fields as type password", () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByPlaceholderText("Min 8 characters")).toHaveAttribute("type", "password");
    expect(screen.getByPlaceholderText("Repeat password")).toHaveAttribute("type", "password");
  });

  it("renders a link to the login page", () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByRole("link", { name: /sign in|log in|login/i })).toBeInTheDocument();
  });

  it("navigates to dashboard on successful registration", async () => {
    // candidateRegister(payload) returns a thunk; dispatch calls thunk(dispatch, getState)
    mockCandidateRegister.mockImplementation(() => () => ({ unwrap: () => Promise.resolve({}) }));
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/candidate/dashboard");
    });
  });

  it("shows error message when registration fails", async () => {
    mockCandidateRegister.mockImplementation(() => () => ({
      unwrap: () => Promise.reject(new Error("Registration failed")),
    }));
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText("Registration failed")).toBeInTheDocument();
    });
  });

  it("navigates to login with share param when share query param is present", async () => {
    mockCandidateRegister.mockImplementation(() => () => ({ unwrap: () => Promise.resolve({}) }));
    const shareValue = "abc123";
    mockUseSearchParams.mockReturnValue([new URLSearchParams({ share: shareValue }), vi.fn()]);
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/candidate/login?share=${shareValue}`);
    });
  });

  it("toggles password field visibility when eye button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    const passInput = screen.getByPlaceholderText("Min 8 characters");
    expect(passInput).toHaveAttribute("type", "password");

    const toggleBtns = screen.getAllByRole("button", { name: "" });
    await user.click(toggleBtns[0]);
    expect(passInput).toHaveAttribute("type", "text");

    await user.click(toggleBtns[0]);
    expect(passInput).toHaveAttribute("type", "password");
  });

  it("toggles confirm password field visibility when eye button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    const confirmInput = screen.getByPlaceholderText("Repeat password");
    expect(confirmInput).toHaveAttribute("type", "password");

    const toggleBtns = screen.getAllByRole("button", { name: "" });
    await user.click(toggleBtns[1]);
    expect(confirmInput).toHaveAttribute("type", "text");

    await user.click(toggleBtns[1]);
    expect(confirmInput).toHaveAttribute("type", "password");
  });

  it("prefills fields and shows google banner when googleData is in location state", async () => {
    mockUseLocation.mockReturnValue({
      state: {
        googleData: {
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@google.com",
          google_id: "google-123",
          picture: "",
        },
      } as unknown as null,
      pathname: "/register",
      search: "",
      hash: "",
      key: "default",
    });

    renderWithProviders(<RegisterPage />);

    expect(screen.getByText(/continuing with google/i)).toBeInTheDocument();
    expect((screen.getByPlaceholderText("John") as HTMLInputElement).value).toBe("Jane");
    expect((screen.getByPlaceholderText("john@email.com") as HTMLInputElement).value).toBe(
      "jane@google.com"
    );
  });
});

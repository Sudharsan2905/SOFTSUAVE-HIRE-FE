import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { AppHeader } from "./index";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeAuthState, makeSuperAdminUser } from "@/test/mocks";

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));
vi.mock("@/assets/icons", () => ({
  IconBell: () => <svg data-testid="icon-bell" />,
  IconSun: () => <svg data-testid="icon-sun" />,
  IconMoon: () => <svg data-testid="icon-moon" />,
  IconLogout: () => <svg data-testid="icon-logout" />,
  IconUsers: () => <svg data-testid="icon-users" />,
  IconChevronDown: () => <svg data-testid="icon-chevron" />,
}));
vi.mock("@/components/notifications/NotificationDropdown", () => ({
  NotificationDropdown: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="notification-dropdown">
      <button onClick={onClose}>Close notifications</button>
    </div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeState(
  userOverrides = {},
  uiTheme: "light" | "dark" = "light",
  unreadCount = 0
) {
  return {
    auth: makeAuthState({ user: makeAdminUser(userOverrides), isAuthenticated: true }),
    ui: { theme: uiTheme, sidebarCollapsed: false },
    notifications: {
      notifications: [],
      unreadCount,
      isLoading: false,
      isFetched: false,
      pagination: null,
      error: null,
    },
  };
}

describe("AppHeader", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("renders welcome greeting with user first name", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    expect(screen.getByText(/welcome,/i)).toBeInTheDocument();
  });

  it("renders Admin role label", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders Super Admin role label for super admin user", () => {
    renderWithProviders(<AppHeader />, {
      preloadedState: {
        ...makeState(),
        auth: makeAuthState({ user: makeSuperAdminUser(), isAuthenticated: true }),
      },
    });
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("renders notification bell button", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("shows unread count in bell label when unread > 0", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState({}, "light", 5) });
    expect(screen.getByLabelText(/5 unread/i)).toBeInTheDocument();
  });

  it("shows numeric badge when unread count > 0", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState({}, "light", 3) });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 9+ badge when unread count exceeds 9", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState({}, "light", 15) });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("opens notification dropdown when bell button is clicked", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
  });

  it("closes notification dropdown when close button inside is clicked", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("Notifications"));
    fireEvent.click(screen.getByText("Close notifications"));
    expect(screen.queryByTestId("notification-dropdown")).not.toBeInTheDocument();
  });

  it("renders theme toggle button in light mode", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    expect(screen.getByLabelText("Switch to dark mode")).toBeInTheDocument();
  });

  it("renders theme toggle button in dark mode", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState({}, "dark") });
    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });

  it("toggles theme when theme button is clicked", () => {
    const { store } = renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("Switch to dark mode"));
    expect(store.getState().ui.theme).toBe("dark");
  });

  it("renders user menu button", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    expect(screen.getByLabelText("User menu")).toBeInTheDocument();
  });

  it("opens profile dropdown when user menu is clicked", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("shows Edit Profile option in dropdown", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Edit Profile")).toBeInTheDocument();
  });

  it("shows Log out option in dropdown", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });

  it("shows user email in profile dropdown", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    expect(screen.getByText("jane.admin@example.com")).toBeInTheDocument();
  });

  it("navigates to profile page when Edit Profile is clicked", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    fireEvent.click(screen.getByText("Edit Profile"));
    expect(mockNavigate).toHaveBeenCalledWith(expect.any(String));
  });

  it("opens logout confirmation modal when Log out is clicked", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    fireEvent.click(screen.getByText("Log out"));
    expect(screen.getByText("Are you sure you want to log out?")).toBeInTheDocument();
  });

  it("closes logout modal on Cancel click", () => {
    renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    fireEvent.click(screen.getByText("Log out"));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText("Are you sure you want to log out?")).not.toBeInTheDocument();
  });

  it("dispatches logout and navigates on confirm Log out", () => {
    const { store } = renderWithProviders(<AppHeader />, { preloadedState: makeState() });
    fireEvent.click(screen.getByLabelText("User menu"));
    // Clicking "Log out" from the menu closes the menu and opens the modal
    fireEvent.click(screen.getByText("Log out"));
    // The dropdown is gone; only the modal's Log out button remains
    fireEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    expect(store.getState().auth.user).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith(expect.any(String));
  });
});

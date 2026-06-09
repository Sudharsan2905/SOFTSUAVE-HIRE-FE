import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { NotificationDropdown } from "./index";
import { renderWithProviders } from "@/test/utils";

// Mock matchMedia to simulate desktop
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: true, // simulate desktop (min-width: 1025px)
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@/store/slices/notificationSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/slices/notificationSlice")>();
  return {
    ...actual,
    fetchNotifications: vi.fn(() => ({ type: "notifications/fetch", payload: undefined })),
    markAsReadThunk: vi.fn(() => ({ type: "notifications/markAsRead", payload: undefined })),
    markAllReadThunk: vi.fn(() => ({ type: "notifications/markAllRead", payload: undefined })),
  };
});

vi.mock("../NotificationItem", () => ({
  NotificationItem: ({ notification, onRead }: { notification: { id: string; title: string }; onRead: (id: string) => void }) => (
    <li data-testid={`notif-${notification.id}`}>
      <span>{notification.title}</span>
      <button onClick={() => onRead(notification.id)}>Mark read</button>
    </li>
  ),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeNotification(id: string, title: string, isRead = false) {
  return { id, title, message: "msg", is_read: isRead, created_at: "2024-01-01T00:00:00Z" };
}

function makeNotificationsState(overrides = {}) {
  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    isFetched: true,
    pagination: null,
    error: null,
    ...overrides,
  };
}

describe("NotificationDropdown", () => {
  let anchorRef: React.RefObject<HTMLButtonElement>;
  const onClose = vi.fn();

  beforeEach(() => {
    anchorRef = createRef<HTMLButtonElement>();
    onClose.mockReset();
    mockNavigate.mockReset();
  });

  function renderDropdown(notifState = {}) {
    return renderWithProviders(
      <NotificationDropdown anchorRef={anchorRef} onClose={onClose} />,
      {
        preloadedState: {
          notifications: makeNotificationsState(notifState),
        },
      }
    );
  }

  it("renders Notifications heading", () => {
    renderDropdown();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders empty state when no notifications", () => {
    renderDropdown({ notifications: [] });
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("renders notification items when notifications exist", () => {
    const notifications = [
      makeNotification("n1", "New submission received"),
      makeNotification("n2", "Assessment completed"),
    ];
    renderDropdown({ notifications, unreadCount: 2 });
    expect(screen.getByTestId("notif-n1")).toBeInTheDocument();
    expect(screen.getByTestId("notif-n2")).toBeInTheDocument();
  });

  it("renders unread count badge when unread > 0", () => {
    renderDropdown({ unreadCount: 4 });
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders 99+ badge when unread count > 99", () => {
    renderDropdown({ unreadCount: 120 });
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("renders Mark all read button when unread > 0", () => {
    renderDropdown({ unreadCount: 2 });
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeInTheDocument();
  });

  it("does not render Mark all read button when unread = 0", () => {
    renderDropdown({ unreadCount: 0 });
    expect(screen.queryByRole("button", { name: /mark all read/i })).not.toBeInTheDocument();
  });

  it("renders View all notifications button when notifications exist", () => {
    const notifications = [makeNotification("n1", "Test notif")];
    renderDropdown({ notifications });
    expect(screen.getByRole("button", { name: /view all notifications/i })).toBeInTheDocument();
  });

  it("does not render View all button when no notifications", () => {
    renderDropdown({ notifications: [] });
    expect(screen.queryByRole("button", { name: /view all/i })).not.toBeInTheDocument();
  });

  it("navigates to notifications page on View all click", () => {
    const notifications = [makeNotification("n1", "Test notif")];
    renderDropdown({ notifications });
    fireEvent.click(screen.getByRole("button", { name: /view all notifications/i }));
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(expect.any(String));
  });

  it("marks notification as read when mark read is clicked", () => {
    const notifications = [makeNotification("n1", "Unread notif", false)];
    const { store } = renderDropdown({ notifications, unreadCount: 1, isFetched: true });
    fireEvent.click(screen.getByRole("button", { name: /mark read/i }));
    expect(store.getState().notifications.unreadCount).toBe(0);
  });

  it("marks all notifications as read when Mark all read is clicked", () => {
    const notifications = [
      makeNotification("n1", "Notif 1", false),
      makeNotification("n2", "Notif 2", false),
    ];
    const { store } = renderDropdown({ notifications, unreadCount: 2, isFetched: true });
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }));
    expect(store.getState().notifications.unreadCount).toBe(0);
  });

  it("renders notifications list with accessible label", () => {
    renderDropdown();
    expect(screen.getByRole("list", { name: /notifications/i })).toBeInTheDocument();
  });

  it("renders loading skeletons when isLoading is true", () => {
    renderDropdown({ isLoading: true });
    // Skeletons are aria-hidden so no visible text from them
    // Just verify the empty state is NOT shown
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });
});

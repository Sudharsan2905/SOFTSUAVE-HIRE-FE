import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationsPage from "./NotificationsPage";
import { renderWithProviders } from "@/test/utils";
import type { Notification } from "@/store/slices/notificationSlice";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="header">
      <span>{title}</span>
      <span data-testid="subtitle">{subtitle}</span>
      <div data-testid="actions">{actions}</div>
    </div>
  ),
}));

vi.mock("@/components/notifications/NotificationItem", () => ({
  NotificationItem: ({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) => (
    <li data-testid={`notification-${notification.id}`} onClick={() => onRead(notification.id)}>
      {notification.title}
    </li>
  ),
}));

vi.mock("@/components/ui/Pagination", () => ({
  Pagination: () => <div data-testid="pagination" />,
}));

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;

const makeNotification = (id: string, isRead = false): Notification => ({
  id,
  type: "system",
  title: `Notification ${id}`,
  message: `Message ${id}`,
  timestamp: "2024-01-01T00:00:00Z",
  isRead,
});

beforeEach(() => {
  mockGet.mockReset();
  mockPatch.mockReset();
  mockPatch.mockResolvedValue({});
});

function makeApiResponse(notifications: Notification[], unreadCount = 0) {
  return {
    data: {
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          created_at: n.timestamp,
          is_read: n.isRead,
        })),
        pagination: { page: 1, page_size: 15, total: notifications.length, total_pages: 1 },
        unread_count: unreadCount,
      },
    },
  };
}

describe("NotificationsPage", () => {
  it("shows a loading spinner while fetching", async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<NotificationsPage />);
    // The header should render immediately
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    mockGet.mockResolvedValue(makeApiResponse([]));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => expect(screen.getByText("No notifications")).toBeInTheDocument());
    expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
  });

  it("renders notifications when they exist", async () => {
    const notifications = [makeNotification("n-1", false), makeNotification("n-2", true)];
    mockGet.mockResolvedValue(makeApiResponse(notifications, 1));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => expect(screen.getByTestId("notification-n-1")).toBeInTheDocument());
    expect(screen.getByTestId("notification-n-2")).toBeInTheDocument();
  });

  it("shows unread count in subtitle", async () => {
    mockGet.mockResolvedValue(makeApiResponse([makeNotification("n-1", false)], 1));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => expect(screen.getByTestId("subtitle")).toHaveTextContent("1 unread notification"));
  });

  it('shows "All caught up" subtitle when no unread', async () => {
    mockGet.mockResolvedValue(makeApiResponse([makeNotification("n-1", true)], 0));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => expect(screen.getByTestId("subtitle")).toHaveTextContent("All caught up"));
  });

  it("shows Mark all as read button when there are unread notifications", async () => {
    mockGet.mockResolvedValue(makeApiResponse([makeNotification("n-1", false)], 1));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /mark all as read/i })).toBeInTheDocument());
  });

  it("dispatches mark all read when button clicked", async () => {
    mockGet.mockResolvedValue(makeApiResponse([makeNotification("n-1", false)], 1));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => screen.getByRole("button", { name: /mark all as read/i }));
    await userEvent.click(screen.getByRole("button", { name: /mark all as read/i }));
    expect(mockPatch).toHaveBeenCalled();
  });

  it("dispatches mark as read when a notification is clicked", async () => {
    mockGet.mockResolvedValue(makeApiResponse([makeNotification("n-1", false)], 1));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => screen.getByTestId("notification-n-1"));
    await userEvent.click(screen.getByTestId("notification-n-1"));
    expect(mockPatch).toHaveBeenCalled();
  });

  it("handles plural unread count correctly", async () => {
    const ns = [makeNotification("n-1", false), makeNotification("n-2", false)];
    mockGet.mockResolvedValue(makeApiResponse(ns, 2));
    renderWithProviders(<NotificationsPage />);
    await waitFor(() =>
      expect(screen.getByTestId("subtitle")).toHaveTextContent("2 unread notifications")
    );
  });
});

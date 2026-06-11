import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import notificationReducer, {
  markAsRead,
  markAllAsRead,
  addNotification,
  clearNotifications,
  resetFetchedFlag,
  fetchNotifications,
  markAsReadThunk,
  markAllReadThunk,
} from "./notificationSlice";
import type { Notification } from "./notificationSlice";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fallback: string) => fallback,
}));

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;

function makeStore() {
  return configureStore({
    reducer: { notifications: notificationReducer },
    middleware: (g) => g({ serializableCheck: false }),
  });
}

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: "n-1",
  type: "system",
  title: "Test",
  message: "Test message",
  timestamp: "2024-01-01T00:00:00Z",
  isRead: false,
  ...overrides,
});

describe("notificationSlice — sync reducers", () => {
  describe("initial state", () => {
    it("starts with empty notifications and zero unread count", () => {
      const state = makeStore().getState().notifications;
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.isFetched).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("addNotification", () => {
    it("prepends a notification to the list", () => {
      const store = makeStore();
      const n1 = makeNotification({ id: "n-1" });
      const n2 = makeNotification({ id: "n-2" });
      store.dispatch(addNotification(n1));
      store.dispatch(addNotification(n2));
      expect(store.getState().notifications.notifications[0].id).toBe("n-2");
    });

    it("increments unreadCount for unread notifications", () => {
      const store = makeStore();
      store.dispatch(addNotification(makeNotification({ isRead: false })));
      store.dispatch(addNotification(makeNotification({ id: "n-2", isRead: false })));
      expect(store.getState().notifications.unreadCount).toBe(2);
    });

    it("does not increment unreadCount for already-read notifications", () => {
      const store = makeStore();
      store.dispatch(addNotification(makeNotification({ isRead: true })));
      expect(store.getState().notifications.unreadCount).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read and decrements unreadCount", () => {
      const store = makeStore();
      store.dispatch(addNotification(makeNotification({ id: "n-1", isRead: false })));
      store.dispatch(markAsRead("n-1"));
      const { notifications, unreadCount } = store.getState().notifications;
      expect(notifications[0].isRead).toBe(true);
      expect(unreadCount).toBe(0);
    });

    it("does not decrement unreadCount below zero", () => {
      const store = makeStore();
      store.dispatch(addNotification(makeNotification({ id: "n-1", isRead: true })));
      store.dispatch(markAsRead("n-1"));
      expect(store.getState().notifications.unreadCount).toBe(0);
    });

    it("is a no-op for unknown notification id", () => {
      const store = makeStore();
      store.dispatch(addNotification(makeNotification({ id: "n-1", isRead: false })));
      store.dispatch(markAsRead("unknown"));
      expect(store.getState().notifications.notifications[0].isRead).toBe(false);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read and resets unreadCount", () => {
      const store = makeStore();
      store.dispatch(addNotification(makeNotification({ id: "n-1", isRead: false })));
      store.dispatch(addNotification(makeNotification({ id: "n-2", isRead: false })));
      store.dispatch(markAllAsRead());
      const { notifications, unreadCount } = store.getState().notifications;
      expect(notifications.every((n) => n.isRead)).toBe(true);
      expect(unreadCount).toBe(0);
    });
  });

  describe("clearNotifications", () => {
    it("resets all notification state", () => {
      const store = makeStore();
      store.dispatch(addNotification(makeNotification({ isRead: false })));
      store.dispatch(clearNotifications());
      const state = store.getState().notifications;
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.pagination).toBeNull();
      expect(state.isFetched).toBe(false);
    });
  });

  describe("resetFetchedFlag", () => {
    it("sets isFetched to false", async () => {
      const store = makeStore();
      mockGet.mockResolvedValueOnce({
        data: {
          data: {
            notifications: [],
            pagination: { page: 1, page_size: 10, total: 0, total_pages: 1 },
            unread_count: 0,
          },
        },
      });
      await store.dispatch(fetchNotifications({}));
      expect(store.getState().notifications.isFetched).toBe(true);
      store.dispatch(resetFetchedFlag());
      expect(store.getState().notifications.isFetched).toBe(false);
    });
  });
});

describe("notificationSlice — async thunks", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
  });

  describe("fetchNotifications", () => {
    it("sets isLoading=true while pending", async () => {
      let resolve!: (v: unknown) => void;
      mockGet.mockReturnValueOnce(
        new Promise((r) => {
          resolve = r;
        })
      );
      const store = makeStore();
      const promise = store.dispatch(fetchNotifications({}));
      expect(store.getState().notifications.isLoading).toBe(true);
      resolve({ data: { data: { notifications: [], pagination: null, unread_count: 0 } } });
      await promise;
    });

    it("normalises and stores notifications on fulfilled", async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: {
            notifications: [
              {
                id: "n-1",
                type: "system",
                title: "Hello",
                message: "World",
                created_at: "2024-01-01T00:00:00Z",
                is_read: false,
                link: "/some-path",
              },
            ],
            pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
            unread_count: 1,
          },
        },
      });
      const store = makeStore();
      await store.dispatch(fetchNotifications({}));
      const state = store.getState().notifications;
      expect(state.isLoading).toBe(false);
      expect(state.isFetched).toBe(true);
      expect(state.unreadCount).toBe(1);
      expect(state.notifications[0].id).toBe("n-1");
      expect(state.notifications[0].timestamp).toBe("2024-01-01T00:00:00Z");
      expect(state.notifications[0].isRead).toBe(false);
      expect(state.notifications[0].link).toBe("/some-path");
    });

    it("sets error on rejected", async () => {
      mockGet.mockRejectedValueOnce(new Error("Network error"));
      const store = makeStore();
      await store.dispatch(fetchNotifications({}));
      const state = store.getState().notifications;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Failed to load notifications");
    });
  });

  describe("markAsReadThunk", () => {
    it("clears error on fulfilled", async () => {
      mockPatch.mockResolvedValueOnce({});
      const store = makeStore();
      await store.dispatch(markAsReadThunk("n-1"));
      expect(store.getState().notifications.error).toBeNull();
    });

    it("sets error on rejected", async () => {
      mockPatch.mockRejectedValueOnce(new Error("fail"));
      const store = makeStore();
      await store.dispatch(markAsReadThunk("n-1"));
      expect(store.getState().notifications.error).toBe("Failed to mark as read");
    });
  });

  describe("markAllReadThunk", () => {
    it("clears error on fulfilled", async () => {
      mockPatch.mockResolvedValueOnce({});
      const store = makeStore();
      await store.dispatch(markAllReadThunk());
      expect(store.getState().notifications.error).toBeNull();
    });

    it("sets error on rejected", async () => {
      mockPatch.mockRejectedValueOnce(new Error("fail"));
      const store = makeStore();
      await store.dispatch(markAllReadThunk());
      expect(store.getState().notifications.error).toBe("Failed to mark all as read");
    });
  });
});

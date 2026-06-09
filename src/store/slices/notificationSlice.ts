import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { DEFAULT_PAGE_SIZE } from "@/constants/app";
import type { PaginationMeta } from "@/types";
import type { Notification, NotificationType } from "@/features/notifications/types";

export type { Notification, NotificationType };

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  pagination: PaginationMeta | null;
  isLoading: boolean;
  isFetched: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  pagination: null,
  isLoading: false,
  isFetched: false,
  error: null,
};

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asOptionalString = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/* Normalise snake_case API response → camelCase Notification */
const normalise = (raw: Record<string, unknown>): Notification => ({
  id: asString(raw.id),
  type: raw.type as NotificationType,
  title: asString(raw.title),
  message: asString(raw.message),
  timestamp: asString(raw.created_at),
  isRead: raw.is_read === true,
  link: asOptionalString(raw.link),
});

/* ── Async Thunks ── */

export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async (
    { page = 1, pageSize = DEFAULT_PAGE_SIZE }: { page?: number; pageSize?: number },
    { rejectWithValue }
  ) => {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      const { data } = await api.get(`${API_ENDPOINTS.NOTIFICATIONS.ROOT}?${params}`);
      return data.data as {
        notifications: Record<string, unknown>[];
        pagination: PaginationMeta;
        unread_count: number;
      };
    } catch {
      return rejectWithValue("Failed to load notifications");
    }
  }
);

export const markAsReadThunk = createAsyncThunk(
  "notifications/markAsRead",
  async (id: string, { rejectWithValue }) => {
    try {
      await api.patch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
      return id;
    } catch {
      return rejectWithValue("Failed to mark as read");
    }
  }
);

export const markAllReadThunk = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await api.patch(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
    } catch {
      return rejectWithValue("Failed to mark all as read");
    }
  }
);

/* ── Slice ── */

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    /* Optimistic sync reducers (used by components that want instant UI feedback) */
    markAsRead(state, action: PayloadAction<string>) {
      const n = state.notifications.find((item) => item.id === action.payload);
      if (n && !n.isRead) {
        n.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead(state) {
      state.notifications.forEach((n) => {
        n.isRead = true;
      });
      state.unreadCount = 0;
    },
    /* Prepend a freshly-created notification (e.g. from a WebSocket event) */
    addNotification(state, action: PayloadAction<Notification>) {
      state.notifications.unshift(action.payload);
      if (!action.payload.isRead) state.unreadCount += 1;
    },
    clearNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
      state.pagination = null;
      state.isFetched = false;
    },
    resetFetchedFlag(state) {
      state.isFetched = false;
    },
  },
  extraReducers: (builder) => {
    /* fetchNotifications */
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isFetched = true;
        state.notifications = action.payload.notifications.map(normalise);
        state.pagination = action.payload.pagination;
        state.unreadCount = action.payload.unread_count;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    /* markAsReadThunk — optimistic update already done by sync reducer; just reset error */
    builder
      .addCase(markAsReadThunk.fulfilled, (state) => {
        state.error = null;
      })
      .addCase(markAsReadThunk.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    /* markAllReadThunk */
    builder
      .addCase(markAllReadThunk.fulfilled, (state) => {
        state.error = null;
      })
      .addCase(markAllReadThunk.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { markAsRead, markAllAsRead, addNotification, clearNotifications, resetFetchedFlag } =
  notificationSlice.actions;
export default notificationSlice.reducer;

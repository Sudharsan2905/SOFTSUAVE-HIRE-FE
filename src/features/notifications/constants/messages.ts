export const NOTIFICATIONS_SUCCESS = {
  MARKED_READ: "Notification marked as read.",
  ALL_MARKED_READ: "All notifications marked as read.",
  DELETED: "Notification deleted.",
} as const;

export const NOTIFICATIONS_ERRORS = {
  LOAD_FAILED: "Failed to load notifications.",
  MARK_READ_FAILED: "Failed to mark notification as read.",
} as const;

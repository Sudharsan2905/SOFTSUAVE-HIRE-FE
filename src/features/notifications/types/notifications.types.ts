export type NotificationType = "submission" | "assessment" | "interview" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** ISO timestamp — mapped from API `created_at` */
  timestamp: string;
  /** Mapped from API `is_read` */
  isRead: boolean;
  link?: string;
}

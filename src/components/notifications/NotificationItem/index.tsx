import React from "react";
import { formatDistanceToNow } from "date-fns";
import { type Notification } from "@/store/slices/notificationSlice";
import styles from "./NotificationItem.module.css";

interface Props {
  readonly notification: Notification;
  readonly onRead: (id: string) => void;
}

const TYPE_CONFIG: Record<Notification["type"], { color: string }> = {
  submission: { color: "var(--primary-500)" },
  assessment: { color: "var(--accent-500)" },
  interview:  { color: "var(--success-500)" },
  system:     { color: "var(--text-tertiary)" },
};

export function NotificationItem({ notification, onRead }: Props) {
  const config = TYPE_CONFIG[notification.type];

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id);
  };

  return (
    <li className={`${styles.item} ${!notification.isRead ? styles.unread : ""}`}>
      <button
        className={styles.itemBtn}
        onClick={handleClick}
        aria-label={`${notification.title} — ${notification.isRead ? "read" : "unread"}`}
      >
        <span className={styles.typeDot} style={{ background: config.color }} aria-hidden="true" />
        <div className={styles.body}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{notification.title}</span>
            {!notification.isRead && <span className={styles.unreadBadge} aria-hidden="true" />}
          </div>
          <p className={styles.message}>{notification.message}</p>
          <span className={styles.time}>
            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
          </span>
        </div>
      </button>
    </li>
  );
}

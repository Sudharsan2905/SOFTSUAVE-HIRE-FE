import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  markAsRead,
  markAllAsRead,
  fetchNotifications,
  markAsReadThunk,
  markAllReadThunk,
} from "@/store/slices/notificationSlice";
import { NotificationItem } from "../NotificationItem";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import styles from "./NotificationDropdown.module.css";

interface Props {
  readonly anchorRef: React.RefObject<HTMLButtonElement>;
  readonly onClose: () => void;
}

const SKELETON_KEYS = ["sk-a", "sk-b", "sk-c", "sk-d"] as const;

function SkeletonItem({ id }: { readonly id: string }) {
  return (
    <li className={styles.skeletonItem} aria-hidden="true" key={id}>
      <div className={styles.skeletonDot} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonLine} style={{ width: "70%" }} />
        <div className={styles.skeletonLine} style={{ width: "90%" }} />
        <div className={styles.skeletonLine} style={{ width: "40%" }} />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <li className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">🔔</span>
      <p className={styles.emptyText}>You&apos;re all caught up!</p>
      <p className={styles.emptySubtext}>No notifications yet.</p>
    </li>
  );
}

export function NotificationDropdown({ anchorRef, onClose }: Props) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, isFetched } = useAppSelector(
    (s) => s.notifications
  );
  const isDesktop = useMediaQuery("(min-width: 1025px)");

  const dropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(dropdownRef, onClose);

  /* On mobile/tablet route to the dedicated page */
  useEffect(() => {
    if (!isDesktop) {
      onClose();
      navigate("/notifications");
    }
  }, [isDesktop, navigate, onClose]);

  /* Fetch on first open */
  useEffect(() => {
    if (isDesktop && !isFetched) {
      dispatch(fetchNotifications({ page: 1, pageSize: 15 }));
    }
  }, [dispatch, isDesktop, isFetched]);

  /* Position below anchor */
  const [pos, setPos] = useState({ top: 0, right: 0 });
  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  }, [anchorRef]);

  if (!isDesktop) return null;

  const handleRead = (id: string) => {
    dispatch(markAsRead(id));
    dispatch(markAsReadThunk(id));
  };

  const handleMarkAll = () => {
    dispatch(markAllAsRead());
    dispatch(markAllReadThunk());
  };

  const renderListContent = () => {
    if (isLoading) {
      return SKELETON_KEYS.map((k) => <SkeletonItem key={k} id={k} />);
    }
    if (notifications.length === 0) {
      return <EmptyState />;
    }
    return notifications.map((n) => (
      <NotificationItem key={n.id} notification={n} onRead={handleRead} />
    ));
  };

  return createPortal(
    <div
      ref={dropdownRef}
      className={styles.dropdown}
      style={{ top: pos.top, right: pos.right }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.heading}>Notifications</span>
          {unreadCount > 0 && (
            <span className={styles.countBadge}>{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button className={styles.markAllBtn} onClick={handleMarkAll}>
            Mark all read
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <ul className={styles.list} aria-label="Notifications">
        {renderListContent()}
      </ul>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className={styles.footer}>
          <button
            className={styles.viewAllBtn}
            onClick={() => {
              onClose();
              navigate("/notifications");
            }}
          >
            View all notifications
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

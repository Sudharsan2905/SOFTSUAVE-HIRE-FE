import React, { useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  markAsReadThunk,
  markAllReadThunk,
  resetFetchedFlag,
} from "@/store/slices/notificationSlice";
import { Header } from "@/components/layout/Header";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { usePagination } from "@/hooks/usePagination";
import styles from "./NotificationsPage.module.css";

const PAGE_SIZE = 15;

export default function NotificationsPage() {
  const dispatch = useAppDispatch();
  const { notifications, unreadCount, isLoading, pagination } = useAppSelector(
    (s) => s.notifications
  );
  const { page, goToPage } = usePagination(PAGE_SIZE);

  const load = useCallback(() => {
    dispatch(resetFetchedFlag());
    dispatch(fetchNotifications({ page, pageSize: PAGE_SIZE }));
  }, [dispatch, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRead = (id: string) => {
    dispatch(markAsRead(id));
    dispatch(markAsReadThunk(id));
  };

  const handleMarkAll = () => {
    dispatch(markAllAsRead());
    dispatch(markAllReadThunk());
  };

  const unreadLabel = unreadCount === 1 ? "notification" : "notifications";
  const subtitle = unreadCount > 0 ? `${unreadCount} unread ${unreadLabel}` : "All caught up";

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.loadingWrapper}>
          <Spinner size="lg" />
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">🔔</div>
          <p className={styles.emptyTitle}>No notifications</p>
          <p className={styles.emptySubtext}>
            You&apos;re all caught up! Check back later for updates.
          </p>
        </div>
      );
    }

    return (
      <>
        <ul className={styles.list} aria-label="Notifications">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={handleRead} />
          ))}
        </ul>
        {pagination && pagination.total_pages > 1 && (
          <div className={styles.paginationWrapper}>
            <Pagination meta={pagination} onPageChange={goToPage} />
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      <Header
        title="Notifications"
        subtitle={subtitle}
        actions={
          unreadCount > 0
            ? <Button variant="secondary" size="sm" onClick={handleMarkAll}>Mark all as read</Button>
            : undefined
        }
      />
      <div className={styles.page}>{renderContent()}</div>
    </div>
  );
}

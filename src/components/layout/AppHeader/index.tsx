import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import logoUrl from "@/assets/favicon.svg";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout } from "@/store/slices/authSlice";
import { toggleTheme } from "@/store/slices/uiSlice";
import { getFullName, getInitials } from "@/utils/helpers";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  IconBell,
  IconSun,
  IconMoon,
  IconLogout,
  IconUsers,
  IconChevronDown,
} from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { UserRole } from "@/types";
import { ROUTES } from "@/constants/routes";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const user = useAppSelector((s) => s.auth.user);
  const theme = useAppSelector((s) => s.ui.theme);
  const { unreadCount } = useAppSelector((s) => s.notifications);

  const fullName = user ? getFullName(user) : "";
  const initials = fullName ? getInitials(fullName) : "U";
  const roleLabel = user?.role === UserRole.SUPER_ADMIN ? "Super Admin" : "Admin";
  const today = format(new Date(), "EEE, dd MMM yyyy");

  /* Popup states */
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /* Refs for anchor-based positioning */
  const bellRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);

  /* Close profile menu on outside click */
  useClickOutside(profileMenuRef, () => setShowProfileMenu(false), showProfileMenu);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    setShowProfileMenu(false);
    dispatch(logout());
    navigate(ROUTES.ADMIN.LOGIN);
  }, [dispatch, navigate]);

  const handleProfileClick = () => {
    setShowProfileMenu(false);
    navigate(ROUTES.ADMIN.PROFILE);
  };

  const notificationUnreadSuffix = unreadCount > 0 ? ` (${unreadCount} unread)` : "";
  const notificationTooltip = `Notifications${notificationUnreadSuffix}`;
  const notificationAriaLabel = `Notifications${notificationUnreadSuffix}`;

  return (
    <>
      <header className={styles.header}>
        {/* Left — logo (mobile only) + greeting */}
        <div className={styles.left}>
          <img
            src={logoUrl}
            className={styles.mobileLogo}
            width={31}
            height={31}
            alt="SoftSuave Hire"
          />
          <h2 className={styles.greeting}>
            Welcome,{" "}
            <span className={styles.greetingName}>{user?.first_name ?? fullName ?? "Admin"}</span>
          </h2>
          <p className={styles.date}>{today}</p>
        </div>

        {/* Right — actions */}
        <div className={styles.right}>
          {/* Notification bell */}
          <Tooltip content={notificationTooltip} placement="bottom">
            <button
              ref={bellRef}
              className={styles.iconBtn}
              onClick={() => setShowNotifications((p) => !p)}
              aria-label={notificationAriaLabel}
              aria-expanded={showNotifications}
            >
              <IconBell size={19} />
              {unreadCount > 0 && (
                <span className={styles.badge} aria-hidden="true">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip
            content={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            placement="bottom"
          >
            <button
              className={styles.iconBtn}
              onClick={() => dispatch(toggleTheme())}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <IconSun size={19} /> : <IconMoon size={19} />}
            </button>
          </Tooltip>

          {/* Divider */}
          <span className={styles.divider} aria-hidden="true" />

          {/* User profile */}
          <div className={styles.profileWrapper} ref={profileMenuRef}>
            <button
              ref={profileBtnRef}
              className={styles.profileBtn}
              onClick={() => setShowProfileMenu((p) => !p)}
              aria-label="User menu"
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
            >
              <div className={styles.avatar} aria-hidden="true">
                {initials}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{fullName || "Admin"}</span>
                <span className={styles.userRole}>{roleLabel}</span>
              </div>
              <IconChevronDown
                size={14}
                className={`${styles.chevron} ${showProfileMenu ? styles.chevronOpen : ""}`}
              />
            </button>

            {/* Profile dropdown menu */}
            {showProfileMenu && (
              <div className={styles.profileMenu} role="menu" aria-label="User options">
                <div className={styles.profileMenuHeader}>
                  <div className={styles.menuAvatar}>{initials}</div>
                  <div className={styles.menuUserInfo}>
                    <span className={styles.menuUserName}>{fullName || "Admin"}</span>
                    <span className={styles.menuUserEmail}>{user?.email}</span>
                  </div>
                </div>

                <div className={styles.menuItems}>
                  <button className={styles.menuItem} onClick={handleProfileClick}>
                    <IconUsers size={15} />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                  >
                    <IconLogout size={15} />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notification dropdown (desktop) / redirects to /notifications on mobile */}
      {showNotifications && (
        <NotificationDropdown anchorRef={bellRef} onClose={() => setShowNotifications(false)} />
      )}

      {/* Logout confirmation modal */}
      {showLogoutConfirm &&
        createPortal(
          <Modal
            isOpen={showLogoutConfirm}
            onClose={() => setShowLogoutConfirm(false)}
            title="Log out"
            size="sm"
            showClose={false}
            footer={
              <>
                <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            }
          >
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Are you sure you want to log out?
            </p>
          </Modal>,
          document.body
        )}
    </>
  );
}

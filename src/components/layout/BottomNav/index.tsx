import React, { useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { IconQuestionBank, IconAssessment, IconLiveInterview, IconUsers } from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { UserRole } from "@/types";
import { ROUTES } from "@/constants/routes";
import styles from "./BottomNav.module.css";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  to: string;
  disabled?: boolean;
}

export function BottomNav() {
  const { activeWorkspace } = useAppSelector((s) => s.workspace);
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const [tappedKey, setTappedKey] = useState<string | null>(null);

  const assessmentsTo = activeWorkspace ? `/workspaces/${activeWorkspace.id}/assessments` : null;

  const navItems: NavItem[] = [
    {
      key: "qbank",
      label: "Question Bank",
      icon: <IconQuestionBank size={22} />,
      to: ROUTES.ADMIN.QUESTION_BANK,
    },
    {
      key: "assessments",
      label: "Assessments",
      icon: <IconAssessment size={22} />,
      to: assessmentsTo ?? "#",
      disabled: !assessmentsTo,
    },
    {
      key: "live",
      label: "Live Interviews",
      icon: <IconLiveInterview size={22} />,
      to: ROUTES.ADMIN.LIVE_INTERVIEWS,
    },
  ];

  if (isSuperAdmin) {
    navItems.push({
      key: "users",
      label: "Users",
      icon: <IconUsers size={22} />,
      to: ROUTES.ADMIN.USERS,
    });
  }

  /* Brief tap flash, then navigate */
  const handleTap = useCallback(
    (item: NavItem) => {
      if (item.disabled) return;
      setTappedKey(item.key);
      setTimeout(() => {
        setTappedKey(null);
        navigate(item.to);
      }, 200);
    },
    [navigate]
  );

  return (
    <nav className={styles.nav} aria-label="Mobile navigation">
      {navItems.map((item) => (
        <Tooltip key={item.key} content={item.label} placement="top">
          <NavLink
            to={item.disabled ? "#" : item.to}
            className={({ isActive }) => {
              const activeClass = isActive && !item.disabled ? styles.active : "";
              const disabledClass = item.disabled ? styles.disabled : "";
              const tappedClass = tappedKey === item.key ? styles.tapped : "";
              return [styles.item, activeClass, disabledClass, tappedClass]
                .filter(Boolean)
                .join(" ");
            }}
            onClick={(e) => {
              e.preventDefault();
              handleTap(item);
            }}
            aria-label={item.label}
            aria-disabled={item.disabled}
            tabIndex={item.disabled ? -1 : 0}
          >
            <span className={styles.iconWrap}>{item.icon}</span>
          </NavLink>
        </Tooltip>
      ))}

      {/* Workspace switcher as the last bottom-nav slot */}
      <div className={styles.wsItem} aria-label="Switch workspace">
        <span className={styles.iconWrap}>
          <WorkspaceSwitcher collapsed={true} />
        </span>
      </div>
    </nav>
  );
}

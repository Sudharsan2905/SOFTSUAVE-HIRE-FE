import React, { useState, useLayoutEffect } from "react";
import { NavLink } from "react-router-dom";
import logoUrl from "@/assets/favicon.svg";
import styles from "./Sidebar.module.css";
import { useAppSelector } from "@/store";
import { WorkspaceSwitcher } from "../WorkspaceSwitcher";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  IconQuestionBank,
  IconAssessment,
  IconLiveInterview,
  IconUsers,
  IconUserSetting,
  IconDotsVertical,
} from "@/assets/icons";
import { UserRole } from "@/types";
import { ROUTES } from "@/constants/routes";

const COLLAPSED_KEY = "talentia_sidebar_collapsed";
const COLLAPSED_WIDTH = 65;
const DEFAULT_WIDTH = 225;

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  {
    to: ROUTES.ADMIN.QUESTION_BANK,
    label: "Knowledge Vault",
    icon: <IconQuestionBank size={21} />,
  },
  {
    to: ROUTES.ADMIN.LIVE_INTERVIEWS,
    label: "Live Interviews",
    icon: <IconLiveInterview size={20} />,
  },
];

export function Sidebar() {
  const user = useAppSelector((s) => s.auth.user);
  const { activeWorkspace } = useAppSelector((s) => s.workspace);
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");

  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : DEFAULT_WIDTH;

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${effectiveWidth}px`);
  }, [effectiveWidth]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      style={{ width: effectiveWidth }}
    >
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <img src={logoUrl} width="31" height="31" alt="Talentia" />
        </div>
        {!collapsed && <span className={styles.logoText}>Talentia</span>}
        <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
          <button
            className={styles.collapseBtn}
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconDotsVertical size={16} />
          </button>
        </Tooltip>
      </div>

      {/* Workspace Switcher */}
      <div className={styles.workspaceSection}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className={styles.navContainer} aria-label="Main navigation">
        {activeWorkspace && (
          <div className={styles.navSection}>
            {!collapsed && <p className={styles.navSectionLabel}>Workspace</p>}
            <Tooltip content="Assessments" placement="right" disabled={!collapsed}>
              <NavLink
                to={ROUTES.ADMIN.assessments(activeWorkspace.id)}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
              >
                <IconAssessment size={22} />
                {!collapsed && <span>Assessments</span>}
              </NavLink>
            </Tooltip>
          </div>
        )}

        <div className={styles.navSection}>
          {!collapsed && <p className={styles.navSectionLabel}>Global</p>}
          {adminNav.map((item) => (
            <Tooltip key={item.to} content={item.label} placement="right" disabled={!collapsed}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </Tooltip>
          ))}
          <Tooltip content="Candidates" placement="right" disabled={!collapsed}>
            <NavLink
              to={ROUTES.ADMIN.CANDIDATES}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              <IconUsers size={20} />
              {!collapsed && <span>Candidates</span>}
            </NavLink>
          </Tooltip>
          {isSuperAdmin && (
            <Tooltip content="Administrators" placement="right" disabled={!collapsed}>
              <NavLink
                to={ROUTES.ADMIN.USERS}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
              >
                <IconUserSetting size={20} />
                {!collapsed && <span>Administrators</span>}
              </NavLink>
            </Tooltip>
          )}
        </div>
      </nav>
    </aside>
  );
}

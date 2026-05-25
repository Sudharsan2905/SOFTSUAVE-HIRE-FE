import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';
import {
  IconQuestionBank,
  IconAssessment,
  IconLiveInterview,
  IconLogout,
  IconSettings,
  IconUsers,
} from '@/assets/icons';
import { getInitials, getAvatarColor } from '@/utils/helpers';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const adminNav: NavItem[] = [
  { to: '/question-bank', label: 'Question Bank', icon: <IconQuestionBank size={18} /> },
  { to: '/live-interviews', label: 'Live Interviews', icon: <IconLiveInterview size={18} /> },
];

export function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { activeWorkspace } = useAppSelector((s) => s.workspace);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/admin/login');
  };

  const initials = user ? getInitials(user.name) : 'U';
  const avatarColor = user ? getAvatarColor(user.name) : '#2563eb';

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#2563EB" />
            <path d="M10 18h16M18 10l8 8-8 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className={styles.logoText}>SoftSuave Hire</span>
      </div>

      {/* Workspace Switcher */}
      <div className={styles.workspaceSection}>
        <WorkspaceSwitcher />
      </div>

      {/* Workspace-specific nav */}
      {activeWorkspace && (
        <div className={styles.navSection}>
          <p className={styles.navSectionLabel}>Workspace</p>
          <NavLink
            to={`/workspaces/${activeWorkspace.id}/assessments`}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <IconAssessment size={18} />
            <span>Assessments</span>
          </NavLink>
        </div>
      )}

      {/* Global nav */}
      <div className={styles.navSection}>
        <p className={styles.navSectionLabel}>Global</p>
        {adminNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        {user?.role === 'super_admin' && (
          <NavLink
            to="/users"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <IconUsers size={18} />
            <span>Users</span>
          </NavLink>
        )}
      </div>

      {/* Bottom user area */}
      <div className={styles.userArea}>
        <div className={styles.userInfo}>
          <div className={styles.avatar} style={{ background: avatarColor }}>
            {initials}
          </div>
          <div className={styles.userMeta}>
            <p className={styles.userName}>{user?.name}</p>
            <p className={styles.userRole}>{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
          <IconLogout size={16} />
        </button>
      </div>
    </aside>
  );
}

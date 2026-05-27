import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logoUrl from "@/assets/favicon.svg";
import styles from "./Sidebar.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout, updateUser } from "@/store/slices/authSlice";
import { WorkspaceSwitcher } from "../WorkspaceSwitcher";
import {
  IconQuestionBank, IconAssessment, IconLiveInterview,
  IconLogout, IconUsers, IconChevronLeft, IconChevronRight,
} from "@/assets/icons";
import { getInitials, getAvatarColor } from "@/utils/helpers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/utils/api";
import toast from "react-hot-toast";

const COLLAPSED_KEY = 'ssh_sidebar_collapsed';
const WIDTH_KEY = 'ssh_sidebar_width';
const COLLAPSED_WIDTH = 64;
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

interface NavItem { to: string; label: string; icon: React.ReactNode; }

const adminNav: NavItem[] = [
  { to: "/question-bank", label: "Question Bank", icon: <IconQuestionBank size={18} /> },
  { to: "/live-interviews", label: "Live Interviews", icon: <IconLiveInterview size={18} /> },
];

export function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { activeWorkspace } = useAppSelector((s) => s.workspace);
  const isSuperAdmin = user?.role === 'super_admin';

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem(COLLAPSED_KEY) === 'true'
  );
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY) || '', 10);
    return isNaN(saved) ? DEFAULT_WIDTH : saved;
  });
  const [hovered, setHovered] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', password: '', workspace_id: '' });
  const [saving, setSaving] = useState(false);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const liveWidth = useRef(width);

  // Hover temporarily expands the sidebar and shifts content (no overlay gap)
  const effectiveWidth = collapsed && !hovered ? COLLAPSED_WIDTH : width;
  const isVisuallyCollapsed = collapsed && !hovered;

  // Sync CSS variable before paint to avoid layout flash
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${effectiveWidth}px`);
  }, [effectiveWidth]);

  useEffect(() => {
    if (!collapsed) localStorage.setItem(WIDTH_KEY, String(width));
  }, [width, collapsed]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + e.clientX - startX.current));
      liveWidth.current = next;
      setWidth(next);
      // Drive CSS variable directly during drag for zero-lag resizing
      document.documentElement.style.setProperty('--sidebar-width', `${next}px`);
    };
    const onUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const openProfile = () => {
    setProfileForm({
      name: user?.name || '',
      password: '',
      workspace_id: user?.workspaces?.find((w) => w.is_default)?.id || user?.workspaces?.[0]?.id || '',
    });
    setShowProfile(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (profileForm.name && profileForm.name !== user?.name) payload.name = profileForm.name;
      if (profileForm.password) payload.password = profileForm.password;
      if (!isSuperAdmin && profileForm.workspace_id) payload.workspace_id = profileForm.workspace_id;
      if (Object.keys(payload).length > 0) {
        const { data } = await api.patch('/api/users/me', payload);
        dispatch(updateUser(data.data));
        toast.success('Profile updated');
      }
      setShowProfile(false);
    } catch {
      toast.error('Failed to update profile');
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/admin/login');
  };

  const initials = user ? getInitials(user.name) : 'U';
  const avatarColor = user ? getAvatarColor(user.name) : '#2563eb';

  return (
    <>
      <aside
        className={`${styles.sidebar} ${isVisuallyCollapsed ? styles.collapsed : ''}`}
        style={{ width: effectiveWidth }}
        onMouseEnter={() => { if (collapsed) setHovered(true); }}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <img src={logoUrl} width="26" height="26" alt="SoftSuave Hire" />
          </div>
          {!isVisuallyCollapsed && <span className={styles.logoText}>SoftSuave Hire</span>}
          <button className={styles.collapseBtn} onClick={toggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
          </button>
        </div>

        {/* Workspace Switcher */}
        {!isVisuallyCollapsed && (
          <div className={styles.workspaceSection}>
            <WorkspaceSwitcher />
          </div>
        )}

        {/* Nav */}
        <div className={styles.navContainer}>
          {activeWorkspace && (
            <div className={styles.navSection}>
              {!isVisuallyCollapsed && <p className={styles.navSectionLabel}>Workspace</p>}
              <NavLink
                to={`/workspaces/${activeWorkspace.id}/assessments`}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                title="Assessments"
              >
                <IconAssessment size={18} />
                {!isVisuallyCollapsed && <span>Assessments</span>}
              </NavLink>
            </div>
          )}
          <div className={styles.navSection}>
            {!isVisuallyCollapsed && <p className={styles.navSectionLabel}>Global</p>}
            {adminNav.map((item) => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                title={item.label}
              >
                {item.icon}
                {!isVisuallyCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
            {isSuperAdmin && (
              <NavLink to="/users"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                title="Users"
              >
                <IconUsers size={18} />
                {!isVisuallyCollapsed && <span>Users</span>}
              </NavLink>
            )}
          </div>
        </div>

        {/* Profile trigger */}
        <button className={styles.profileTrigger} onClick={openProfile} title={isVisuallyCollapsed ? user?.name : undefined}>
          <div className={styles.avatar} style={{ background: avatarColor }}>{initials}</div>
          {!isVisuallyCollapsed && (
            <div className={styles.userMeta}>
              <p className={styles.userName}>{user?.name}</p>
              <p className={styles.userRole}>{user?.role?.replace('_', ' ')}</p>
            </div>
          )}
        </button>

        {/* Resize handle */}
        {!collapsed && !hovered && <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />}
      </aside>

      {/* Profile Modal */}
      <Modal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        title="My Profile"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <Button variant="danger" leftIcon={<IconLogout size={15} />} onClick={handleLogout}>
              Logout
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowProfile(false)}>Cancel</Button>
              <Button onClick={saveProfile} isLoading={saving}>Save Changes</Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Name"
            value={profileForm.name}
            onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="New Password"
            type="password"
            placeholder="Leave blank to keep current password"
            value={profileForm.password}
            onChange={(e) => setProfileForm((p) => ({ ...p, password: e.target.value }))}
          />
          {!isSuperAdmin && user?.workspaces && user.workspaces.length > 0 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Default Workspace
              </label>
              <select
                value={profileForm.workspace_id}
                onChange={(e) => setProfileForm((p) => ({ ...p, workspace_id: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                }}
              >
                {user.workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

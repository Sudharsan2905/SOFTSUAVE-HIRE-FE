import React, { useState, useEffect, useLayoutEffect } from "react";
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
import { getInitials, getAvatarColor, getFullName } from "@/utils/helpers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/utils/api";
import toast from "react-hot-toast";

const COLLAPSED_KEY = 'ssh_sidebar_collapsed';
const COLLAPSED_WIDTH = 65;
const DEFAULT_WIDTH = 225;

interface NavItem { to: string; label: string; icon: React.ReactNode; }

const adminNav: NavItem[] = [
  { to: "/question-bank", label: "Question Bank", icon: <IconQuestionBank size={18} /> },
  { to: "/live-interviews", label: "Live Interviews", icon: <IconLiveInterview size={18} /> },
];

export function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { activeWorkspace, workspaces: allWorkspaces } = useAppSelector((s) => s.workspace);
  const isSuperAdmin = user?.role === 'super_admin';

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem(COLLAPSED_KEY) === 'true'
  );
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', password: '', default_workspace_id: '' });
  const [saving, setSaving] = useState(false);

  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : DEFAULT_WIDTH;

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${effectiveWidth}px`);
  }, [effectiveWidth]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const openProfile = () => {
    const wsOptions = isSuperAdmin ? allWorkspaces : (user?.workspaces || []);
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      password: '',
      default_workspace_id: user?.default_workspace_id || wsOptions[0]?.id || '',
    });
    setShowProfile(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (profileForm.first_name && profileForm.first_name !== user?.first_name) payload.first_name = profileForm.first_name;
      if (profileForm.last_name !== (user?.last_name || '')) payload.last_name = profileForm.last_name;
      if (profileForm.password) payload.password = profileForm.password;
      if (profileForm.default_workspace_id) payload.default_workspace_id = profileForm.default_workspace_id;
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

  const fullName = user ? getFullName(user) : '';
  const initials = fullName ? getInitials(fullName) : 'U';
  const avatarColor = fullName ? getAvatarColor(fullName) : '#2563eb';

  return (
    <>
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
        style={{ width: effectiveWidth }}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <img src={logoUrl} width="26" height="26" alt="SoftSuave Hire" />
          </div>
          {!collapsed && <span className={styles.logoText}>SoftSuave Hire</span>}
          <button className={styles.collapseBtn} onClick={toggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className={styles.workspaceSection}>
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        {/* Nav */}
        <div className={styles.navContainer}>
          {activeWorkspace && (
            <div className={styles.navSection}>
              {!collapsed && <p className={styles.navSectionLabel}>Workspace</p>}
              <NavLink
                to={`/workspaces/${activeWorkspace.id}/assessments`}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                title="Assessments"
              >
                <IconAssessment size={18} />
                {!collapsed && <span>Assessments</span>}
              </NavLink>
            </div>
          )}
          <div className={styles.navSection}>
            {!collapsed && <p className={styles.navSectionLabel}>Global</p>}
            {adminNav.map((item) => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                title={item.label}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
            {isSuperAdmin && (
              <NavLink to="/users"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                title="Users"
              >
                <IconUsers size={18} />
                {!collapsed && <span>Users</span>}
              </NavLink>
            )}
          </div>
        </div>

        {/* Profile trigger */}
        <button className={styles.profileTrigger} onClick={openProfile} title={collapsed ? fullName : undefined}>
          <div className={styles.avatar} style={{ background: avatarColor }}>{initials}</div>
          {!collapsed && (
            <div className={styles.userMeta}>
              <p className={styles.userName}>{fullName}</p>
              <p className={styles.userRole}>{user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
            </div>
          )}
        </button>

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
          <div style={{ display: 'flex', gap: 12 }}>
            <Input
              label="First Name"
              value={profileForm.first_name}
              onChange={(e) => setProfileForm((p) => ({ ...p, first_name: e.target.value }))}
            />
            <Input
              label="Last Name"
              placeholder="Optional"
              value={profileForm.last_name}
              onChange={(e) => setProfileForm((p) => ({ ...p, last_name: e.target.value }))}
            />
          </div>
          <Input
            label="New Password"
            type="password"
            placeholder="Leave blank to keep current password"
            value={profileForm.password}
            onChange={(e) => setProfileForm((p) => ({ ...p, password: e.target.value }))}
          />
          {((isSuperAdmin ? allWorkspaces : user?.workspaces) || []).length > 0 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Default Workspace
              </label>
              <select
                value={profileForm.default_workspace_id}
                onChange={(e) => setProfileForm((p) => ({ ...p, default_workspace_id: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                }}
              >
                {(isSuperAdmin ? allWorkspaces : (user?.workspaces || [])).map((ws) => (
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

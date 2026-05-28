import React, { useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import logoUrl from "@/assets/favicon.svg";
import styles from "./Sidebar.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout, updateUser } from "@/store/slices/authSlice";
import { WorkspaceSwitcher } from "../WorkspaceSwitcher";
import {
  IconQuestionBank, IconAssessment, IconLiveInterview,
  IconLogout, IconUsers, IconChevronLeft, IconChevronRight,
  IconEdit,
} from "@/assets/icons";
import { getInitials, getAvatarColor, getFullName } from "@/utils/helpers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
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
  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', default_workspace_id: '' });
  const [saving, setSaving] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  const wsOptions = isSuperAdmin ? allWorkspaces : (user?.workspaces || []);

  const openProfile = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      default_workspace_id: user?.default_workspace_id || wsOptions[0]?.id || '',
    });
    setIsEditing(false);
    setShowProfile(true);
  };

  const closeProfile = () => {
    setShowProfile(false);
    setIsEditing(false);
  };

  const toggleEdit = () => {
    if (isEditing) {
      setProfileForm({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        default_workspace_id: user?.default_workspace_id || wsOptions[0]?.id || '',
      });
    }
    setIsEditing((prev) => !prev);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (profileForm.first_name && profileForm.first_name !== user?.first_name) payload.first_name = profileForm.first_name;
      if (profileForm.last_name !== (user?.last_name || '')) payload.last_name = profileForm.last_name;
      if (profileForm.default_workspace_id) payload.default_workspace_id = profileForm.default_workspace_id;
      if (Object.keys(payload).length > 0) {
        const { data } = await api.patch('/api/users/me', payload);
        dispatch(updateUser(data.data));
        toast.success('Profile updated');
      }
      setIsEditing(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setPwSaving(true);
    try {
      await api.patch('/api/users/me', {
        old_password: passwordForm.old_password,
        password: passwordForm.new_password,
      });
      toast.success('Password changed');
      setShowPasswordModal(false);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch {
      toast.error('Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/admin/login');
  };

  const fullName = user ? getFullName(user) : '';
  const initials = fullName ? getInitials(fullName) : 'U';
  const avatarColor = fullName ? getAvatarColor(fullName) : '#2563eb';
  const roleLabel = user?.role === 'super_admin' ? 'Super Admin' : 'Admin';
  const defaultWsName = wsOptions.find((ws) => ws.id === user?.default_workspace_id)?.name || '—';

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
              <p className={styles.userRole}>{roleLabel}</p>
            </div>
          )}
        </button>
      </aside>

      {/* Profile Popup */}
      {showProfile && createPortal(
        <div className={styles.ppOverlay} onClick={closeProfile}>
          <div className={styles.ppCard} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className={styles.ppHeader}>
              <div className={styles.ppHeaderLeft}>
                <div className={styles.ppAvatar} style={{ background: avatarColor }}>{initials}</div>
                <p className={styles.ppTitle}>My Profile</p>
              </div>
              <div className={styles.ppHeaderActions}>
                <button
                  className={`${styles.ppIconBtn} ${isEditing ? styles.ppIconBtnActive : ''}`}
                  onClick={toggleEdit}
                  title={isEditing ? 'Cancel editing' : 'Edit profile'}
                >
                  <IconEdit size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className={styles.ppBody}>
              <div className={styles.ppFieldRow}>
                <span className={styles.ppFieldLabel}>First Name</span>
                {isEditing ? (
                  <input
                    className={styles.ppFieldInput}
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, first_name: e.target.value }))}
                    placeholder="First name"
                    autoComplete="off"
                  />
                ) : (
                  <span className={styles.ppFieldValue}>{user?.first_name || '—'}</span>
                )}
              </div>

              <div className={styles.ppFieldRow}>
                <span className={styles.ppFieldLabel}>Last Name</span>
                {isEditing ? (
                  <input
                    className={styles.ppFieldInput}
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, last_name: e.target.value }))}
                    placeholder="Last name (optional)"
                    autoComplete="off"
                  />
                ) : (
                  <span className={styles.ppFieldValue}>{user?.last_name || '—'}</span>
                )}
              </div>

              <div className={styles.ppFieldRow}>
                <span className={styles.ppFieldLabel}>Email</span>
                <span className={`${styles.ppFieldValue} ${styles.ppFieldMuted}`}>{user?.email}</span>
              </div>

              <div className={styles.ppFieldRow}>
                <span className={styles.ppFieldLabel}>Role</span>
                <span className={styles.ppRoleTag}>{roleLabel}</span>
              </div>

              {wsOptions.length > 0 && (
                <div className={styles.ppFieldRow}>
                  <span className={styles.ppFieldLabel}>Default Workspace</span>
                  {isEditing ? (
                    <div style={{ flex: 1, maxWidth: 220, minWidth: 0 }}>
                      <Select
                        value={profileForm.default_workspace_id}
                        onChange={(v) => setProfileForm((p) => ({ ...p, default_workspace_id: v }))}
                        options={wsOptions.map((ws) => ({ value: ws.id, label: ws.name }))}
                      />
                    </div>
                  ) : (
                    <span className={styles.ppFieldValue}>{defaultWsName}</span>
                  )}
                </div>
              )}

              <div className={styles.ppFieldRow}>
                <span className={styles.ppFieldLabel}>Password</span>
                {isEditing ? (
                  <button className={styles.ppChangeBtn} onClick={() => setShowPasswordModal(true)}>
                    Change
                  </button>
                ) : (
                  <span className={`${styles.ppFieldValue} ${styles.ppFieldMuted}`}>••••••••</span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={styles.ppFooter}>
              <button className={styles.ppLogoutBtn} onClick={() => setShowLogoutConfirm(true)} title="Log out">
                <span className={styles.ppLogoutIcon}><IconLogout size={16} /></span>
                <span className={styles.ppLogoutLabel}>Log out</span>
              </button>
              <div className={styles.ppFooterRight}>
                {isEditing ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={toggleEdit}>Cancel</Button>
                    <Button size="sm" onClick={saveProfile} isLoading={saving}>Save</Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={closeProfile}>Close</Button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Log out"
        size="sm"
        showClose={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleLogout}>Log out</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Are you sure you want to log out?
        </p>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={closePasswordModal}
        title="Change Password"
        size="sm"
        showClose={false}
        footer={
          <>
            <Button variant="secondary" onClick={closePasswordModal}>Cancel</Button>
            <Button onClick={handlePasswordChange} isLoading={pwSaving}>Save</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Current Password"
            type="password"
            placeholder="Enter current password"
            value={passwordForm.old_password}
            onChange={(e) => setPasswordForm((p) => ({ ...p, old_password: e.target.value }))}
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            type="password"
            placeholder="Enter new password"
            value={passwordForm.new_password}
            onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
            autoComplete="new-password"
          />
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Confirm new password"
            value={passwordForm.confirm_password}
            onChange={(e) => setPasswordForm((p) => ({ ...p, confirm_password: e.target.value }))}
            autoComplete="new-password"
          />
        </div>
      </Modal>
    </>
  );
}

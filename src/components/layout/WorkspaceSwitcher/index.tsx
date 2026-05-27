import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './WorkspaceSwitcher.module.css';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveWorkspace, setWorkspaces, clearWorkspace } from '@/store/slices/workspaceSlice';
import { api } from '@/utils/api';
import { Workspace, User } from '@/types';
import { IconChevronDown, IconSettings, IconUserPlus, IconPlus, IconCheck, IconStar, IconEdit } from '@/assets/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { getInitials, getAvatarColor, getFullName } from '@/utils/helpers';
import { updateUser } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';

export function WorkspaceSwitcher() {
  const dispatch = useAppDispatch();
  const { activeWorkspace, workspaces } = useAppSelector((s) => s.workspace);
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const { data } = await api.get('/api/workspaces?page_size=50');
      const rawList: Workspace[] = data.data?.workspaces || [];
      const list = rawList;
      dispatch(setWorkspaces(list));
      if (activeWorkspace) {
        const stillInList = list.find((ws) => ws.id === activeWorkspace.id);
        if (!stillInList) {
          if (list.length > 0) {
            dispatch(setActiveWorkspace(list[0]));
          } else {
            dispatch(clearWorkspace());
          }
        }
      } else if (list.length > 0) {
        // Activate the workspace marked as default in the user's profile
        const defaultRef = user?.workspaces?.find((w) => w.is_default);
        const defaultWs = defaultRef ? list.find((ws) => ws.id === defaultRef.id) : null;
        dispatch(setActiveWorkspace(defaultWs || list[0]));
      }
    } catch {}
  }, [dispatch, activeWorkspace, user]);

  const setAsDefault = async () => {
    if (!activeWorkspace) return;
    try {
      const { data } = await api.patch('/api/users/me', { workspace_id: activeWorkspace.id });
      dispatch(updateUser(data.data));
      toast.success(`"${activeWorkspace.name}" set as default workspace`);
    } catch {
      toast.error('Failed to set default workspace');
    }
  };

  useEffect(() => { fetchWorkspaces(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openSettings = () => {
    if (activeWorkspace) setEditForm({ name: activeWorkspace.name, description: activeWorkspace.description });
    setIsEditing(false);
    setIsOpen(false);
    setShowSettings(true);
  };

  const openInvite = async () => {
    setIsOpen(false);
    setSelectedUsers([]);
    try {
      const { data } = await api.get('/api/workspaces/admin-users');
      setAdminUsers(data.data || []);
    } catch {}
    setShowInvite(true);
  };

  const saveSettings = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const { data } = await api.put(`/api/workspaces/${activeWorkspace.id}`, editForm);
      dispatch(setActiveWorkspace(data.data));
      await fetchWorkspaces();
      toast.success('Workspace updated');
      setShowSettings(false);
    } catch {
      toast.error('Failed to update workspace');
    } finally { setLoading(false); }
  };

  const saveInvite = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      await api.post(`/api/workspaces/${activeWorkspace.id}/invite`, { user_ids: selectedUsers });
      toast.success('Members updated');
      setShowInvite(false);
    } catch {
      toast.error('Failed to update members');
    } finally { setLoading(false); }
  };

  const createWorkspace = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/workspaces', createForm);
      dispatch(setActiveWorkspace(data.data));
      await fetchWorkspaces();
      toast.success('Workspace created');
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
    } catch {
      toast.error('Failed to create workspace');
    } finally { setLoading(false); }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isActiveDefault = !isSuperAdmin && !!user?.workspaces?.find((w) => w.id === activeWorkspace?.id)?.is_default;

  return (
    <>
      <div ref={ref} className={styles.container}>
        <button className={styles.trigger} onClick={() => setIsOpen(!isOpen)}>
          <div className={styles.triggerLeft}>
            <div
              className={styles.wsIcon}
              style={{ background: activeWorkspace ? getAvatarColor(activeWorkspace.name) : '#334155' }}
            >
              {activeWorkspace ? getInitials(activeWorkspace.name) : '?'}
            </div>
            <div className={styles.wsNameRow}>
              <span className={styles.wsName}>
                {activeWorkspace?.name || 'Select Workspace'}
              </span>
              {isActiveDefault && (
                <IconStar size={10} className={styles.triggerStar} />
              )}
            </div>
          </div>
          <IconChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
        </button>

        {isOpen && (
          <div className={styles.popup}>
            {/* Workspace list */}
            <div className={styles.wsList}>
              {workspaces.length === 0 ? (
                <p className={styles.noWs}>No workspaces yet</p>
              ) : (
                workspaces.map((ws) => {
                  const isDefault = !isSuperAdmin && user?.workspaces?.find((w) => w.id === ws.id)?.is_default;
                  return (
                    <button
                      key={ws.id}
                      className={`${styles.wsItem} ${activeWorkspace?.id === ws.id ? styles.wsItemActive : ''}`}
                      onClick={() => { dispatch(setActiveWorkspace(ws)); setIsOpen(false); }}
                    >
                      <div className={styles.wsItemIcon} style={{ background: getAvatarColor(ws.name) }}>
                        {getInitials(ws.name)}
                      </div>
                      <span className={styles.wsItemName}>{ws.name}</span>
                      {isDefault && <IconStar size={12} className={styles.defaultStar} />}
                      {activeWorkspace?.id === ws.id && <IconCheck size={14} className={styles.wsCheckIcon} />}
                    </button>
                  );
                })
              )}
            </div>

            {/* New Workspace — super admin only */}
            {isSuperAdmin && (
              <button
                className={styles.createBtn}
                onClick={() => { setIsOpen(false); setShowCreate(true); }}
              >
                <IconPlus size={14} />
                New Workspace
              </button>
            )}

            {/* Settings — visible to all users */}
            {activeWorkspace && (
              <button className={styles.settingsBtn} onClick={openSettings}>
                <IconSettings size={14} />
                Settings
              </button>
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => { setShowSettings(false); setIsEditing(false); }}
        title="Workspace Settings"
        footer={
          isEditing ? (
            <>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={saveSettings} isLoading={loading}>Save Changes</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setShowSettings(false)}>Close</Button>
          )
        }
      >
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Workspace Name"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
            />
            <Textarea
              label="Description"
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
            />
          </div>
        ) : (
          <div className={styles.wsSettingsView}>
            <div className={styles.wsSettingsHead}>
              <div className={styles.wsSettingsField}>
                <p className={styles.wsSettingsSectionLabel}>Workspace Name</p>
                <p className={styles.wsSettingsName}>{activeWorkspace?.name}</p>
              </div>
              <div className={styles.wsSettingsField}>
                <p className={styles.wsSettingsSectionLabel}>Description</p>
                <p className={styles.wsSettingsDesc}>
                  {activeWorkspace?.description || 'No description'}
                </p>
              </div>
            </div>

            <div>
              <p className={styles.wsSettingsSectionLabel}>Members</p>
              <p className={styles.wsSettingsMeta}>
                {activeWorkspace?.members?.length ?? 0} member{(activeWorkspace?.members?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>

            {isSuperAdmin ? (
              <div className={styles.wsSettingsActions}>
                <button className={styles.wsSettingsBtn} onClick={() => setIsEditing(true)}>
                  <IconEdit size={14} />
                  Edit Workspace
                </button>
                <button className={styles.wsSettingsBtn} onClick={() => { setShowSettings(false); openInvite(); }}>
                  <IconUserPlus size={14} />
                  Invite Members
                </button>
              </div>
            ) : (
              <div className={styles.wsSettingsActions}>
                {isActiveDefault ? (
                  <div className={styles.wsDefaultBadge}>
                    <IconStar size={13} className={styles.wsDefaultBadgeStar} />
                    Default Workspace
                  </div>
                ) : (
                  <button className={styles.wsSettingsBtn} onClick={setAsDefault}>
                    <IconStar size={14} />
                    Set as Default
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Invite Modal */}
      <Modal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite Members"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={saveInvite} isLoading={loading}>Save</Button>
          </>
        }
      >
        <div className={styles.inviteList}>
          {adminUsers.map((u) => {
            const isMember = !!activeWorkspace?.members?.some((m) => m.user_id === u.id);
            const selected = !isMember && selectedUsers.includes(u.id);
            return (
              <div
                key={u.id}
                className={`${styles.inviteItem} ${isMember ? styles.inviteItemMember : ''} ${selected ? styles.inviteItemSelected : ''}`}
                onClick={() => !isMember && toggleUser(u.id)}
              >
                <div
                  className={styles.inviteAvatar}
                  style={{ background: getAvatarColor(getFullName(u)) }}
                >
                  {getInitials(getFullName(u))}
                </div>
                <div className={styles.inviteInfo}>
                  <p className={styles.inviteName}>{getFullName(u)}</p>
                  <p className={styles.inviteEmail}>{u.email}</p>
                </div>
                {isMember ? (
                  <span className={styles.memberBadge}>Member</span>
                ) : (
                  <div className={`${styles.inviteCheck} ${selected ? styles.inviteCheckSelected : ''}`}>
                    {selected && <IconCheck size={12} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Workspace"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createWorkspace} isLoading={loading} disabled={!createForm.name}>
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Workspace Name"
            placeholder="e.g., Engineering Hiring"
            value={createForm.name}
            onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Textarea
            label="Description (optional)"
            placeholder="What is this workspace for?"
            value={createForm.description}
            onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
          />
        </div>
      </Modal>
    </>
  );
}

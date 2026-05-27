import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './WorkspaceSwitcher.module.css';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveWorkspace, setWorkspaces, clearWorkspace } from '@/store/slices/workspaceSlice';
import { api } from '@/utils/api';
import { Workspace, User } from '@/types';
import { IconChevronDown, IconSettings, IconUserPlus, IconPlus, IconCheck, IconStar } from '@/assets/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { getInitials, getAvatarColor } from '@/utils/helpers';
import { updateUser } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';

export function WorkspaceSwitcher() {
  const dispatch = useAppDispatch();
  const { activeWorkspace, workspaces } = useAppSelector((s) => s.workspace);
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
    setIsOpen(false);
    setShowSettings(true);
  };

  const openInvite = async () => {
    setIsOpen(false);
    try {
      const { data } = await api.get('/api/workspaces/admin-users');
      setAdminUsers(data.data || []);
      if (activeWorkspace) {
        const memberIds = activeWorkspace.members.map((m) => m.user_id);
        setSelectedUsers(memberIds);
      }
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
            <div className={styles.wsInfo}>
              <span className={styles.wsName}>
                {activeWorkspace?.name || 'Select Workspace'}
              </span>
              <span className={styles.wsLabel}>Workspace</span>
            </div>
          </div>
          <IconChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
        </button>

        {isOpen && (
          <div className={styles.popup}>
            {/* Actions row */}
            <div className={styles.popupActions}>
              {activeWorkspace && (activeWorkspace.name !== 'Common' || isSuperAdmin) && (
                <button className={styles.actionBtn} onClick={openSettings}>
                  <IconSettings size={14} />
                  Settings
                </button>
              )}
              {isSuperAdmin && activeWorkspace && (
                <button className={styles.actionBtn} onClick={openInvite}>
                  <IconUserPlus size={14} />
                  Invite
                </button>
              )}
              {!isSuperAdmin && activeWorkspace && !user?.workspaces?.find((w) => w.id === activeWorkspace.id)?.is_default && (
                <button className={styles.actionBtn} onClick={setAsDefault}>
                  <IconStar size={14} />
                  Set default
                </button>
              )}
            </div>

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

            {/* Create button */}
            {isSuperAdmin && (
              <button
                className={styles.createBtn}
                onClick={() => { setIsOpen(false); setShowCreate(true); }}
              >
                <IconPlus size={14} />
                New Workspace
              </button>
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Workspace Settings"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={saveSettings} isLoading={loading}>Save Changes</Button>
          </>
        }
      >
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
            const selected = selectedUsers.includes(u.id);
            const isCurrentUser = u.id === user?.id;
            return (
              <div
                key={u.id}
                className={`${styles.inviteItem} ${selected ? styles.inviteItemSelected : ''}`}
                onClick={() => !isCurrentUser && toggleUser(u.id)}
              >
                <div
                  className={styles.inviteAvatar}
                  style={{ background: getAvatarColor(u.name) }}
                >
                  {getInitials(u.name)}
                </div>
                <div className={styles.inviteInfo}>
                  <p className={styles.inviteName}>{u.name} {isCurrentUser && '(you)'}</p>
                  <p className={styles.inviteEmail}>{u.email}</p>
                </div>
                <div className={`${styles.inviteCheck} ${selected ? styles.inviteCheckSelected : ''}`}>
                  {selected && <IconCheck size={12} />}
                </div>
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

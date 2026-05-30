import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./WorkspaceSwitcher.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { setActiveWorkspace, setWorkspaces, clearWorkspace } from "@/store/slices/workspaceSlice";
import { api } from "@/utils/api";
import { Workspace, User } from "@/types";
import {
  IconChevronDown,
  IconSettings,
  IconUserPlus,
  IconPlus,
  IconCheck,
  IconStar,
  IconEdit,
  IconDelete,
} from "@/assets/icons";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Tooltip } from "@/components/ui/Tooltip";
import { getInitials, getAvatarColor, getFullName } from "@/utils/helpers";
import { updateUser } from "@/store/slices/authSlice";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";

export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeWorkspace, workspaces } = useAppSelector((s) => s.workspace);
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memberDetails, setMemberDetails] = useState<User[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
  }>({ left: 0 });

  const fetchWorkspaces = useCallback(async () => {
    try {
      const [wsRes, meRes] = await Promise.all([
        api.get("/api/workspaces?page_size=50"),
        api.get("/api/auth/me"),
      ]);
      const freshUser: User = meRes.data.data;
      dispatch(updateUser(freshUser));
      const rawList: Workspace[] = wsRes.data.data?.workspaces || [];
      dispatch(setWorkspaces(rawList));
      if (activeWorkspace) {
        const stillInList = rawList.find((ws) => ws.id === activeWorkspace.id);
        if (stillInList) {
          dispatch(setActiveWorkspace(stillInList));
        } else if (rawList.length > 0) {
          dispatch(setActiveWorkspace(rawList[0]));
        } else {
          dispatch(clearWorkspace());
        }
      } else if (rawList.length > 0) {
        const defaultId = freshUser.default_workspace_id;
        const defaultWs = defaultId ? rawList.find((ws) => ws.id === defaultId) : null;
        dispatch(setActiveWorkspace(defaultWs || rawList[0]));
      }
    } catch {}
  }, [dispatch, activeWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = ref.current?.contains(target);
      const inPopup = popupRef.current?.contains(target);
      if (!inContainer && !inPopup) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const openSettings = async () => {
    if (activeWorkspace)
      setEditForm({ name: activeWorkspace.name, description: activeWorkspace.description });
    setIsEditing(false);
    setIsOpen(false);
    setShowSettings(true);
    if (isSuperAdmin && activeWorkspace) {
      try {
        const { data } = await api.get(`/api/workspaces/${activeWorkspace.id}/members`);
        setMemberDetails(data.data || []);
      } catch {}
    }
  };

  const openInvite = async () => {
    setIsOpen(false);
    setSelectedUsers([]);
    setShowInvite(true);
    try {
      const [, usersRes] = await Promise.all([
        fetchWorkspaces(),
        api.get("/api/workspaces/admin-users"),
      ]);
      setAdminUsers(usersRes.data.data || []);
    } catch {}
  };

  const saveSettings = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const { data } = await api.put(`/api/workspaces/${activeWorkspace.id}`, editForm);
      dispatch(setActiveWorkspace(data.data));
      await fetchWorkspaces();
      toast.success("Workspace updated");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update workspace");
    } finally {
      setLoading(false);
    }
  };

  const saveInvite = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      await api.post(`/api/workspaces/${activeWorkspace.id}/invite`, { user_ids: selectedUsers });
      toast.success("Members updated");
      setShowInvite(false);
      setShowSettings(true);
    } catch {
      toast.error("Failed to update members");
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/workspaces", createForm);
      dispatch(setActiveWorkspace(data.data));
      await fetchWorkspaces();
      toast.success("Workspace created");
      setShowCreate(false);
      setCreateForm({ name: "", description: "" });
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkspace = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      await api.delete(`/api/workspaces/${activeWorkspace.id}`);
      toast.success(`"${activeWorkspace.name}" deleted`);
      setShowDeleteConfirm(false);
      setShowSettings(false);
      await fetchWorkspaces();
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const switchWorkspace = (ws: Workspace) => {
    dispatch(setActiveWorkspace(ws));
    setIsOpen(false);
    if (location.pathname.startsWith("/workspaces")) {
      navigate(`/workspaces/${ws.id}/assessments`);
    }
  };

  const isActiveDefault = activeWorkspace?.id === user?.default_workspace_id;

  // Admin with no workspace access
  if (!isSuperAdmin && workspaces.length === 0) {
    if (collapsed) {
      return (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className={styles.wsIcon} style={{ background: "#334155", opacity: 0.5 }}>
            ?
          </div>
        </div>
      );
    }
    return (
      <div className={styles.noWsPrompt}>
        <p className={styles.noWsText}>No workspace access</p>
        <p className={styles.noWsText} style={{ opacity: 0.7 }}>
          Contact your administrator
        </p>
      </div>
    );
  }

  // Super admin with no workspaces yet — show inline create prompt
  if (isSuperAdmin && workspaces.length === 0) {
    if (collapsed) {
      return (
        <>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Tooltip content="Create Workspace" placement="right">
              <button
                className={styles.collapsedTrigger}
                onClick={() => setShowCreate(true)}
                aria-label="Create Workspace"
              >
                <div className={styles.wsIcon} style={{ background: "#334155" }}>
                  <IconPlus size={13} color="#fff" />
                </div>
              </button>
            </Tooltip>
          </div>
          <Modal
            isOpen={showCreate}
            onClose={() => setShowCreate(false)}
            title="Create Workspace"
            showClose={false}
            footer={
              <>
                <Button variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button onClick={createWorkspace} isLoading={loading} disabled={!createForm.name}>
                  Create
                </Button>
              </>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
    return (
      <>
        <div className={styles.noWsPrompt}>
          <p className={styles.noWsText}>No workspaces yet</p>
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            <IconPlus size={14} />
            Create Workspace
          </button>
        </div>

        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Create Workspace"
          showClose={false}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={createWorkspace} isLoading={loading} disabled={!createForm.name}>
                Create
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

  const wsColor = activeWorkspace ? getAvatarColor(activeWorkspace.name) : "#334155";
  const wsInitials = activeWorkspace ? getInitials(activeWorkspace.name) : "?";

  const popupContent = (
    <>
      <div className={styles.wsList}>
        {workspaces.map((ws) => {
          const isDefault = ws.id === user?.default_workspace_id;
          return (
            <button
              key={ws.id}
              className={`${styles.wsItem} ${activeWorkspace?.id === ws.id ? styles.wsItemActive : ""}`}
              onClick={() => {
                switchWorkspace(ws);
              }}
            >
              <div className={styles.wsItemIcon} style={{ background: getAvatarColor(ws.name) }}>
                {getInitials(ws.name)}
              </div>
              <span className={styles.wsItemName}>{ws.name}</span>
              {isDefault && <IconStar size={12} className={styles.defaultStar} />}
              {activeWorkspace?.id === ws.id && (
                <IconCheck size={14} className={styles.wsCheckIcon} />
              )}
            </button>
          );
        })}
      </div>
      {isSuperAdmin && (
        <button
          className={styles.createBtn}
          onClick={() => {
            setIsOpen(false);
            setShowCreate(true);
          }}
        >
          <IconPlus size={14} />
          New Workspace
        </button>
      )}
      {activeWorkspace && (
        <button className={styles.settingsBtn} onClick={openSettings}>
          <IconSettings size={14} />
          Settings
        </button>
      )}
    </>
  );

  return (
    <>
      <div ref={ref} className={styles.container}>
        {collapsed ? (
          <Tooltip content={activeWorkspace?.name || "Select Workspace"} placement="right">
            <button
              ref={triggerRef}
              className={styles.collapsedTrigger}
              aria-label={activeWorkspace?.name || "Select Workspace"}
              onClick={() => {
                if (!isOpen && triggerRef.current) {
                  const rect = triggerRef.current.getBoundingClientRect();
                  const vw = window.innerWidth;
                  const vh = window.innerHeight;
                  const popupW = 240;
                  const popupH = 300; // estimated max height
                  const gap = 8;

                  // Horizontal: prefer right of trigger, fall back to left
                  let left = rect.right + gap;
                  if (left + popupW > vw - gap) {
                    left = rect.left - popupW - gap;
                  }
                  left = Math.max(gap, Math.min(left, vw - popupW - gap));

                  // Vertical: open upward if not enough space below
                  const spaceBelow = vh - rect.bottom;
                  if (spaceBelow < popupH && rect.top > spaceBelow) {
                    setPopupPos({ bottom: vh - rect.top + gap, left });
                  } else {
                    setPopupPos({ top: rect.top, left });
                  }
                }
                setIsOpen((v) => !v);
              }}
            >
              <div className={styles.wsIcon} style={{ background: wsColor }}>
                {wsInitials}
              </div>
            </button>
          </Tooltip>
        ) : (
          <button className={styles.trigger} onClick={() => setIsOpen(!isOpen)}>
            <div className={styles.triggerLeft}>
              <div className={styles.wsIcon} style={{ background: wsColor }}>
                {wsInitials}
              </div>
              <div className={styles.wsNameRow}>
                <span className={styles.wsName}>{activeWorkspace?.name || "Select Workspace"}</span>
                {isActiveDefault && <IconStar size={10} className={styles.triggerStar} />}
              </div>
            </div>
            <IconChevronDown
              size={14}
              className={`${styles.chevron} ${isOpen ? styles.open : ""}`}
            />
          </button>
        )}

        {!collapsed && isOpen && <div className={styles.popup}>{popupContent}</div>}
      </div>

      {collapsed &&
        isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className={styles.popup}
            style={{
              position: "fixed",
              ...(popupPos.bottom !== undefined
                ? { bottom: popupPos.bottom, top: "auto" }
                : { top: popupPos.top, bottom: "auto" }),
              left: popupPos.left,
              right: "auto",
              minWidth: 220,
            }}
          >
            {popupContent}
          </div>,
          document.body
        )}

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          setIsEditing(false);
        }}
        title="Workspace Settings"
        showClose={false}
        footer={
          isEditing ? (
            <>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={saveSettings} isLoading={loading}>
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setShowSettings(false)}>
              Close
            </Button>
          )
        }
      >
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                  {activeWorkspace?.description || "No description"}
                </p>
              </div>
            </div>

            {isSuperAdmin && (
              <div>
                <p className={styles.wsSettingsSectionLabel}>Members</p>
                {(activeWorkspace?.members?.length ?? 0) === 0 ? (
                  <p className={styles.wsSettingsMeta}>No members yet</p>
                ) : (
                  <div className={styles.memberAvatarStack}>
                    {(activeWorkspace?.members || []).slice(0, 6).map((m, i) => {
                      const detail = memberDetails.find((u) => u.id === m.user_id);
                      const displayName = detail ? getFullName(detail) : m.email || m.user_id;
                      const initials = detail
                        ? getInitials(displayName)
                        : m.email
                          ? m.email[0].toUpperCase()
                          : "?";
                      const color = getAvatarColor(displayName);
                      return (
                        <Tooltip
                          key={m.user_id}
                          content={displayName}
                          placement="top"
                        >
                          <div
                            className={styles.memberAvatar}
                            style={{ background: color, zIndex: 6 - i }}
                          >
                            {initials}
                          </div>
                        </Tooltip>
                      );
                    })}
                    {(activeWorkspace?.members?.length ?? 0) > 6 && (
                      <div className={styles.memberAvatarMore}>
                        +{(activeWorkspace?.members?.length ?? 0) - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isSuperAdmin ? (
              <div className={styles.wsSettingsActions}>
                <button
                  className={styles.wsSettingsBtn}
                  onClick={() => {
                    setShowSettings(false);
                    openInvite();
                  }}
                >
                  <IconUserPlus size={14} />
                  Invite Members
                </button>
                <button className={styles.wsSettingsBtn} onClick={() => setIsEditing(true)}>
                  <IconEdit size={14} />
                  Edit
                </button>
                <button
                  className={`${styles.wsSettingsBtn} ${styles.wsSettingsBtnDanger}`}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <IconDelete size={14} />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Invite Modal */}
      <Modal
        isOpen={showInvite}
        onClose={() => {
          setShowInvite(false);
          setShowSettings(true);
        }}
        title="Invite Members"
        showClose={false}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowInvite(false);
                setShowSettings(true);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveInvite} isLoading={loading}>
              Save
            </Button>
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
                className={`${styles.inviteItem} ${isMember ? styles.inviteItemMember : ""} ${selected ? styles.inviteItemSelected : ""}`}
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
                  <div
                    className={`${styles.inviteCheck} ${selected ? styles.inviteCheckSelected : ""}`}
                  >
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
        showClose={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createWorkspace} isLoading={loading} disabled={!createForm.name}>
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Workspace"
        showClose={false}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteWorkspace} isLoading={loading}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Delete <strong>{activeWorkspace?.name}</strong>? This will remove all members from this
          workspace. Any user whose default workspace is this one will be reassigned automatically.
          This action cannot be undone.
        </p>
      </Modal>

    </>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { updateUser } from "@/store/slices/authSlice";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { getFullName, getInitials, getAvatarColor } from "@/utils/helpers";
import { api, extractApiErrorMessage } from "@/utils/api";
import { User, UserRole } from "@/types";
import toast from "react-hot-toast";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { PROFILE_SUCCESS, PROFILE_ERRORS } from "@/features/profile/constants";
import styles from "./UserProfilePage.module.css";

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// S3358 (line 246): Extracted nested ternary to a named helper function
function getRoleLabel(role: string | undefined): string {
  if (role === UserRole.SUPER_ADMIN) return "Super Admin";
  if (role === UserRole.ADMIN) return "Admin";
  return "Candidate";
}

type ProfileFormState = {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  default_workspace_id: string;
  workspace_ids: string[];
};

// S3776 (line 44): Extracted form state construction to reduce cognitive complexity of the effect
function buildProfileFormState(
  activeUser: User,
  wsOptions: { id: string; name: string }[]
): ProfileFormState {
  return {
    first_name: activeUser.first_name ?? "",
    last_name: activeUser.last_name ?? "",
    email: activeUser.email ?? "",
    role: activeUser.role ?? "",
    is_active: activeUser.is_active !== false,
    default_workspace_id: activeUser.default_workspace_id ?? wsOptions[0]?.id ?? "",
    workspace_ids: (activeUser.workspaces ?? []).map((w) => w.id),
  };
}

// S3776 (line 132): Extracted base payload building (common fields) to reduce handleSave complexity
function buildBasePayload(
  profileForm: ProfileFormState,
  activeUser: User
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (profileForm.first_name !== (activeUser.first_name ?? ""))
    payload.first_name = profileForm.first_name;
  if (profileForm.last_name !== (activeUser.last_name ?? ""))
    payload.last_name = profileForm.last_name;
  if (profileForm.email !== activeUser.email) payload.email = profileForm.email;
  if (
    profileForm.default_workspace_id &&
    profileForm.default_workspace_id !== activeUser.default_workspace_id
  )
    payload.default_workspace_id = profileForm.default_workspace_id;
  return payload;
}

// S3776 (line 132): Extracted admin-specific payload building to reduce handleSave complexity
function buildAdminPayload(
  profileForm: ProfileFormState,
  activeUser: User
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (profileForm.role !== activeUser.role) payload.role = profileForm.role;
  if (profileForm.is_active !== (activeUser.is_active !== false))
    payload.is_active = profileForm.is_active;
  const cmp = (a: string, b: string) => a.localeCompare(b);
  const currentWsIds = (activeUser.workspaces ?? [])
    .map((w) => w.id)
    .sort(cmp)
    .join(",");
  const newWsIds = [...profileForm.workspace_ids].sort(cmp).join(",");
  if (currentWsIds !== newWsIds) payload.workspace_ids = profileForm.workspace_ids;
  return payload;
}

// S3358 (line 477): Extracted nested ternary workspace content to a named component
function WorkspacePreferencesContent({
  isEditing,
  isViewingOther,
  isSuperAdmin,
  profileForm,
  allWorkspaces,
  wsOptions,
  defaultWsName,
  activeUser,
  setProfileForm,
  toggleWs,
}: Readonly<{
  isEditing: boolean;
  isViewingOther: boolean;
  isSuperAdmin: boolean;
  profileForm: ProfileFormState;
  allWorkspaces: { id: string; name: string }[];
  wsOptions: { id: string; name: string }[];
  defaultWsName: string;
  activeUser: User;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  toggleWs: (id: string) => void;
}>) {
  const editingAdminWs = isEditing && isViewingOther && isSuperAdmin;
  const editingSelfWs = isEditing && !isViewingOther;

  if (editingAdminWs) {
    return (
      <div className={styles.wsAssignSection}>
        <p className={styles.wsAssignHint}>Select workspaces to assign to this user</p>
        <div className={styles.wsGrid}>
          {allWorkspaces.map((ws) => {
            const checked = profileForm.workspace_ids.includes(ws.id);
            return (
              <button
                key={ws.id}
                type="button"
                className={`${styles.wsChip} ${checked ? styles.wsChipActive : ""}`}
                onClick={() => toggleWs(ws.id)}
                aria-pressed={checked}
              >
                <span
                  className={`${styles.wsChipCheck} ${checked ? styles.wsChipCheckActive : ""}`}
                >
                  {checked && <CheckIcon />}
                </span>
                <span>{ws.name}</span>
              </button>
            );
          })}
        </div>
        {profileForm.workspace_ids.length > 0 && (
          <div className={styles.field} style={{ marginTop: 16 }}>
            <Select
              label="Default Workspace"
              value={profileForm.default_workspace_id}
              onChange={(v) => setProfileForm((p) => ({ ...p, default_workspace_id: v }))}
              options={allWorkspaces
                .filter((ws) => profileForm.workspace_ids.includes(ws.id))
                .map((ws) => ({ value: ws.id, label: ws.name }))}
            />
          </div>
        )}
      </div>
    );
  }

  if (editingSelfWs) {
    return (
      <div className={styles.grid}>
        <Select
          label="Default Workspace"
          value={profileForm.default_workspace_id}
          onChange={(v) => setProfileForm((p) => ({ ...p, default_workspace_id: v }))}
          options={wsOptions.map((ws) => ({ value: ws.id, label: ws.name }))}
        />
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Default Workspace</span>
        <span className={styles.fieldValue}>{defaultWsName}</span>
      </div>
      {activeUser.workspaces && activeUser.workspaces.length > 0 && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Assigned Workspaces</span>
          <div className={styles.wsPills}>
            {activeUser.workspaces.map((ws) => (
              <span key={ws.id} className={styles.wsPill}>
                {ws.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// S3776: extracted the Personal Information card out of the main component.
function PersonalInformationCard({
  isEditing,
  activeUser,
  profileForm,
  setProfileForm,
  roleLabel,
}: Readonly<{
  isEditing: boolean;
  activeUser: User;
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  roleLabel: string;
}>) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Personal Information</h2>
      <div className={styles.grid}>
        {isEditing ? (
          <>
            <Input
              label="First Name"
              placeholder="Enter first name"
              value={profileForm.first_name}
              onChange={(e) => setProfileForm((p) => ({ ...p, first_name: e.target.value }))}
              showRequired
            />
            <Input
              label="Last Name"
              placeholder="Enter last name (optional)"
              value={profileForm.last_name}
              onChange={(e) => setProfileForm((p) => ({ ...p, last_name: e.target.value }))}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
              showRequired
            />
          </>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>First Name</span>
              <span className={styles.fieldValue}>{activeUser.first_name ?? "—"}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Last Name</span>
              {/* S6606 (line 355): Replace || with ?? */}
              <span className={styles.fieldValue}>{activeUser.last_name ?? "—"}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Email Address</span>
              <span className={styles.fieldValue}>{activeUser.email}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Role</span>
              <span className={styles.fieldValue}>{roleLabel}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// S3776: extracted the Account Settings card out of the main component.
function AccountSettingsCard({
  isEditing,
  activeUser,
  profileForm,
  setProfileForm,
  roleLabel,
  isActive,
}: Readonly<{
  isEditing: boolean;
  activeUser: User;
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  roleLabel: string;
  isActive: boolean;
}>) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Account Settings</h2>
      <div className={styles.grid}>
        {isEditing ? (
          <>
            <Select
              label="Role"
              value={profileForm.role}
              onChange={(v) => setProfileForm((p) => ({ ...p, role: v }))}
              options={[
                { value: UserRole.ADMIN, label: "Admin" },
                { value: UserRole.SUPER_ADMIN, label: "Super Admin" },
              ]}
              disabled={activeUser.role === UserRole.SUPER_ADMIN}
            />
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Status</span>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkboxNative}
                  checked={profileForm.is_active}
                  onChange={(e) => setProfileForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <span className={styles.checkboxText}>Active account</span>
              </label>
            </div>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Role</span>
              <span className={styles.fieldValue}>{roleLabel}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Status</span>
              <label className={styles.checkboxLabel}>
                <span
                  className={`${styles.checkbox} ${isActive ? styles.checkboxChecked : ""}`}
                  aria-hidden="true"
                >
                  {isActive && <CheckIcon />}
                </span>
                <span className={styles.checkboxText}>
                  {isActive ? "Active account" : "Inactive account"}
                </span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type PasswordFormState = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};
type ShowPwState = { current: boolean; new: boolean; confirm: boolean };

// S3776: extracted the password change/reset modal out of the main component.
function PasswordModal({
  isOpen,
  isViewingOther,
  passwordForm,
  setPasswordForm,
  showPw,
  setShowPw,
  pwSaving,
  onClose,
  onSubmit,
}: Readonly<{
  isOpen: boolean;
  isViewingOther: boolean;
  passwordForm: PasswordFormState;
  setPasswordForm: React.Dispatch<React.SetStateAction<PasswordFormState>>;
  showPw: ShowPwState;
  setShowPw: React.Dispatch<React.SetStateAction<ShowPwState>>;
  pwSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}>) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isViewingOther ? "Reset Password" : "Change Password"}
      size="sm"
      showClose={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={pwSaving}>
            {isViewingOther ? "Reset" : "Save"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!isViewingOther && (
          <Input
            label="Current Password"
            type={showPw.current ? "text" : "password"}
            placeholder="Enter current password"
            value={passwordForm.current_password}
            onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
            showRequired
            autoComplete="current-password"
            rightElement={
              <ToggleVisBtn
                show={showPw.current}
                onToggle={() => setShowPw((p) => ({ ...p, current: !p.current }))}
              />
            }
          />
        )}
        <Input
          label="New Password"
          type={showPw.new ? "text" : "password"}
          placeholder="Enter new password"
          value={passwordForm.new_password}
          onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
          showRequired
          autoComplete="new-password"
          rightElement={
            <ToggleVisBtn
              show={showPw.new}
              onToggle={() => setShowPw((p) => ({ ...p, new: !p.new }))}
            />
          }
        />
        <Input
          label="Confirm New Password"
          type={showPw.confirm ? "text" : "password"}
          placeholder="Confirm new password"
          value={passwordForm.confirm_password}
          onChange={(e) => setPasswordForm((p) => ({ ...p, confirm_password: e.target.value }))}
          showRequired
          autoComplete="new-password"
          rightElement={
            <ToggleVisBtn
              show={showPw.confirm}
              onToggle={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))}
            />
          }
        />
      </div>
    </Modal>
  );
}

// S3776: extracted the gradient hero header out of the main component.
function ProfileHero({
  avatarBg,
  initials,
  fullName,
  email,
  roleLabel,
  isActive,
  canEditThis,
  isEditing,
  saving,
  onEdit,
  onCancel,
  onSave,
}: Readonly<{
  avatarBg: string;
  initials: string;
  fullName: string;
  email: string | undefined;
  roleLabel: string;
  isActive: boolean;
  canEditThis: boolean;
  isEditing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}>) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <div className={styles.avatarCircle} style={{ background: avatarBg }}>
            {initials}
          </div>
          <div className={styles.heroInfo}>
            <h1 className={styles.heroName}>{fullName || "—"}</h1>
            <p className={styles.heroMeta}>
              <span>{email}</span>
              <span className={styles.heroDot} aria-hidden="true">
                ·
              </span>
              <span>{roleLabel}</span>
              <span className={styles.heroDot} aria-hidden="true">
                ·
              </span>
              <span className={isActive ? styles.statusActive : styles.statusInactive}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
        </div>
        {canEditThis && (
          <div className={styles.heroActions}>
            {isEditing ? (
              <>
                <Button variant="secondary" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} isLoading={saving}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button size="sm" leftIcon={<EditIcon />} onClick={onEdit}>
                Edit Profile
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.auth.user);
  const { workspaces: allWorkspaces } = useAppSelector((s) => s.workspace);

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const isViewingOther = !!userId && userId !== currentUser?.id;
  const canEditThis = isSuperAdmin || !isViewingOther;

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isViewingOther);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    is_active: true,
    default_workspace_id: "",
    workspace_ids: [],
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  const fetchProfileUser = useCallback(async () => {
    if (!isViewingOther) return;
    setIsLoading(true);
    try {
      const { data } = await api.get(API_ENDPOINTS.USERS.BY_ID(userId));
      setProfileUser(data.data);
    } catch {
      toast.error(PROFILE_ERRORS.LOAD_FAILED);
      navigate(ROUTES.ADMIN.USERS);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isViewingOther, navigate]);

  useEffect(() => {
    fetchProfileUser();
  }, [fetchProfileUser]);

  const activeUser: User | null = isViewingOther ? profileUser : currentUser;

  // S3776 (line 44): Delegated form state construction to buildProfileFormState helper
  useEffect(() => {
    if (!activeUser) return;
    const wsOptions = isSuperAdmin ? allWorkspaces : (activeUser.workspaces ?? []);
    setProfileForm(buildProfileFormState(activeUser, wsOptions));
  }, [activeUser, allWorkspaces, isSuperAdmin]);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    if (activeUser) {
      const wsOptions = isSuperAdmin ? allWorkspaces : (activeUser.workspaces ?? []);
      setProfileForm(buildProfileFormState(activeUser, wsOptions));
    }
  };

  // S3776 (line 132): Delegated payload construction to buildBasePayload / buildAdminPayload helpers
  const handleSave = async () => {
    if (!activeUser) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...buildBasePayload(profileForm, activeUser),
        ...(isViewingOther && isSuperAdmin ? buildAdminPayload(profileForm, activeUser) : {}),
      };

      if (Object.keys(payload).length === 0) {
        setIsEditing(false);
        return;
      }

      const endpoint = isViewingOther ? API_ENDPOINTS.USERS.BY_ID(userId) : API_ENDPOINTS.USERS.ME;
      const { data } = await api.patch(endpoint, payload);

      if (isViewingOther) {
        setProfileUser(data.data);
      } else {
        dispatch(updateUser(data.data));
      }
      toast.success(PROFILE_SUCCESS.UPDATED);
      setIsEditing(false);
    } catch (e: unknown) {
      toast.error(extractApiErrorMessage(e, PROFILE_ERRORS.UPDATE_FAILED));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }
    if (!isViewingOther && !passwordForm.current_password) {
      toast.error("Current password is required");
      return;
    }
    setPwSaving(true);
    try {
      if (isViewingOther && isSuperAdmin) {
        await api.patch(API_ENDPOINTS.USERS.BY_ID(userId), {
          password: passwordForm.new_password,
        });
      } else {
        await api.patch(API_ENDPOINTS.USERS.ME, {
          password: passwordForm.new_password,
          current_password: passwordForm.current_password,
        });
      }
      toast.success(PROFILE_SUCCESS.PASSWORD_CHANGED);
      setShowPasswordModal(false);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setShowPw({ current: false, new: false, confirm: false });
    } catch (e: unknown) {
      toast.error(extractApiErrorMessage(e, PROFILE_ERRORS.PASSWORD_CHANGE_FAILED));
    } finally {
      setPwSaving(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    setShowPw({ current: false, new: false, confirm: false });
  };

  const toggleWs = (id: string) => {
    setProfileForm((p) => ({
      ...p,
      workspace_ids: p.workspace_ids.includes(id)
        ? p.workspace_ids.filter((x) => x !== id)
        : [...p.workspace_ids, id],
    }));
  };

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!activeUser) return null;

  const fullName = getFullName(activeUser);
  const initials = fullName ? getInitials(fullName) : "U";
  const avatarBg = fullName ? getAvatarColor(fullName) : "var(--primary-600)";
  // S3358 (line 246): Extracted nested ternary to getRoleLabel helper function
  const roleLabel = getRoleLabel(activeUser.role);
  const isActive = activeUser.is_active !== false;

  // S6606 (line 251): Replace || with ??
  const wsOptions = isSuperAdmin ? allWorkspaces : (activeUser.workspaces ?? []);
  // S6606 (line 253): Replace || with ??
  const defaultWsName =
    wsOptions.find((ws) => ws.id === activeUser.default_workspace_id)?.name ?? "—";

  return (
    <div className={styles.page}>
      {/* Back button when viewing another user */}
      {isViewingOther && (
        <button className={styles.backBtn} onClick={() => navigate(ROUTES.ADMIN.USERS)}>
          <BackIcon />
          <span>Back to Users</span>
        </button>
      )}

      {/* ── Gradient Hero Header ── */}
      <ProfileHero
        avatarBg={avatarBg}
        initials={initials}
        fullName={fullName}
        email={activeUser.email}
        roleLabel={roleLabel}
        isActive={isActive}
        canEditThis={canEditThis}
        isEditing={isEditing}
        saving={saving}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onSave={handleSave}
      />

      {/* ── Content ── */}
      <div className={styles.content}>
        {/* Personal Information */}
        <PersonalInformationCard
          isEditing={isEditing}
          activeUser={activeUser}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          roleLabel={roleLabel}
        />

        {/* Account Settings — visible to super admin editing another user */}
        {isViewingOther && isSuperAdmin && (
          <AccountSettingsCard
            isEditing={isEditing}
            activeUser={activeUser}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            roleLabel={roleLabel}
            isActive={isActive}
          />
        )}

        {/* Workspace Preferences */}
        {/* S3358 (line 477): Extracted nested ternary to WorkspacePreferencesContent component */}
        {wsOptions.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Workspace Preferences</h2>
            <WorkspacePreferencesContent
              isEditing={isEditing}
              isViewingOther={isViewingOther}
              isSuperAdmin={isSuperAdmin}
              profileForm={profileForm}
              allWorkspaces={allWorkspaces}
              wsOptions={wsOptions}
              defaultWsName={defaultWsName}
              activeUser={activeUser}
              setProfileForm={setProfileForm}
              toggleWs={toggleWs}
            />
          </div>
        )}

        {/* Security */}
        {canEditThis && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Security</h2>
            <div className={styles.securityRow}>
              <div>
                <p className={styles.fieldLabel}>Password</p>
                <p className={styles.securityHint}>
                  {isViewingOther && isSuperAdmin
                    ? "Reset this user's password without requiring their current password."
                    : "Update your password. You'll need your current password."}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowPasswordModal(true)}>
                {isViewingOther ? "Reset Password" : "Change Password"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Password Modal ── */}
      <PasswordModal
        isOpen={showPasswordModal}
        isViewingOther={isViewingOther}
        passwordForm={passwordForm}
        setPasswordForm={setPasswordForm}
        showPw={showPw}
        setShowPw={setShowPw}
        pwSaving={pwSaving}
        onClose={closePasswordModal}
        onSubmit={handlePasswordChange}
      />
    </div>
  );
}

function ToggleVisBtn({
  show,
  onToggle,
}: Readonly<{
  show: boolean;
  onToggle: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--text-tertiary)",
        display: "flex",
        alignItems: "center",
        padding: 0,
      }}
    >
      {show ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

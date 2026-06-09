import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./UsersPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import {
  IconPlus,
  IconUsers,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconWorkspace,
  IconUserSetting,
} from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { useAppSelector } from "@/store";
import { User, SortOrder, UserRole } from "@/types";
import { getAvatarColor, getInitials, getFullName } from "@/utils/helpers";
import toast from "react-hot-toast";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { USERS_SUCCESS, USERS_ERRORS } from "@/features/users/constants";

export default function UsersPage() {
  const navigate = useNavigate();
  const allWorkspaces = useAppSelector((s) => s.workspace.workspaces);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role: UserRole;
  }>({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: UserRole.ADMIN,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createWsIds, setCreateWsIds] = useState<string[]>([]);

  const debouncedSearch = useDebounce(search, 300);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get(API_ENDPOINTS.USERS.ROOT);
      const list: User[] = Array.isArray(data.data) ? data.data : [];
      let filteredList = debouncedSearch
        ? list.filter(
            (u) =>
              getFullName(u).toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              u.email.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : list;
      const sorted = [...filteredList].sort((a, b) => {
        if (a.role === UserRole.SUPER_ADMIN && b.role !== UserRole.SUPER_ADMIN) return -1;
        if (a.role !== UserRole.SUPER_ADMIN && b.role === UserRole.SUPER_ADMIN) return 1;
        const da = new Date(a.created_at).getTime();
        const db2 = new Date(b.created_at).getTime();
        return sortOrder === "desc" ? db2 - da : da - db2;
      });
      setUsers(sorted);
    } catch {
      toast.error(USERS_ERRORS.LOAD_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setForm({ first_name: "", last_name: "", email: "", password: "", role: UserRole.ADMIN });
    setCreateWsIds([]);
    setShowPassword(false);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const needsWorkspace = form.role !== UserRole.SUPER_ADMIN;
    if (
      !form.first_name.trim() ||
      !form.email.trim() ||
      !form.password.trim() ||
      (needsWorkspace && createWsIds.length === 0)
    )
      return;
    setSaving(true);
    try {
      await api.post(API_ENDPOINTS.USERS.ROOT, {
        first_name: form.first_name,
        last_name: form.last_name || undefined,
        email: form.email,
        password: form.password,
        role: form.role,
        workspace_ids: createWsIds,
      });
      toast.success(USERS_SUCCESS.CREATED);
      setShowCreate(false);
      fetchUsers();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          USERS_ERRORS.CREATE_FAILED
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCreateWs = (id: string) =>
    setCreateWsIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const noWorkspaces = allWorkspaces.length === 0;

  let userContent: React.ReactNode;
  if (isLoading) {
    userContent = (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Spinner size="lg" />
      </div>
    );
  } else if (users.length === 0) {
    userContent = (
      <div className={styles.empty}>
        <IconUsers size={48} color="var(--text-tertiary)" />
        <p>No admin users yet</p>
        <Button leftIcon={<IconPlus size={15} />} onClick={openCreate}>
          Create first admin
        </Button>
      </div>
    );
  } else {
    userContent = (
      <div className={viewMode === "grid" ? styles.grid : styles.list}>
        {users.map((user) => {
          const isActive = user.is_active !== false;
          const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
          return (
            <div key={user.id} className={`${styles.card} ${isActive ? "" : styles.cardInactive}`}>
              <div className={styles.cardLeft}>
                <div
                  className={styles.avatar}
                  style={{
                    background: getAvatarColor(getFullName(user)),
                    opacity: isActive ? 1 : 0.5,
                  }}
                >
                  {getInitials(getFullName(user))}
                </div>
                <div className={styles.info}>
                  <p className={styles.name}>{getFullName(user)}</p>
                  <p className={styles.email}>{user.email}</p>
                </div>
              </div>
              <div className={styles.cardRight}>
                <Badge variant={isSuperAdmin ? "accent" : "primary"}>
                  {isSuperAdmin ? "Super Admin" : "Admin"}
                </Badge>
                <Badge variant={isActive ? "success" : "default"}>
                  {isActive ? "Active" : "Inactive"}
                </Badge>
                <Tooltip content="Edit user profile" placement="top">
                  <button
                    className={styles.editBtn}
                    onClick={() => navigate(ROUTES.ADMIN.profileById(user.id))}
                    aria-label={`Edit profile of ${getFullName(user)}`}
                  >
                    <IconUserSetting size={16} />
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Users"
        subtitle="Manage admin users"
        actions={
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={openCreate}
            disabled={noWorkspaces}
            title={noWorkspaces ? "Create a workspace first before adding admin users" : undefined}
          >
            New Admin
          </Button>
        }
      />

      {noWorkspaces && (
        <div className={styles.empty}>
          <IconWorkspace size={48} color="var(--text-tertiary)" />
          <p>Create a workspace first</p>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              maxWidth: 360,
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            You need at least one workspace before you can create admin users.
          </p>
        </div>
      )}

      {!noWorkspaces && (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            sortBy="created_at"
            sortOrder={sortOrder}
            onSortOrderToggle={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            onRefresh={fetchUsers}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {userContent}
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Admin User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={saving}
              disabled={
                !form.first_name.trim() ||
                !form.email.trim() ||
                !form.password.trim() ||
                (form.role !== UserRole.SUPER_ADMIN && createWsIds.length === 0)
              }
            >
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Input
              label="First Name"
              placeholder="Enter first name"
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
              showRequired
            />
            <Input
              label="Last Name"
              placeholder="Enter last name (optional)"
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
            />
          </div>
          <Input
            label="Email"
            type="email"
            placeholder="Enter email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            showRequired
            autoComplete="off"
          />
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            showRequired
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  padding: 0,
                }}
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            }
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(v) => setForm((p) => ({ ...p, role: v as UserRole }))}
            options={[
              { value: UserRole.ADMIN, label: "Admin" },
              { value: UserRole.SUPER_ADMIN, label: "Super Admin" },
            ]}
            showRequired
          />
          {form.role !== UserRole.SUPER_ADMIN && (
            <div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
                Workspaces <span style={{ color: "var(--error-500)" }}>*</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
                Select at least one workspace to assign
              </p>
              <div className={styles.wsList}>
                {allWorkspaces.map((ws) => {
                  const checked = createWsIds.includes(ws.id);
                  return (
                    <label
                      key={ws.id}
                      className={`${styles.wsItem} ${checked ? styles.wsItemSelected : ""}`}
                    >
                      <input
                        type="checkbox"
                        className={styles.wsHiddenCheckbox}
                        checked={checked}
                        onChange={() => toggleCreateWs(ws.id)}
                      />
                      <div className={styles.wsInfo}>
                        <p className={styles.wsName}>{ws.name}</p>
                        {ws.description && <p className={styles.wsDesc}>{ws.description}</p>}
                      </div>
                      <div className={`${styles.wsCheck} ${checked ? styles.wsCheckSelected : ""}`}>
                        {checked && <IconCheck size={12} />}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconPlus, IconEdit, IconDelete, IconEye, IconUsers } from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { getAvatarColor, getInitials, getFullName } from "@/utils/helpers";
import toast from "react-hot-toast";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import type { PaginationMeta, SortOrder } from "@/types";
import styles from "../../users/pages/UsersPage.module.css";

interface Candidate {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  gender?: string;
  location?: string;
  institution?: string;
  is_active?: boolean;
  created_at: string;
}

const GENDER_OPTIONS = [
  { value: "", label: "— Any Gender —" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const blankForm = () => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "",
  location: "",
  institution: "",
});

export default function CandidatesPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm());

  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: "created_at",
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const { data } = await api.get(`${API_ENDPOINTS.CANDIDATES.ROOT}?${params}`);
      setCandidates(data.data?.candidates ?? []);
      setMeta(data.data?.pagination ?? null);
    } catch {
      toast.error("Failed to load candidates");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortOrder, debouncedSearch]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    reset();
  }, [debouncedSearch, sortOrder]);

  const openCreate = () => {
    setForm(blankForm());
    setShowCreate(true);
  };

  const openEdit = (c: Candidate) => {
    setSelected(c);
    setForm({
      first_name: c.first_name,
      last_name: c.last_name ?? "",
      email: c.email,
      phone: c.phone ?? "",
      gender: c.gender ?? "",
      location: c.location ?? "",
      institution: c.institution ?? "",
    });
    setShowEdit(true);
  };

  const handleCreate = async () => {
    if (!form.first_name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      await api.post(API_ENDPOINTS.CANDIDATES.ROOT, {
        first_name: form.first_name,
        last_name: form.last_name || undefined,
        email: form.email,
        phone: form.phone || undefined,
        gender: form.gender || undefined,
        location: form.location || undefined,
        institution: form.institution || undefined,
      });
      toast.success("Candidate created successfully");
      setShowCreate(false);
      fetchCandidates();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create candidate"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected || !form.first_name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      await api.put(API_ENDPOINTS.CANDIDATES.BY_ID(selected.id), {
        first_name: form.first_name,
        last_name: form.last_name || undefined,
        email: form.email,
        candidate_data: {
          phone: form.phone || undefined,
          gender: form.gender || undefined,
          location: form.location || undefined,
          institution: form.institution || undefined,
        },
      });
      toast.success("Candidate updated successfully");
      setShowEdit(false);
      fetchCandidates();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to update candidate"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.delete(API_ENDPOINTS.CANDIDATES.BY_ID(selected.id));
      toast.success("Candidate deactivated successfully");
      setShowDelete(false);
      fetchCandidates();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to deactivate candidate"
      );
    } finally {
      setSaving(false);
    }
  };

  const formFields = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
      <div style={{ display: "flex", gap: 12 }}>
        <Input
          label="Phone"
          placeholder="Enter phone (optional)"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
        />
        <Select
          label="Gender"
          options={GENDER_OPTIONS}
          value={form.gender}
          onChange={(v) => setForm((p) => ({ ...p, gender: v }))}
        />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Input
          label="Institution"
          placeholder="University / School (optional)"
          value={form.institution}
          onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))}
        />
        <Input
          label="Location"
          placeholder="City / Country (optional)"
          value={form.location}
          onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
        />
      </div>
    </div>
  );

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Spinner size="lg" />
      </div>
    );
  } else if (candidates.length === 0) {
    content = (
      <div className={styles.empty}>
        <IconUsers size={48} color="var(--text-tertiary)" />
        <p>No candidates yet</p>
        <Button leftIcon={<IconPlus size={15} />} onClick={openCreate}>
          Add first candidate
        </Button>
      </div>
    );
  } else {
    content = (
      <>
        <div className={viewMode === "grid" ? styles.grid : styles.list}>
          {candidates.map((c) => {
            const fullName = getFullName(c);
            const isActive = c.is_active !== false;
            return (
              <div
                key={c.id}
                className={`${styles.card} ${isActive ? "" : styles.cardInactive}`}
              >
                <div className={styles.cardLeft}>
                  <div
                    className={styles.avatar}
                    style={{ background: getAvatarColor(fullName) }}
                  >
                    {getInitials(fullName)}
                  </div>
                  <div className={styles.info}>
                    <p className={styles.name}>{fullName}</p>
                    <p className={styles.email}>{c.email}</p>
                  </div>
                </div>
                <div className={styles.cardRight}>
                  <Badge variant={isActive ? "success" : "default"}>
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Tooltip content="View profile" placement="top">
                    <button
                      className={styles.editBtn}
                      onClick={() => navigate(ROUTES.ADMIN.candidateProfile(c.id))}
                      aria-label={`View profile of ${fullName}`}
                    >
                      <IconEye size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Edit" placement="top">
                    <button
                      className={styles.editBtn}
                      onClick={() => openEdit(c)}
                      aria-label={`Edit ${fullName}`}
                    >
                      <IconEdit size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Deactivate" placement="top">
                    <button
                      className={styles.editBtn}
                      onClick={() => { setSelected(c); setShowDelete(true); }}
                      aria-label={`Deactivate ${fullName}`}
                      style={{ color: "var(--error-500)" }}
                    >
                      <IconDelete size={15} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
        {meta && (
          <Pagination
            meta={meta}
            onPageChange={goToPage}
            pageSize={pageSize}
            onPageSizeChange={changePageSize}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <Header
        title="Candidates"
        subtitle={`${meta?.total ?? 0} candidates`}
        actions={
          <Button leftIcon={<IconPlus size={16} />} onClick={openCreate}>
            New Candidate
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        onRefresh={fetchCandidates}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {content}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Candidate"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={saving}
              disabled={!form.first_name.trim() || !form.email.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Candidate"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              isLoading={saving}
              disabled={!form.first_name.trim() || !form.email.trim()}
            >
              Save Changes
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Deactivate Candidate"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={saving}>
              Deactivate
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Are you sure you want to deactivate{" "}
          <strong>{selected ? getFullName(selected) : "this candidate"}</strong>? They will no
          longer be able to access the platform.
        </p>
      </Modal>
    </div>
  );
}

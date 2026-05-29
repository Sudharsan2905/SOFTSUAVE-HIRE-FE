import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./CategoriesPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { IconPlus, IconEdit, IconDelete, IconQuestionBank } from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { QuestionCategory, PaginationMeta, ViewMode, SortOrder } from "@/types";
import { formatDate, getAvatarColor, getInitials } from "@/utils/helpers";
import toast from "react-hot-toast";

const SORT_OPTIONS = [
  { value: "created_at", label: "Created Date" },
  { value: "name", label: "Name" },
  { value: "question_count", label: "Questions" },
];

export default function CategoriesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected] = useState<QuestionCategory | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const { data } = await api.get(`/api/questions/categories?${params}`);
      setCategories(data.data?.categories || []);
      setMeta(data.data?.pagination || null);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);
  useEffect(() => {
    reset();
  }, [debouncedSearch, sortBy, sortOrder]);

  const openEdit = (cat: QuestionCategory) => {
    setSelected(cat);
    setForm({ name: cat.name, description: cat.description });
    setShowEdit(true);
  };
  const openDelete = (cat: QuestionCategory) => {
    setSelected(cat);
    setShowDelete(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/questions/categories", form);
      toast.success("Category created");
      setShowCreate(false);
      setForm({ name: "", description: "" });
      fetchCategories();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/api/questions/categories/${selected.id}`, form);
      toast.success("Category updated");
      setShowEdit(false);
      fetchCategories();
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.delete(`/api/questions/categories/${selected.id}`);
      toast.success("Category deleted");
      setShowDelete(false);
      fetchCategories();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header
        title="Question Bank"
        subtitle="Manage question categories and questions"
        actions={
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={() => {
              setForm({ name: "", description: "" });
              setShowCreate(true);
            }}
          >
            New Category
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortByOptions={SORT_OPTIONS}
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={fetchCategories}
      />

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spinner size="lg" />
        </div>
      ) : categories.length === 0 ? (
        <div className={styles.empty}>
          <IconQuestionBank size={48} color="var(--text-tertiary)" />
          <p>No categories yet</p>
          <Button leftIcon={<IconPlus size={15} />} onClick={() => setShowCreate(true)}>
            Create your first category
          </Button>
        </div>
      ) : (
        <>
          <div className={viewMode === "grid" ? styles.grid : styles.list}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={styles.card}
                onClick={() => navigate(`/question-bank/${cat.id}`)}
              >
                {/* Grid layout */}
                <div className={styles.cardTop}>
                  <div className={styles.catIcon} style={{ background: getAvatarColor(cat.name) }}>
                    {getInitials(cat.name)}
                  </div>
                  <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.iconBtn} onClick={() => openEdit(cat)} title="Edit">
                      <IconEdit size={14} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => openDelete(cat)}
                      title="Delete"
                    >
                      <IconDelete size={14} />
                    </button>
                  </div>
                </div>
                <h3 className={styles.catName}>{cat.name}</h3>
                <p className={styles.catDesc}>{cat.description || " "}</p>
                <div className={styles.cardFooter}>
                  <Badge variant="primary">{cat.question_count} questions</Badge>
                  <span className={styles.dateText}>{formatDate(cat.created_at)}</span>
                </div>

                {/* List layout */}
                <div className={styles.listRow}>
                  <div className={styles.listIcon} style={{ background: getAvatarColor(cat.name) }}>
                    {getInitials(cat.name)}
                  </div>
                  <span className={styles.listName}>{cat.name}</span>
                  <span className={styles.listDesc}>{cat.description}</span>
                  <div className={styles.listMeta}>
                    <Badge variant="primary">{cat.question_count} questions</Badge>
                    <span className={styles.listDate}>{formatDate(cat.created_at)}</span>
                  </div>
                  <div className={styles.listActions} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.iconBtn} onClick={() => openEdit(cat)} title="Edit">
                      <IconEdit size={14} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => openDelete(cat)}
                      title="Delete"
                    >
                      <IconDelete size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {meta && <Pagination meta={meta} onPageChange={goToPage} pageSize={pageSize} onPageSizeChange={changePageSize} />}
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Category"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={saving} disabled={!form.name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Category Name"
            placeholder="e.g., Python, React, SQL"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Textarea
            label="Description (optional)"
            placeholder="Brief description..."
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Category"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} isLoading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input
            label="Category Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Category"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={saving}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Are you sure you want to delete <strong>{selected?.name}</strong>? This will also delete
          all {selected?.question_count} question(s) in this category. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

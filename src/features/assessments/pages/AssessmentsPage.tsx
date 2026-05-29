import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./AssessmentsPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconPlus,
  IconDelete,
  IconShare,
  IconClone,
  IconUsers,
  IconAssessment,
  IconTime,
  IconCopy,
  IconMail,
  IconWhatsApp,
  IconWorkspace,
  IconChevronRight,
} from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { Assessment, PaginationMeta, ViewMode, SortOrder } from "@/types";
import { formatDate, generateShareUrl, copyToClipboard } from "@/utils/helpers";
import toast from "react-hot-toast";
import {
  CreateAssessmentWizard,
  AssessmentDraft,
} from "../components/CreateWizard/WizardContainer";
import { useAppSelector } from "@/store";

const SORT_OPTIONS = [
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "name", label: "Name" },
];

export default function AssessmentsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { activeWorkspace } = useAppSelector((s) => s.workspace);
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showWizard, setShowWizard] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<Partial<AssessmentDraft> | null>(null);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [saving, setSaving] = useState(false);
  const { page, pageSize, goToPage, reset } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  const fetchAssessments = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const { data } = await api.get(`/api/workspaces/${workspaceId}/assessments?${params}`);
      setAssessments(data.data?.assessments || []);
      setMeta(data.data?.pagination || null);
    } catch {
      toast.error("Failed to load assessments");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, pageSize, sortBy, sortOrder, debouncedSearch]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);
  useEffect(() => {
    reset();
  }, [debouncedSearch, sortBy, sortOrder]);

  const handleCloneClick = (a: Assessment) => {
    setWizardPrefill({
      name: `Copy of ${a.name}`,
      description: a.description,
      rounds: a.rounds.map((r) => ({
        round_number: r.round_number,
        question_count: r.question_count,
        max_duration_minutes: r.max_duration_minutes,
        question_ids: r.question_ids,
      })),
      accessibility: a.accessibility,
      monitoring_config: a.monitoring_config,
    });
    setShowWizard(true);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.delete(`/api/workspaces/${workspaceId}/assessments/${selected.id}`);
      toast.success("Assessment deleted");
      setShowDelete(false);
      fetchAssessments();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = selected ? generateShareUrl(selected.share_link) : "";

  if (!activeWorkspace) {
    return (
      <div>
        <Header title="Assessments" subtitle="" />
        <div className={styles.empty}>
          <IconWorkspace size={48} color="var(--text-tertiary)" />
          <p>{isSuperAdmin ? "Create a workspace to get started" : "No workspace access"}</p>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              maxWidth: 380,
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            {isSuperAdmin
              ? "Use the workspace switcher in the sidebar to create your first workspace."
              : "You have no workspace assigned. Please contact your administrator to get access."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Assessments"
        subtitle={`${meta?.total ?? 0} assessments`}
        actions={
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={() => {
              setWizardPrefill(null);
              setShowWizard(true);
            }}
          >
            Create Assessment
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
      />

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spinner size="lg" />
        </div>
      ) : assessments.length === 0 ? (
        <div className={styles.empty}>
          <IconAssessment size={48} color="var(--text-tertiary)" />
          <p>No assessments yet</p>
          <Button
            leftIcon={<IconPlus size={15} />}
            onClick={() => {
              setWizardPrefill(null);
              setShowWizard(true);
            }}
          >
            Create Assessment
          </Button>
        </div>
      ) : (
        <>
          <div className={viewMode === "grid" ? styles.grid : styles.list}>
            {assessments.map((a) => (
              <div
                key={a.id}
                className={styles.card}
                onClick={() => navigate(`/workspaces/${workspaceId}/assessments/${a.id}`)}
              >
                <div className={styles.cardTop}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge variant={a.accessibility === "monitoring" ? "accent" : "default"}>
                      {a.accessibility === "monitoring" ? "🛡 Monitoring" : "Normal"}
                    </Badge>
                    <Badge variant="info">
                      {a.rounds.length} round{a.rounds.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => {
                        setSelected(a);
                        setShowShare(true);
                      }}
                      title="Share"
                    >
                      <IconShare size={14} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleCloneClick(a)}
                      title="Clone"
                    >
                      <IconClone size={14} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => {
                        setSelected(a);
                        setShowDelete(true);
                      }}
                      title="Delete"
                    >
                      <IconDelete size={14} />
                    </button>
                  </div>
                </div>

                <h3 className={styles.assessmentName}>{a.name}</h3>
                {a.description && <p className={styles.assessmentDesc}>{a.description}</p>}

                <div className={styles.metaRow}>
                  <span className={styles.metaItem}>
                    <IconTime size={12} />{" "}
                    {a.rounds.reduce((t, r) => t + r.max_duration_minutes, 0)} min total
                  </span>
                  <span className={styles.metaItem}>
                    <IconUsers size={12} /> {a.submission_count ?? 0} submitted
                  </span>
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.dateText}>{formatDate(a.created_at)}</span>
                  <span className={styles.viewDetail}>
                    View Details <IconChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
          {meta && <Pagination meta={meta} onPageChange={goToPage} />}
        </>
      )}

      {/* Create Wizard */}
      {showWizard && workspaceId && (
        <CreateAssessmentWizard
          workspaceId={workspaceId}
          onClose={() => {
            setShowWizard(false);
            setWizardPrefill(null);
          }}
          onSuccess={() => {
            setShowWizard(false);
            setWizardPrefill(null);
            fetchAssessments();
          }}
          initialData={wizardPrefill || undefined}
        />
      )}

      {/* Share Modal */}
      <Modal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title="Share Assessment"
        size="md"
      >
        <div className={styles.shareCards}>
          <button
            className={styles.shareCard}
            onClick={() => {
              copyToClipboard(shareUrl).then(() => toast.success("Link copied!"));
            }}
          >
            <IconCopy size={24} color="var(--primary-600)" />
            <div>
              <p className={styles.shareCardTitle}>Copy Link</p>
              <p className={styles.shareCardDesc}>Share the unique assessment link directly</p>
            </div>
          </button>
          <a
            className={styles.shareCard}
            href={`mailto:?subject=Assessment Invitation&body=Please complete this assessment: ${shareUrl}`}
            target="_blank"
            rel="noreferrer"
          >
            <IconMail size={24} color="var(--primary-600)" />
            <div>
              <p className={styles.shareCardTitle}>Share via Email</p>
              <p className={styles.shareCardDesc}>Send invitation through email</p>
            </div>
          </a>
          <a
            className={styles.shareCard}
            href={`https://wa.me/?text=Please complete this assessment: ${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
          >
            <IconWhatsApp size={24} color="#25D366" />
            <div>
              <p className={styles.shareCardTitle}>Share via WhatsApp</p>
              <p className={styles.shareCardDesc}>Send via WhatsApp message</p>
            </div>
          </a>
        </div>
        <div className={styles.shareLinkBox}>
          <code className={styles.shareLink}>{shareUrl}</code>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Assessment"
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
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Delete <strong>{selected?.name}</strong>? This will remove all candidate submissions. This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

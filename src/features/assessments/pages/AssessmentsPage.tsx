import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import styles from "./AssessmentsPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconPlus,
  IconDelete,
  IconEdit,
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
  IconShield,
} from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
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
  const { activeWorkspace, workspaces: allWorkspaces } = useAppSelector((s) => s.workspace);
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
  const [showCloneWorkspace, setShowCloneWorkspace] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<Partial<AssessmentDraft> | null>(null);
  const [cloneTargetWorkspaceId, setCloneTargetWorkspaceId] = useState<string>("");
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Assessment | null>(null);
  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
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

  const handleEditClick = (a: Assessment) => {
    setEditTarget(a);
  };

  const handleCloneClick = (a: Assessment) => {
    setSelected(a);
    setCloneTargetWorkspaceId(workspaceId ?? "");
    setShowCloneWorkspace(true);
  };

  const handleCloneConfirm = () => {
    if (!selected) return;
    setShowCloneWorkspace(false);
    setWizardPrefill({
      name: `Copy of ${selected.name}`,
      description: selected.description,
      rounds: selected.rounds.map((r) => ({
        round_number: r.round_number,
        question_count: r.question_count,
        max_duration_minutes: r.max_duration_minutes,
        question_ids: r.question_ids,
      })),
      accessibility: selected.accessibility,
      monitoring_config: selected.monitoring_config,
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

  let assessmentContent: React.ReactNode;
  if (isLoading) {
    assessmentContent = (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Spinner size="lg" />
      </div>
    );
  } else if (assessments.length === 0) {
    assessmentContent = (
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
    );
  } else {
    assessmentContent = (
      <>
        <div className={viewMode === "grid" ? styles.grid : styles.list}>
          {assessments.map((a) => (
            <div key={a.id} className={styles.card}>
              {/* Stretched link covers the card; action buttons sit above it via z-index */}
              <Link
                to={`/workspaces/${workspaceId}/assessments/${a.id}`}
                className={styles.cardOverlay}
                aria-label={`View ${a.name} assessment`}
              />
              <div className={styles.cardTop}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge variant={a.accessibility === "monitoring" ? "accent" : "default"}>
                    {a.accessibility === "monitoring" ? (
                      <><IconShield size={11} /> Monitoring</>
                    ) : (
                      "Normal"
                    )}
                  </Badge>
                  <Badge variant="info">
                    {a.rounds.length} round{a.rounds.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className={styles.cardActions}>
                  <Tooltip content="Edit" placement="top">
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleEditClick(a)}
                      aria-label="Edit assessment"
                    >
                      <IconEdit size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Share" placement="top">
                    <button
                      className={styles.iconBtn}
                      onClick={() => { setSelected(a); setShowShare(true); }}
                      aria-label="Share assessment"
                    >
                      <IconShare size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Clone" placement="top">
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleCloneClick(a)}
                      aria-label="Clone assessment"
                    >
                      <IconClone size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete" placement="top">
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => { setSelected(a); setShowDelete(true); }}
                      aria-label="Delete assessment"
                    >
                      <IconDelete size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <h3 className={styles.assessmentName}>{a.name}</h3>
              {a.description && <p className={styles.assessmentDesc}>{a.description}</p>}

              <div className={styles.metaRow}>
                <span className={styles.metaItem}>
                  <IconTime size={12} /> {a.rounds.reduce((t, r) => t + r.max_duration_minutes, 0)}{" "}
                  min total
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
        onRefresh={fetchAssessments}
      />

      {assessmentContent}

      {/* Create / Clone Wizard */}
      {showWizard && (cloneTargetWorkspaceId || workspaceId) && (
        <CreateAssessmentWizard
          workspaceId={wizardPrefill ? cloneTargetWorkspaceId : (workspaceId ?? "")}
          onClose={() => {
            setShowWizard(false);
            setWizardPrefill(null);
            setCloneTargetWorkspaceId("");
          }}
          onSuccess={() => {
            setShowWizard(false);
            setWizardPrefill(null);
            setCloneTargetWorkspaceId("");
            fetchAssessments();
          }}
          initialData={wizardPrefill || undefined}
        />
      )}

      {/* Edit Wizard */}
      {editTarget && workspaceId && (
        <CreateAssessmentWizard
          workspaceId={workspaceId}
          editMode
          assessmentId={editTarget.id}
          initialData={{
            name: editTarget.name,
            description: editTarget.description,
            rounds: editTarget.rounds.map((r) => ({
              round_number: r.round_number,
              question_count: r.question_count,
              max_duration_minutes: r.max_duration_minutes,
              question_ids: r.question_ids,
            })),
            accessibility: editTarget.accessibility,
            monitoring_config: editTarget.monitoring_config,
          }}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            fetchAssessments();
          }}
        />
      )}

      {/* Clone — Workspace Selector */}
      <Modal
        isOpen={showCloneWorkspace}
        onClose={() => setShowCloneWorkspace(false)}
        title="Clone Assessment"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCloneWorkspace(false)}>
              Cancel
            </Button>
            <Button
              leftIcon={<IconClone size={15} />}
              onClick={handleCloneConfirm}
              disabled={!cloneTargetWorkspaceId}
            >
              Clone
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Clone <strong>{selected?.name}</strong> into the selected workspace. A new assessment
            with all rounds and question selections will be created.
          </p>
          <Select
            label="Target Workspace"
            value={cloneTargetWorkspaceId}
            onChange={setCloneTargetWorkspaceId}
            options={(isSuperAdmin ? allWorkspaces : (user?.workspaces ?? [])).map((ws) => ({
              value: ws.id,
              label: ws.name,
            }))}
            showRequired
          />
        </div>
      </Modal>

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

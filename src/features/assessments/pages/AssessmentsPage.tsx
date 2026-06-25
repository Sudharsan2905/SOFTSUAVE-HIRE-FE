import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import styles from "./AssessmentsPage.module.css";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { FilterBar, TabOption } from "@/components/shared/FilterBar";
import {
  IconPlus,
  IconAssessment,
  IconCopy,
  IconMail,
  IconWhatsApp,
  IconWorkspace,
  IconUsers,
  IconRectangleList,
  IconCheckCircle,
  IconShield,
  IconMonitor,
} from "@/assets/icons";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { Assessment, PaginationMeta, ViewMode, SortOrder, UserRole } from "@/types";
import { generateShareUrl, copyToClipboard } from "@/utils/helpers";
import toast from "react-hot-toast";
import { API_ENDPOINTS } from "@/constants/api";
import { ASSESSMENT_SUCCESS, ASSESSMENT_ERRORS } from "@/features/assessments/constants";
import type { AssessmentDraft } from "@/features/assessments/types";
import { CreateAssessmentWizard } from "../components/CreateWizard/WizardContainer";
import { AssessmentCard } from "../components/AssessmentCard";
import { useAppSelector } from "@/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentStats {
  total: number;
  monitoring: number;
  standard: number;
  submissions_30d: number;
  avg_completion: number;
}

const STATS_DEFAULT: AssessmentStats = {
  total: 0,
  monitoring: 0,
  standard: 0,
  submissions_30d: 0,
  avg_completion: 0,
};

// ─── Counter animation hook ───────────────────────────────────────────────────

function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef(0);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const from = currentRef.current;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      startTime ??= timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / 1000, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      currentRef.current = next;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_FIELD_OPTIONS = [
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "name", label: "Name" },
];

const COMPLETION_CIRCUMFERENCE = 138.2; // 2 * π * r22

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoWorkspaceState({ isSuperAdmin }: { readonly isSuperAdmin: boolean }) {
  return (
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
  );
}

interface ListContentProps {
  isLoading: boolean;
  assessments: Assessment[];
  viewMode: ViewMode;
  workspaceId: string;
  meta: PaginationMeta | null;
  pageSize: number;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onCreateClick: () => void;
  onEdit: (a: Assessment) => void;
  onClone: (a: Assessment) => void;
  onDeleteRequest: (a: Assessment) => void;
}

function AssessmentListContent({
  isLoading,
  assessments,
  viewMode,
  workspaceId,
  meta,
  pageSize,
  onGoToPage,
  onPageSizeChange,
  onCreateClick,
  onEdit,
  onClone,
  onDeleteRequest,
}: Readonly<ListContentProps>) {
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (assessments.length === 0) {
    return (
      <div className={styles.empty}>
        <IconAssessment size={48} color="var(--text-tertiary)" />
        <p>No assessments yet</p>
        <Button leftIcon={<IconPlus size={15} />} onClick={onCreateClick}>
          Create Assessment
        </Button>
      </div>
    );
  }
  return (
    <>
      <div className={viewMode === "grid" ? styles.grid : styles.list}>
        {assessments.map((a) => (
          <AssessmentCard
            key={a.id}
            assessment={a}
            workspaceId={workspaceId}
            viewMode={viewMode}
            onEdit={onEdit}
            onClone={onClone}
            onDelete={onDeleteRequest}
          />
        ))}
      </div>
      {meta && (
        <Pagination
          meta={meta}
          onPageChange={onGoToPage}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { activeWorkspace, workspaces: allWorkspaces } = useAppSelector((s) => s.workspace);
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  // ── List state ──────────────────────────────────────────────────────────────
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // ── Stats + filter tab ──────────────────────────────────────────────────────
  const [stats, setStats] = useState<AssessmentStats>(STATS_DEFAULT);
  const [accessibilityFilter, setAccessibilityFilter] = useState<"" | "monitoring" | "normal">("");

  // ── Wizard / modals ─────────────────────────────────────────────────────────
  const [showWizard, setShowWizard] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<Partial<AssessmentDraft> | null>(null);
  const [cloneWorkspaces, setCloneWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Assessment | null>(null);
  const [shareStep, setShareStep] = useState<"question" | "expirable" | "ready">("question");
  const [shareUrl, setShareUrl] = useState("");
  const [shareExpireFrom, setShareExpireFrom] = useState("");
  const [shareExpireTo, setShareExpireTo] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  // ── Counter animations ──────────────────────────────────────────────────────
  const animTotal = useCountUp(stats.total);
  const animMonitoring = useCountUp(stats.monitoring);
  const animSubmissions = useCountUp(stats.submissions_30d);
  const animCompletion = useCountUp(stats.avg_completion);

  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { data } = await api.get(API_ENDPOINTS.ASSESSMENTS.STATS(workspaceId));
      setStats(data.data ?? STATS_DEFAULT);
    } catch {
      // stats are decorative — fail silently
    }
  }, [workspaceId]);

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
        ...(accessibilityFilter && { accessibility: accessibilityFilter }),
      });
      const { data } = await api.get(`${API_ENDPOINTS.ASSESSMENTS.ROOT(workspaceId)}?${params}`);
      setAssessments(data.data?.assessments || []);
      setMeta(data.data?.pagination || null);
    } catch {
      toast.error(ASSESSMENT_ERRORS.LOAD_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, pageSize, sortBy, sortOrder, debouncedSearch, accessibilityFilter]);

  // ── Wizard handlers ──────────────────────────────────────────────────────────

  const handleWizardClose = useCallback(() => {
    setShowWizard(false);
    setWizardPrefill(null);
    setCloneWorkspaces([]);
  }, []);

  const handleWizardSuccess = useCallback(() => {
    setShowWizard(false);
    setWizardPrefill(null);
    setCloneWorkspaces([]);
    fetchAssessments();
    fetchStats();
  }, [fetchAssessments, fetchStats]);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);
  useEffect(() => {
    reset();
  }, [debouncedSearch, sortBy, sortOrder, accessibilityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleEditClick = (a: Assessment) => {
    setEditTarget(a);
  };

  const handleCloneClick = (a: Assessment) => {
    const workspaces = isSuperAdmin ? allWorkspaces : (user?.workspaces ?? []);
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
    setCloneWorkspaces(workspaces);
    setShowWizard(true);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.delete(API_ENDPOINTS.ASSESSMENTS.BY_ID(workspaceId!, selected.id));
      toast.success(ASSESSMENT_SUCCESS.DELETED);
      setShowDelete(false);
      fetchAssessments();
      fetchStats();
    } catch {
      toast.error(ASSESSMENT_ERRORS.DELETE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (a: Assessment) => {
    setSelected(a);
    setShowDelete(true);
  };

  const handleGenerateExpirableLink = async () => {
    if (!selected || !workspaceId) return;
    const start = new Date(shareExpireFrom);
    const end = new Date(shareExpireTo);
    const now = new Date();
    if (start < new Date(now.getTime() - 60000)) {
      toast.error("Start time must be now or in the future.");
      return;
    }
    if (end <= start) {
      toast.error("End time must be after start time.");
      return;
    }
    setGeneratingLink(true);
    try {
      const { data } = await api.post(API_ENDPOINTS.ASSESSMENTS.SHARE_EXPIRABLE(workspaceId), {
        assessment_id: selected.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      setShareUrl(generateShareUrl(data.data.share_link));
      setShareStep("ready");
    } catch {
      toast.error(ASSESSMENT_ERRORS.LINK_CREATE_FAILED);
    } finally {
      setGeneratingLink(false);
    }
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const completionDash = `${(animCompletion / 100) * COMPLETION_CIRCUMFERENCE} ${COMPLETION_CIRCUMFERENCE}`;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.pageWrapper}>
      <Header
        title="Assessments"
        subtitle="Create and monitor AI-powered hiring assessments"
        actions={
          activeWorkspace ? (
            <Button
              leftIcon={<IconPlus size={16} />}
              onClick={() => {
                setWizardPrefill(null);
                setShowWizard(true);
              }}
              style={{ background: "linear-gradient(135deg, rgb(255, 107, 44) 0%, rgb(255, 138, 74) 100%)", border: "none" }}
            >
              Create Assessment
            </Button>
          ) : undefined
        }
      />

      {activeWorkspace ? (
        <>
          {/* ── Analytics Stats ─────────────────────────────────────────── */}
          <div className={styles.statsGrid}>
            {/* Total Assessments */}
            <div className={styles.statCard}>
              <div className={styles.statCardTop}>
                <div
                  className={styles.statCardIcon}
                  style={{ background: "rgba(108,99,255,0.09)", color: "var(--primary-600)" }}
                >
                  <IconRectangleList size={22} />
                </div>
                <span className={styles.statCardValue}>{animTotal}</span>
              </div>
              <div className={styles.statCardBottom}>
                <span className={styles.statCardLabel}>Total Assessments</span>
              </div>
            </div>

            {/* Active Right Now */}
            <div className={styles.statCard}>
              <div className={styles.statCardTop}>
                <div
                  className={styles.statCardIcon}
                  style={{ background: "rgba(22,199,132,0.1)", color: "#0b7a52" }}
                >
                  <IconCheckCircle size={22} />
                </div>
                <span className={styles.statCardValue}>{animMonitoring}</span>
              </div>
              <div className={styles.statCardBottom}>
                <span className={styles.statCardLabel}>Active Right Now</span>
                <span className={styles.statCardLiveBadge}>Live</span>
              </div>
            </div>

            {/* Submissions (30d) */}
            <div className={styles.statCard}>
              <div className={styles.statCardTop}>
                <div
                  className={styles.statCardIcon}
                  style={{ background: "rgba(255,107,44,0.09)", color: "#cc4f15" }}
                >
                  <IconUsers size={22} />
                </div>
                <span className={styles.statCardValue}>{animSubmissions}</span>
              </div>
              <div className={styles.statCardBottom}>
                <span className={styles.statCardLabel}>Submissions (30d)</span>
              </div>
            </div>

            {/* Avg. Completion */}
            <div className={styles.statCard}>
              <div className={styles.statCardTop}>
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 56 56"
                  style={{ flexShrink: 0, marginLeft: -2 }}
                >
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="var(--border-default)"
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="var(--primary-600)"
                    strokeWidth="3.5"
                    strokeDasharray={completionDash}
                    strokeLinecap="round"
                    transform="rotate(-90 28 28)"
                    style={{ transition: "stroke-dasharray 0.4s ease" }}
                  />
                </svg>
                <span className={styles.statCardValue}>{animCompletion}%</span>
              </div>
              <div className={styles.statCardBottom}>
                <span className={styles.statCardLabel}>Avg. Completion</span>
              </div>
            </div>
          </div>

          {/* ── Section Wrapper: filter header + cards ──────────────────── */}
          <div className={styles.sectionWrapper}>
            {/* Section Header — FilterBar owns tabs + controls */}
            <div className={styles.sectionHeader}>
              <FilterBar
                compact
                tabs={
                  [
                    {
                      value: "",
                      label: "All",
                      count: stats.total,
                      icon: <IconRectangleList size={14} />,
                    },
                    {
                      value: "monitoring",
                      label: "Monitoring",
                      count: stats.monitoring,
                      icon: <IconShield size={14} />,
                    },
                    {
                      value: "normal",
                      label: "Standard",
                      count: stats.standard,
                      icon: <IconMonitor size={14} />,
                    },
                  ] satisfies TabOption[]
                }
                activeTab={accessibilityFilter}
                onTabChange={(v) => setAccessibilityFilter(v as "" | "monitoring" | "normal")}
                search={search}
                onSearchChange={setSearch}
                sortByOptions={SORT_FIELD_OPTIONS}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onRefresh={fetchAssessments}
              />
            </div>

            {/* Cards */}
            <div className={styles.cardsContainer}>
              <AssessmentListContent
                isLoading={isLoading}
                assessments={assessments}
                viewMode={viewMode}
                workspaceId={workspaceId!}
                meta={meta}
                pageSize={pageSize}
                onGoToPage={goToPage}
                onPageSizeChange={changePageSize}
                onCreateClick={() => {
                  setWizardPrefill(null);
                  setShowWizard(true);
                }}
                onEdit={handleEditClick}
                onClone={handleCloneClick}
                onDeleteRequest={handleDeleteRequest}
              />
            </div>
          </div>
        </>
      ) : (
        <NoWorkspaceState isSuperAdmin={isSuperAdmin} />
      )}

      {/* ── Create / Clone Wizard ──────────────────────────────────────── */}
      {showWizard && workspaceId && (
        <CreateAssessmentWizard
          workspaceId={workspaceId}
          availableWorkspaces={wizardPrefill ? cloneWorkspaces : undefined}
          onClose={handleWizardClose}
          onSuccess={handleWizardSuccess}
          initialData={wizardPrefill || undefined}
        />
      )}

      {/* ── Edit Wizard ─────────────────────────────────────────────────── */}
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
            expected_candidates: editTarget.expected_candidates,
          }}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            fetchAssessments();
            fetchStats();
          }}
        />
      )}

      {/* ── Share Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title={shareStep === "expirable" ? "Set Expiry Window" : "Share Assessment"}
        size="md"
      >
        {shareStep === "question" && (
          <div className={styles.shareQuestion}>
            <p className={styles.shareQuestionTitle}>Should this share link have an expiry?</p>
            <div className={styles.shareOptionBtns}>
              <button
                className={styles.shareOptionBtn}
                onClick={() => {
                  if (selected) setShareUrl(generateShareUrl(selected.share_link));
                  setShareStep("ready");
                }}
              >
                <p className={styles.shareOptionBtnTitle}>No — Use Permanent Link</p>
                <p className={styles.shareOptionBtnDesc}>Generate a link that never expires</p>
              </button>
              <button
                className={styles.shareOptionBtn}
                onClick={() => {
                  setShareExpireFrom("");
                  setShareExpireTo("");
                  setShareStep("expirable");
                }}
              >
                <p className={styles.shareOptionBtnTitle}>Yes — Set Expiry</p>
                <p className={styles.shareOptionBtnDesc}>
                  Restrict access to a specific date and time window
                </p>
              </button>
            </div>
          </div>
        )}

        {shareStep === "expirable" && (
          <div className={styles.shareExpireForm}>
            <button className={styles.shareBackLink} onClick={() => setShareStep("question")}>
              ← Back
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label
                htmlFor="share-from"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
              >
                From Date &amp; Time
              </label>
              <input
                id="share-from"
                type="datetime-local"
                value={shareExpireFrom}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setShareExpireFrom(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--border-default)",
                  fontSize: 13,
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label
                htmlFor="share-to"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
              >
                To Date &amp; Time
              </label>
              <input
                id="share-to"
                type="datetime-local"
                value={shareExpireTo}
                min={
                  shareExpireFrom
                    ? new Date(new Date(shareExpireFrom).getTime() + 60000)
                        .toISOString()
                        .slice(0, 16)
                    : new Date().toISOString().slice(0, 16)
                }
                onChange={(e) => setShareExpireTo(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--border-default)",
                  fontSize: 13,
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <Button
              isLoading={generatingLink}
              disabled={!shareExpireFrom || !shareExpireTo || generatingLink}
              onClick={handleGenerateExpirableLink}
            >
              Generate Link
            </Button>
          </div>
        )}

        {shareStep === "ready" && (
          <>
            <div className={styles.shareCards}>
              <button
                className={styles.shareCard}
                onClick={() => {
                  copyToClipboard(shareUrl).then(() =>
                    toast.success(ASSESSMENT_SUCCESS.LINK_COPIED)
                  );
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
            <button
              className={styles.shareBackLink}
              style={{ marginTop: 12 }}
              onClick={() => {
                setShareStep("question");
                setShareUrl("");
              }}
            >
              ← Generate Different Link
            </button>
          </>
        )}
      </Modal>

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
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

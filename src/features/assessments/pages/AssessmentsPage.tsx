import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import styles from "./AssessmentsPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconPlus,
  IconAssessment,
  IconCopy,
  IconMail,
  IconWhatsApp,
  IconWorkspace,
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

const SORT_OPTIONS = [
  { value: "created_at", label: "Created Date" },
  { value: "updated_at", label: "Updated Date" },
  { value: "name", label: "Name" },
];

export default function AssessmentsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { activeWorkspace, workspaces: allWorkspaces } = useAppSelector((s) => s.workspace);
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

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
  const [cloneWorkspaces, setCloneWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Assessment | null>(null);
  const [shareStep, setShareStep] = useState<"question" | "expirable" | "ready">("question");
  const [shareUrl, setShareUrl] = useState("");
  const [shareExpireFrom, setShareExpireFrom] = useState("");
  const [shareExpireTo, setShareExpireTo] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
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
      const { data } = await api.get(`${API_ENDPOINTS.ASSESSMENTS.ROOT(workspaceId)}?${params}`);
      setAssessments(data.data?.assessments || []);
      setMeta(data.data?.pagination || null);
    } catch {
      toast.error(ASSESSMENT_ERRORS.LOAD_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, page, pageSize, sortBy, sortOrder, debouncedSearch]);

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
  }, [fetchAssessments]);

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
    } catch {
      toast.error(ASSESSMENT_ERRORS.DELETE_FAILED);
    } finally {
      setSaving(false);
    }
  };

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
            <AssessmentCard
              key={a.id}
              assessment={a}
              workspaceId={workspaceId!}
              viewMode={viewMode}
              onEdit={handleEditClick}
              onClone={handleCloneClick}
              onDelete={(assessment) => {
                setSelected(assessment);
                setShowDelete(true);
              }}
            />
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
      {showWizard && workspaceId && (
        <CreateAssessmentWizard
          workspaceId={workspaceId}
          availableWorkspaces={wizardPrefill ? cloneWorkspaces : undefined}
          onClose={handleWizardClose}
          onSuccess={handleWizardSuccess}
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

      {/* Share Modal */}
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
              onClick={async () => {
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
                  const { data } = await api.post(
                    API_ENDPOINTS.ASSESSMENTS.SHARE_EXPIRABLE(workspaceId),
                    {
                      assessment_id: selected.id,
                      start_time: start.toISOString(),
                      end_time: end.toISOString(),
                    }
                  );
                  setShareUrl(generateShareUrl(data.data.share_link));
                  setShareStep("ready");
                } catch {
                  toast.error(ASSESSMENT_ERRORS.LINK_CREATE_FAILED);
                } finally {
                  setGeneratingLink(false);
                }
              }}
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

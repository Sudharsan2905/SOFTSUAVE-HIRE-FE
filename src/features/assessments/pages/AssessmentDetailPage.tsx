import React, { useState, useEffect, useCallback } from "react";
import writeXlsxFile from "write-excel-file/browser";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./AssessmentDetailPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { IconDownload, IconChevronLeft, IconCircleInfo, IconShare } from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import type { DateRange } from "@/components/datetime/DateRangePicker";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { Assessment, Submission, PaginationMeta, SortOrder } from "@/types";
import { SUBMISSION_STATUS_OPTIONS } from "@/constants/app";
import { getStatusColor, getStatusLabel } from "@/constants/statusColors";
import { ShareWizardModal } from "@/features/assessments/components/ShareWizard/ShareWizardModal";
import {
  formatDateTime,
  getAvatarColor,
  getInitials,
  getFullName,
  percentageBadgeColor,
} from "@/utils/helpers";
import toast from "react-hot-toast";

const SORT_OPTIONS = [
  { value: "started_at", label: "Started Time" },
  { value: "candidate_name", label: "Name" },
  { value: "candidate_email", label: "Email" },
];

const REACCESS_CATEGORY_OPTIONS = [
  { value: "poor_network", label: "Poor Network" },
  { value: "candidate_request", label: "Candidate Request" },
  { value: "technical_issue", label: "Technical Issue" },
  { value: "other", label: "Other" },
];

interface SubmissionWithCandidate extends Omit<Submission, "candidate"> {
  candidate?: { first_name?: string; last_name?: string; email?: string; id?: string };
  score_percentage?: number;
}

type ExportRow = {
  name: string;
  email: string;
  phone: string;
  percentage: number;
  rounds_count: number;
  completed_at: string;
};

export default function AssessmentDetailPage() {
  const { workspaceId, id } = useParams<{ workspaceId: string; id: string }>();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionWithCandidate[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentName, setAssessmentName] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("started_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [status, setStatus] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);
  const [terminating, setTerminating] = useState<string | null>(null);
  const [forceCompleting, setForceCompleting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  // Re-access modal state
  const [reaccessModal, setReaccessModal] = useState<{
    submissionId: string;
    candidateId: string;
  } | null>(null);
  const [reaccessReason, setReaccessReason] = useState("");
  const [reaccessCategory, setReaccessCategory] = useState("other");
  const [reaccessSubmitting, setReaccessSubmitting] = useState(false);

  // Fetch the full assessment once (needed by the schedule/share wizard)
  useEffect(() => {
    if (!workspaceId || !id) return;
    api
      .get(`/api/workspaces/${workspaceId}/assessments/${id}`)
      .then(({ data }) => setAssessment(data.data ?? null))
      .catch(() => {
        /* non-critical — share button stays disabled */
      });
  }, [workspaceId, id]);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(status && { status }),
        ...(dateRange.from && { from_date: dateRange.from }),
        ...(dateRange.to && { to_date: dateRange.to }),
      });
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/assessments/${id}/submissions?${params}`
      );
      setSubmissions(data.data?.submissions || []);
      setMeta(data.data?.pagination || null);
      if (data.data?.assessment_name) setAssessmentName(data.data.assessment_name);
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  }, [id, workspaceId, page, pageSize, sortBy, sortOrder, debouncedSearch, status, dateRange]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);
  useEffect(() => {
    reset();
  }, [debouncedSearch, sortBy, sortOrder, status, dateRange]);

  const handleResume = async (submissionId: string) => {
    setResuming(submissionId);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/assessments/${id}/submissions/${submissionId}/resume`
      );
      toast.success("Interview resumed — candidate can continue.");
      void fetchSubmissions();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to resume interview");
    } finally {
      setResuming(null);
    }
  };

  const handleTerminate = async (submissionId: string) => {
    setTerminating(submissionId);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/assessments/${id}/submissions/${submissionId}/terminate`,
        { reason: "Terminated by admin" }
      );
      toast.success("Submission terminated.");
      void fetchSubmissions();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to terminate submission");
    } finally {
      setTerminating(null);
    }
  };

  const handleForceComplete = async (submissionId: string) => {
    setForceCompleting(submissionId);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/assessments/${id}/submissions/${submissionId}/complete`
      );
      toast.success("Submission force-completed.");
      void fetchSubmissions();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to force complete submission");
    } finally {
      setForceCompleting(null);
    }
  };

  const openReaccessModal = (submissionId: string, candidateId: string) => {
    setReaccessReason("");
    setReaccessCategory("other");
    setReaccessModal({ submissionId, candidateId });
  };

  const handleReaccess = async () => {
    if (!reaccessModal) return;
    if (!reaccessReason.trim()) {
      toast.error("Please provide a reason for re-access.");
      return;
    }
    setReaccessSubmitting(true);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/assessments/${id}/submissions/${reaccessModal.submissionId}/reaccess`,
        { reason: reaccessReason.trim(), reason_category: reaccessCategory }
      );
      toast.success("Re-access granted.");
      setReaccessModal(null);
      void fetchSubmissions();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to grant re-access");
    } finally {
      setReaccessSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get(
        `/api/workspaces/${workspaceId}/assessments/${id}/submissions/export`
      );
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return Number.isNaN(date.getTime()) ? "Invalid Date" : formatDateTime(dateStr);
      };
      const rows: ExportRow[] = data.data ?? data;
      await writeXlsxFile<ExportRow>(rows, {
        columns: [
          { header: "Name", cell: (r: ExportRow) => r.name },
          { header: "Email", cell: (r: ExportRow) => r.email },
          { header: "Phone", cell: (r: ExportRow) => r.phone },
          { header: "Score (%)", cell: (r: ExportRow) => r.percentage },
          { header: "Rounds", cell: (r: ExportRow) => r.rounds_count },
          { header: "Completed At", cell: (r: ExportRow) => formatDate(r.completed_at) },
        ],
      }).toFile(`${assessmentName || "assessment"}_submissions.xlsx`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Spinner size="lg" />
      </div>
    );
  } else if (submissions.length === 0) {
    content = (
      <div className={styles.empty}>
        <p>No submissions yet</p>
        <span style={{ fontSize: 12 }}>
          Candidates will appear here once they start the assessment
        </span>
      </div>
    );
  } else {
    content = (
      <>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Status</th>
                <th>Score</th>
                <th>Round</th>
                <th>Started</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const name = sub.candidate
                  ? getFullName(sub.candidate as { first_name: string; last_name?: string })
                  : "Unknown";
                const pct = sub.score_percentage;
                const candidateId = sub.candidate?.id ?? "";
                const subStatus = sub.status;
                // Use centralized status colors
                const statusConfig = getStatusColor(subStatus);
                void statusConfig; // available for future inline use
                void getStatusLabel; // imported for potential future use

                return (
                  <tr key={sub.id}>
                    <td>
                      <div className={styles.candidateCell}>
                        <div className={styles.avatar} style={{ background: getAvatarColor(name) }}>
                          {getInitials(name)}
                        </div>
                        <div>
                          <p className={styles.candidateName}>{name}</p>
                          <p className={styles.candidateEmail}>{sub.candidate?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={sub.status} />
                    </td>
                    <td>
                      {pct !== undefined && pct !== null ? (
                        <Badge variant={percentageBadgeColor(pct)}>{pct.toFixed(1)}%</Badge>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Round {sub.current_round}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                      {formatDateTime(sub.started_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                        {/* on_hold: Resume + Terminate */}
                        {subStatus === "on_hold" && (
                          <>
                            <Tooltip content="Resume Interview" placement="top">
                              <button
                                className={`${styles.actionBtn} ${styles.resume}`}
                                onClick={() => void handleResume(sub.id)}
                                aria-label="Resume interview"
                                disabled={resuming === sub.id}
                              >
                                {resuming === sub.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <span style={{ fontSize: 14 }}>▶</span>
                                )}
                              </button>
                            </Tooltip>
                            <Tooltip content="Terminate" placement="top">
                              <button
                                className={`${styles.actionBtn} ${styles.danger}`}
                                onClick={() => void handleTerminate(sub.id)}
                                aria-label="Terminate submission"
                                disabled={terminating === sub.id}
                              >
                                {terminating === sub.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <span style={{ fontSize: 14 }}>✕</span>
                                )}
                              </button>
                            </Tooltip>
                          </>
                        )}

                        {/* in_progress: Terminate + Force Complete */}
                        {subStatus === "in_progress" && (
                          <>
                            <Tooltip content="Terminate" placement="top">
                              <button
                                className={`${styles.actionBtn} ${styles.danger}`}
                                onClick={() => void handleTerminate(sub.id)}
                                aria-label="Terminate submission"
                                disabled={terminating === sub.id}
                              >
                                {terminating === sub.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <span style={{ fontSize: 14 }}>✕</span>
                                )}
                              </button>
                            </Tooltip>
                            <Tooltip content="Force Complete" placement="top">
                              <button
                                className={`${styles.actionBtn} ${styles.success}`}
                                onClick={() => void handleForceComplete(sub.id)}
                                aria-label="Force complete submission"
                                disabled={forceCompleting === sub.id}
                              >
                                {forceCompleting === sub.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <span style={{ fontSize: 14 }}>✔</span>
                                )}
                              </button>
                            </Tooltip>
                          </>
                        )}

                        {/* malpractice: Re-access */}
                        {subStatus === "malpractice" && (
                          <Tooltip content="Re-access" placement="top">
                            <button
                              className={`${styles.actionBtn} ${styles.reaccess}`}
                              onClick={() => openReaccessModal(sub.id, candidateId)}
                              aria-label="Grant re-access"
                            >
                              <span style={{ fontSize: 13 }}>↺</span>
                            </button>
                          </Tooltip>
                        )}

                        {/* terminated: Re-access */}
                        {subStatus === "terminated" && (
                          <Tooltip content="Re-access" placement="top">
                            <button
                              className={`${styles.actionBtn} ${styles.reaccess}`}
                              onClick={() => openReaccessModal(sub.id, candidateId)}
                              aria-label="Grant re-access"
                            >
                              <span style={{ fontSize: 13 }}>↺</span>
                            </button>
                          </Tooltip>
                        )}

                        {/* All statuses: Candidate Details */}
                        <Tooltip content="Candidate Details" placement="top">
                          <button
                            className={`${styles.actionBtn} ${styles.viewDetails}`}
                            onClick={() =>
                              navigate(
                                `/workspaces/${workspaceId}/assessments/${id}/candidates/${candidateId}`
                              )
                            }
                            aria-label="View candidate details"
                          >
                            <IconCircleInfo size={20} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        title={assessmentName || "Assessment"}
        subtitle={`${meta?.total ?? 0} submissions`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="secondary"
              leftIcon={<IconDownload size={16} />}
              onClick={handleExport}
              isLoading={exporting}
            >
              Export
            </Button>
            <Button
              leftIcon={<IconShare size={14} />}
              onClick={() => setShowSchedule(true)}
              disabled={!assessment}
            >
              Share
            </Button>
          </div>
        }
      />

      <button
        onClick={() => navigate(`/workspaces/${workspaceId}/assessments`)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--text-secondary)",
          fontSize: 13,
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        <IconChevronLeft size={14} /> Back to Assessments
      </button>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortByOptions={SORT_OPTIONS}
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        status={status}
        onStatusChange={setStatus}
        statusOptions={SUBMISSION_STATUS_OPTIONS}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        dateRangePlaceholder="Started date"
        onRefresh={fetchSubmissions}
      />

      {content}

      {showSchedule && assessment && (
        <ShareWizardModal
          isOpen={showSchedule}
          onClose={() => setShowSchedule(false)}
          assessment={{
            id: assessment.id,
            name: assessment.name,
            share_link: assessment.share_link,
            workspace_id: workspaceId!,
          }}
        />
      )}

      {/* Re-access Modal */}
      <Modal
        isOpen={reaccessModal !== null}
        onClose={() => setReaccessModal(null)}
        title="Grant Re-access"
        size="sm"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={() => setReaccessModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleReaccess()} isLoading={reaccessSubmitting}>
              Confirm Re-access
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              htmlFor="reaccess-category"
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}
            >
              Reason Category
            </label>
            <select
              id="reaccess-category"
              value={reaccessCategory}
              onChange={(e) => setReaccessCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
              }}
            >
              {REACCESS_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="reaccess-reason"
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}
            >
              Reason <span style={{ color: "var(--color-error-500)" }}>*</span>
            </label>
            <textarea
              id="reaccess-reason"
              value={reaccessReason}
              onChange={(e) => setReaccessReason(e.target.value)}
              placeholder="Describe why re-access is being granted..."
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

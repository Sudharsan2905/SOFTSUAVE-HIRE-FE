import React, { useState, useEffect, useCallback } from "react";
import writeXlsxFile from "write-excel-file/browser";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./AssessmentDetailPage.module.css";
import { Header } from "@/components/layout/Header";
import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { IconDownload, IconEye, IconRefresh, IconChevronLeft } from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import type { DateRange } from "@/components/datetime/DateRangePicker";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { Submission, PaginationMeta, SortOrder } from "@/types";
import { SUBMISSION_STATUS_OPTIONS } from "@/constants/app";
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

interface SubmissionWithCandidate extends Omit<Submission, "candidate"> {
  candidate?: { first_name?: string; last_name?: string; email?: string };
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
  const [selected, setSelected] = useState<SubmissionWithCandidate | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [regranting, setRegranting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

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

  const handleReaccess = async (submissionId: string) => {
    setRegranting(submissionId);
    try {
      await api.post(
        `/api/workspaces/${workspaceId}/assessments/${id}/submissions/${submissionId}/reaccess`
      );
      toast.success("Access granted — candidate can re-enter the assessment");
      fetchSubmissions();
    } catch {
      toast.error("Failed to grant access");
    } finally {
      setRegranting(null);
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

  const openDetail = (sub: SubmissionWithCandidate) => {
    setSelected(sub);
    setShowDetail(true);
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const name = sub.candidate
                  ? getFullName(sub.candidate as { first_name: string; last_name?: string })
                  : "Unknown";
                const pct = sub.score_percentage;
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
                      <div style={{ display: "flex", gap: 6 }}>
                        <Tooltip content="View Details" placement="top">
                          <button
                            className={styles.actionBtn}
                            onClick={() => openDetail(sub)}
                            aria-label="View submission details"
                          >
                            <IconEye size={14} />
                          </button>
                        </Tooltip>
                        {(sub.status === "completed" || sub.status === "malpractice") && (
                          <Tooltip content="Grant Re-access" placement="top">
                            <button
                              className={`${styles.actionBtn} ${styles.reaccess}`}
                              onClick={() => handleReaccess(sub.id)}
                              aria-label="Grant re-access"
                              disabled={regranting === sub.id}
                            >
                              {regranting === sub.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <IconRefresh size={14} />
                              )}
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {meta && <Pagination meta={meta} onPageChange={goToPage} pageSize={pageSize} onPageSizeChange={changePageSize} />}
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
              leftIcon={<IconChevronLeft size={16} />}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              leftIcon={<IconDownload size={16} />}
              onClick={handleExport}
              isLoading={exporting}
            >
              Export
            </Button>
          </div>
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
        status={status}
        onStatusChange={setStatus}
        statusOptions={SUBMISSION_STATUS_OPTIONS}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        dateRangePlaceholder="Started date"
        onRefresh={fetchSubmissions}
      />

      {content}

      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title="Submission Details"
        size="lg"
      >
        {selected && (
          <div className={styles.detailContent}>
            <div className={styles.detailHeader}>
              <div
                className={styles.avatar}
                style={{
                  background: getAvatarColor(
                    selected.candidate
                      ? getFullName(
                          selected.candidate as { first_name: string; last_name?: string }
                        )
                      : ""
                  ),
                }}
              >
                {getInitials(
                  selected.candidate
                    ? getFullName(selected.candidate as { first_name: string; last_name?: string })
                    : "U"
                )}
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>
                  {selected.candidate
                    ? getFullName(selected.candidate as { first_name: string; last_name?: string })
                    : ""}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  {selected.candidate?.email}
                </p>
              </div>
              <StatusBadge status={selected.status} />
              {selected.score_percentage !== undefined && selected.score_percentage !== null && (
                <span style={{ marginLeft: "auto" }}>
                  <Badge variant={percentageBadgeColor(selected.score_percentage)}>
                    {selected.score_percentage.toFixed(1)}%
                  </Badge>
                </span>
              )}
            </div>

            {selected.malpractice_flags && selected.malpractice_flags.length > 0 && (
              <div className={styles.malpracticeBox}>
                <p style={{ fontWeight: 600, color: "var(--error-600)", marginBottom: 6 }}>
                  Malpractice Flags ({selected.malpractice_flags.length})
                </p>
                {selected.malpractice_flags.map((flag) => (
                  <div key={`${flag.type}-${flag.flagged_at}`} className={styles.flagItem}>
                    <span>{flag.type}</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                      {formatDateTime(flag.flagged_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selected.rounds?.map((round) => (
              <div key={round.round_number} className={styles.roundSection}>
                <h4
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 10,
                    color: "var(--text-secondary)",
                  }}
                >
                  Round {round.round_number}
                </h4>
                {Object.entries(round.answers ?? {}).map(([qId, answer]) => (
                  <div key={qId} className={styles.answerItem}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
                      Q: {qId}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      A: {Array.isArray(answer) ? answer.join(", ") : String(answer || "—")}
                    </p>
                  </div>
                ))}
              </div>
            ))}

            {selected.screenshots && selected.screenshots.length > 0 && (
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                  Screenshots ({selected.screenshots.length})
                </p>
                <div className={styles.screenshotGrid}>
                  {selected.screenshots.map((s, i) => (
                    <div key={s.taken_at}>
                      <div className={styles.screenshotBox}>Screenshot {i + 1}</div>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          textAlign: "center",
                          marginTop: 4,
                        }}
                      >
                        {formatDateTime(s.taken_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

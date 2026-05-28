import React, { useState, useEffect, useCallback } from "react";
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
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { Submission, PaginationMeta, SortOrder } from "@/types";
import {
  formatDateTime,
  getAvatarColor,
  getInitials,
  getFullName,
  percentageBadgeColor,
} from "@/utils/helpers";
import toast from "react-hot-toast";

interface SubmissionWithCandidate extends Submission {
  candidate?: { first_name?: string; last_name?: string; email?: string };
  score_percentage?: number;
}

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionWithCandidate[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentName, setAssessmentName] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selected, setSelected] = useState<SubmissionWithCandidate | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [regranting, setRegranting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { page, pageSize, goToPage, reset } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const { data } = await api.get(`/api/assessments/${id}/submissions?${params}`);
      setSubmissions(data.data?.submissions || []);
      setMeta(data.data?.pagination || null);
      if (data.data?.assessment_name) setAssessmentName(data.data.assessment_name);
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  }, [id, page, pageSize, sortOrder, debouncedSearch]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);
  useEffect(() => {
    reset();
  }, [debouncedSearch, sortOrder]);

  const handleReaccess = async (submissionId: string) => {
    setRegranting(submissionId);
    try {
      await api.post(`/api/assessments/submissions/${submissionId}/reaccess`);
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
      const res = await api.get(`/api/assessments/${id}/submissions/export`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${assessmentName || "assessment"}_submissions.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
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
        sortBy="submitted_at"
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
      />

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spinner size="lg" />
        </div>
      ) : submissions.length === 0 ? (
        <div className={styles.empty}>
          <p>No submissions yet</p>
          <span style={{ fontSize: 12 }}>
            Candidates will appear here once they start the assessment
          </span>
        </div>
      ) : (
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
                          <div
                            className={styles.avatar}
                            style={{ background: getAvatarColor(name) }}
                          >
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
                          <button
                            className={styles.actionBtn}
                            onClick={() => openDetail(sub)}
                            title="View Details"
                          >
                            <IconEye size={14} />
                          </button>
                          {(sub.status === "completed" || sub.status === "malpractice") && (
                            <button
                              className={`${styles.actionBtn} ${styles.reaccess}`}
                              onClick={() => handleReaccess(sub.id)}
                              title="Grant Re-access"
                              disabled={regranting === sub.id}
                            >
                              {regranting === sub.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <IconRefresh size={14} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && <Pagination meta={meta} onPageChange={goToPage} />}
        </>
      )}

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
                {selected.malpractice_flags.map((flag, i) => (
                  <div key={i} className={styles.flagItem}>
                    <span>{flag.type}</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                      {formatDateTime(flag.flagged_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selected.rounds &&
              selected.rounds.map((round, ri) => (
                <div key={ri} className={styles.roundSection}>
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
                  {round.answers &&
                    Object.entries(round.answers).map(([qId, answer]) => (
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
                    <div key={i}>
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

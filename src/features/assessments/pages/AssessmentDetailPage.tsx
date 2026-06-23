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
import { Select } from "@/components/ui/Select";
import { IconDownload, IconChevronLeft, IconCircleInfo, IconShare } from "@/assets/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import type { DateRange } from "@/components/datetime/DateRangePicker";
import { api } from "@/utils/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { Assessment, Submission, PaginationMeta, SortOrder } from "@/types";
import { SUBMISSION_STATUS_OPTIONS } from "@/constants/app";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { ASSESSMENT_ERRORS } from "@/features/assessments/constants";
import { ShareWizardModal } from "@/features/assessments/components/ShareWizard/ShareWizardModal";
import { formatDateTime, getAvatarColor, getInitials, getFullName } from "@/utils/helpers";
import toast from "react-hot-toast";

const SORT_OPTIONS = [
  { value: "started_at", label: "Started Time" },
  { value: "first_name", label: "Name" },
  { value: "email", label: "Email" },
];

interface SubmissionWithCandidate extends Omit<Submission, "candidate"> {
  candidate?: { first_name?: string; last_name?: string; email?: string; id?: string };
  score_percentage?: number;
}

type ExportRound = { round_number: number; percentage: number };

type ExportRow = {
  name: string;
  email: string;
  phone: string;
  percentage: number;
  rounds: ExportRound[];
  completed_at: string | null;
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
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  // Fetch the full assessment once (needed by the schedule/share wizard and max-rounds display)
  useEffect(() => {
    if (!workspaceId || !id) return;
    api
      .get(API_ENDPOINTS.ASSESSMENTS.BY_ID(workspaceId, id))
      .then(({ data }) => setAssessment(data.data ?? null))
      .catch(() => {
        /* non-critical */
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
        `${API_ENDPOINTS.ASSESSMENTS.SUBMISSIONS(workspaceId!, id!)}?${params}`
      );
      setSubmissions(data.data?.submissions || []);
      setMeta(data.data?.pagination || null);
      if (data.data?.assessment_name) setAssessmentName(data.data.assessment_name);
    } catch {
      toast.error(ASSESSMENT_ERRORS.SUBMISSIONS_LOAD_FAILED);
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

  const EXPORT_OPTIONS = [
    { value: "all", label: "Export All" },
    { value: "filtered", label: "Export With Filters" },
  ] as const;

  const handleExportSelect = (value: string) => {
    setExportType("");
    if (value === "all") handleExport(false);
    else if (value === "filtered") handleExport(true);
  };

  const handleExport = async (withFilters = false) => {
    setExporting(true);
    try {
      const baseUrl = API_ENDPOINTS.ASSESSMENTS.SUBMISSIONS_EXPORT(workspaceId!, id!);
      const url = withFilters
        ? (() => {
            const params = new URLSearchParams({
              sort_by: sortBy,
              sort_order: sortOrder,
              ...(debouncedSearch && { search: debouncedSearch }),
              ...(status && { status }),
              ...(dateRange.from && { from_date: dateRange.from }),
              ...(dateRange.to && { to_date: dateRange.to }),
            });
            return `${baseUrl}?${params}`;
          })()
        : baseUrl;
      const { data } = await api.get(url);
      const formatDate = (dateStr: string) => {
        if (!dateStr) return " - ";
        const date = new Date(dateStr);
        return Number.isNaN(date.getTime()) ? "Invalid Date" : formatDateTime(dateStr);
      };
      const rows: ExportRow[] = data.data ?? data;
      const maxRoundCount = Math.max(...rows.map((r) => r.rounds?.length ?? 0), 0);
      const roundColumns = Array.from({ length: maxRoundCount }, (_, i) => ({
        header: `Round ${i + 1} (%)`,
        cell: (r: ExportRow) => r.rounds?.[i]?.percentage ?? "",
      }));
      await writeXlsxFile<ExportRow>(rows, {
        columns: [
          { header: "Name", cell: (r: ExportRow) => r.name },
          { header: "Email", cell: (r: ExportRow) => r.email },
          { header: "Phone", cell: (r: ExportRow) => r.phone },
          { header: "Score (%)", cell: (r: ExportRow) => r.percentage },
          { header: "Rounds", cell: (r: ExportRow) => r.rounds?.length ?? 0 },
          ...roundColumns,
          { header: "Completed At", cell: (r: ExportRow) => formatDate(r.completed_at ?? "") },
        ],
      }).toFile(`${assessmentName || "assessment"}_submissions.xlsx`);
    } catch {
      toast.error(ASSESSMENT_ERRORS.EXPORT_FAILED);
    } finally {
      setExporting(false);
    }
  };

  const maxRounds = assessment?.rounds?.length ?? null;

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
                <th>Percentage</th>
                <th>Round</th>
                <th>Malpractice</th>
                <th>Started</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const name = sub.candidate
                  ? getFullName(sub.candidate as { first_name: string; last_name?: string })
                  : "Unknown";
                const pct = sub.percentage;
                const candidateId = sub.candidate?.id ?? "";
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
                      {pct === undefined || pct === null ? (
                        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>—</span>
                      ) : (
                        <Badge variant="default">{pct.toFixed(1)}%</Badge>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {sub.current_round}
                      {maxRounds === null ? "" : ` / ${maxRounds}`}
                    </td>
                    <td
                      style={{
                        fontSize: 13,
                        color:
                          (sub.malpractice_count ?? 0) > 0
                            ? "var(--color-error-600, #dc2626)"
                            : "var(--text-tertiary)",
                      }}
                    >
                      {sub.malpractice_count ?? 0} / 3
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                      {formatDateTime(sub.started_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                        <Tooltip content="Candidate Details" placement="top">
                          <button
                            className={`${styles.actionBtn} ${styles.viewDetails}`}
                            onClick={() =>
                              navigate(ROUTES.ADMIN.candidateDetail(workspaceId!, id!, candidateId))
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
            <Select
              value={exportType}
              onChange={handleExportSelect}
              options={EXPORT_OPTIONS}
              placeholder={exporting ? "Exporting…" : "Export as CSV"}
              leftIcon={exporting ? <Spinner size="sm" /> : <IconDownload size={16} />}
              fullWidth={false}
              hideArrow={true}
              disabled={exporting}
              style={{ minWidth: 145 }}
            />
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
        onClick={() => navigate(ROUTES.ADMIN.assessments(workspaceId!))}
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
    </div>
  );
}

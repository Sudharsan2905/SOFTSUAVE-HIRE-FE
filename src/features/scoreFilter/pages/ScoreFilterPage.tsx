import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import styles from "./ScoreFilterPage.module.css";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Pagination } from "@/components/ui/Pagination";
import { ResultBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconClose,
  IconSearch,
  IconTime,
  IconUsersGroup,
} from "@/assets/icons";
import { api, extractApiErrorMessage } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { SortOrder } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { clsx, getAvatarColor, getInitials } from "@/utils/helpers";
import {
  BREAKDOWN_STATE_LABELS,
  MAX_ASSESSMENTS,
  PASS_PERCENTAGE_DEBOUNCE_MS,
  PASS_PERCENTAGE_MAX,
  PASS_PERCENTAGE_MIN,
  RESULT_ALL,
  RESULT_INCOMPLETE,
  RESULT_JUDGED_OPTIONS,
  SCORE_FILTER_ERRORS,
} from "../constants";
import type {
  ScoreFilterData,
  ScoreFilterResultFilter,
  ScoreFilterRow,
  ScoreFilterSortBy,
} from "../types";

interface AssessmentOption {
  value: string;
  label: string;
}

/** `value` is null when the box is empty (no Pass/Fail yet) or invalid (`invalid` is set). */
function parsePassPercentage(raw: string): { value: number | null; invalid: boolean } {
  const text = raw.trim();
  if (text === "") return { value: null, invalid: false };
  const n = Number(text);
  if (!Number.isFinite(n) || n < PASS_PERCENTAGE_MIN || n > PASS_PERCENTAGE_MAX) {
    return { value: null, invalid: true };
  }
  return { value: n, invalid: false };
}

function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoreFilterPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  // ── Controls ────────────────────────────────────────────────────────────────
  const [assessmentOptions, setAssessmentOptions] = useState<AssessmentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [passInput, setPassInput] = useState("");
  const [resultFilter, setResultFilter] = useState<ScoreFilterResultFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<ScoreFilterSortBy>("combined_percentage");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // ── Results ─────────────────────────────────────────────────────────────────
  const [data, setData] = useState<ScoreFilterData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestId = useRef(0);

  const { page, pageSize, goToPage, reset, changePageSize } = usePagination();
  const debouncedSearch = useDebounce(search, 300);
  const debouncedPassInput = useDebounce(passInput, PASS_PERCENTAGE_DEBOUNCE_MS);

  const typedPass = parsePassPercentage(passInput); // immediate: drives the error message
  const appliedPass = parsePassPercentage(debouncedPassInput).value; // debounced: drives requests
  const hasPass = appliedPass !== null;

  // Passed / Failed only make sense once a percentage is applied.
  const needsPass = resultFilter === "passed" || resultFilter === "failed";
  const effectiveResult: ScoreFilterResultFilter = needsPass && !hasPass ? "all" : resultFilter;
  const resultOptions = hasPass
    ? [RESULT_ALL, ...RESULT_JUDGED_OPTIONS, RESULT_INCOMPLETE]
    : [RESULT_ALL, RESULT_INCOMPLETE];

  // ── Assessments for the picker ──────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setSelectedIds([]);
    setData(null);
    api
      .get(`${API_ENDPOINTS.ASSESSMENTS.ROOT(workspaceId)}?page=1&page_size=100`)
      .then(({ data: res }) => {
        if (cancelled) return;
        const list: { id: string; name: string }[] = res.data?.assessments ?? [];
        setAssessmentOptions(list.map((a) => ({ value: a.id, label: a.name })));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          toast.error(extractApiErrorMessage(err, SCORE_FILTER_ERRORS.ASSESSMENTS_LOAD_FAILED));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Clearing the percentage also clears a Passed / Failed choice.
  useEffect(() => {
    if (needsPass && !hasPass) setResultFilter("all");
  }, [needsPass, hasPass]);

  // Any filter change starts again from page 1.
  const selectionKey = selectedIds.join(",");
  useEffect(() => {
    reset();
  }, [selectionKey, appliedPass, effectiveResult, debouncedSearch, sortBy, sortOrder, reset]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchResults = useCallback(async () => {
    if (!workspaceId || selectedIds.length === 0) {
      setData(null);
      setIsLoading(false);
      return;
    }
    const id = ++requestId.current; // ignore responses that arrive out of order
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      selectedIds.forEach((a) => params.append("assessment_ids", a));
      if (appliedPass !== null) params.set("pass_percentage", String(appliedPass));
      if (effectiveResult !== "all") params.set("result", effectiveResult);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      const { data: res } = await api.get(
        `${API_ENDPOINTS.ASSESSMENTS.SCORE_FILTER(workspaceId)}?${params}`
      );
      if (id === requestId.current) setData(res.data);
    } catch (err: unknown) {
      if (id === requestId.current) {
        toast.error(extractApiErrorMessage(err, SCORE_FILTER_ERRORS.LOAD_FAILED));
      }
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [
    workspaceId,
    selectedIds,
    appliedPass,
    effectiveResult,
    debouncedSearch,
    sortBy,
    sortOrder,
    page,
    pageSize,
  ]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const assessmentNames = new Map(assessmentOptions.map((o) => [o.value, o.label]));

  const toggleSort = (field: ScoreFilterSortBy) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC));
    } else {
      setSortBy(field);
      setSortOrder(field === "name" ? SortOrder.ASC : SortOrder.DESC);
    }
  };

  const sortIndicator = (field: ScoreFilterSortBy) => {
    if (sortBy !== field) return null;
    return sortOrder === SortOrder.ASC ? (
      <IconChevronUp size={12} />
    ) : (
      <IconChevronDown size={12} />
    );
  };

  const renderRow = (row: ScoreFilterRow) => {
    const { candidate } = row;
    const total = data?.assessments.length ?? 0;
    return (
      <tr key={candidate.id}>
        <td>
          <div className={styles.candidateCell}>
            <div className={styles.avatar} style={{ background: getAvatarColor(candidate.name) }}>
              {getInitials(candidate.name)}
            </div>
            <div>
              <p className={styles.candidateName}>{candidate.name || "Unknown"}</p>
              <p className={styles.candidateEmail}>{candidate.email}</p>
            </div>
          </div>
        </td>
        <td>
          <ul className={styles.breakdown}>
            {row.breakdown.map((item) => {
              const done = item.status === "completed";
              const label = done
                ? formatPercentage(item.percentage)
                : (BREAKDOWN_STATE_LABELS[item.status] ?? item.status);
              return (
                <li
                  key={item.assessment_id}
                  className={clsx(styles.chip, done ? styles.chipDone : styles.chipOpen)}
                  title={done ? `${item.score} / ${item.total} correct` : undefined}
                >
                  <span className={styles.chipName}>
                    {assessmentNames.get(item.assessment_id) ?? "Assessment"}
                  </span>
                  <span className={styles.chipValue}>{label}</span>
                </li>
              );
            })}
          </ul>
        </td>
        <td className={styles.nowrap}>
          {row.completed_count} / {total}
        </td>
        <td className={styles.nowrap}>
          {row.combined_score === null ? "—" : `${row.combined_score} / ${row.combined_total}`}
        </td>
        <td className={clsx(styles.nowrap, styles.percentage)}>
          {formatPercentage(row.combined_percentage)}
        </td>
        <td>
          <ResultBadge result={row.result} />
        </td>
      </tr>
    );
  };

  // ── Content ─────────────────────────────────────────────────────────────────
  const hasActiveFilters = Boolean(debouncedSearch || effectiveResult !== "all");
  let content: React.ReactNode;
  if (selectedIds.length === 0) {
    content = (
      <div className={styles.empty}>
        <p>Select one or more assessments</p>
        <span>
          Pick up to {MAX_ASSESSMENTS} assessments to list their candidates, then enter a pass
          percentage to see who passed.
        </span>
      </div>
    );
  } else if (isLoading && !data) {
    content = (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  } else if (!data || data.candidates.length === 0) {
    content = (
      <div className={styles.empty}>
        <p>
          {hasActiveFilters
            ? "No candidates match the selected filters"
            : "No candidates have taken the selected assessments yet"}
        </p>
        {hasActiveFilters && <span>Try changing or clearing the filters</span>}
      </div>
    );
  } else {
    content = (
      <>
        <div className={clsx(styles.tableWrapper, isLoading && styles.refreshing)}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th aria-sort={sortBy === "name" ? sortAria(sortOrder) : "none"}>
                  <button
                    type="button"
                    className={styles.sortBtn}
                    onClick={() => toggleSort("name")}
                  >
                    Candidate {sortIndicator("name")}
                  </button>
                </th>
                <th>Assessments</th>
                <th>Completed</th>
                <th>Score</th>
                <th aria-sort={sortBy === "combined_percentage" ? sortAria(sortOrder) : "none"}>
                  <button
                    type="button"
                    className={styles.sortBtn}
                    onClick={() => toggleSort("combined_percentage")}
                  >
                    Combined % {sortIndicator("combined_percentage")}
                  </button>
                </th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>{data.candidates.map(renderRow)}</tbody>
          </table>
        </div>
        <Pagination
          meta={data.pagination}
          onPageChange={goToPage}
          pageSize={pageSize}
          onPageSizeChange={changePageSize}
        />
      </>
    );
  }

  const judged = data?.pass_percentage !== null && data?.pass_percentage !== undefined;
  const summary = data?.summary;

  return (
    <div>
      <Header
        title="Score Filter"
        subtitle="Combine assessments and judge candidates against one pass percentage"
      />

      <div className={styles.filters}>
        <MultiSelect
          label="Assessments"
          placeholder="Select assessments"
          options={assessmentOptions}
          value={selectedIds}
          onChange={setSelectedIds}
          maxSelected={MAX_ASSESSMENTS}
        />
        <Input
          label="Pass percentage"
          type="number"
          inputMode="decimal"
          min={PASS_PERCENTAGE_MIN}
          max={PASS_PERCENTAGE_MAX}
          step="any"
          placeholder="e.g. 60"
          value={passInput}
          onChange={(e) => setPassInput(e.target.value)}
          error={typedPass.invalid ? SCORE_FILTER_ERRORS.PASS_PERCENTAGE_RANGE : undefined}
          hint={typedPass.invalid ? undefined : "Leave empty to list everyone"}
          rightElement={<span className={styles.unit}>%</span>}
        />
        <Select
          label="Result"
          value={effectiveResult}
          onChange={(v) => setResultFilter(v as ScoreFilterResultFilter)}
          options={resultOptions}
          hint={hasPass ? undefined : "Enter a pass percentage to filter Passed / Failed"}
        />
        <Input
          label="Search"
          placeholder="Name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftElement={<IconSearch size={15} />}
          disabled={selectedIds.length === 0}
        />
      </div>

      {summary && selectedIds.length > 0 && (
        <div className={styles.statsStrip}>
          <div className={styles.statCard}>
            <div className={clsx(styles.statIcon, styles.iconTotal)}>
              <IconUsersGroup size={24} />
            </div>
            <div>
              <p className={styles.statLabel}>Candidates</p>
              <p className={styles.statValue}>{summary.total}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={clsx(styles.statIcon, styles.iconPassed)}>
              <IconCircleCheck size={24} />
            </div>
            <div>
              <p className={styles.statLabel}>Passed</p>
              <p className={styles.statValue}>{judged ? summary.passed : "—"}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={clsx(styles.statIcon, styles.iconFailed)}>
              <IconClose size={24} />
            </div>
            <div>
              <p className={styles.statLabel}>Failed</p>
              <p className={styles.statValue}>{judged ? summary.failed : "—"}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={clsx(styles.statIcon, styles.iconIncomplete)}>
              <IconTime size={24} />
            </div>
            <div>
              <p className={styles.statLabel}>Incomplete</p>
              <p className={styles.statValue}>{summary.incomplete}</p>
            </div>
          </div>
        </div>
      )}

      {content}
    </div>
  );
}

function sortAria(order: SortOrder): "ascending" | "descending" {
  return order === SortOrder.ASC ? "ascending" : "descending";
}

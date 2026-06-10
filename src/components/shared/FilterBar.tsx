import React from "react";
import styles from "./FilterBar.module.css";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  IconSearch,
  IconSortAsc,
  IconSortDesc,
  IconGrid,
  IconList,
  IconDownload,
  IconRefresh,
} from "@/assets/icons";
import { DateRangePicker, DateRange } from "@/components/datetime/DateRangePicker";
import { COMPLEXITY_OPTIONS, QUESTION_TYPE_OPTIONS } from "@/constants/app";
import type { ViewMode, SortOrder } from "@/types";

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  sortBy: string;
  onSortByChange?: (v: string) => void;
  sortByOptions?: { value: string; label: string }[];
  sortOrder: SortOrder;
  onSortOrderToggle: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  complexity?: string;
  onComplexityChange?: (v: string) => void;
  questionType?: string;
  onQuestionTypeChange?: (v: string) => void;
  status?: string;
  onStatusChange?: (v: string) => void;
  statusOptions?: readonly { value: string; label: string }[];
  onExport?: () => void;
  onRefresh?: () => void;
  showComplexity?: boolean;
  showQuestionType?: boolean;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  dateRangePlaceholder?: string;
  children?: React.ReactNode;
}

export function FilterBar({
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortByOptions,
  sortOrder,
  onSortOrderToggle,
  viewMode,
  onViewModeChange,
  complexity,
  onComplexityChange,
  questionType,
  onQuestionTypeChange,
  status,
  onStatusChange,
  statusOptions,
  onExport,
  onRefresh,
  showComplexity = false,
  showQuestionType = false,
  dateRange,
  onDateRangeChange,
  dateRangePlaceholder = "Date range",
  children,
}: Readonly<FilterBarProps>) {
  // Count active *filter* dropdown slots to choose the mobile layout condition.
  // The sort-by dropdown is intentionally excluded — it lives in the utilities
  // cluster (inline with the sort/view toggles), not in the filter grid.
  const dropdownCount = [
    showComplexity && onComplexityChange,
    showQuestionType && onQuestionTypeChange,
    statusOptions && onStatusChange,
    dateRange && onDateRangeChange,
  ].filter(Boolean).length;

  const singleDropdown = dropdownCount === 1;

  const hasFilterDrops = dropdownCount > 0 || children;

  return (
    <div className={styles.filterBar}>
      {/*
        searchRow — dissolves on desktop (display:contents), reinstates
        as Row 1 on mobile: [Refresh?] [Search — flex-1]
      */}
      <div className={styles.searchRow}>
        {onRefresh && (
          <Tooltip content="Refresh" placement="top">
            <button className={styles.refreshBtn} onClick={onRefresh} aria-label="Refresh">
              <IconRefresh size={16} />
            </button>
          </Tooltip>
        )}
        <div className={styles.searchWrap}>
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            leftElement={<IconSearch size={15} />}
            fullWidth
          />
        </div>
      </div>

      {/*
        midSection — dissolves on desktop so all its descendants join the
        flat flex row. On mobile it reinstates as the layout container:

          CONDITION A (.midMulti) — multiple dropdowns:
            flex-col → sub-Row 2: 2-col grid | sub-Row 3: utilities

          CONDITION B (.midSingle) — single dropdown:
            flex-row → [dropdown flex-1] [utilities]  (one combined row)
      */}
      <div
        className={`${styles.midSection} ${singleDropdown ? styles.midSingle : styles.midMulti}`}
      >
        {hasFilterDrops && (
          <div className={styles.filterDrops}>
            {showComplexity && onComplexityChange && (
              <div className={styles.filterSelect}>
                <Select
                  options={COMPLEXITY_OPTIONS}
                  placeholder="Complexity"
                  value={complexity}
                  onChange={onComplexityChange}
                  fullWidth
                />
              </div>
            )}
            {showQuestionType && onQuestionTypeChange && (
              <div className={styles.filterSelect}>
                <Select
                  options={QUESTION_TYPE_OPTIONS}
                  placeholder="Question Type"
                  value={questionType}
                  onChange={onQuestionTypeChange}
                  fullWidth
                />
              </div>
            )}
            {statusOptions && onStatusChange && (
              <div className={styles.filterSelect}>
                <Select
                  options={[{ value: "", label: "All Statuses" }, ...statusOptions]}
                  placeholder="Status"
                  value={status}
                  onChange={onStatusChange}
                  fullWidth
                />
              </div>
            )}
            {dateRange && onDateRangeChange && (
              <div className={styles.datePickerWrap}>
                <DateRangePicker
                  value={dateRange}
                  onChange={onDateRangeChange}
                  placeholder={dateRangePlaceholder}
                  fullWidth
                />
              </div>
            )}
            {children}
          </div>
        )}

        {/* Utilities: Sort-by dropdown + Sort order toggle + View mode switch + Export */}
        <div className={styles.utilities}>
          {sortByOptions && onSortByChange && (
            <div className={styles.filterSelect}>
              <Select options={sortByOptions} value={sortBy} onChange={onSortByChange} fullWidth />
            </div>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={onSortOrderToggle}
            leftIcon={sortOrder === "asc" ? <IconSortAsc size={16} /> : <IconSortDesc size={16} />}
          >
            <span className={styles.btnLabel}>{sortOrder === "asc" ? "ASC" : "DESC"}</span>
          </Button>

          {onViewModeChange && viewMode && (
            <div className={styles.viewToggle}>
              <Tooltip content="List view" placement="top">
                <button
                  className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewActive : ""}`}
                  onClick={() => onViewModeChange("list")}
                  aria-label="List view"
                >
                  <IconList size={15} />
                </button>
              </Tooltip>
              <Tooltip content="Grid view" placement="top">
                <button
                  className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewActive : ""}`}
                  onClick={() => onViewModeChange("grid")}
                  aria-label="Grid view"
                >
                  <IconGrid size={15} />
                </button>
              </Tooltip>
            </div>
          )}

          {onExport && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<IconDownload size={16} />}
              onClick={onExport}
            >
              <span className={styles.btnLabel}>Export</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

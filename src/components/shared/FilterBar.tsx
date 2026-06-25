import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  IconChevronDown,
  IconCheck,
} from "@/assets/icons";
import { DateRangePicker, DateRange } from "@/components/datetime/DateRangePicker";
import { COMPLEXITY_OPTIONS, QUESTION_TYPE_OPTIONS } from "@/constants/app";
import type { ViewMode, SortOrder } from "@/types";

// ─── Tab types ────────────────────────────────────────────────────────────────

export interface TabOption {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  compact?: boolean;
  // Controls white card styling (bg, border, shadow). Defaults to true; false when compact.
  wrapper?: boolean;

  // ── Tabs (left-side pill tabs in compact mode) ──────────────────────────────
  tabs?: TabOption[];
  activeTab?: string;
  onTabChange?: (value: string) => void;

  // ── Sort controls ───────────────────────────────────────────────────────────
  sortBy?: string;
  onSortByChange?: (v: string) => void;
  sortByOptions?: { value: string; label: string }[];
  sortOrder?: SortOrder;
  onSortOrderToggle?: () => void;
  // When provided alongside sortByOptions+onSortByChange+sortOrder, renders the grouped SortDropdown
  onSortOrderChange?: (dir: SortOrder) => void;

  // ── View mode ───────────────────────────────────────────────────────────────
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;

  // ── Filter dropdowns ────────────────────────────────────────────────────────
  complexity?: string;
  onComplexityChange?: (v: string) => void;
  questionType?: string;
  onQuestionTypeChange?: (v: string) => void;
  status?: string;
  onStatusChange?: (v: string) => void;
  statusOptions?: readonly { value: string; label: string }[];
  showComplexity?: boolean;
  showQuestionType?: boolean;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  dateRangePlaceholder?: string;

  // ── Actions ─────────────────────────────────────────────────────────────────
  onExport?: () => void;
  onRefresh?: () => void;

  children?: React.ReactNode;
}

// ─── Sub-renderers (extracted to keep FilterBar's cognitive complexity low) ──

// ── SortDropdown: grouped portal dropdown with field + direction sections ──

interface SortDropdownProps {
  sortByOptions: { value: string; label: string }[];
  sortBy: string;
  onSortByChange: (v: string) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (dir: SortOrder) => void;
}

function SortDropdown({
  sortByOptions,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: Readonly<SortDropdownProps>) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        dropRef.current &&
        !dropRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const openDropdown = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedH = (sortByOptions.length + 3) * 38 + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedH + 8 && rect.top > spaceBelow;
      setDropdownStyle(
        openUp
          ? {
              position: "fixed",
              bottom: window.innerHeight - rect.top + 4,
              left: rect.left,
              minWidth: rect.width,
              maxHeight: Math.min(rect.top - 8, 320),
              overflowY: "auto",
              zIndex: 9999,
            }
          : {
              position: "fixed",
              top: rect.bottom + 4,
              left: rect.left,
              minWidth: rect.width,
              maxHeight: Math.min(spaceBelow - 8, 320),
              overflowY: "auto",
              zIndex: 9999,
            }
      );
    }
    setOpen((v) => !v);
  };

  const activeLabel = sortByOptions.find((o) => o.value === sortBy)?.label ?? sortBy;

  return (
    <div className={styles.sortDropWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.sortTrigger} ${open ? styles.sortTriggerOpen : ""}`}
        onClick={openDropdown}
      >
        {sortOrder === "asc" ? <IconSortAsc size={14} /> : <IconSortDesc size={14} />}
        <span className={styles.sortTriggerLabel}>{activeLabel}</span>
        <IconChevronDown
          size={13}
          className={`${styles.sortChevron} ${open ? styles.sortChevronOpen : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div ref={dropRef} className={styles.sortDropdown} style={dropdownStyle}>
            {sortByOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.sortOption} ${opt.value === sortBy ? styles.sortOptionActive : ""}`}
                onClick={() => {
                  onSortByChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className={styles.sortOptionCheck}>
                  {opt.value === sortBy && <IconCheck size={12} />}
                </span>
                {opt.label}
              </button>
            ))}
            <div className={styles.sortDivider} />
            <button
              type="button"
              className={`${styles.sortOption} ${sortOrder === "asc" ? styles.sortOptionActive : ""}`}
              onClick={() => {
                onSortOrderChange("asc");
                setOpen(false);
              }}
            >
              <span className={styles.sortOptionCheck}>
                {sortOrder === "asc" && <IconCheck size={12} />}
              </span>
              <IconSortAsc size={13} className={styles.sortDirIcon} />
              Ascending
            </button>
            <button
              type="button"
              className={`${styles.sortOption} ${sortOrder === "desc" ? styles.sortOptionActive : ""}`}
              onClick={() => {
                onSortOrderChange("desc");
                setOpen(false);
              }}
            >
              <span className={styles.sortOptionCheck}>
                {sortOrder === "desc" && <IconCheck size={12} />}
              </span>
              <IconSortDesc size={13} className={styles.sortDirIcon} />
              Descending
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

// ── SortControls: routes to SortDropdown (grouped) or legacy separate controls

interface SortControlsProps {
  sortByOptions?: { value: string; label: string }[];
  sortBy?: string;
  onSortByChange?: (v: string) => void;
  sortOrder?: SortOrder;
  onSortOrderToggle?: () => void;
  onSortOrderChange?: (dir: SortOrder) => void;
}

function SortControls({
  sortByOptions,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  onSortOrderChange,
}: Readonly<SortControlsProps>) {
  if (
    sortByOptions &&
    sortBy !== undefined &&
    onSortByChange &&
    sortOrder !== undefined &&
    onSortOrderChange
  ) {
    return (
      <SortDropdown
        sortByOptions={sortByOptions}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
        sortOrder={sortOrder}
        onSortOrderChange={onSortOrderChange}
      />
    );
  }
  return (
    <>
      {sortByOptions && onSortByChange && sortBy !== undefined && (
        <div className={styles.filterSelect}>
          <Select options={sortByOptions} value={sortBy} onChange={onSortByChange} fullWidth />
        </div>
      )}
      {onSortOrderToggle && sortOrder !== undefined && (
        <Button
          variant="secondary"
          size="md"
          onClick={onSortOrderToggle}
          leftIcon={sortOrder === "asc" ? <IconSortAsc size={16} /> : <IconSortDesc size={16} />}
        >
          <span className={styles.btnLabel}>{sortOrder === "asc" ? "ASC" : "DESC"}</span>
        </Button>
      )}
    </>
  );
}

function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: Readonly<{ viewMode: ViewMode; onViewModeChange: (m: ViewMode) => void }>) {
  return (
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
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterBar({
  search,
  onSearchChange,
  compact = false,
  wrapper,
  tabs,
  activeTab,
  onTabChange,
  sortBy,
  onSortByChange,
  sortByOptions,
  sortOrder,
  onSortOrderToggle,
  onSortOrderChange,
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
  const dropdownCount = [
    showComplexity && onComplexityChange,
    showQuestionType && onQuestionTypeChange,
    statusOptions && onStatusChange,
    dateRange && onDateRangeChange,
  ].filter(Boolean).length;

  const singleDropdown = dropdownCount === 1;
  const hasFilterDrops = dropdownCount > 0 || children;
  const hasTabs = tabs && tabs.length > 0 && !!onTabChange;

  const showCard = wrapper ?? !compact; // default: show card unless compact
  const barClass = showCard ? styles.filterBar : `${styles.compactBar} ${styles.filterBar}`;

  const sortControlsProps: SortControlsProps = {
    sortByOptions,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderToggle,
    onSortOrderChange,
  };

  // ── Tabs + compact layout ──────────────────────────────────────────────────
  if (hasTabs && compact) {
    return (
      <div className={`${barClass} ${styles.tabsCompactBar}`}>
        {/* Left: tab pills */}
        <div className={styles.tabsSection}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={`${styles.tab} ${activeTab === tab.value ? styles.tabActive : ""}`}
              onClick={() => onTabChange?.(tab.value)}
            >
              {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
              <span className={styles.tabLabel}>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={styles.tabCount}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Right: controls */}
        <div className={styles.controlsSection}>
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
          <SortControls {...sortControlsProps} />
          {onViewModeChange && viewMode && (
            <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
          )}
          {onExport && (
            <Button variant="secondary" size="md" leftIcon={<IconDownload size={16} />} onClick={onExport}>
              <span className={styles.btnLabel}>Export</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Original flat layout (no tabs) ────────────────────────────────────────
  return (
    <div className={barClass}>
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

      <div className={`${styles.midSection} ${singleDropdown ? styles.midSingle : styles.midMulti}`}>
        {hasFilterDrops && (
          <div className={styles.filterDrops}>
            {showComplexity && onComplexityChange && (
              <div className={styles.filterSelect}>
                <Select options={COMPLEXITY_OPTIONS} placeholder="Complexity" value={complexity} onChange={onComplexityChange} fullWidth />
              </div>
            )}
            {showQuestionType && onQuestionTypeChange && (
              <div className={styles.filterSelect}>
                <Select options={QUESTION_TYPE_OPTIONS} placeholder="Question Type" value={questionType} onChange={onQuestionTypeChange} fullWidth />
              </div>
            )}
            {statusOptions && onStatusChange && (
              <div className={styles.filterSelect}>
                <Select options={[{ value: "", label: "All Statuses" }, ...statusOptions]} placeholder="Status" value={status} onChange={onStatusChange} fullWidth />
              </div>
            )}
            {dateRange && onDateRangeChange && (
              <div className={styles.datePickerWrap}>
                <DateRangePicker value={dateRange} onChange={onDateRangeChange} placeholder={dateRangePlaceholder} fullWidth />
              </div>
            )}
            {children}
          </div>
        )}

        <div className={styles.utilities}>
          <SortControls {...sortControlsProps} />
          {onViewModeChange && viewMode && (
            <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
          )}
          {onExport && (
            <Button variant="secondary" size="md" leftIcon={<IconDownload size={16} />} onClick={onExport}>
              <span className={styles.btnLabel}>Export</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

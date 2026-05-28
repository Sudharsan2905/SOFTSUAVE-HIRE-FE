import React from "react";
import styles from "./FilterBar.module.css";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  IconSearch,
  IconSortAsc,
  IconSortDesc,
  IconGrid,
  IconList,
  IconDownload,
} from "@/assets/icons";
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
  onExport?: () => void;
  showComplexity?: boolean;
  showQuestionType?: boolean;
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
  onExport,
  showComplexity = false,
  showQuestionType = false,
  children,
}: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <div className={styles.left}>
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          leftElement={<IconSearch size={15} />}
          fullWidth={false}
          style={{ minWidth: 200 }}
        />
        {showComplexity && onComplexityChange && (
          <Select
            options={COMPLEXITY_OPTIONS}
            placeholder="Complexity"
            value={complexity}
            onChange={onComplexityChange}
            fullWidth={false}
            style={{ minWidth: 130 }}
          />
        )}
        {showQuestionType && onQuestionTypeChange && (
          <Select
            options={QUESTION_TYPE_OPTIONS}
            placeholder="Question Type"
            value={questionType}
            onChange={onQuestionTypeChange}
            fullWidth={false}
            style={{ minWidth: 160 }}
          />
        )}
        {sortByOptions && onSortByChange && (
          <Select
            options={sortByOptions}
            value={sortBy}
            onChange={onSortByChange}
            fullWidth={false}
            style={{ minWidth: 130 }}
          />
        )}
        {children}
      </div>
      <div className={styles.right}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSortOrderToggle}
          leftIcon={sortOrder === "asc" ? <IconSortAsc size={15} /> : <IconSortDesc size={15} />}
        >
          {sortOrder === "asc" ? "ASC" : "DESC"}
        </Button>
        {onViewModeChange && viewMode && (
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewActive : ""}`}
              onClick={() => onViewModeChange("list")}
              title="List view"
            >
              <IconList size={15} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewActive : ""}`}
              onClick={() => onViewModeChange("grid")}
              title="Grid view"
            >
              <IconGrid size={15} />
            </button>
          </div>
        )}
        {onExport && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconDownload size={15} />}
            onClick={onExport}
          >
            Export
          </Button>
        )}
      </div>
    </div>
  );
}

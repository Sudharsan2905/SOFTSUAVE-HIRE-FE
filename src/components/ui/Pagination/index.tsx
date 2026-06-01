import React from "react";
import styles from "./Pagination.module.css";
import { IconChevronLeft, IconChevronRight } from "@/assets/icons";
import { PaginationMeta } from "@/types";
import { PAGE_SIZE_OPTIONS } from "@/constants/app";
import { Select } from "@/components/ui/Select";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination({
  meta,
  onPageChange,
  pageSize,
  onPageSizeChange,
  className,
}: Readonly<PaginationProps>) {
  const { page, total_pages, page_size, has_prev, has_next } = meta;

  const pages = getPageNumbers(page, total_pages);

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <div className={styles.meta}>
        <span className={styles.info}>Showing</span>
        {onPageSizeChange && (
          <Select
            options={PAGE_SIZE_OPTIONS.map((s) => ({ value: String(s), label: String(s) }))}
            value={String(pageSize ?? page_size)}
            onChange={(v) => onPageSizeChange(Number(v))}
            fullWidth={false}
            style={{ minWidth: 70 }}
          />
        )}
      </div>
      <div className={styles.controls}>
        <button
          className={styles.navBtn}
          disabled={!has_prev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous"
        >
          <IconChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-before-${pages[i + 1]}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={p}
              className={`${styles.pageBtn} ${p === page ? styles.active : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className={styles.navBtn}
          disabled={!has_next}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next"
        >
          <IconChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current, "...", total];
}

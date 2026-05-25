import React from 'react';
import styles from './Pagination.module.css';
import { IconChevronLeft, IconChevronRight } from '@/assets/icons';
import { PaginationMeta } from '@/types';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ meta, onPageChange, className }: PaginationProps) {
  const { page, total_pages, total, page_size, has_prev, has_next } = meta;

  const pages = getPageNumbers(page, total_pages);
  const from = (page - 1) * page_size + 1;
  const to = Math.min(page * page_size, total);

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      <span className={styles.info}>
        Showing {from}–{to} of {total}
      </span>
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
          p === '...' ? (
            <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
          ) : (
            <button
              key={p}
              className={`${styles.pageBtn} ${p === page ? styles.active : ''}`}
              onClick={() => onPageChange(p as number)}
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

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

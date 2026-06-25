import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./AssessmentCard.module.css";
import {
  IconEdit,
  IconClone,
  IconDelete,
  IconTime,
  IconRectangleList,
  IconCalendar,
  IconChevronRight,
} from "@/assets/icons";
import { Assessment } from "@/types";
import { formatDate } from "@/utils/helpers";
import { ROUTES } from "@/constants/routes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: "#EEF2FF", color: "#4F46E5" }, // Indigo
  { bg: "#ECFDF5", color: "#059669" }, // Emerald
  { bg: "#FFF7ED", color: "#EA580C" }, // Orange
  { bg: "#EFF6FF", color: "#2563EB" }, // Blue
  { bg: "#F5F3FF", color: "#7C3AED" }, // Violet
  { bg: "#FDF2F8", color: "#DB2777" }, // Pink
  { bg: "#F0FDFA", color: "#0F766E" }, // Teal
  { bg: "#FEFCE8", color: "#CA8A04" }, // Yellow
  { bg: "#F1F5F9", color: "#475569" }, // Slate
  { bg: "#FDF4FF", color: "#A21CAF" }, // Fuchsia
];

function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (name.codePointAt(i) ?? 0) + ((h << 5) - h);
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ─── Three-dot icon ───────────────────────────────────────────────────────────

function IconDots({ size = 16 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  assessment: Assessment;
  workspaceId: string;
  viewMode: "grid" | "list";
  onEdit: (a: Assessment) => void;
  onClone: (a: Assessment) => void;
  onDelete: (a: Assessment) => void;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function AssessmentCard({
  assessment: a,
  workspaceId,
  viewMode,
  onEdit,
  onClone,
  onDelete,
}: Readonly<Props>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const totalMinutes = a.rounds.reduce((t, r) => t + r.max_duration_minutes, 0);
  const totalQuestions = a.rounds.reduce((t, r) => t + r.question_count, 0);
  const submitted = a.submission_count ?? 0;
  const expected = a.expected_candidates ?? 100;
  const progressPct = expected > 0 ? Math.min(100, Math.round((submitted / expected) * 100)) : 0;
  const isMonitoring = a.accessibility === "monitoring";

  function renderProgress() {
    if (expected > 0) {
      return (
        <div className={styles.progressSection}>
          <div className={styles.progressLabelRow}>
            <span className={styles.progressLabel}>
              {submitted} of {expected} completed
            </span>
            <span className={styles.progressPct}>{progressPct}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      );
    }
    if (submitted > 0) {
      return (
        <div className={styles.progressSection}>
          <div className={styles.progressLabelRow}>
            <span className={styles.progressLabel}>{submitted} submitted</span>
          </div>
        </div>
      );
    }
    return null;
  }
  const avatar = getAvatarColor(a.name);
  const initials = getInitials(a.name);

  const cardClass = [
    styles.card,
    viewMode === "list" ? styles.listCard : "",
    menuOpen ? styles.cardMenuOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass}>
      <Link
        to={ROUTES.ADMIN.assessmentDetail(workspaceId, a.id)}
        className={styles.overlay}
        aria-label={`View ${a.name} assessment`}
      />

      {/* ── Header: badges + menu ── */}
      <div className={styles.cardHeader}>
        <div className={styles.badgeRow}>
          <span
            className={`${styles.modeBadge} ${isMonitoring ? styles.modeBadgeMonitor : styles.modeBadgeNormal}`}
          >
            <span className={styles.modeDot} />
            {isMonitoring ? "Monitoring" : "Standard"}
          </span>
          <span className={styles.roundBadge}>
            {a.rounds.length} round{a.rounds.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className={styles.menuWrap} ref={menuRef}>
          <button
            className={[styles.menuTrigger, menuOpen ? styles.menuTriggerOpen : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((o) => !o);
            }}
            aria-label="Assessment actions"
          >
            <IconDots size={16} />
          </button>

          {menuOpen && (
            <div className={styles.dropdown} role="menu">
              <button
                className={styles.menuItem}
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onEdit(a);
                }}
              >
                <IconEdit size={14} /> Edit
              </button>
              <button
                className={styles.menuItem}
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onClone(a);
                }}
              >
                <IconClone size={14} /> Clone
              </button>
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onDelete(a);
                }}
              >
                <IconDelete size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body: avatar + title ── */}
      <div className={styles.cardTop}>
        <div
          className={styles.avatar}
          style={{ background: avatar.bg, color: avatar.color }}
          aria-hidden="true"
        >
          {initials}
        </div>

        <div className={styles.titleBlock}>
          <h3 className={styles.name}>{a.name}</h3>
          {a.description && <p className={styles.desc}>{a.description}</p>}
        </div>
      </div>

      {/* ── Meta ── */}
      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <IconTime size={14} /> {totalMinutes} min
        </span>
        <span className={styles.metaItem}>
          <IconRectangleList size={14} /> {totalQuestions} Questions
        </span>
      </div>

      {/* ── Progress ── */}
      {renderProgress()}

      {/* ── Footer ── */}
      <div className={styles.footer}>
        <span className={styles.date}>
          <IconCalendar size={12} /> {formatDate(a.created_at)}
        </span>
        <Link to={ROUTES.ADMIN.assessmentDetail(workspaceId, a.id)} className={styles.viewBtn}>
          View Details <IconChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

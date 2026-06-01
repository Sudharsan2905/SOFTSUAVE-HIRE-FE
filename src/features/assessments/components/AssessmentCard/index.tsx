import React, { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./AssessmentCard.module.css";
import { Badge } from "@/components/ui/Badge";
import {
  IconEdit,
  IconShare,
  IconClone,
  IconDelete,
  IconTime,
  IconUsers,
  IconChevronRight,
  IconShield,
} from "@/assets/icons";
import { Assessment } from "@/types";
import { formatDate } from "@/utils/helpers";

interface DotsIcon {
  size?: number;
  color?: string;
}
function IconDots({ size = 16, color = "currentColor" }: DotsIcon) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" fill={color} stroke="none" />
      <circle cx="12" cy="12" r="1" fill={color} stroke="none" />
      <circle cx="12" cy="19" r="1" fill={color} stroke="none" />
    </svg>
  );
}

interface Props {
  assessment: Assessment;
  workspaceId: string;
  viewMode: "grid" | "list";
  onEdit: (a: Assessment) => void;
  onShare: (a: Assessment) => void;
  onClone: (a: Assessment) => void;
  onDelete: (a: Assessment) => void;
}

export function AssessmentCard({ assessment: a, workspaceId, viewMode, onEdit, onShare, onClone, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const totalMinutes = a.rounds.reduce((t, r) => t + r.max_duration_minutes, 0);

  const cardClass = [
    viewMode === "list" ? `${styles.card} ${styles.listCard}` : styles.card,
    menuOpen ? styles.cardMenuOpen : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cardClass}>
      <Link
        to={`/workspaces/${workspaceId}/assessments/${a.id}`}
        className={styles.overlay}
        aria-label={`View ${a.name} assessment`}
      />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.badges}>
          <Badge variant={a.accessibility === "monitoring" ? "accent" : "default"}>
            {a.accessibility === "monitoring" ? (
              <><IconShield size={10} /> Monitoring</>
            ) : (
              "Normal"
            )}
          </Badge>
          <Badge variant="info">
            {a.rounds.length} round{a.rounds.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {/* Three-dot action menu */}
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            className={[styles.menuTrigger, menuOpen ? styles.menuTriggerOpen : ""].filter(Boolean).join(" ")}
            onClick={(e) => { e.preventDefault(); setMenuOpen((o) => !o); }}
            aria-label="Assessment actions"
          >
            <IconDots size={16} />
          </button>

          {menuOpen && (
            <div className={styles.dropdown} role="menu">
              <button
                className={styles.menuItem}
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); onEdit(a); }}
              >
                <IconEdit size={14} /> Edit
              </button>
              <button
                className={styles.menuItem}
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); onShare(a); }}
              >
                <IconShare size={14} /> Share
              </button>
              <button
                className={styles.menuItem}
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); onClone(a); }}
              >
                <IconClone size={14} /> Clone
              </button>
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); onDelete(a); }}
              >
                <IconDelete size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <h3 className={styles.name}>{a.name}</h3>
        {a.description && <p className={styles.desc}>{a.description}</p>}
      </div>

      {/* Meta */}
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <IconTime size={13} /> {totalMinutes} min total
        </span>
        <span className={styles.metaItem}>
          <IconUsers size={13} /> {a.submission_count ?? 0} submitted
        </span>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.date}>{formatDate(a.created_at)}</span>
        <Link
          to={`/workspaces/${workspaceId}/assessments/${a.id}`}
          className={styles.viewBtn}
        >
          View Details <IconChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

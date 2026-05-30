import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import logoUrl from "@/assets/favicon.svg";
import styles from "./NoAccessPage.module.css";

interface NoAccessPageProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function NoAccessPage({
  title = "Access Restricted",
  description = "You don't have permission to view this page. Contact your administrator if you believe this is a mistake.",
  showBackButton = true,
  backTo = "/question-bank",
  backLabel = "Go Back",
}: Readonly<NoAccessPageProps>) {
  const navigate = useNavigate();

  return (
    <div className={styles.page} role="main" aria-labelledby="noaccess-title">
      <div className={styles.card}>
        {/* Brand header */}
        <div className={styles.brand}>
          <img src={logoUrl} width="36" height="36" alt="SoftSuave Hire logo" />
          <span className={styles.brandName}>SoftSuave Hire</span>
        </div>

        {/* Lock icon */}
        <div className={styles.iconWrap} aria-hidden="true">
          <LockIcon />
        </div>

        {/* Message */}
        <h1 id="noaccess-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>

        {/* Action */}
        {showBackButton && (
          <Button
            onClick={() => navigate(backTo)}
            variant="secondary"
            size="sm"
          >
            {backLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

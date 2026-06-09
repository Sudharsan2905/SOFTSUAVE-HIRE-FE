import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { IconLock } from "@/assets/icons";
import logoUrl from "@/assets/favicon.svg";
import { ROUTES } from "@/constants/routes";
import styles from "./NoAccessPage.module.css";

interface IconProps {
  size?: number | string;
  strokeWidth?: number;
}

interface NoAccessPageProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
  icon?: React.ElementType<IconProps>;
}

export function NoAccessPage({
  title = "Access Restricted",
  description = "You don't have permission to view this page. Contact your administrator if you believe this is a mistake.",
  showBackButton = true,
  backTo = ROUTES.ADMIN.QUESTION_BANK,
  backLabel = "Go Back",
  icon: Icon = IconLock,
}: Readonly<NoAccessPageProps>) {
  const navigate = useNavigate();

  return (
    <main className={styles.page} aria-labelledby="noaccess-title">
      <div className={styles.card}>
        {/* Brand header */}
        <div className={styles.brand}>
          <img src={logoUrl} width="36" height="36" alt="SoftSuave Hire logo" />
          <span className={styles.brandName}>SoftSuave Hire</span>
        </div>

        {/* Icon */}
        <div className={styles.iconWrap} aria-hidden="true">
          <Icon size={40} strokeWidth={1.5} />
        </div>

        {/* Message */}
        <h1 id="noaccess-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>

        {/* Action */}
        {showBackButton && (
          <Button onClick={() => navigate(backTo)} variant="secondary" size="sm">
            {backLabel}
          </Button>
        )}
      </div>
    </main>
  );
}

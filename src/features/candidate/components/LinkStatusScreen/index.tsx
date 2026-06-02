import React from "react";
import logoUrl from "@/assets/favicon.svg";
import { IconTime, IconInvalid, IconNotStarted } from "@/assets/icons";
import styles from "./LinkStatusScreen.module.css";

export type LinkStatus = "not_started" | "expired" | "invalid";

const COPY: Record<LinkStatus, { title: string; fallbackDesc: string }> = {
  expired: {
    title: "Interview Link Expired",
    fallbackDesc: "This interview session is no longer available.",
  },
  not_started: {
    title: "Interview Not Started",
    fallbackDesc: "This interview link will become active at the scheduled time.",
  },
  invalid: {
    title: "Invalid Link",
    fallbackDesc: "This link is not valid. Please check the URL or contact the administrator.",
  },
};

const STATUS_ICON: Record<LinkStatus, React.ReactNode> = {
  not_started: <IconNotStarted size={42} />,
  expired: <IconTime size={40} />,
  invalid: <IconInvalid size={40} />,
};

interface LinkStatusScreenProps {
  status: LinkStatus;
  message?: string;
  startTime?: string;
}

export function LinkStatusScreen({ status, message, startTime }: Readonly<LinkStatusScreenProps>) {
  const { title, fallbackDesc } = COPY[status];
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src={logoUrl} width={31} height={31} alt="SoftSuave Hire" />
          <span className={styles.brandName}>SoftSuave Hire</span>
        </div>

        <div className={styles.iconWrap} aria-hidden="true">
          {STATUS_ICON[status]}
        </div>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{message ?? fallbackDesc}</p>

        {status === "not_started" && startTime && (
          <p className={styles.time}>Starts: {new Date(startTime).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

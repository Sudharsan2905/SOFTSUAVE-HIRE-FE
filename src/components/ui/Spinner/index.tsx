import React from "react";
import styles from "./Spinner.module.css";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: Readonly<SpinnerProps>) {
  return (
    <output
      className={`${styles.spinner} ${styles[size]} ${className ?? ""}`}
      aria-label="Loading"
    ></output>
  );
}

export function PageLoader() {
  return (
    <div className={styles.pageLoader}>
      <div className={styles.loaderContent}>
        <Spinner size="lg" />
        <span className={styles.loaderText}>Loading...</span>
      </div>
    </div>
  );
}

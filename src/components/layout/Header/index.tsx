import React from "react";
import styles from "./Header.module.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { toggleTheme } from "@/store/slices/uiSlice";
import { IconSun, IconMoon } from "@/assets/icons";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);

  return (
    <header className={styles.header}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={styles.actions}>
        {actions}
        <button
          className={styles.themeBtn}
          onClick={() => dispatch(toggleTheme())}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
      </div>
    </header>
  );
}

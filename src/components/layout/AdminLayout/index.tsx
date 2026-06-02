import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import styles from "./AdminLayout.module.css";
import { useAppSelector } from "@/store";
import { UserRole } from "@/types";
import { Sidebar } from "../Sidebar";
import { AppHeader } from "../AppHeader";
import { BottomNav } from "../BottomNav";

export function AdminLayout() {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  // Explicit allowlist — only admin/super_admin may enter. Any other role
  // (candidate, undefined, unknown) is rejected to prevent privilege escalation.
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  if (user?.role === UserRole.CANDIDATE) return <Navigate to="/admin/no-access" replace />;
  else if (!isAdmin) return <Navigate to="/admin/login" replace />;

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <AppHeader />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

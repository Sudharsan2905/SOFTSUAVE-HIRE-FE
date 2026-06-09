import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { Spinner } from "@/components/ui/Spinner";
import { UserRole } from "@/types";
import { ROUTES } from "@/constants/routes";

export default function DashboardPage() {
  const navigate = useNavigate();
  const activeWorkspace = useAppSelector((s) => s.workspace.activeWorkspace);
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    if (activeWorkspace && activeWorkspace.name !== "Common") {
      navigate(ROUTES.ADMIN.assessments(activeWorkspace.id), { replace: true });
    }
  }, [activeWorkspace, navigate]);

  // Admin only has access to Common Workspace (no dedicated workspace assigned yet)
  if (!isSuperAdmin && (!activeWorkspace || activeWorkspace.name === "Common")) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 12,
          textAlign: "center",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Common Workspace
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, maxWidth: 340 }}>
          Contact your administrator to get access to a workspace.
        </p>
      </div>
    );
  }

  // Super admin with no workspaces yet
  if (isSuperAdmin && !activeWorkspace) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 12,
          textAlign: "center",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
          <path d="M8 6v14M16 6v14" />
        </svg>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          No Workspaces Yet
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, maxWidth: 340 }}>
          Use the workspace switcher in the sidebar to create your first workspace.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}
    >
      <Spinner size="lg" />
    </div>
  );
}

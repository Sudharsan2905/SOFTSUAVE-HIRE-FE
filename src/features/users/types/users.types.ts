import type { UserRole } from "@/constants/enums";

export interface CreateUserForm {
  first_name: string;
  last_name?: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserForm {
  first_name: string;
  last_name?: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  default_workspace_id: string;
  workspace_ids: string[];
}

// Re-exports
export type { User, Workspace, WorkspaceRef } from "@/types";

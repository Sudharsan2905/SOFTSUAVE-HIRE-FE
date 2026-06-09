export interface ProfileFormState {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  default_workspace_id: string;
  workspace_ids: string[];
}

export interface PasswordFormState {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

// Re-exports
export type { User, WorkspaceRef } from "@/types";

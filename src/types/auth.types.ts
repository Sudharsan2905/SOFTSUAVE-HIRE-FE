import type { UserRole } from "@/constants/enums";

export interface WorkspaceRef {
  id: string;
  name: string;
}

export interface WorkspaceMember {
  user_id: string;
  email?: string;
  role: UserRole;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  created_by: string;
  members: WorkspaceMember[];
  created_at: string;
  updated_at: string;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  phone: string;
  father_name: string;
  gender: "male" | "female" | "other";
  dob?: string;
  college_name?: string;
  college_city?: string;
}

export interface User {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
  workspaces?: WorkspaceRef[];
  default_workspace_id?: string;
  created_at: string;
  updated_at: string;
  profile?: CandidateProfile;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

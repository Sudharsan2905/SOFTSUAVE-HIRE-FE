/**
 * Reusable mock-data factories for tests.
 *
 * Every factory accepts an optional `overrides` object so individual tests
 * can customise just the fields they care about without re-declaring the
 * entire shape.
 */
import type { User } from "@/types";
import { UserRole } from "@/constants/enums";

// ---------------------------------------------------------------------------
// User factories
// ---------------------------------------------------------------------------

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    first_name: "Jane",
    last_name: "Admin",
    email: "jane.admin@example.com",
    role: UserRole.ADMIN,
    is_active: true,
    workspaces: [{ id: "ws-1", name: "Workspace One" }],
    default_workspace_id: "ws-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeAdminUser(overrides: Partial<User> = {}): User {
  return makeUser({ role: UserRole.ADMIN, ...overrides });
}

export function makeSuperAdminUser(overrides: Partial<User> = {}): User {
  return makeUser({ role: UserRole.SUPER_ADMIN, ...overrides });
}

export function makeCandidateUser(overrides: Partial<User> = {}): User {
  return makeUser({
    role: UserRole.CANDIDATE,
    email: "candidate@example.com",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Auth state factory
// ---------------------------------------------------------------------------

export interface AuthStateOverrides {
  user?: User | null;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
}

export function makeAuthState(overrides: AuthStateOverrides = {}) {
  return {
    user: null as User | null,
    isAuthenticated: false,
    isLoading: false,
    accessToken: null as string | null,
    refreshToken: null as string | null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared token constants
// ---------------------------------------------------------------------------

export const mockAuthTokens = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
} as const;

export function makeAuthPayload(user = makeAdminUser()) {
  return {
    access_token: mockAuthTokens.access_token,
    refresh_token: mockAuthTokens.refresh_token,
    user,
  };
}

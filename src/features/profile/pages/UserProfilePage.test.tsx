import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserProfilePage from "./UserProfilePage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeSuperAdminUser, makeAuthState } from "@/test/mocks";
import { UserRole } from "@/constants/enums";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockNavigate = vi.fn();
const mockUseParams = vi.fn<() => { userId: string | undefined }>(() => ({ userId: undefined }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPatch = api.patch as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

const adminUser = makeAdminUser();
const superAdminUser = makeSuperAdminUser();

const renderOwnProfile = (userOverrides = {}) =>
  renderWithProviders(<UserProfilePage />, {
    preloadedState: {
      auth: makeAuthState({ user: { ...adminUser, ...userOverrides }, isAuthenticated: true }),
    },
  });

const renderSuperAdminOwnProfile = () =>
  renderWithProviders(<UserProfilePage />, {
    preloadedState: {
      auth: makeAuthState({ user: superAdminUser, isAuthenticated: true }),
      workspace: {
        activeWorkspace: null,
        workspaces: [
          { id: "ws-1", name: "Workspace One", description: "", created_by: "user-1", members: [], created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
          { id: "ws-2", name: "Workspace Two", description: "", created_by: "user-1", members: [], created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
        ],
      },
    },
  });

const otherUser = {
  ...adminUser,
  id: "other-user",
  first_name: "Bob",
  last_name: "Jones",
  email: "bob@example.com",
  role: UserRole.ADMIN,
  workspaces: [{ id: "ws-1", name: "Workspace One" }],
  default_workspace_id: "ws-1",
};

const renderViewingOtherAsSuperAdmin = (otherUserOverrides = {}) => {
  mockUseParams.mockReturnValue({ userId: "other-user" });
  mockGet.mockResolvedValue({ data: { data: { ...otherUser, ...otherUserOverrides } } });
  return renderWithProviders(<UserProfilePage />, {
    preloadedState: {
      auth: makeAuthState({ user: superAdminUser, isAuthenticated: true }),
      workspace: {
        activeWorkspace: null,
        workspaces: [
          { id: "ws-1", name: "Workspace One", description: "", created_by: "user-1", members: [], created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
          { id: "ws-2", name: "Workspace Two", description: "", created_by: "user-1", members: [], created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
        ],
      },
    },
  });
};

beforeEach(() => {
  mockGet.mockReset();
  mockPatch.mockReset();
  mockNavigate.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockUseParams.mockReturnValue({ userId: undefined });
});

describe("UserProfilePage — own profile", () => {
  it("renders the user's full name", () => {
    renderOwnProfile();
    const fullName = [adminUser.first_name, adminUser.last_name].filter(Boolean).join(" ");
    expect(screen.getByText(fullName)).toBeInTheDocument();
  });

  it("renders the user's email", () => {
    renderOwnProfile();
    expect(screen.getAllByText(adminUser.email).length).toBeGreaterThan(0);
  });

  it("renders Edit Profile button", () => {
    renderOwnProfile();
    expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument();
  });

  it("enters editing mode when Edit Profile is clicked", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("returns to view mode on Cancel", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument();
  });

  it("calls PATCH when saving with changes", async () => {
    mockPatch.mockResolvedValue({ data: { data: { ...adminUser, first_name: "Updated" } } });
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const firstNameInput = screen.getByPlaceholderText(/enter first name/i);
    await userEvent.clear(firstNameInput);
    await userEvent.type(firstNameInput, "Updated");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
  });

  it("renders Change Password button", () => {
    renderOwnProfile();
    expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument();
  });

  it("opens the password modal on Change Password click", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    expect(screen.getByPlaceholderText(/current password/i)).toBeInTheDocument();
  });

  it("shows form inputs for first name, last name, and email when editing", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(screen.getByPlaceholderText(/enter first name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter last name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter email/i)).toBeInTheDocument();
  });

  it("pre-populates form inputs with current user data when editing", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(screen.getByDisplayValue(adminUser.first_name)).toBeInTheDocument();
    expect(screen.getByDisplayValue(adminUser.email)).toBeInTheDocument();
  });

  it("does NOT call PATCH when saving with no changes", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument()
    );
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("shows toast success after a successful save", async () => {
    mockPatch.mockResolvedValue({ data: { data: { ...adminUser, first_name: "NewName" } } });
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const firstNameInput = screen.getByPlaceholderText(/enter first name/i);
    await userEvent.clear(firstNameInput);
    await userEvent.type(firstNameInput, "NewName");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Profile updated successfully."));
  });

  it("shows toast error when PATCH fails on save", async () => {
    mockPatch.mockRejectedValue(new Error("Server error"));
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const firstNameInput = screen.getByPlaceholderText(/enter first name/i);
    await userEvent.clear(firstNameInput);
    await userEvent.type(firstNameInput, "Failing");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to update profile. Please try again.")
    );
  });

  it("displays role label as Admin for admin user", () => {
    renderOwnProfile();
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("displays Active status for active user", () => {
    renderOwnProfile();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("displays Inactive status for inactive user", () => {
    renderOwnProfile({ is_active: false });
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("displays Candidate role label for candidate user", () => {
    renderOwnProfile({ role: UserRole.CANDIDATE });
    expect(screen.getAllByText("Candidate").length).toBeGreaterThan(0);
  });

  it("displays Super Admin role label for super admin user", () => {
    renderSuperAdminOwnProfile();
    expect(screen.getAllByText("Super Admin").length).toBeGreaterThan(0);
  });

  it("shows role field in view mode", () => {
    renderOwnProfile();
    expect(screen.getByText("Role")).toBeInTheDocument();
  });

  it("renders workspace preferences section when user has workspaces", () => {
    renderOwnProfile();
    expect(screen.getByText("Workspace Preferences")).toBeInTheDocument();
    expect(screen.getByText("Default Workspace")).toBeInTheDocument();
  });

  it("shows default workspace name in view mode", () => {
    renderOwnProfile();
    expect(screen.getAllByText("Workspace One").length).toBeGreaterThan(0);
  });

  it("shows Security section", () => {
    renderOwnProfile();
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("cancels the password modal and resets form", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    const cancelBtn = screen.getAllByRole("button", { name: /cancel/i })[0];
    await userEvent.click(cancelBtn);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/current password/i)).not.toBeInTheDocument()
    );
  });

  it("shows validation error when new passwords do not match", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    await userEvent.type(screen.getByPlaceholderText(/current password/i), "OldPass123");
    await userEvent.type(screen.getByPlaceholderText(/enter new password/i), "NewPass123");
    await userEvent.type(screen.getByPlaceholderText(/confirm new password/i), "DifferentPass");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("New passwords do not match")
    );
  });

  it("shows validation error when current password is missing", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    await userEvent.type(screen.getByPlaceholderText(/enter new password/i), "NewPass123");
    await userEvent.type(screen.getByPlaceholderText(/confirm new password/i), "NewPass123");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Current password is required")
    );
  });

  it("shows validation error when new password fields are empty", async () => {
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Please fill in all required fields")
    );
  });

  it("calls PATCH with password payload and shows success toast", async () => {
    mockPatch.mockResolvedValue({ data: {} });
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    await userEvent.type(screen.getByPlaceholderText(/current password/i), "OldPass123");
    await userEvent.type(screen.getByPlaceholderText(/enter new password/i), "NewPass123!");
    await userEvent.type(screen.getByPlaceholderText(/confirm new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Password changed successfully.")
    );
    expect(mockPatch).toHaveBeenCalledWith(
      "/api/users/me",
      expect.objectContaining({ password: "NewPass123!", current_password: "OldPass123" })
    );
  });

  it("shows error toast when password change fails", async () => {
    mockPatch.mockRejectedValue(new Error("fail"));
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    await userEvent.type(screen.getByPlaceholderText(/current password/i), "OldPass123");
    await userEvent.type(screen.getByPlaceholderText(/enter new password/i), "NewPass123!");
    await userEvent.type(screen.getByPlaceholderText(/confirm new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to change password. Please try again."
      )
    );
  });

  it("closes the password modal after successful password change", async () => {
    mockPatch.mockResolvedValue({ data: {} });
    renderOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));
    await userEvent.type(screen.getByPlaceholderText(/current password/i), "OldPass123");
    await userEvent.type(screen.getByPlaceholderText(/enter new password/i), "NewPass123!");
    await userEvent.type(screen.getByPlaceholderText(/confirm new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/current password/i)).not.toBeInTheDocument()
    );
  });
});

describe("UserProfilePage — viewing another user (super admin)", () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ userId: "other-user" });
    mockGet.mockResolvedValue({ data: { data: otherUser } });
  });

  it("shows a loading spinner while fetching", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<UserProfilePage />, {
      preloadedState: {
        auth: makeAuthState({ user: superAdminUser, isAuthenticated: true }),
      },
    });
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it("renders the other user's name after load", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() => expect(screen.getByText("Bob Jones")).toBeInTheDocument());
  });

  it("shows Back to Users button", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to users/i })).toBeInTheDocument()
    );
  });

  it("navigates back when Back to Users is clicked", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to users/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /back to users/i }));
    expect(mockNavigate).toHaveBeenCalled();
  });

  it("navigates away on API error loading another user", async () => {
    mockGet.mockRejectedValue(new Error("Not found"));
    renderWithProviders(<UserProfilePage />, {
      preloadedState: {
        auth: makeAuthState({ user: superAdminUser, isAuthenticated: true }),
      },
    });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });

  it("shows toast error when loading another user fails", async () => {
    mockGet.mockRejectedValue(new Error("Not found"));
    renderWithProviders(<UserProfilePage />, {
      preloadedState: {
        auth: makeAuthState({ user: superAdminUser, isAuthenticated: true }),
      },
    });
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to load profile.")
    );
  });

  it("shows Edit Profile button for super admin viewing another user", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument()
    );
  });

  it("shows Account Settings card with Role and Status fields (view mode)", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() => expect(screen.getByText("Account Settings")).toBeInTheDocument());
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("shows Role select and Status checkbox in Account Settings when editing", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(screen.getByText("Active account")).toBeInTheDocument();
  });

  it("calls PATCH on the other user's endpoint when saving changes as super admin", async () => {
    mockPatch.mockResolvedValue({ data: { data: { ...otherUser, first_name: "Changed" } } });
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const firstNameInput = screen.getByPlaceholderText(/enter first name/i);
    await userEvent.clear(firstNameInput);
    await userEvent.type(firstNameInput, "Changed");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        "/api/users/other-user",
        expect.objectContaining({ first_name: "Changed" })
      )
    );
  });

  it("shows toast error when PATCH fails while saving another user", async () => {
    mockPatch.mockRejectedValue(new Error("fail"));
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    const lastNameInput = screen.getByPlaceholderText(/enter last name/i);
    await userEvent.clear(lastNameInput);
    await userEvent.type(lastNameInput, "Fail");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to update profile. Please try again.")
    );
  });

  it("shows Reset Password button when viewing another user", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument()
    );
  });

  it("opens reset password modal without current password field", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(screen.queryByPlaceholderText(/current password/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
  });

  it("resets other user password via PATCH to user endpoint", async () => {
    mockPatch.mockResolvedValue({ data: {} });
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await userEvent.type(screen.getByPlaceholderText(/enter new password/i), "NewPass123!");
    await userEvent.type(screen.getByPlaceholderText(/confirm new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /^reset$/i }));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        "/api/users/other-user",
        expect.objectContaining({ password: "NewPass123!" })
      )
    );
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Password changed successfully.")
    );
  });

  it("shows workspace assignment UI (wsGrid) for super admin editing another user", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(
      screen.getByText(/select workspaces to assign to this user/i)
    ).toBeInTheDocument();
  });

  it("toggles workspace assignment chip when clicked", async () => {
    renderViewingOtherAsSuperAdmin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit profile/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    await waitFor(() =>
      expect(screen.getByText("Workspace Two")).toBeInTheDocument()
    );
    const wsChip = screen.getByRole("button", { name: /workspace two/i });
    expect(wsChip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(wsChip);
    expect(wsChip).toHaveAttribute("aria-pressed", "true");
  });
});

describe("UserProfilePage — super admin own profile workspace select", () => {
  it("shows Default Workspace Select in edit mode for super admin (self)", async () => {
    renderSuperAdminOwnProfile();
    await userEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    expect(screen.getByText("Default Workspace")).toBeInTheDocument();
  });
});

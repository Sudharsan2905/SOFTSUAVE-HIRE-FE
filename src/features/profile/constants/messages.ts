export const PROFILE_SUCCESS = {
  UPDATED: "Profile updated successfully.",
  PASSWORD_CHANGED: "Password changed successfully.",
  WORKSPACE_UPDATED: "Workspace settings updated.",
} as const;

export const PROFILE_ERRORS = {
  LOAD_FAILED: "Failed to load profile.",
  UPDATE_FAILED: "Failed to update profile. Please try again.",
  PASSWORD_CHANGE_FAILED: "Failed to change password. Please try again.",
  WRONG_CURRENT_PASSWORD: "Current password is incorrect.",
  PASSWORD_MISMATCH: "New passwords do not match.",
} as const;

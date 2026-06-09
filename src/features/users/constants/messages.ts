export const USERS_SUCCESS = {
  CREATED: "User created successfully.",
  UPDATED: "User updated successfully.",
  DELETED: "User deleted successfully.",
  ACTIVATED: "User activated.",
  DEACTIVATED: "User deactivated.",
  PASSWORD_RESET: "Password reset link sent.",
} as const;

export const USERS_ERRORS = {
  LOAD_FAILED: "Failed to load users.",
  CREATE_FAILED: "Failed to create user. Please try again.",
  UPDATE_FAILED: "Failed to update user.",
  DELETE_FAILED: "Failed to delete user.",
  EMAIL_TAKEN: "A user with this email already exists.",
} as const;

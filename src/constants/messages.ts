export const SUCCESS_MESSAGES = {
  AUTH: {
    LOGIN: "Logged in successfully.",
    LOGOUT: "You have been logged out.",
    REGISTER: "Account created successfully.",
    PASSWORD_CHANGED: "Password changed successfully.",
  },
  PROFILE: {
    UPDATED: "Profile updated successfully.",
  },
  GENERIC: {
    SAVED: "Changes saved successfully.",
    CREATED: "Created successfully.",
    UPDATED: "Updated successfully.",
    DELETED: "Deleted successfully.",
    COPIED: "Copied to clipboard.",
  },
} as const;

export const ERROR_MESSAGES = {
  AUTH: {
    INVALID_CREDENTIALS: "Invalid email or password.",
    SESSION_EXPIRED: "Your session has expired. Please log in again.",
    UNAUTHORIZED: "You do not have permission to perform this action.",
    GOOGLE_FAILED: "Google sign-in failed. Please try again.",
  },
  NETWORK: {
    NO_CONNECTION: "No internet connection. Please check your network.",
    TIMEOUT: "Request timed out. Please try again.",
    SERVER_ERROR: "Something went wrong on our end. Please try again later.",
  },
  VALIDATION: {
    REQUIRED: "This field is required.",
    INVALID_EMAIL: "Please enter a valid email address.",
    MIN_LENGTH: (min: number) => `Must be at least ${min} characters.`,
    MAX_LENGTH: (max: number) => `Must not exceed ${max} characters.`,
  },
  GENERIC: {
    FETCH_FAILED: "Failed to load data. Please refresh.",
    SAVE_FAILED: "Failed to save changes. Please try again.",
    DELETE_FAILED: "Failed to delete. Please try again.",
    UNEXPECTED: "An unexpected error occurred.",
  },
} as const;

export const WARNING_MESSAGES = {
  UNSAVED_CHANGES: "You have unsaved changes. Are you sure you want to leave?",
  DELETE_CONFIRM: "This action cannot be undone.",
  SESSION_EXPIRING: "Your session will expire in 5 minutes.",
} as const;

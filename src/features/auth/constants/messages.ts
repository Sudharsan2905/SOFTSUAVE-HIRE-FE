export const AUTH_SUCCESS = {
  LOGIN: "Logged in successfully.",
  LOGOUT: "You have been logged out.",
  REGISTER: "Account created successfully.",
  PASSWORD_CHANGED: "Password changed successfully.",
} as const;

export const AUTH_ERRORS = {
  LOGIN_FAILED: "Invalid email or password.",
  GOOGLE_FAILED: "Google sign-in failed. Please try again.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  REGISTER_FAILED: "Registration failed. Please try again.",
  EMAIL_TAKEN: "An account with this email already exists.",
  UNAUTHORIZED: "You do not have permission to access this page.",
} as const;

export const ASSESSMENT_SUCCESS = {
  CREATED: "Assessment created successfully.",
  UPDATED: "Assessment updated successfully.",
  DELETED: "Assessment deleted successfully.",
  LINK_COPIED: "Share link copied to clipboard.",
  LINK_REVOKED: "Share link revoked.",
  LINK_CREATED: "Share link created successfully.",
} as const;

export const ASSESSMENT_ERRORS = {
  CREATE_FAILED: "Failed to create assessment. Please try again.",
  UPDATE_FAILED: "Failed to update assessment. Please try again.",
  DELETE_FAILED: "Failed to delete assessment. Please try again.",
  LOAD_FAILED: "Failed to load assessments.",
  DETAIL_LOAD_FAILED: "Failed to load assessment details.",
  SUBMISSIONS_LOAD_FAILED: "Failed to load submissions.",
  EXPORT_FAILED: "Failed to export submissions.",
  NO_QUESTIONS: "Add at least one question before saving.",
  LINK_EXPIRED: "This assessment link has expired.",
  ALREADY_ATTEMPTED: "You have already attempted this assessment.",
  NOT_FOUND: "Assessment not found.",
  LINK_CREATE_FAILED: "Failed to create share link.",
  LINK_REVOKE_FAILED: "Failed to revoke share link.",
} as const;

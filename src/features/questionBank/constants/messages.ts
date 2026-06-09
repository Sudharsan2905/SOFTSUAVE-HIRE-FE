export const QUESTION_BANK_SUCCESS = {
  CATEGORY_CREATED: "Category created successfully.",
  CATEGORY_UPDATED: "Category updated successfully.",
  CATEGORY_DELETED: "Category deleted successfully.",
  QUESTION_CREATED: "Question created successfully.",
  QUESTION_UPDATED: "Question updated successfully.",
  QUESTION_DELETED: "Question deleted successfully.",
  BULK_CREATED: (count: number) => `${count} question${count === 1 ? "" : "s"} created.`,
  BULK_IMPORTED: (count: number) => `${count} question${count === 1 ? "" : "s"} imported.`,
  AI_GENERATED: (count: number) => `${count} question${count === 1 ? "" : "s"} generated.`,
} as const;

export const QUESTION_BANK_ERRORS = {
  CATEGORIES_LOAD_FAILED: "Failed to load categories.",
  CATEGORY_CREATE_FAILED: "Failed to create category.",
  CATEGORY_UPDATE_FAILED: "Failed to update category.",
  CATEGORY_DELETE_FAILED: "Failed to delete category.",
  QUESTIONS_LOAD_FAILED: "Failed to load questions.",
  QUESTION_CREATE_FAILED: "Failed to create question. Please check your inputs.",
  QUESTION_UPDATE_FAILED: "Failed to update question.",
  QUESTION_DELETE_FAILED: "Failed to delete question.",
  BULK_IMPORT_FAILED: "Bulk import failed. Please check the file format.",
  AI_GENERATE_FAILED: "AI generation failed. Please try again.",
  EXCEL_HEADERS_FAILED: "Failed to read Excel headers. Please check the file format.",
  MCQ_NEEDS_CORRECT: "MCQ questions must have at least one correct option.",
  MCQ_NEEDS_OPTIONS: "MCQ questions must have at least two options.",
} as const;

import type { QuestionForm, AiGenerateForm, CategoryForm } from "../types/questionBank.types";

export const QUESTION_FORM_DEFAULTS: Omit<QuestionForm, "_key"> = {
  question_text: "",
  question_type: "mcq_single",
  complexity: "medium",
  options: [
    { id: "", text: "", is_correct: false },
    { id: "", text: "", is_correct: false },
    { id: "", text: "", is_correct: false },
    { id: "", text: "", is_correct: false },
  ],
  correct_answer: "",
};

export const AI_GENERATE_FORM_DEFAULTS: AiGenerateForm = {
  topic: "",
  count: 5,
  complexity: "medium",
  question_type: "mcq_single",
};

export const CATEGORY_FORM_DEFAULTS: CategoryForm = {
  name: "",
  description: "",
};

export const COLUMN_MAP_DEFAULTS = {
  question: "",
  options: "",
  answer: "",
  complexity: "",
};

export const MCQ_OPTION_COUNT = 4;
export const AI_GENERATE_MIN_COUNT = 1;
export const AI_GENERATE_MAX_COUNT = 20;

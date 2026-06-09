import type { Complexity, QuestionType } from "@/constants/enums";

// ─── Form types ───────────────────────────────────────────────────────────────

export interface QuestionForm {
  _key: string;
  question_text: string;
  question_type: QuestionType;
  complexity: Complexity;
  options: { id: string; text: string; is_correct: boolean }[];
  correct_answer: string;
}

export interface AiGenerateForm {
  topic: string;
  count: number;
  complexity: Complexity;
  question_type: QuestionType;
}

export interface CategoryForm {
  name: string;
  description: string;
}

export interface ColumnMap {
  question: string;
  options: string;
  answer: string;
  complexity: string;
}

// ─── Re-exports of domain types used in this feature ─────────────────────────

export type { Question, QuestionCategory, QuestionOption } from "@/types";

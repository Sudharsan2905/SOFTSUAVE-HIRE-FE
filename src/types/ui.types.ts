import type { Complexity, QuestionType, SortOrder, ViewMode } from "@/constants/enums";

export interface FilterState {
  search: string;
  complexity?: Complexity;
  question_type?: QuestionType;
  sort_by: string;
  sort_order: SortOrder;
  page: number;
  page_size: number;
}

export type { ViewMode, SortOrder };

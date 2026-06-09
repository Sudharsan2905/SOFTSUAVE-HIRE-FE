export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  detail?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiError {
  message: string;
  statusCode: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

// Make specific keys optional while keeping the rest required
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Make specific keys required while keeping the rest as-is
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

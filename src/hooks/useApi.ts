import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/utils/api';
import { AxiosRequestConfig } from 'axios';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (err: string) => void;
  immediate?: boolean;
  initialData?: T;
}

export function useApi<T>(
  endpoint: string,
  config?: AxiosRequestConfig,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(options.initialData ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (overrideConfig?: AxiosRequestConfig) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      setError(null);
      try {
        const response = await api({
          url: endpoint,
          signal: abortRef.current.signal,
          ...config,
          ...overrideConfig,
        });
        const result = response.data?.data ?? response.data;
        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err as Error).message ||
          'Request failed';
        if (msg !== 'canceled') {
          setError(msg);
          options.onError?.(msg);
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, config, options]
  );

  useEffect(() => {
    if (options.immediate) execute();
    return () => abortRef.current?.abort();
  }, []);

  return { data, isLoading, error, execute, setData };
}

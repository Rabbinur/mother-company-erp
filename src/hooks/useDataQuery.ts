"use client";

import { useState, useEffect, useCallback } from "react";

export interface UseDataQueryOptions<T> {
  url: string;
  initialParams?: Record<string, string | number>;
  onSuccess?: (data: T[]) => void;
  onError?: (err: Error) => void;
}

export interface UseDataQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  total: number;
  setPage: (p: number) => void;
  setParams: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
  params: Record<string, string | number>;
  refetch: () => Promise<void>;
}

/**
 * Reusable Data Query Hook (Single Responsibility: Client-side fetching & pagination state)
 */
export function useDataQuery<T>({
  url,
  initialParams = {},
  onSuccess,
  onError,
}: UseDataQueryOptions<T>): UseDataQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [params, setParams] = useState<Record<string, string | number>>(initialParams);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      query.append("page", String(page));

      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          query.append(key, String(val));
        }
      });

      const res = await fetch(`${url}?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch data");
      }

      const items = (json.data || []) as T[];
      setData(items);

      if (json.meta) {
        setTotalPages(json.meta.totalPages || 1);
        setTotal(json.meta.total || items.length);
      }

      if (onSuccess) onSuccess(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      if (onError && err instanceof Error) onError(err);
    } finally {
      setLoading(false);
    }
  }, [url, page, params, onSuccess, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    page,
    totalPages,
    total,
    setPage,
    setParams,
    params,
    refetch: fetchData,
  };
}

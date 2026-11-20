/**
 * Common Domain Interfaces & Data Transfer Contracts
 * Adhering to Interface Segregation Principle (ISP)
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface DateRangeFilter {
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface SearchFilter {
  search?: string;
}

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary";

export interface StatusConfig {
  variant: StatusVariant;
  label: string;
}

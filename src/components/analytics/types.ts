export type AnalyticsTab = "products" | "customers" | "salesmen" | "suppliers" | "demand";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "previous_month"
  | "custom";

export interface AnalyticsFilterState {
  preset: DateRangePreset;
  startDate?: string;
  endDate?: string;
  dealershipId?: string;
  principalCompanyId?: string;
}

export interface DealershipOption {
  _id: string;
  name: string;
  code: string;
}

export interface PrincipalCompanyOption {
  _id: string;
  name: string;
  code: string;
}

import type { DashboardDateRange } from "./types";

export class DashboardDateHelper {
  /**
   * Parses time intervals into current and equivalent prior comparison date intervals.
   * Supports both object parameters and string/positional parameters.
   */
  static parseDateRange(
    paramsOrPreset?:
      | string
      | {
          preset?: string;
          startDate?: string | Date;
          endDate?: string | Date;
        },
    customStart?: string | Date,
    customEnd?: string | Date
  ): DashboardDateRange {
    let preset: string;
    let customStartDate: string | Date | undefined;
    let customEndDate: string | Date | undefined;

    if (typeof paramsOrPreset === "string") {
      preset = (paramsOrPreset || "last_30_days").toLowerCase();
      customStartDate = customStart;
      customEndDate = customEnd;
    } else if (paramsOrPreset && typeof paramsOrPreset === "object") {
      preset = (paramsOrPreset.preset || "last_30_days").toLowerCase();
      customStartDate = paramsOrPreset.startDate;
      customEndDate = paramsOrPreset.endDate;
    } else {
      preset = "last_30_days";
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (customStartDate && customEndDate && preset === "custom") {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (preset) {
        case "today": {
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        }
        case "yesterday": {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        }
        case "last_7_days": {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
          break;
        }
        case "this_month": {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          break;
        }
        case "previous_month": {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        }
        case "last_30_days":
        default: {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 29);
          startDate.setHours(0, 0, 0, 0);
          break;
        }
      }
    }

    // Equivalent preceding interval duration calculation
    const durationMs = endDate.getTime() - startDate.getTime();
    const priorEndDate = new Date(startDate.getTime() - 1);
    const priorStartDate = new Date(priorEndDate.getTime() - durationMs);

    return {
      startDate,
      endDate,
      priorStartDate,
      priorEndDate,
      preset,
    };
  }
}

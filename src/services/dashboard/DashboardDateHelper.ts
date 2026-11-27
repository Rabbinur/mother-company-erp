import type { DashboardDateRange } from "./types";

export class DashboardDateHelper {
  /**
   * Parses a date input into a boundary Date respecting Bangladesh Standard Time (UTC+6).
   */
  static parseDateBoundary(dateInput: string | Date, isEndOfDay: boolean): Date {
    if (typeof dateInput === "string") {
      const trimmed = dateInput.trim();
      // Date-only string (YYYY-MM-DD): apply explicit Bangladesh timezone offset (+06:00)
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T${isEndOfDay ? "23:59:59.999" : "00:00:00.000"}+06:00`);
      }
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        if (isEndOfDay && !trimmed.includes("T")) {
          d.setHours(23, 59, 59, 999);
        }
        return d;
      }
    }
    const d = new Date(dateInput);
    if (isEndOfDay && d instanceof Date && !isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  }

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

    const hasCustomDates = Boolean(customStartDate && customEndDate);
    if (hasCustomDates || preset === "custom") {
      preset = "custom";
      startDate = customStartDate ? this.parseDateBoundary(customStartDate, false) : new Date(now);
      endDate = customEndDate ? this.parseDateBoundary(customEndDate, true) : new Date(now);
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

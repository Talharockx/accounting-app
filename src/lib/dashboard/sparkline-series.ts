import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import { mobileProfitFromTransactions } from "@/lib/dashboard/daily-entry";
import { restaurantProfitFromTransactions } from "@/lib/dashboard/restaurant-daily-entry";
import { addCalendarDaysISO, getTodayLocalISO } from "@/lib/utils/date-range";

/** Last N calendar days ending today, oldest-first (for left-to-right sparklines). */
export function rollingDaysISOIncludingToday(days: number, todayISO = getTodayLocalISO()): string[] {
  const n = Math.max(1, Math.floor(days));
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    dates.push(addCalendarDaysISO(todayISO, -i));
  }
  return dates;
}

export type RestaurantSparkMetrics = ReturnType<typeof restaurantProfitFromTransactions>;

export type MobileSparkMetrics = {
  phoneSales: number;
  phoneProfit: number;
  simSales: number;
  simBuy: number;
  packageSales: number;
  repairs: number;
  extras: number;
  posSales: number;
  cashExpenses: number;
  bankExpenses: number;
  purchases: number;
  expenses: number;
  profit: number;
  lastBalance: number;
  lastBalanceWithBank: number;
};

export function restaurantSparkSeries(rows: TransactionWithMeta[], dates: string[]): RestaurantSparkMetrics[] {
  return dates.map((d) => {
    const slice = rows.filter((r) => r.transaction_date === d);
    return restaurantProfitFromTransactions(slice);
  });
}

export function mobileSparkSeries(rows: TransactionWithMeta[], dates: string[]): MobileSparkMetrics[] {
  return dates.map((d) => {
    const slice = rows.filter((r) => r.transaction_date === d);
    return mobileProfitFromTransactions(slice);
  });
}

export function seriesFromRestaurant<T extends keyof RestaurantSparkMetrics>(
  slices: RestaurantSparkMetrics[],
  key: T,
): number[] {
  return slices.map((s) => s[key]);
}

export function seriesFromMobile<T extends keyof MobileSparkMetrics>(slices: MobileSparkMetrics[], key: T): number[] {
  return slices.map((s) => s[key]);
}

/** Compare last value to simple prior-window average — traffic-light trend for sparklines. */
export function sparkTrendTone(values: number[]): "positive" | "neutral" | "critical" {
  if (values.length < 2) return "neutral";
  const last = values[values.length - 1] ?? 0;
  const prev = values.slice(0, -1);
  const avg = prev.reduce((a, b) => a + b, 0) / Math.max(prev.length, 1);
  const epsilon = Math.max(Math.abs(avg), 1) * 0.02;
  if (last > avg + epsilon) return "positive";
  if (last < avg - epsilon) return "critical";
  return "neutral";
}

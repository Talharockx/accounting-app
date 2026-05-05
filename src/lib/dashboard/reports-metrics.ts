import {
  mobileProfitFromTransactions,
  restaurantProfitFromTransactions,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { addCalendarDaysISO } from "@/lib/utils/date-range";

export type ReportsBusinessType = "restaurant" | "mobile_shop";

export type DailyFinancialBreakdown = {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
};

export function dailySalesExpensesProfit(
  businessType: ReportsBusinessType,
  rows: TransactionWithMeta[],
  dateISO: string,
): Omit<DailyFinancialBreakdown, "date"> {
  const dayRows = rows.filter((r) => r.transaction_date === dateISO);
  if (businessType === "restaurant") {
    const t = restaurantProfitFromTransactions(dayRows);
    return {
      sales: t.cash + t.bank,
      expenses: t.purchases + t.expenses,
      profit: t.profit,
    };
  }
  const t = mobileProfitFromTransactions(dayRows);
  return {
    sales: t.phoneSales + t.simSales + t.repairs,
    expenses: t.purchases + t.expenses,
    profit: t.profit,
  };
}

export function monthlyTotalsForRange(
  businessType: ReportsBusinessType,
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): { sales: number; expenses: number; profit: number } {
  let sales = 0;
  let expenses = 0;
  let profit = 0;
  for (
    let d = monthStartISO;
    d.localeCompare(monthEndISO) <= 0;
    d = addCalendarDaysISO(d, 1)
  ) {
    const slice = dailySalesExpensesProfit(businessType, rows, d);
    sales += slice.sales;
    expenses += slice.expenses;
    profit += slice.profit;
    if (d === monthEndISO) break;
  }
  return { sales, expenses, profit };
}

/** Build daily breakdown for charts / PDF rows (dense). */
export function buildDailySeries(
  businessType: ReportsBusinessType,
  rows: TransactionWithMeta[],
  datesInclusive: string[],
): DailyFinancialBreakdown[] {
  return datesInclusive.map((date) => ({
    date,
    ...dailySalesExpensesProfit(businessType, rows, date),
  }));
}

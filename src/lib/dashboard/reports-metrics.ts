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
  /** Purchases / inventory buys (matches Transactions “Purchases” column). */
  purchases: number;
  /** Operating overhead only (matches Transactions “Expenses” column). */
  operatingExpenses: number;
  /** Purchases + operating — used for combined “costs vs sales” charts. */
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
    const purchases = t.purchases;
    const operating = t.expenses;
    return {
      sales: t.cash + t.bank,
      purchases,
      operatingExpenses: operating,
      expenses: purchases + operating,
      profit: t.profit,
    };
  }
  const t = mobileProfitFromTransactions(dayRows);
  const purchases = t.purchases;
  const operating = t.expenses;
  return {
    sales: t.phoneSales + t.simSales + t.repairs,
    purchases,
    operatingExpenses: operating,
    expenses: purchases + operating,
    profit: t.profit,
  };
}

export function monthlyTotalsForRange(
  businessType: ReportsBusinessType,
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): {
  sales: number;
  purchases: number;
  operatingExpenses: number;
  expenses: number;
  profit: number;
} {
  let sales = 0;
  let purchases = 0;
  let operatingExpenses = 0;
  let expenses = 0;
  let profit = 0;
  for (
    let d = monthStartISO;
    d.localeCompare(monthEndISO) <= 0;
    d = addCalendarDaysISO(d, 1)
  ) {
    const slice = dailySalesExpensesProfit(businessType, rows, d);
    sales += slice.sales;
    purchases += slice.purchases;
    operatingExpenses += slice.operatingExpenses;
    expenses += slice.expenses;
    profit += slice.profit;
    if (d === monthEndISO) break;
  }
  return { sales, purchases, operatingExpenses, expenses, profit };
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

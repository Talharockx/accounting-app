import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import { buildMobileTransactionLedgerRow } from "@/lib/dashboard/mobile-transaction-ledger";
import { restaurantProfitFromTransactions } from "@/lib/dashboard/restaurant-daily-entry";
import type { ReportsBusinessType } from "@/lib/business-types";
import { groceryProfitFromTransactions } from "@/lib/dashboard/grocery-daily-entry";
import { addCalendarDaysISO } from "@/lib/utils/date-range";

export type { ReportsBusinessType };

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
  if (businessType === "grocery") {
    const t = groceryProfitFromTransactions(dayRows);
    return {
      sales: t.totalSale,
      purchases: 0,
      operatingExpenses: t.spesaTotal,
      expenses: t.spesaTotal,
      profit: t.totalProfit,
    };
  }
  if (businessType === "restaurant") {
    const t = restaurantProfitFromTransactions(dayRows);
    return {
      sales: t.totalSale,
      purchases: t.kebabPurchase + t.ccPurchase,
      operatingExpenses: t.otherSpesa + t.rent + t.personPurchases,
      expenses: t.totalSpesa,
      profit: t.totalProfit,
    };
  }
  const ledger = buildMobileTransactionLedgerRow(rows, dateISO);
  const operating = ledger.cashExpense + ledger.bankExpense;
  return {
    /** Matches ledger “Total sale” (SIM + mobile + accessories + repair + extras + R.Wind + R.Voda). */
    sales: ledger.totalSale,
    purchases: ledger.simBuy + ledger.mobileBuy + ledger.accessoryBuy,
    operatingExpenses: operating,
    expenses: operating,
    /** Total sale − (cash expense + bank expense) — same as ledger “Total profit”. */
    profit: ledger.lastBalance,
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

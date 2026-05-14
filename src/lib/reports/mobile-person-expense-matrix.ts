import { parseMobileDailyFromTransactions, type TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import { eachISODateInclusive } from "@/lib/utils/date-range";

/** Fixed column order for the mobile monthly PDF grid (matches Daily Entry buckets). */
export const MOBILE_MONTH_SHEET_COLUMNS = [
  "Sim Sale",
  "Sim Buying",
  "Sim Profit",
  "Mobile Sale",
  "Mobile Buying",
  "Mobile Profit",
  "Accessories sale",
  "Accessories buying",
  "Acces. Profit",
  "R.Wind",
  "R.Voda",
  "Repair",
  "Extra",
  "POS",
  "Cash Expense",
  "Bank Expense",
] as const;

export type MobilePersonExpenseMatrixReport = {
  /** Column headers (fixed set for mobile month sheet). */
  columns: string[];
  /** One row per calendar day in the month. */
  rows: { dateISO: string; displayDate: string; amounts: Record<string, number> }[];
  /** Sum of each column over the month. */
  columnTotals: number[];
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function sumLineAmounts(lines: { item_name: string; amount: number }[]): number {
  return lines.reduce((s, line) => s + (Number(line.amount) || 0), 0);
}

export function matrixColumnTotal(matrix: MobilePersonExpenseMatrixReport, column: string): number {
  const i = matrix.columns.indexOf(column);
  if (i < 0) return 0;
  return matrix.columnTotals[i] ?? 0;
}

/**
 * Month grid: Date × mobile Daily Entry columns (SIM, merch, packages, repair, POS, cash/bank totals).
 * “Cash Expense” / “Bank Expense” are **per-day totals** of all cash / bank lines that day (not split by person name).
 */
export function buildMobilePersonExpenseMatrix(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): MobilePersonExpenseMatrixReport {
  const dates = eachISODateInclusive(monthStartISO, monthEndISO);
  const columns = [...MOBILE_MONTH_SHEET_COLUMNS];

  const matrixRows = dates.map((dateISO) => {
    const p = parseMobileDailyFromTransactions(rows, dateISO);
    const mobileSale = sumLineAmounts(p.mobile_sales);
    const mobileBuying = sumLineAmounts(p.mobile_buys);
    const accSale = sumLineAmounts(p.accessory_sales);
    const accBuying = sumLineAmounts(p.accessory_buys);
    const amounts: Record<string, number> = {
      "Sim Sale": p.sim_sale,
      "Sim Buying": p.sim_buy,
      "Sim Profit": p.sim_sale - p.sim_buy,
      "Mobile Sale": mobileSale,
      "Mobile Buying": mobileBuying,
      "Mobile Profit": mobileSale - mobileBuying,
      "Accessories sale": accSale,
      "Accessories buying": accBuying,
      "Acces. Profit": accSale - accBuying,
      "R.Wind": p.package_r_wind,
      "R.Voda": p.package_r_voda,
      "Repair": sumLineAmounts(p.repairs),
      "Extra": sumLineAmounts(p.extras),
      "POS": p.pos_sale,
      "Cash Expense": sumLineAmounts(p.cash_expenses),
      "Bank Expense": sumLineAmounts(p.bank_expenses),
    };
    return {
      dateISO,
      displayDate: isoToDisplayDDMMYYYY(dateISO),
      amounts,
    };
  });

  const columnTotals = columns.map((c) => matrixRows.reduce((s, r) => s + (r.amounts[c] ?? 0), 0));

  return { columns, rows: matrixRows, columnTotals };
}

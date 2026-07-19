import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import {
  groceryDayHasContent,
  groceryProfitFromTransactions,
} from "@/lib/dashboard/grocery-daily-entry";
import { eachISODateInclusive } from "@/lib/utils/date-range";

/**
 * Client export columns for grocery monthly report / PDF.
 * Date is rendered separately; remaining columns match Transactions + cash/bank expense split.
 */
export const GROCERY_REPORT_COLUMNS = [
  "Bank Sale",
  "Cash Sale",
  "Total Sale",
  "Cash Expense",
  "Bank Expense",
  "Spesa Total",
  "Cheques",
  "Total Profit",
] as const;

export type GroceryReportMatrix = {
  columns: string[];
  rows: { dateISO: string; displayDate: string; amounts: Record<string, number> }[];
  columnTotals: number[];
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/**
 * Month grid for grocery: sales, cash/bank expense, spesa, cheques, profit.
 */
export function buildGroceryReportMatrix(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): GroceryReportMatrix {
  const dates = eachISODateInclusive(monthStartISO, monthEndISO);
  const columns = [...GROCERY_REPORT_COLUMNS];
  const matrixRows: GroceryReportMatrix["rows"] = [];

  for (const dateISO of dates) {
    const dayRows = rows.filter((r) => r.transaction_date === dateISO);
    if (!groceryDayHasContent(dayRows)) continue;

    const totals = groceryProfitFromTransactions(dayRows);

    const amounts: Record<string, number> = {
      "Bank Sale": totals.bankSaleTotal,
      "Cash Sale": totals.cashSaleTotal,
      "Total Sale": totals.totalSale,
      "Cash Expense": totals.cashExpense,
      "Bank Expense": totals.spesaPos,
      "Spesa Total": totals.spesaTotal,
      Cheques: totals.cheques,
      "Total Profit": totals.totalProfit,
    };

    matrixRows.push({
      dateISO,
      displayDate: isoToDisplayDDMMYYYY(dateISO),
      amounts,
    });
  }

  const columnTotals = columns.map((col) =>
    matrixRows.reduce((sum, row) => sum + (row.amounts[col] ?? 0), 0),
  );

  return { columns, rows: matrixRows, columnTotals };
}

export function groceryReportMatrixColumnTotal(matrix: GroceryReportMatrix, column: string): number {
  const i = matrix.columns.indexOf(column);
  if (i < 0) return 0;
  return matrix.columnTotals[i] ?? 0;
}

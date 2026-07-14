import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import {
  restaurantDayHasContent,
  restaurantProfitFromTransactions,
} from "@/lib/dashboard/restaurant-daily-entry";
import { eachISODateInclusive } from "@/lib/utils/date-range";

/**
 * Client export columns for restaurant monthly report / PDF.
 * Date is rendered separately; remaining columns:
 * Bank Sale, Cash Sale, Glovo, Just Eat, Deliveroo, Total Sale, Total Spesa, Total Profit
 */
export const RESTAURANT_REPORT_COLUMNS = [
  "Bank Sale",
  "Cash Sale",
  "Glovo",
  "Just Eat",
  "Deliveroo",
  "Total Sale",
  "Total Spesa",
  "Total Profit",
] as const;

export type RestaurantReportMatrix = {
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
 * Month grid for restaurant: sales channels + total sale + total spesa + total profit.
 */
export function buildRestaurantReportMatrix(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): RestaurantReportMatrix {
  const dates = eachISODateInclusive(monthStartISO, monthEndISO);
  const columns = [...RESTAURANT_REPORT_COLUMNS];
  const matrixRows: RestaurantReportMatrix["rows"] = [];

  for (const dateISO of dates) {
    const dayRows = rows.filter((r) => r.transaction_date === dateISO);
    if (!restaurantDayHasContent(dayRows)) continue;

    const totals = restaurantProfitFromTransactions(dayRows);

    const amounts: Record<string, number> = {
      "Bank Sale": totals.bankSaleTotal,
      "Cash Sale": totals.cashSaleTotal,
      Glovo: totals.glovo,
      "Just Eat": totals.justEat,
      Deliveroo: totals.deliveroo,
      "Total Sale": totals.totalSale,
      "Total Spesa": totals.totalSpesa,
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

export function restaurantReportMatrixColumnTotal(matrix: RestaurantReportMatrix, column: string): number {
  const i = matrix.columns.indexOf(column);
  if (i < 0) return 0;
  return matrix.columnTotals[i] ?? 0;
}

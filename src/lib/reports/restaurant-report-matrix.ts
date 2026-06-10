import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import {
  parseRestaurantDailyFromTransactions,
  restaurantDayHasContent,
  restaurantProfitFromTransactions,
} from "@/lib/dashboard/restaurant-daily-entry";
import { eachISODateInclusive } from "@/lib/utils/date-range";

/** Fixed columns before dynamic other-spesa / person columns. */
export const RESTAURANT_REPORT_FIXED_COLUMNS = [
  "Bank Sale",
  "Cash Sale",
  "Glovo",
  "Just Eat",
  "Deliveroo",
  "Total Sale",
  "Kebab",
  "C & C",
] as const;

export const RESTAURANT_REPORT_TAIL_COLUMNS = ["Rent", "Total Spesa"] as const;

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

function spesaLineKey(name: string, prefix: "Other" | "Person"): string {
  const t = name.trim();
  return t ? `${prefix}: ${t}` : `${prefix} (unnamed)`;
}

function collectNamedKeys(
  rows: TransactionWithMeta[],
  dates: string[],
  field: "other_spesa" | "person_purchases",
  prefix: "Other" | "Person",
): string[] {
  const keys = new Set<string>();
  for (const dateISO of dates) {
    const dayRows = rows.filter((r) => r.transaction_date === dateISO);
    if (!restaurantDayHasContent(dayRows)) continue;
    const draft = parseRestaurantDailyFromTransactions(dayRows, dateISO);
    const lines = field === "other_spesa" ? draft.other_spesa : draft.person_purchases;
    for (const line of lines) {
      if (line.amount <= 0) continue;
      keys.add(spesaLineKey(line.item_name, prefix));
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function sumNamedLines(
  lines: { item_name: string; amount: number }[],
  prefix: "Other" | "Person",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    if (line.amount <= 0) continue;
    const key = spesaLineKey(line.item_name, prefix);
    out[key] = (out[key] ?? 0) + line.amount;
  }
  return out;
}

/**
 * Month grid: Date × restaurant daily-entry columns.
 * Other spesa and person expenses get one column per unique name (with amount per day).
 */
export function buildRestaurantReportMatrix(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): RestaurantReportMatrix {
  const dates = eachISODateInclusive(monthStartISO, monthEndISO);
  const otherColumns = collectNamedKeys(rows, dates, "other_spesa", "Other");
  const personColumns = collectNamedKeys(rows, dates, "person_purchases", "Person");

  const columns = [
    ...RESTAURANT_REPORT_FIXED_COLUMNS,
    ...otherColumns,
    ...RESTAURANT_REPORT_TAIL_COLUMNS.slice(0, 1),
    ...personColumns,
    ...RESTAURANT_REPORT_TAIL_COLUMNS.slice(1),
  ];

  const matrixRows: RestaurantReportMatrix["rows"] = [];

  for (const dateISO of dates) {
    const dayRows = rows.filter((r) => r.transaction_date === dateISO);
    if (!restaurantDayHasContent(dayRows)) continue;

    const draft = parseRestaurantDailyFromTransactions(dayRows, dateISO);
    const totals = restaurantProfitFromTransactions(dayRows);
    const otherByName = sumNamedLines(draft.other_spesa, "Other");
    const personByName = sumNamedLines(draft.person_purchases, "Person");

    const amounts: Record<string, number> = {
      "Bank Sale": totals.bankSaleTotal,
      "Cash Sale": totals.cashSaleTotal,
      Glovo: totals.glovo,
      "Just Eat": totals.justEat,
      Deliveroo: totals.deliveroo,
      "Total Sale": totals.totalSale,
      Kebab: totals.kebabPurchase,
      "C & C": totals.ccPurchase,
      Rent: totals.rent,
      "Total Spesa": totals.totalSpesa,
      ...otherByName,
      ...personByName,
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

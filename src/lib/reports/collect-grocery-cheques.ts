import {
  getMetadata,
  metaString,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { SOURCE_GROCERY } from "@/lib/dashboard/grocery-daily-entry";
import { formatCurrency } from "@/lib/utils/formatters";

export type GroceryChequeLineRow = {
  date: string;
  name: string;
  amount: number;
  dueDate: string;
  paid: boolean;
};

/** Grocery Daily Entry cheque lines for a date range (entry date or due date). */
export function collectGroceryChequesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): GroceryChequeLineRow[] {
  const out: GroceryChequeLineRow[] = [];

  for (const row of rows) {
    if (row.transaction_type !== "expense") continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_GROCERY) continue;
    if (metaString(m, "line") !== "cheque") continue;

    const amt = Number(row.amount) || 0;
    if (amt <= 0) continue;

    const itemName = typeof m["item_name"] === "string" ? m["item_name"].trim() : "";
    const dueDate = typeof m["due_date"] === "string" ? m["due_date"] : "";
    const entryInRange =
      row.transaction_date >= rangeStartISO && row.transaction_date <= rangeEndISO;
    const dueInRange = Boolean(dueDate) && dueDate >= rangeStartISO && dueDate <= rangeEndISO;
    if (!entryInRange && !dueInRange) continue;

    out.push({
      date: row.transaction_date,
      name: itemName || "Cheque",
      amount: amt,
      dueDate,
      paid: m["paid"] === true,
    });
  }

  out.sort(
    (a, b) =>
      (a.dueDate || a.date).localeCompare(b.dueDate || b.date) ||
      a.date.localeCompare(b.date) ||
      a.name.localeCompare(b.name),
  );
  return out;
}

export function sumGroceryChequeAmounts(rows: GroceryChequeLineRow[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function formatGroceryChequeAmount(amount: number): string {
  return formatCurrency(amount);
}

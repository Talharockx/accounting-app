import {
  getMetadata,
  metaString,
  mobileExpenseLineDisplayLabel,
  SOURCE_MOBILE,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { formatCurrency } from "@/lib/utils/formatters";

export type MobileDetailLineRow = {
  date: string;
  itemName: string;
  amount: number;
};

function trimName(raw: string): string {
  return raw.trim();
}

function pushNamedLine(
  out: MobileDetailLineRow[],
  date: string,
  itemName: string,
  amount: number,
): void {
  if (amount <= 0) return;
  const name = trimName(itemName);
  if (!name) return;
  out.push({ date, itemName: name, amount });
}

/** Extra income lines from mobile daily entry for a date range. */
export function collectMobileExtrasForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  const out: MobileDetailLineRow[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_MOBILE) continue;
    if (metaString(m, "line") !== "extra_sale" || row.transaction_type !== "sale") continue;
    const itemName = typeof m["item_name"] === "string" ? m["item_name"] : "";
    pushNamedLine(out, row.transaction_date, itemName, Number(row.amount) || 0);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return out;
}

/** Cash expense lines from mobile daily entry for a date range. */
export function collectMobileCashExpensesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  const out: MobileDetailLineRow[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_MOBILE) continue;
    if (metaString(m, "line") !== "expense_cash_line" || row.transaction_type !== "expense") continue;
    const itemName =
      typeof m["item_name"] === "string" ? m["item_name"] : "";
    const label =
      trimName(mobileExpenseLineDisplayLabel(row, m) || itemName) || "Cash expense";
    pushNamedLine(out, row.transaction_date, label, Number(row.amount) || 0);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return out;
}

/** Bank expense lines from mobile daily entry for a date range. */
export function collectMobileBankExpensesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  const out: MobileDetailLineRow[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_MOBILE) continue;
    if (metaString(m, "line") !== "expense_bank_line" || row.transaction_type !== "expense") continue;
    const itemName =
      typeof m["item_name"] === "string" ? m["item_name"] : "";
    const label =
      trimName(mobileExpenseLineDisplayLabel(row, m) || itemName) || "Bank expense";
    pushNamedLine(out, row.transaction_date, label, Number(row.amount) || 0);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return out;
}

export function sumDetailLineAmounts(rows: MobileDetailLineRow[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function formatDetailLineAmount(amount: number): string {
  return formatCurrency(amount);
}

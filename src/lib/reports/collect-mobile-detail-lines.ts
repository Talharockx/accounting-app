import type { BusinessType } from "@/lib/business-types";
import {
  getMetadata,
  metaString,
  mobileExpenseLineDisplayLabel,
  SOURCE_MOBILE,
  SOURCE_RESTAURANT,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { SOURCE_GROCERY } from "@/lib/dashboard/grocery-daily-entry";
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

/** Grocery Daily Entry cash expense fixed lines. */
export function collectGroceryCashExpensesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  const out: MobileDetailLineRow[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    if (row.transaction_type !== "expense") continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_GROCERY) continue;
    if (metaString(m, "line") !== "fixed_expense") continue;
    if (metaString(m, "category") !== "cash_expense") continue;
    const label = typeof m["label"] === "string" ? trimName(m["label"]) : "";
    pushNamedLine(out, row.transaction_date, label || "Cash expense", Number(row.amount) || 0);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return out;
}

/** Grocery Daily Entry bank / POS expense fixed lines. */
export function collectGroceryBankExpensesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  const out: MobileDetailLineRow[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    if (row.transaction_type !== "expense") continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_GROCERY) continue;
    if (metaString(m, "line") !== "fixed_expense") continue;
    const category = metaString(m, "category");
    if (category !== "bank_expense" && category !== "pos_expense") continue;
    const label = typeof m["label"] === "string" ? trimName(m["label"]) : "";
    pushNamedLine(out, row.transaction_date, label || "Bank expense", Number(row.amount) || 0);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return out;
}

/** Restaurant Daily Entry cash expense named lines. */
export function collectRestaurantCashExpensesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  const out: MobileDetailLineRow[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    if (row.transaction_type !== "expense") continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_RESTAURANT) continue;
    if (metaString(m, "line") !== "expense_cash_line") continue;
    const itemName = typeof m["item_name"] === "string" ? m["item_name"] : "";
    pushNamedLine(out, row.transaction_date, trimName(itemName) || "Cash expense", Number(row.amount) || 0);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return out;
}

/** Restaurant Daily Entry bank expense named lines. */
export function collectRestaurantBankExpensesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  const out: MobileDetailLineRow[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    if (row.transaction_type !== "expense") continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_RESTAURANT) continue;
    if (metaString(m, "line") !== "expense_bank_line") continue;
    const itemName = typeof m["item_name"] === "string" ? m["item_name"] : "";
    pushNamedLine(out, row.transaction_date, trimName(itemName) || "Bank expense", Number(row.amount) || 0);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return out;
}

/** Cash expenses for any business type that supports the Cash expenses tab. */
export function collectCashExpensesForBusiness(
  businessType: BusinessType | string | null | undefined,
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  if (businessType === "mobile_shop") {
    return collectMobileCashExpensesForRange(rows, rangeStartISO, rangeEndISO);
  }
  if (businessType === "grocery") {
    return collectGroceryCashExpensesForRange(rows, rangeStartISO, rangeEndISO);
  }
  if (businessType === "restaurant") {
    return collectRestaurantCashExpensesForRange(rows, rangeStartISO, rangeEndISO);
  }
  return [];
}

/** Bank expenses for any business type that supports the Bank expenses tab. */
export function collectBankExpensesForBusiness(
  businessType: BusinessType | string | null | undefined,
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): MobileDetailLineRow[] {
  if (businessType === "mobile_shop") {
    return collectMobileBankExpensesForRange(rows, rangeStartISO, rangeEndISO);
  }
  if (businessType === "grocery") {
    return collectGroceryBankExpensesForRange(rows, rangeStartISO, rangeEndISO);
  }
  if (businessType === "restaurant") {
    return collectRestaurantBankExpensesForRange(rows, rangeStartISO, rangeEndISO);
  }
  return [];
}

export function sumDetailLineAmounts(rows: MobileDetailLineRow[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function formatDetailLineAmount(amount: number): string {
  return formatCurrency(amount);
}

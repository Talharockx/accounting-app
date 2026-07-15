import {
  getMetadata,
  metaString,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import {
  GROCERY_FIXED_EXPENSE_CATEGORIES,
  SOURCE_GROCERY,
  type GroceryFixedExpenseCategory,
} from "@/lib/dashboard/grocery-daily-entry";
import { formatCurrency } from "@/lib/utils/formatters";

export type GroceryExpenseLineRow = {
  date: string;
  category: string;
  detail: string;
  amount: number;
};

function trimName(raw: string): string {
  return raw.trim();
}

function fixedLabel(category: string): string {
  return (
    GROCERY_FIXED_EXPENSE_CATEGORIES.find((c) => c.key === category)?.label ??
    category
  );
}

function pushRow(
  out: GroceryExpenseLineRow[],
  date: string,
  category: string,
  detail: string,
  amount: number,
): void {
  if (amount <= 0) return;
  out.push({
    date,
    category,
    detail: trimName(detail) || category,
    amount,
  });
}

/** All grocery expense lines for a date range (company, person, kametti, cheque, fixed). */
export function collectGroceryExpensesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): GroceryExpenseLineRow[] {
  const out: GroceryExpenseLineRow[] = [];

  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    if (row.transaction_type !== "expense") continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_GROCERY) continue;

    const line = metaString(m, "line");
    const amt = Number(row.amount) || 0;
    const date = row.transaction_date;
    const itemName = typeof m["item_name"] === "string" ? m["item_name"] : "";

    if (line === "company_expense") {
      pushRow(out, date, "Company expense", itemName || "Company expense", amt);
    } else if (line === "person_expense") {
      pushRow(out, date, "Person expense", itemName || "Person expense", amt);
    } else if (line === "kametti_expense") {
      pushRow(out, date, "Kametti", itemName || "Kametti", amt);
    } else if (line === "cheque") {
      const due = typeof m["due_date"] === "string" && m["due_date"] ? ` · due ${m["due_date"]}` : "";
      const paid = m["paid"] === true ? " · paid" : m["paid"] === false ? " · unpaid" : "";
      pushRow(out, date, "Cheque", `${itemName || "Cheque"}${due}${paid}`, amt);
    } else if (line === "fixed_expense") {
      const category = metaString(m, "category");
      const catLabel =
        category === "pos_expense" || category === "bank_expense"
          ? "Bank expense"
          : category === "cash_expense"
            ? "Cash expense"
            : category
              ? fixedLabel(category)
              : "Fixed expense";
      const label = typeof m["label"] === "string" ? m["label"] : "";
      pushRow(out, date, catLabel, trimName(label) || catLabel, amt);
    }
  }

  out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.category.localeCompare(b.category) ||
      a.detail.localeCompare(b.detail),
  );
  return out;
}

export function sumGroceryExpenseAmounts(rows: GroceryExpenseLineRow[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function formatGroceryExpenseAmount(amount: number): string {
  return formatCurrency(amount);
}

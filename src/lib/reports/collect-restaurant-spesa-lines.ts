import {
  getMetadata,
  metaString,
  SOURCE_RESTAURANT,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import {
  RESTAURANT_SPESA_COMPANIES,
  type RestaurantSpesaCompanyKey,
} from "@/lib/dashboard/restaurant-daily-entry";
import { formatCurrency } from "@/lib/utils/formatters";

export type RestaurantSpesaLineRow = {
  date: string;
  category: string;
  detail: string;
  amount: number;
};

function trimName(raw: string): string {
  return raw.trim();
}

function spesaCompanyLabel(key: string): string {
  return RESTAURANT_SPESA_COMPANIES.find((c) => c.key === key)?.label ?? key;
}

function pushRow(
  out: RestaurantSpesaLineRow[],
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

/** Purchases + spesa detail lines from restaurant daily entry for a date range. */
export function collectRestaurantSpesaForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): RestaurantSpesaLineRow[] {
  const out: RestaurantSpesaLineRow[] = [];

  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    if (row.transaction_type !== "expense") continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_RESTAURANT) continue;

    const line = metaString(m, "line");
    const amt = Number(row.amount) || 0;
    const date = row.transaction_date;

    if (line === "company_spesa") {
      const key = metaString(m, "company_key") as RestaurantSpesaCompanyKey | "";
      const label = key ? spesaCompanyLabel(key) : "Company spesa";
      pushRow(out, date, "Company purchase", label, amt);
    } else if (line === "other_spesa") {
      const itemName = typeof m["item_name"] === "string" ? m["item_name"] : "";
      pushRow(out, date, "Other spesa", itemName || "Other spesa", amt);
    } else if (line === "purchases") {
      pushRow(out, date, "Other spesa", "Legacy purchases", amt);
    } else if (line === "expenses") {
      pushRow(out, date, "Other spesa", "Legacy expenses", amt);
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

export function sumRestaurantSpesaAmounts(rows: RestaurantSpesaLineRow[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function formatRestaurantSpesaAmount(amount: number): string {
  return formatCurrency(amount);
}

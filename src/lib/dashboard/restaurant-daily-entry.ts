import {
  DESC_REST_BANK,
  DESC_REST_CASH,
  DESC_REST_NOTES,
  SOURCE_RESTAURANT,
  getMetadata,
  metaString,
  parseNonNegative,
  formatMoneyInputValue,
  type NamedMoneyLine,
  type TransactionInsert,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { isBlankNote } from "@/lib/utils/rich-text";

export const RESTAURANT_DELIVERY_PLATFORMS = [
  { key: "glovo", label: "Glovo" },
  { key: "just_eat", label: "Just Eat" },
  { key: "deliveroo", label: "Deliveroo" },
] as const;

export const RESTAURANT_SPESA_COMPANIES = [
  { key: "kebab", label: "Kebab" },
  { key: "c_and_c", label: "C & C" },
] as const;

export type RestaurantDeliveryKey = (typeof RESTAURANT_DELIVERY_PLATFORMS)[number]["key"];
export type RestaurantSpesaCompanyKey = (typeof RESTAURANT_SPESA_COMPANIES)[number]["key"];

export type RestaurantMetaLine =
  | "cash_sales"
  | "bank_sales"
  | "company_sale"
  | "company_spesa"
  | "other_spesa"
  | "rent"
  | "person_purchase"
  | "expense_cash_line"
  | "expense_bank_line"
  | "daily_notes"
  /** Legacy daily-entry lines (read-only). */
  | "purchases"
  | "expenses";

export type RestaurantCompanySaleLine = {
  company_key: RestaurantDeliveryKey;
  amount: number;
};

export type RestaurantCompanySpesaLine = {
  company_key: RestaurantSpesaCompanyKey;
  amount: number;
};

export type RestaurantDailyInput = {
  business_id: string;
  created_by_user_id: string;
  transaction_date: string;
  bank_sales: number;
  cash_sales: number;
  company_sales: RestaurantCompanySaleLine[];
  company_spesa: RestaurantCompanySpesaLine[];
  other_spesa: NamedMoneyLine[];
  rent: number;
  person_purchases: NamedMoneyLine[];
  cash_expenses: NamedMoneyLine[];
  bank_expenses: NamedMoneyLine[];
  notes: string;
};

export type RestaurantDayTotals = {
  bankSaleTotal: number;
  cashSaleTotal: number;
  companySaleTotal: number;
  glovo: number;
  justEat: number;
  deliveroo: number;
  totalSale: number;
  kebabPurchase: number;
  ccPurchase: number;
  otherSpesa: number;
  rent: number;
  personPurchases: number;
  cashExpenses: number;
  bankExpenses: number;
  totalSpesa: number;
  totalProfit: number;
};

export type RestaurantDailyDraft = {
  transaction_date: string;
  bank_sales: number;
  cash_sales: number;
  company_sales: RestaurantCompanySaleLine[];
  company_spesa: RestaurantCompanySpesaLine[];
  other_spesa: NamedMoneyLine[];
  rent: number;
  person_purchases: NamedMoneyLine[];
  cash_expenses: NamedMoneyLine[];
  bank_expenses: NamedMoneyLine[];
  notes: string;
};

function trimName(name: string) {
  return name.trim();
}

function deliveryLabel(key: RestaurantDeliveryKey): string {
  return RESTAURANT_DELIVERY_PLATFORMS.find((p) => p.key === key)?.label ?? key;
}

function spesaCompanyLabel(key: RestaurantSpesaCompanyKey): string {
  return RESTAURANT_SPESA_COMPANIES.find((c) => c.key === key)?.label ?? key;
}

function normalizeDeliveryKey(raw: unknown): RestaurantDeliveryKey | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (t === "glovo") return "glovo";
  if (t === "just_eat" || t === "justeat") return "just_eat";
  if (t === "deliveroo" || t === "delivero") return "deliveroo";
  return null;
}

function normalizeSpesaCompanyKey(raw: unknown): RestaurantSpesaCompanyKey | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/&/g, "and");
  if (t === "kebab") return "kebab";
  if (t === "c_and_c" || t === "c&c" || t === "c_and_c" || t === "candc") return "c_and_c";
  return null;
}

function emptyTotals(): RestaurantDayTotals {
  return {
    bankSaleTotal: 0,
    cashSaleTotal: 0,
    companySaleTotal: 0,
    glovo: 0,
    justEat: 0,
    deliveroo: 0,
    totalSale: 0,
    kebabPurchase: 0,
    ccPurchase: 0,
    otherSpesa: 0,
    rent: 0,
    personPurchases: 0,
    cashExpenses: 0,
    bankExpenses: 0,
    totalSpesa: 0,
    totalProfit: 0,
  };
}

export function restaurantProfitFromTransactions(rows: TransactionWithMeta[]): RestaurantDayTotals {
  const t = emptyTotals();

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    const amt = Number(row.amount) || 0;
    if (amt <= 0 && metaString(m, "line") !== "daily_notes") continue;

    if (metaString(m, "source") === SOURCE_RESTAURANT) {
      const line = metaString(m, "line") as RestaurantMetaLine | undefined;
      if (line === "cash_sales" && row.transaction_type === "sale") {
        t.cashSaleTotal += amt;
      } else if (line === "bank_sales" && row.transaction_type === "sale") {
        t.bankSaleTotal += amt;
      } else if (line === "company_sale" && row.transaction_type === "sale") {
        const key = normalizeDeliveryKey(m["company_key"]);
        if (key === "glovo") t.glovo += amt;
        else if (key === "just_eat") t.justEat += amt;
        else if (key === "deliveroo") t.deliveroo += amt;
        t.companySaleTotal += amt;
      } else if (line === "company_spesa" && row.transaction_type === "expense") {
        const key = normalizeSpesaCompanyKey(m["company_key"]);
        if (key === "kebab") t.kebabPurchase += amt;
        else if (key === "c_and_c") t.ccPurchase += amt;
      } else if (line === "other_spesa" && row.transaction_type === "expense") {
        t.otherSpesa += amt;
      } else if (line === "rent" && row.transaction_type === "expense") {
        t.rent += amt;
      } else if (line === "person_purchase" && row.transaction_type === "expense") {
        t.personPurchases += amt;
      } else if (line === "expense_cash_line" && row.transaction_type === "expense") {
        t.cashExpenses += amt;
      } else if (line === "expense_bank_line" && row.transaction_type === "expense") {
        t.bankExpenses += amt;
      } else if (line === "purchases" && row.transaction_type === "expense") {
        t.otherSpesa += amt;
      } else if (line === "expenses" && row.transaction_type === "expense") {
        t.otherSpesa += amt;
      }
      continue;
    }

    const d = (row.description ?? "").trim().toLowerCase();
    if (row.transaction_type === "sale" && d === DESC_REST_CASH.toLowerCase()) t.cashSaleTotal += amt;
    else if (row.transaction_type === "sale" && d === DESC_REST_BANK.toLowerCase()) t.bankSaleTotal += amt;
    else if (row.transaction_type === "expense" && d.includes("restaurant: purchases")) t.otherSpesa += amt;
    else if (row.transaction_type === "expense" && d.includes("restaurant: expenses")) t.otherSpesa += amt;
  }

  t.companySaleTotal = t.glovo + t.justEat + t.deliveroo;
  t.totalSale = t.cashSaleTotal + t.bankSaleTotal + t.companySaleTotal;
  t.totalSpesa =
    t.kebabPurchase +
    t.ccPurchase +
    t.otherSpesa +
    t.rent +
    t.personPurchases +
    t.cashExpenses +
    t.bankExpenses;
  t.totalProfit = t.totalSale - t.totalSpesa;
  return t;
}

export function parseRestaurantDailyFromTransactions(
  rows: TransactionWithMeta[],
  dateISO: string,
): RestaurantDailyDraft {
  const draft: RestaurantDailyDraft = {
    transaction_date: dateISO,
    bank_sales: 0,
    cash_sales: 0,
    company_sales: [],
    company_spesa: [],
    other_spesa: [],
    rent: 0,
    person_purchases: [],
    cash_expenses: [],
    bank_expenses: [],
    notes: "",
  };

  for (const row of rows) {
    if (row.transaction_date !== dateISO) continue;
    const m = getMetadata(row.metadata, row.description);
    const amt = Number(row.amount) || 0;

    if (metaString(m, "source") !== SOURCE_RESTAURANT) continue;
    const line = metaString(m, "line") as RestaurantMetaLine | undefined;

    if (line === "cash_sales" && row.transaction_type === "sale") draft.cash_sales += amt;
    else if (line === "bank_sales" && row.transaction_type === "sale") draft.bank_sales += amt;
    else if (line === "company_sale" && row.transaction_type === "sale" && amt > 0) {
      const key = normalizeDeliveryKey(m["company_key"]);
      if (key) draft.company_sales.push({ company_key: key, amount: amt });
    } else if (line === "company_spesa" && row.transaction_type === "expense" && amt > 0) {
      const key = normalizeSpesaCompanyKey(m["company_key"]);
      if (key) draft.company_spesa.push({ company_key: key, amount: amt });
    } else if (line === "other_spesa" && row.transaction_type === "expense" && amt > 0) {
      draft.other_spesa.push({
        item_name: metaString(m, "item_name") ?? "",
        amount: amt,
      });
    } else if (line === "rent" && row.transaction_type === "expense") draft.rent += amt;
    else if (line === "person_purchase" && row.transaction_type === "expense" && amt > 0) {
      draft.person_purchases.push({
        item_name: metaString(m, "item_name") ?? "",
        amount: amt,
      });
    } else if (line === "expense_cash_line" && row.transaction_type === "expense" && amt > 0) {
      draft.cash_expenses.push({
        item_name: metaString(m, "item_name") ?? "",
        amount: amt,
      });
    } else if (line === "expense_bank_line" && row.transaction_type === "expense" && amt > 0) {
      draft.bank_expenses.push({
        item_name: metaString(m, "item_name") ?? "",
        amount: amt,
      });
    } else if (line === "purchases" && row.transaction_type === "expense" && amt > 0) {
      draft.other_spesa.push({ item_name: "Legacy purchases", amount: amt });
    } else if (line === "expenses" && row.transaction_type === "expense" && amt > 0) {
      draft.other_spesa.push({ item_name: "Legacy expenses", amount: amt });
    } else if (line === "daily_notes") {
      const notes = typeof m["notes"] === "string" ? m["notes"] : "";
      if (!isBlankNote(notes)) draft.notes = notes;
    }
  }

  return draft;
}

export function buildRestaurantDailyRows(input: RestaurantDailyInput): TransactionInsert[] {
  const rows: TransactionInsert[] = [];
  const source = SOURCE_RESTAURANT;

  const bank = Math.max(0, input.bank_sales);
  if (bank > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: bank,
      description: DESC_REST_BANK,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "bank_sales" satisfies RestaurantMetaLine },
    });
  }

  const cash = Math.max(0, input.cash_sales);
  if (cash > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: cash,
      description: DESC_REST_CASH,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "cash_sales" satisfies RestaurantMetaLine },
    });
  }

  for (let i = 0; i < input.company_sales.length; i += 1) {
    const line = input.company_sales[i];
    if (!line || line.amount <= 0) continue;
    const label = deliveryLabel(line.company_key);
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: line.amount,
      description: `Restaurant: Company sale (${label})`,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "company_sale" satisfies RestaurantMetaLine,
        company_key: line.company_key,
      },
    });
  }

  for (let i = 0; i < input.company_spesa.length; i += 1) {
    const line = input.company_spesa[i];
    if (!line || line.amount <= 0) continue;
    const label = spesaCompanyLabel(line.company_key);
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: `Restaurant: Company spesa (${label})`,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "company_spesa" satisfies RestaurantMetaLine,
        company_key: line.company_key,
      },
    });
  }

  for (let i = 0; i < input.other_spesa.length; i += 1) {
    const line = input.other_spesa[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: name ? `Restaurant: Other spesa: ${name}` : `Restaurant: Other spesa (${i + 1})`,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "other_spesa" satisfies RestaurantMetaLine,
        item_name: name,
      },
    });
  }

  const rent = Math.max(0, input.rent);
  if (rent > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: rent,
      description: "Restaurant: Rent",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "rent" satisfies RestaurantMetaLine },
    });
  }

  for (let i = 0; i < input.person_purchases.length; i += 1) {
    const line = input.person_purchases[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: name ? `Restaurant: Person purchase: ${name}` : `Restaurant: Person purchase (${i + 1})`,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "person_purchase" satisfies RestaurantMetaLine,
        item_name: name,
      },
    });
  }

  for (let i = 0; i < input.cash_expenses.length; i += 1) {
    const line = input.cash_expenses[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: name ? `Restaurant: Cash expense: ${name}` : `Restaurant: Cash expense (${i + 1})`,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "expense_cash_line" satisfies RestaurantMetaLine,
        item_name: name,
      },
    });
  }

  for (let i = 0; i < input.bank_expenses.length; i += 1) {
    const line = input.bank_expenses[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: name ? `Restaurant: Bank expense: ${name}` : `Restaurant: Bank expense (${i + 1})`,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "expense_bank_line" satisfies RestaurantMetaLine,
        item_name: name,
      },
    });
  }

  const trimmedNotes = input.notes.trim();
  if (!isBlankNote(input.notes)) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: 0,
      description: DESC_REST_NOTES,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "daily_notes" satisfies RestaurantMetaLine,
        notes: trimmedNotes,
      },
    });
  }

  return rows;
}

export function restaurantDayHasContent(rows: TransactionWithMeta[]): boolean {
  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_RESTAURANT) continue;
    const line = metaString(m, "line");
    if (line === "daily_notes") continue;
    if (Number(row.amount) > 0) return true;
  }
  return false;
}

export function summarizeRestaurantDay(rows: TransactionWithMeta[], dateISO: string) {
  const dayRows = rows.filter((r) => r.transaction_date === dateISO);
  return { date: dateISO, ...restaurantProfitFromTransactions(dayRows) };
}

export type CompanyDropdownRowStr = { companyKey: RestaurantDeliveryKey | ""; amount: string };
export type SpesaDropdownRowStr = { companyKey: RestaurantSpesaCompanyKey | ""; amount: string };

export const emptyCompanySaleRow = (): CompanyDropdownRowStr => ({ companyKey: "", amount: "" });
export const emptySpesaCompanyRow = (): SpesaDropdownRowStr => ({ companyKey: "", amount: "" });

export function restaurantCompanySalesFromForm(rows: CompanyDropdownRowStr[]): RestaurantCompanySaleLine[] {
  const out: RestaurantCompanySaleLine[] = [];
  for (const row of rows) {
    const amount = parseNonNegative(row.amount);
    if (amount <= 0 || !row.companyKey) continue;
    out.push({ company_key: row.companyKey, amount });
  }
  return out;
}

export function restaurantCompanySpesaFromForm(rows: SpesaDropdownRowStr[]): RestaurantCompanySpesaLine[] {
  const out: RestaurantCompanySpesaLine[] = [];
  for (const row of rows) {
    const amount = parseNonNegative(row.amount);
    if (amount <= 0 || !row.companyKey) continue;
    out.push({ company_key: row.companyKey, amount });
  }
  return out;
}

export function restaurantNamedLinesFromForm(
  rows: { itemName: string; amount: string }[],
): NamedMoneyLine[] {
  return rows
    .map((r) => ({ item_name: r.itemName, amount: parseNonNegative(r.amount) }))
    .filter((r) => r.amount > 0);
}

export function hydrateCompanySaleRows(lines: RestaurantCompanySaleLine[]): CompanyDropdownRowStr[] {
  if (lines.length === 0) return [emptyCompanySaleRow()];
  return lines.map((l) => ({ companyKey: l.company_key, amount: formatMoneyInputValue(l.amount) }));
}

export function hydrateSpesaCompanyRows(lines: RestaurantCompanySpesaLine[]): SpesaDropdownRowStr[] {
  if (lines.length === 0) return [emptySpesaCompanyRow()];
  return lines.map((l) => ({ companyKey: l.company_key, amount: formatMoneyInputValue(l.amount) }));
}

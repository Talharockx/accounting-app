import {
  getMetadata,
  metaString,
  parseNonNegative,
  type NamedMoneyLine,
  type TransactionInsert,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { isBlankNote } from "@/lib/utils/rich-text";

export const SOURCE_GROCERY = "daily_entry_grocery" as const;
export const DESC_GROCERY_NOTES = "Grocery: Daily Notes";

export type GroceryMetaLine =
  | "bank_sales"
  | "cash_sales"
  | "person_sale"
  | "company_expense"
  | "person_expense"
  | "kametti_expense"
  | "cheque"
  | "fixed_expense"
  | "daily_notes";

export type GroceryFixedExpenseCategory =
  | "rent"
  | "bill"
  | "accountant"
  | "pos_expense"
  /** Prefer this over legacy `pos_expense`. */
  | "bank_expense"
  | "salary"
  | "extra"
  | "vodafone";

/** Active fixed operating lines shown in Daily Entry (legacy categories still total when present). */
export const GROCERY_FIXED_EXPENSE_CATEGORIES: {
  key: GroceryFixedExpenseCategory;
  label: string;
  hint: string;
}[] = [
  { key: "bank_expense", label: "Bank expense", hint: "Bank / card payment expense for the day." },
];

/** All known fixed categories (legacy + current) for totals / hydration. */
export const GROCERY_ALL_FIXED_EXPENSE_CATEGORIES: GroceryFixedExpenseCategory[] = [
  "rent",
  "bill",
  "accountant",
  "pos_expense",
  "bank_expense",
  "salary",
  "extra",
  "vodafone",
];

export type GroceryPersonSaleLine = {
  item_name: string;
  bank: number;
  cash: number;
};

export type GroceryChequeLine = {
  item_name: string;
  amount: number;
  due_date: string;
  paid: boolean;
};

export type GroceryFixedExpenseLine = {
  category: GroceryFixedExpenseCategory;
  amount: number;
  label?: string;
};

export type GroceryDailyInput = {
  business_id: string;
  created_by_user_id: string;
  transaction_date: string;
  bank_sales: number;
  cash_sales: number;
  person_sales: GroceryPersonSaleLine[];
  company_expenses: NamedMoneyLine[];
  person_expenses: NamedMoneyLine[];
  kametti_expenses: NamedMoneyLine[];
  cheques: GroceryChequeLine[];
  fixed_expenses: GroceryFixedExpenseLine[];
  notes: string;
};

export type GroceryDayTotals = {
  bankSaleTotal: number;
  cashSaleTotal: number;
  /** Shop bank + shop cash + all person sales (bank + cash per person). */
  totalSale: number;
  companyAmadari: number;
  companyCipPat: number;
  companyEurospin: number;
  companyAia: number;
  /** Sum of all company expense lines. */
  companyExpenses: number;
  cheques: number;
  affitto: number;
  bolletta: number;
  commercialista: number;
  stipendio: number;
  /** Expenses by person — included in Spesa total. */
  personExpenses: number;
  /** Kametti — included in Spesa total. */
  kametti: number;
  vodafone: number;
  spesaPos: number;
  extra: number;
  /** Company + person expenses + cheques + fixed operating costs + Kametti + Vodafone + POS + extra. */
  spesaTotal: number;
  /** totalSale − spesaTotal */
  totalProfit: number;
};

export const GROCERY_TRACKED_COMPANIES = [
  { key: "amadari", label: "Amadari" },
  { key: "cip_pat", label: "Cip./Pat." },
  { key: "eurospin", label: "Eurospin" },
  { key: "aia", label: "Aia" },
] as const;

export type GroceryTrackedCompanyKey = (typeof GROCERY_TRACKED_COMPANIES)[number]["key"];

function classifyCompanyExpense(name: string): GroceryTrackedCompanyKey | "other" {
  const n = name.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (!n) return "other";
  if (n.includes("amadari")) return "amadari";
  if (n.includes("eurospin")) return "eurospin";
  if (n === "aia" || n.startsWith("aia ")) return "aia";
  if (n.includes("cip") || n.includes("pat")) return "cip_pat";
  return "other";
}

/** Map stored company name to a dropdown label (legacy free-text rows included). */
export function resolveCompanyDropdownLabel(name: string): string {
  const bucket = classifyCompanyExpense(name);
  if (bucket === "other") {
    const trimmed = name.trim();
    const exact = GROCERY_TRACKED_COMPANIES.find((c) => c.label.toLowerCase() === trimmed.toLowerCase());
    if (exact) return exact.label;
    return trimmed || GROCERY_TRACKED_COMPANIES[0].label;
  }
  return GROCERY_TRACKED_COMPANIES.find((c) => c.key === bucket)?.label ?? GROCERY_TRACKED_COMPANIES[0].label;
}

export function emptyCompanyExpenseRow(): { itemName: string; amount: string } {
  return { itemName: "", amount: "0" };
}

export function emptyCompanyExpenseRows(): { itemName: string; amount: string }[] {
  return [emptyCompanyExpenseRow()];
}

/** Freeform company name + amount lines (not the old fixed Amadari / Cip / Eurospin grid). */
export function hydrateCompanyExpenseRows(lines: NamedMoneyLine[]): { itemName: string; amount: string }[] {
  const rows = lines
    .filter((line) => line.item_name.trim() || line.amount > 0)
    .map((line) => ({
      itemName: line.item_name,
      amount: String(line.amount),
    }));
  return rows.length > 0 ? rows : emptyCompanyExpenseRows();
}

function emptyGroceryDayTotals(): GroceryDayTotals {
  return {
    bankSaleTotal: 0,
    cashSaleTotal: 0,
    totalSale: 0,
    companyAmadari: 0,
    companyCipPat: 0,
    companyEurospin: 0,
    companyAia: 0,
    companyExpenses: 0,
    cheques: 0,
    affitto: 0,
    bolletta: 0,
    commercialista: 0,
    stipendio: 0,
    personExpenses: 0,
    kametti: 0,
    vodafone: 0,
    spesaPos: 0,
    extra: 0,
    spesaTotal: 0,
    totalProfit: 0,
  };
}

function trimName(name: string) {
  return name.trim();
}

function descPersonSale(name: string, index: number) {
  const t = trimName(name);
  return t ? `Grocery person sale: ${t}` : `Grocery person sale (${index + 1})`;
}

function descCompanyExpense(name: string, index: number) {
  const t = trimName(name);
  return t ? `Grocery company expense: ${t}` : `Grocery company expense (${index + 1})`;
}

function descPersonExpense(name: string, index: number) {
  const t = trimName(name);
  return t ? `Grocery person expense: ${t}` : `Grocery person expense (${index + 1})`;
}

function descKametti(name: string, index: number) {
  const t = trimName(name);
  return t ? `Grocery Kametti: ${t}` : `Grocery Kametti (${index + 1})`;
}

function descCheque(name: string, index: number) {
  const t = trimName(name);
  return t ? `Grocery cheque: ${t}` : `Grocery cheque (${index + 1})`;
}

function fixedCategoryLabel(category: GroceryFixedExpenseCategory): string {
  if (category === "pos_expense" || category === "bank_expense") return "Bank expense";
  return GROCERY_FIXED_EXPENSE_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}

function descFixedExpense(category: GroceryFixedExpenseCategory, label: string | undefined, index: number) {
  const cat = fixedCategoryLabel(category);
  const t = trimName(label ?? "");
  return t ? `Grocery ${cat}: ${t}` : `Grocery ${cat} (${index + 1})`;
}

export function buildGroceryDailyRows(input: GroceryDailyInput): TransactionInsert[] {
  const rows: TransactionInsert[] = [];
  const source = SOURCE_GROCERY;

  const bank = Math.max(0, input.bank_sales);
  if (bank > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: bank,
      description: "Grocery: Bank sales",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "bank_sales" satisfies GroceryMetaLine },
    });
  }

  const cash = Math.max(0, input.cash_sales);
  if (cash > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: cash,
      description: "Grocery: Cash sales",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "cash_sales" satisfies GroceryMetaLine },
    });
  }

  for (let i = 0; i < input.person_sales.length; i += 1) {
    const line = input.person_sales[i];
    if (!line) continue;
    const bankAmt = Math.max(0, line.bank);
    const cashAmt = Math.max(0, line.cash);
    const total = bankAmt + cashAmt;
    if (total <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: total,
      description: descPersonSale(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "person_sale" satisfies GroceryMetaLine,
        item_name: name,
        bank_amount: bankAmt,
        cash_amount: cashAmt,
      },
    });
  }

  for (let i = 0; i < input.company_expenses.length; i += 1) {
    const line = input.company_expenses[i];
    if (!line || line.amount <= 0) continue;
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: descCompanyExpense(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "company_expense" satisfies GroceryMetaLine,
        item_name: trimName(line.item_name),
      },
    });
  }

  for (let i = 0; i < input.person_expenses.length; i += 1) {
    const line = input.person_expenses[i];
    if (!line || line.amount <= 0) continue;
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: descPersonExpense(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "person_expense" satisfies GroceryMetaLine,
        item_name: trimName(line.item_name),
      },
    });
  }

  for (let i = 0; i < input.cheques.length; i += 1) {
    const line = input.cheques[i];
    if (!line || line.amount <= 0) continue;
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: descCheque(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "cheque" satisfies GroceryMetaLine,
        item_name: trimName(line.item_name),
        due_date: line.due_date || undefined,
        paid: line.paid,
      },
    });
  }

  const fixedByCategory: Partial<Record<GroceryFixedExpenseCategory, number>> = {};
  for (const line of input.fixed_expenses) {
    if (line.amount <= 0) continue;
    fixedByCategory[line.category] = (fixedByCategory[line.category] ?? 0) + 1;
    const idx = fixedByCategory[line.category] ?? 1;
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: descFixedExpense(line.category, line.label, idx - 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "fixed_expense" satisfies GroceryMetaLine,
        category: line.category,
        label: trimName(line.label ?? "") || undefined,
      },
    });
  }

  for (let i = 0; i < input.kametti_expenses.length; i += 1) {
    const line = input.kametti_expenses[i];
    if (!line || line.amount <= 0) continue;
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: descKametti(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "kametti_expense" satisfies GroceryMetaLine,
        item_name: trimName(line.item_name),
      },
    });
  }

  if (!isBlankNote(input.notes)) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: 0,
      description: DESC_GROCERY_NOTES,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "daily_notes" satisfies GroceryMetaLine,
        notes: input.notes.trim(),
      },
    });
  }

  return rows;
}

export function parseGroceryDailyFromTransactions(
  rows: TransactionWithMeta[],
  dateISO: string,
): Omit<GroceryDailyInput, "business_id" | "created_by_user_id" | "transaction_date"> {
  const dayRows = rows.filter((r) => r.transaction_date === dateISO);

  let bank_sales = 0;
  let cash_sales = 0;
  const person_sales: GroceryPersonSaleLine[] = [];
  const company_expenses: NamedMoneyLine[] = [];
  const person_expenses: NamedMoneyLine[] = [];
  const kametti_expenses: NamedMoneyLine[] = [];
  const cheques: GroceryChequeLine[] = [];
  const fixed_expenses: GroceryFixedExpenseLine[] = [];
  let notes = "";

  for (const row of dayRows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_GROCERY) continue;

    const line = metaString(m, "line") as GroceryMetaLine | undefined;
    const amt = Number(row.amount) || 0;
    const itemName = typeof m["item_name"] === "string" ? (m["item_name"] as string) : "";

    if (line === "bank_sales" && row.transaction_type === "sale") bank_sales += amt;
    else if (line === "cash_sales" && row.transaction_type === "sale") cash_sales += amt;
    else if (line === "person_sale" && row.transaction_type === "sale") {
      const bankAmt = typeof m["bank_amount"] === "number" ? Math.max(0, m["bank_amount"]) : 0;
      const cashAmt = typeof m["cash_amount"] === "number" ? Math.max(0, m["cash_amount"]) : 0;
      if (bankAmt > 0 || cashAmt > 0) {
        person_sales.push({ item_name: itemName, bank: bankAmt, cash: cashAmt });
      } else if (amt > 0) {
        person_sales.push({ item_name: itemName, bank: 0, cash: amt });
      }
    } else if (line === "company_expense" && row.transaction_type === "expense") {
      company_expenses.push({ item_name: itemName, amount: amt });
    } else if (line === "person_expense" && row.transaction_type === "expense") {
      person_expenses.push({ item_name: itemName, amount: amt });
    } else if (line === "kametti_expense" && row.transaction_type === "expense") {
      kametti_expenses.push({ item_name: itemName, amount: amt });
    } else if (line === "cheque" && row.transaction_type === "expense") {
      cheques.push({
        item_name: itemName,
        amount: amt,
        due_date: typeof m["due_date"] === "string" ? m["due_date"] : "",
        paid: m["paid"] === true,
      });
    } else if (line === "fixed_expense" && row.transaction_type === "expense") {
      const category = m["category"] as GroceryFixedExpenseCategory | undefined;
      if (category && GROCERY_FIXED_EXPENSE_CATEGORIES.some((c) => c.key === category)) {
        fixed_expenses.push({
          category,
          amount: amt,
          label: typeof m["label"] === "string" ? m["label"] : undefined,
        });
      }
    } else if (line === "daily_notes" && row.transaction_type === "expense") {
      const n = typeof m["notes"] === "string" ? m["notes"] : "";
      if (!isBlankNote(n)) notes = n;
    }
  }

  return {
    bank_sales,
    cash_sales,
    person_sales: person_sales.length ? person_sales : [{ item_name: "", bank: 0, cash: 0 }],
    company_expenses: company_expenses.length ? company_expenses : [{ item_name: "", amount: 0 }],
    person_expenses: person_expenses.length ? person_expenses : [{ item_name: "", amount: 0 }],
    kametti_expenses: kametti_expenses.length ? kametti_expenses : [{ item_name: "", amount: 0 }],
    cheques: cheques.length ? cheques : [{ item_name: "", amount: 0, due_date: "", paid: false }],
    fixed_expenses,
    notes,
  };
}

export function groceryProfitFromTransactions(rows: TransactionWithMeta[]): GroceryDayTotals {
  const totals = emptyGroceryDayTotals();

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_GROCERY) continue;

    const line = metaString(m, "line") as GroceryMetaLine | undefined;
    const amt = Number(row.amount) || 0;
    const itemName = typeof m["item_name"] === "string" ? (m["item_name"] as string) : "";

    if (line === "bank_sales" && row.transaction_type === "sale") totals.bankSaleTotal += amt;
    else if (line === "cash_sales" && row.transaction_type === "sale") totals.cashSaleTotal += amt;
    else if (line === "person_sale" && row.transaction_type === "sale") {
      const bankAmt = typeof m["bank_amount"] === "number" ? Math.max(0, m["bank_amount"]) : 0;
      const cashAmt = typeof m["cash_amount"] === "number" ? Math.max(0, m["cash_amount"]) : 0;
      if (bankAmt > 0 || cashAmt > 0) {
        totals.bankSaleTotal += bankAmt;
        totals.cashSaleTotal += cashAmt;
      } else if (amt > 0) {
        totals.cashSaleTotal += amt;
      }
    } else if (line === "company_expense" && row.transaction_type === "expense") {
      totals.companyExpenses += amt;
      const bucket = classifyCompanyExpense(itemName);
      if (bucket === "amadari") totals.companyAmadari += amt;
      else if (bucket === "cip_pat") totals.companyCipPat += amt;
      else if (bucket === "eurospin") totals.companyEurospin += amt;
      else if (bucket === "aia") totals.companyAia += amt;
    } else if (line === "person_expense" && row.transaction_type === "expense") totals.personExpenses += amt;
    else if (line === "kametti_expense" && row.transaction_type === "expense") totals.kametti += amt;
    else if (line === "cheque" && row.transaction_type === "expense") totals.cheques += amt;
    else if (line === "fixed_expense" && row.transaction_type === "expense") {
      const category = m["category"] as GroceryFixedExpenseCategory | undefined;
      if (category === "rent") totals.affitto += amt;
      else if (category === "bill") totals.bolletta += amt;
      else if (category === "accountant") totals.commercialista += amt;
      else if (category === "salary") totals.stipendio += amt;
      else if (category === "pos_expense" || category === "bank_expense") totals.spesaPos += amt;
      else if (category === "vodafone") totals.vodafone += amt;
      else if (category === "extra") totals.extra += amt;
    }
  }

  totals.totalSale = totals.bankSaleTotal + totals.cashSaleTotal;
  totals.spesaTotal =
    totals.companyExpenses +
    totals.personExpenses +
    totals.cheques +
    totals.affitto +
    totals.bolletta +
    totals.commercialista +
    totals.stipendio +
    totals.kametti +
    totals.vodafone +
    totals.spesaPos +
    totals.extra;

  // Legacy display: older days stored person expenses before Kametti had its own section.
  const hasKamettiLines = rows.some((row) => {
    const m = getMetadata(row.metadata, row.description);
    return metaString(m, "source") === SOURCE_GROCERY && metaString(m, "line") === "kametti_expense";
  });
  if (!hasKamettiLines && totals.personExpenses > 0) {
    totals.kametti += totals.personExpenses;
  }

  totals.totalProfit = totals.totalSale - totals.spesaTotal;

  return totals;
}

/** Whether saved rows contain any grocery figures (incl. person sales / notes). */
export function groceryDayHasContent(rows: TransactionWithMeta[]): boolean {
  const t = groceryProfitFromTransactions(rows);
  if (t.totalSale + t.spesaTotal > 0) return true;
  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_GROCERY) continue;
    const line = metaString(m, "line");
    if (line === "person_sale" && Number(row.amount) > 0) return true;
    if (line === "daily_notes") {
      const n = typeof m["notes"] === "string" ? m["notes"] : "";
      if (!isBlankNote(n)) return true;
    }
  }
  return false;
}

export function summarizeGroceryDay(rows: TransactionWithMeta[], dateISO: string) {
  const dayRows = rows.filter((r) => r.transaction_date === dateISO);
  return groceryProfitFromTransactions(dayRows);
}

/** Convert string form rows into builder input fragments. */
export function groceryPersonSalesFromForm(
  rows: { itemName: string; bank: string; cash: string }[],
): GroceryPersonSaleLine[] {
  return rows
    .map((r) => ({
      item_name: r.itemName,
      bank: parseNonNegative(r.bank),
      cash: parseNonNegative(r.cash),
    }))
    .filter((r) => r.bank > 0 || r.cash > 0);
}

export function groceryNamedLinesFromForm(rows: { itemName: string; amount: string }[]): NamedMoneyLine[] {
  return rows
    .map((r) => ({ item_name: r.itemName, amount: parseNonNegative(r.amount) }))
    .filter((r) => r.amount > 0);
}

export function groceryChequesFromForm(
  rows: { itemName: string; amount: string; dueDate: string; paid: boolean }[],
): GroceryChequeLine[] {
  return rows
    .map((r) => ({
      item_name: r.itemName,
      amount: parseNonNegative(r.amount),
      due_date: r.dueDate,
      paid: r.paid,
    }))
    .filter((r) => r.amount > 0);
}

export function groceryFixedFromForm(
  sections: Record<GroceryFixedExpenseCategory, { itemName: string; amount: string }[]>,
): GroceryFixedExpenseLine[] {
  const out: GroceryFixedExpenseLine[] = [];
  for (const key of GROCERY_ALL_FIXED_EXPENSE_CATEGORIES) {
    for (const row of sections[key] ?? []) {
      const amount = parseNonNegative(row.amount);
      if (amount <= 0) continue;
      out.push({
        category: key,
        amount,
        label: row.itemName.trim() || undefined,
      });
    }
  }
  return out;
}

export function emptyGroceryFixedSections(): Record<
  GroceryFixedExpenseCategory,
  { itemName: string; amount: string }[]
> {
  const sections = {} as Record<GroceryFixedExpenseCategory, { itemName: string; amount: string }[]>;
  for (const key of GROCERY_ALL_FIXED_EXPENSE_CATEGORIES) {
    sections[key] = [{ itemName: "", amount: "0" }];
  }
  return sections;
}

export function hydrateGroceryFixedSections(
  fixed: GroceryFixedExpenseLine[],
): Record<GroceryFixedExpenseCategory, { itemName: string; amount: string }[]> {
  const sections = {} as Record<GroceryFixedExpenseCategory, { itemName: string; amount: string }[]>;
  for (const key of GROCERY_ALL_FIXED_EXPENSE_CATEGORIES) {
    sections[key] = [];
  }
  for (const line of fixed) {
    const key = line.category;
    if (!sections[key]) sections[key] = [];
    sections[key].push({
      itemName: line.label ?? "",
      amount: String(line.amount),
    });
  }
  for (const key of GROCERY_ALL_FIXED_EXPENSE_CATEGORIES) {
    if (sections[key].length === 0) {
      sections[key] = [{ itemName: "", amount: "0" }];
    }
  }
  return sections;
}

/** Sum POS + bank expense fixed lines for the Daily Entry “Bank expense” field. */
export function groceryBankExpenseAmount(fixed: GroceryFixedExpenseLine[]): number {
  return fixed.reduce((sum, line) => {
    if (line.category === "bank_expense" || line.category === "pos_expense") {
      return sum + Math.max(0, line.amount);
    }
    return sum;
  }, 0);
}

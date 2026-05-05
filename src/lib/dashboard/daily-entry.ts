/** Fallback when DB has no `metadata` column: JSON URI-encoded and appended to `description`. */
export const META_EMBED_MARK = "|__META__:";

/** Shared identifiers for structured daily-entry rows (stored on transactions.metadata). */
export const SOURCE_RESTAURANT = "daily_entry_restaurant" as const;
export const SOURCE_MOBILE = "daily_entry_mobile" as const;

export type RestaurantMetaLine =
  | "cash_sales"
  | "bank_sales"
  | "purchases"
  | "expenses"
  | "daily_notes";

export type MobileMetaLine =
  | "mobile_phone_sale"
  | "sim_sales"
  | "repair_income"
  | "mobile_purchases"
  | "mobile_expenses";

export type TransactionInsert = {
  business_id: string;
  transaction_type: "sale" | "expense" | "repair";
  amount: number;
  description: string;
  transaction_date: string;
  created_by_user_id: string;
  metadata: Record<string, unknown>;
};

export type TransactionWithMeta = {
  amount: number;
  transaction_type: "sale" | "expense" | "repair";
  description: string | null;
  transaction_date: string;
  metadata: unknown;
};

export const DESC_REST_CASH = "Restaurant: Cash Sales";
export const DESC_REST_BANK = "Restaurant: Bank Sales";
export const DESC_REST_PURCHASES = "Restaurant: Purchases";
export const DESC_REST_EXPENSES = "Restaurant: Expenses";
export const DESC_REST_NOTES = "Restaurant: Daily Notes";

function normDesc(description: string | null) {
  return (description ?? "").trim().toLowerCase();
}

export function parseNonNegative(value: string, fallback = 0): number {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, n);
}

export function parseEmbeddedMetaFromDescription(description: string | null | undefined): Record<string, unknown> {
  const d = description ?? "";
  const idx = d.indexOf(META_EMBED_MARK);
  if (idx === -1) return {};
  const payload = d.slice(idx + META_EMBED_MARK.length);
  try {
    const parsed = JSON.parse(decodeURIComponent(payload));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Human-readable description without the embedded JSON suffix (for tables / labels). */
export function stripEmbeddedMetaFromDescription(description: string | null): string {
  const d = description ?? "";
  const idx = d.indexOf(META_EMBED_MARK);
  return idx === -1 ? d : d.slice(0, idx).trimEnd();
}

export function getMetadata(meta: unknown, description?: string | null): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const direct = meta as Record<string, unknown>;
    if (Object.keys(direct).length > 0) return direct;
  }
  const embedded = parseEmbeddedMetaFromDescription(description ?? null);
  return Object.keys(embedded).length > 0 ? embedded : {};
}

export function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const v = meta[key];
  return typeof v === "string" ? v : undefined;
}

function metaNumber_nonneg(meta: Record<string, unknown>, key: string): number {
  const v = meta[key];
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, v);
}

/** Restaurant daily profit for a set of transactions (same filters as UI). */
export function restaurantProfitFromTransactions(rows: TransactionWithMeta[]): {
  cash: number;
  bank: number;
  purchases: number;
  expenses: number;
  profit: number;
} {
  let cash = 0;
  let bank = 0;
  let purchases = 0;
  let expenses = 0;
  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    const amt = Number(row.amount) || 0;
    if (metaString(m, "source") === SOURCE_RESTAURANT) {
      const line = metaString(m, "line") as RestaurantMetaLine | undefined;
      if (line === "cash_sales" && row.transaction_type === "sale") cash += amt;
      else if (line === "bank_sales" && row.transaction_type === "sale") bank += amt;
      else if (line === "purchases" && row.transaction_type === "expense") purchases += amt;
      else if (line === "expenses" && row.transaction_type === "expense") expenses += amt;
      continue;
    }

    const d = normDesc(stripEmbeddedMetaFromDescription(row.description));
    if (row.transaction_type === "sale" && d === normDesc(DESC_REST_CASH)) cash += amt;
    else if (row.transaction_type === "sale" && d === normDesc(DESC_REST_BANK)) bank += amt;
    else if (row.transaction_type === "expense" && d === normDesc(DESC_REST_PURCHASES))
      purchases += amt;
    else if (row.transaction_type === "expense" && d === normDesc(DESC_REST_EXPENSES))
      expenses += amt;
    else if (row.transaction_type === "sale" && d === "daily sales") cash += amt;
    else if (row.transaction_type === "expense" && d === "purchases") purchases += amt;
    else if (row.transaction_type === "expense" && d === "expenses") expenses += amt;
  }
  return {
    cash,
    bank,
    purchases,
    expenses,
    profit: cash + bank - purchases - expenses,
  };
}

/** Mobile daily profit for a set of transactions. */
export function mobileProfitFromTransactions(rows: TransactionWithMeta[]): {
  /** Sum of handset selling prices (revenue). */
  phoneSales: number;
  /** Sum of per-handset profit from metadata (margin). */
  phoneProfit: number;
  simSales: number;
  repairs: number;
  purchases: number;
  expenses: number;
  /** (phoneProfit + SIM + repairs) − (purchases + expenses). */
  profit: number;
} {
  let phoneSales = 0;
  let phoneProfit = 0;
  let simSales = 0;
  let repairs = 0;
  let purchases = 0;
  let expenses = 0;

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    const amt = Number(row.amount) || 0;
    if (metaString(m, "source") === SOURCE_MOBILE) {
      const line = metaString(m, "line") as MobileMetaLine | undefined;
      if (line === "mobile_phone_sale" && row.transaction_type === "sale") {
        phoneSales += amt;
        phoneProfit += metaNumber_nonneg(m, "profit");
      } else if (line === "sim_sales" && row.transaction_type === "sale") simSales += amt;
      else if (line === "repair_income" && row.transaction_type === "repair") repairs += amt;
      else if (line === "mobile_purchases" && row.transaction_type === "expense") purchases += amt;
      else if (line === "mobile_expenses" && row.transaction_type === "expense") expenses += amt;
      continue;
    }

    const displayD = normDesc(stripEmbeddedMetaFromDescription(row.description));

    if (row.transaction_type === "sale" && displayD === "product sales") {
      phoneSales += amt;
    } else if (row.transaction_type === "sale" && displayD.includes("mobile phone")) {
      phoneSales += amt;
      phoneProfit += metaNumber_nonneg(m, "profit");
    } else if (row.transaction_type === "sale" && displayD.includes("mobile sim")) simSales += amt;
    else if (row.transaction_type === "sale" && displayD.includes("sim")) simSales += amt;
    else if (row.transaction_type === "repair" && (displayD === "repairs" || displayD.includes("repair")))
      repairs += amt;
    else if (row.transaction_type === "expense" && displayD.includes("mobile purchase"))
      purchases += amt;
    else if (row.transaction_type === "expense" && displayD.includes("mobile expense"))
      expenses += amt;
  }

  return {
    phoneSales,
    phoneProfit,
    simSales,
    repairs,
    purchases,
    expenses,
    profit: phoneProfit + simSales + repairs - purchases - expenses,
  };
}

export function summarizeRestaurantDay(rows: TransactionWithMeta[], date: string) {
  const dayRows = rows.filter((r) => r.transaction_date === date);
  return {
    date,
    ...restaurantProfitFromTransactions(dayRows),
  };
}

export function summarizeMobileDay(rows: TransactionWithMeta[], date: string) {
  const dayRows = rows.filter((r) => r.transaction_date === date);
  return {
    date,
    ...mobileProfitFromTransactions(dayRows),
  };
}

export type RestaurantDailyInput = {
  business_id: string;
  created_by_user_id: string;
  transaction_date: string;
  cash_sales: number;
  bank_sales: number;
  purchases: number;
  expenses: number;
  notes: string;
};

export function buildRestaurantDailyRows(input: RestaurantDailyInput): TransactionInsert[] {
  const rows: TransactionInsert[] = [];

  const baseContext = SOURCE_RESTAURANT;

  if (input.cash_sales > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: input.cash_sales,
      description: DESC_REST_CASH,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source: baseContext, line: "cash_sales" satisfies RestaurantMetaLine },
    });
  }

  if (input.bank_sales > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: input.bank_sales,
      description: DESC_REST_BANK,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source: baseContext, line: "bank_sales" satisfies RestaurantMetaLine },
    });
  }

  if (input.purchases > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: input.purchases,
      description: DESC_REST_PURCHASES,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source: baseContext, line: "purchases" satisfies RestaurantMetaLine },
    });
  }

  if (input.expenses > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: input.expenses,
      description: DESC_REST_EXPENSES,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source: baseContext, line: "expenses" satisfies RestaurantMetaLine },
    });
  }

  const trimmedNotes = input.notes.trim();
  if (trimmedNotes.length > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: 0,
      description: DESC_REST_NOTES,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source: baseContext,
        line: "daily_notes" satisfies RestaurantMetaLine,
        notes: trimmedNotes,
      },
    });
  }

  return rows;
}

export type PhoneSaleDraft = {
  item_name: string;
  selling_price: number;
  profit: number;
};

export type MobileDailyInput = {
  business_id: string;
  created_by_user_id: string;
  transaction_date: string;
  phones: PhoneSaleDraft[];
  sim_vodafone: number;
  sim_wind: number;
  repair_income: number;
  purchases: number;
  expenses: number;
};

export function buildMobileDailyRows(input: MobileDailyInput): TransactionInsert[] {
  const rows: TransactionInsert[] = [];
  const source = SOURCE_MOBILE;

  for (let index = 0; index < input.phones.length; index += 1) {
    const phone = input.phones[index];
    if (!phone || phone.selling_price <= 0) continue;

    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: phone.selling_price,
      description: phone.item_name.trim()
        ? `Mobile Phone: ${phone.item_name.trim()}`
        : `Mobile Phone (${index + 1})`,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "mobile_phone_sale" satisfies MobileMetaLine,
        item_name: phone.item_name.trim() || "",
        selling_price: phone.selling_price,
        profit: Math.max(0, phone.profit),
      },
    });
  }

  const simTotal = Math.max(0, input.sim_vodafone) + Math.max(0, input.sim_wind);
  if (simTotal > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: simTotal,
      description: "Mobile SIM Sales",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "sim_sales" satisfies MobileMetaLine,
        vodafone: Math.max(0, input.sim_vodafone),
        wind: Math.max(0, input.sim_wind),
      },
    });
  }

  if (input.repair_income > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "repair",
      amount: input.repair_income,
      description: "Mobile Repair Income",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "repair_income" satisfies MobileMetaLine },
    });
  }

  if (input.purchases > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: input.purchases,
      description: "Mobile Purchases",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "mobile_purchases" satisfies MobileMetaLine },
    });
  }

  if (input.expenses > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: input.expenses,
      description: "Mobile Expenses",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "mobile_expenses" satisfies MobileMetaLine },
    });
  }

  return rows;
}

/** Omit `metadata` and embed JSON in `description` (for DBs without a metadata column). */
export function rowsForInsertWithoutMetadataColumn(rows: TransactionInsert[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const { metadata, ...rest } = row;
    const suffix = META_EMBED_MARK + encodeURIComponent(JSON.stringify(metadata ?? {}));
    return {
      ...rest,
      description: `${rest.description}${suffix}`,
    };
  });
}

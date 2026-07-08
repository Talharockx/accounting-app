import { isBlankNote } from "@/lib/utils/rich-text";

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
  | "sim_buy"
  | "sim_sale"
  | "sim_sales"
  | "mobile_phone_sale"
  | "mobile_phone_buy"
  | "accessory_sale"
  | "accessory_buy"
  | "package_r_wind"
  | "package_r_voda"
  | "repair_line"
  | "extra_sale"
  | "repair_income"
  | "mobile_purchases"
  /** Rich-text day notes (amount 0 expense row). */
  | "daily_notes"
  /** Card / POS terminal sales (bank-acquired turnover). */
  | "pos_sale"
  /** Cash-paid operating expense with free-text detail in metadata.item_name. */
  | "expense_cash_line"
  /** Bank / card-paid operating expense with free-text detail. */
  | "expense_bank_line"
  /** Legacy single-day expense lump (read-only in parse). */
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
export const DESC_MOBILE_NOTES = "Mobile: Daily Notes";

function normDesc(description: string | null) {
  return (description ?? "").trim().toLowerCase();
}

export function parseNonNegative(value: string, fallback = 0): number {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, n);
}

/**
 * Sanitize currency field text while typing — keeps partial decimals ("10.", "12.0", "12.01").
 * Returns null when the edit should be ignored (invalid characters).
 */
export function sanitizeNonNegativeDecimalInput(
  value: string,
  options?: { maxFractionDigits?: number },
): string | null {
  const maxFractionDigits = options?.maxFractionDigits ?? 2;
  const normalized = value.trim().replace(/,/g, ".");

  if (normalized === "") return "0";
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  if (normalized === ".") return "0.";

  const dotIndex = normalized.indexOf(".");
  if (dotIndex !== -1) {
    const fraction = normalized.slice(dotIndex + 1);
    if (fraction.length > maxFractionDigits) {
      return normalized.slice(0, dotIndex + 1 + maxFractionDigits);
    }
  }

  return normalized;
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

function trimName(name: string) {
  return name.trim();
}

export function getMetadata(meta: unknown, description?: string | null): Record<string, unknown> {
  if (typeof meta === "string") {
    const t = meta.trim();
    if (t.startsWith("{") && t.endsWith("}")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const rec = parsed as Record<string, unknown>;
          if (Object.keys(rec).length > 0) return rec;
        }
      } catch {
        /* ignore */
      }
    }
  }
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

/**
 * Detail text for a mobile cash/bank expense line: prefers `metadata.item_name`, otherwise parses
 * `Mobile expense (cash|bank): …` from the row description (including JSON embedded after {@link META_EMBED_MARK}).
 */
export function mobileExpenseLineDisplayLabel(row: TransactionWithMeta, meta: Record<string, unknown>): string {
  const fromMeta = trimName(metaString(meta, "item_name") ?? "");
  if (fromMeta) return fromMeta;
  const d = stripEmbeddedMetaFromDescription(row.description ?? null);
  const bankMatch = /^Mobile\s+expense\s+\(bank\):\s*(.+)$/i.exec(d);
  if (bankMatch?.[1]) {
    const tail = trimName(bankMatch[1]);
    if (tail && !/^\(\d+\)$/.test(tail)) return tail;
  }
  const cashMatch = /^Mobile\s+expense\s+\(cash\):\s*(.+)$/i.exec(d);
  if (cashMatch?.[1]) {
    const tail = trimName(cashMatch[1]);
    if (tail && !/^\(\d+\)$/.test(tail)) return tail;
  }
  return "";
}

function metaNumber_nonneg(meta: Record<string, unknown>, key: string): number {
  const v = meta[key];
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, v);
}

/**
 * Cash/bank expense lines that match the client sheet “ricarche” column (yellow + “ric. Shop”):
 * carrier top-ups and similar, not pranzo/rent/spesa.
 * Unknown labels fall through as normal expense (safer than mis-classifying).
 */
export function isSupplierRicarcheExpenseLabel(itemName: string): boolean {
  const n = itemName.trim().toLowerCase().replace(/\s+/g, " ");
  if (!n) return false;
  if (/(^|\s)ric\.\s*shop\b|(^|\s)ric\s+shop\b/.test(n)) return true;
  if (n.includes("mobilax")) return true;
  if (n.includes("utopya")) return true;
  if (n.includes("noltel") || /\bno\s*tel\b/.test(n) || /\bno\s*vod/.test(n)) return true;
  if (/\bric\.\s*wind\b|\bric\s+wind\b/.test(n)) return true;
  if (/\bric\.\s*vod/.test(n) || /\bric\s+vod/.test(n)) return true;
  if (/\bric\.\s*faenza\b|\bric\s+faenza\b/.test(n)) return true;
  if (/\bric\.\s*ch\b|\bric\s+ch\b/.test(n)) return true;
  if (/\bsim\s+iliad\b/.test(n)) return true;
  // Italian sheet wording: "ricarica wind", "ricarica vodafone", …
  if (/\bricaric/.test(n) && /(wind|vod|tim|iliad|vodafone|shop|mobil|faenza|noltel|\bsim\b)/i.test(n)) return true;
  // Distributor / bulk top-up phrasing on card statements
  if (/(distribuzione|distrib\.|ricariche)/i.test(n) && /(wind|vod|tim|iliad|vodafone)/i.test(n)) return true;
  // Abbreviated "R.Wind" / "R Wind" on POS (not handset package sales — those are sale rows)
  if (/\br\.?\s*wind\b/i.test(n) && !/\b(vendita|sale|phone|cell)\b/i.test(n)) return true;
  if (/\br\.?\s*vod/i.test(n) && !/\b(vendita|sale|phone|cell)\b/i.test(n)) return true;
  return false;
}

export {
  buildRestaurantDailyRows,
  restaurantProfitFromTransactions,
  summarizeRestaurantDay,
  type RestaurantDailyInput,
  type RestaurantDayTotals,
} from "@/lib/dashboard/restaurant-daily-entry";

/** Mobile daily P&L from structured daily-entry rows (SOURCE_MOBILE) + legacy description rows. */
export function mobileProfitFromTransactions(rows: TransactionWithMeta[]): {
  /** Handset + accessory retail sale amounts (excl. SIM / packages / repairs / extras). */
  phoneSales: number;
  /** Merchandise margin: handset + accessory sales − buys; falls back to legacy per-handset `profit` metadata when no buy rows exist. */
  phoneProfit: number;
  /** Gross SIM retail (sim_sale + legacy sim_sales). */
  simSales: number;
  simBuy: number;
  /** R.Wind + R.Voda package retail. */
  packageSales: number;
  /** Repair labour / services (excludes packages and extras). */
  repairs: number;
  extras: number;
  /** Card / POS terminal sales. */
  posSales: number;
  /** Cash operating expenses (itemized). */
  cashExpenses: number;
  /** Bank / card operating expenses (itemized). */
  bankExpenses: number;
  /** Inventory + SIM cost + other purchase bucket (matches “Purchases” in ledger). */
  purchases: number;
  /** Cash + bank + legacy lump operating expenses. */
  expenses: number;
  /** Full P&amp;L: revenue (incl. POS) − COGS − operating expenses (incl. bank). */
  profit: number;
  /**
   * Client sheet: {@link totalSaleSheet} − {@link purchases} − {@link supplierRicarche} − cash operating expenses
   * ({@link cashExpenses}: itemized cash + legacy lump). **Bank/card lines are not subtracted here** — see {@link bankExpenses}.
   */
  lastBalance: number;
  /**
   * Same as {@link lastBalance}, but operating deduction uses **cash + bank** (itemized cash + legacy lump + bank lines).
   * Formula: {@link totalSaleSheet} − {@link purchases} − {@link supplierRicarche} − ({@link cashExpenses} + {@link bankExpenses}).
   */
  lastBalanceWithBank: number;
  /** Sum of SIM sale, mobile sale, accessory sale, R.Wind, R.Voda, repairs, extras only (buy columns excluded). */
  totalSaleSheet: number;
  /** SIM buy + mobile buy + accessory buy (inventory / stock cost). */
  totalBuyCost: number;
  /** R.Wind + R.Voda package **retail** (white columns on the sheet). */
  packageRetailSales: number;
  /**
   * **Total recharges** on Overview: sum of R.Wind + R.Voda package amounts from Daily Entry (`package_r_wind` + `package_r_voda`).
   * Same numeric value as {@link packageRetailSales} for structured rows.
   */
  supplierRicarche: number;
  /** Cash + bank + legacy lump minus supplier-style bank/cash top-up lines (internal split; Overview “Total expense” uses {@link cashExpenses} only). */
  clientOperatingExpense: number;
  /** Same as {@link supplierRicarche} (R.Wind + R.Voda package totals). */
  totalRecharges: number;
} {
  let simBuy = 0;
  let simSaleNew = 0;
  let legacySimTotal = 0;
  let handsetSales = 0;
  let handsetBuys = 0;
  let legacyHandsetMetaProfit = 0;
  let accSales = 0;
  let accBuys = 0;
  let packW = 0;
  let packV = 0;
  let repairLines = 0;
  let legacyRepairs = 0;
  let extraSales = 0;
  let posSales = 0;
  let cashExpenses = 0;
  let bankExpenses = 0;
  let supplierBankTopups = 0;
  let otherPurchases = 0;
  let legacyLumpExpenses = 0;

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    const amt = Number(row.amount) || 0;
    if (metaString(m, "source") === SOURCE_MOBILE) {
      const line = metaString(m, "line") as MobileMetaLine | undefined;
      if (line === "sim_buy" && row.transaction_type === "expense") simBuy += amt;
      else if (line === "sim_sale" && row.transaction_type === "sale") simSaleNew += amt;
      else if (line === "sim_sales" && row.transaction_type === "sale") legacySimTotal += amt;
      else if (line === "mobile_phone_sale" && row.transaction_type === "sale") {
        handsetSales += amt;
        legacyHandsetMetaProfit += metaNumber_nonneg(m, "profit");
      } else if (line === "mobile_phone_buy" && row.transaction_type === "expense") handsetBuys += amt;
      else if (line === "accessory_sale" && row.transaction_type === "sale") accSales += amt;
      else if (line === "accessory_buy" && row.transaction_type === "expense") accBuys += amt;
      else if (line === "package_r_wind" && row.transaction_type === "sale") packW += amt;
      else if (line === "package_r_voda" && row.transaction_type === "sale") packV += amt;
      else if (line === "repair_line" && row.transaction_type === "repair") repairLines += amt;
      else if (line === "extra_sale" && row.transaction_type === "sale") extraSales += amt;
      else if (line === "repair_income" && row.transaction_type === "repair") legacyRepairs += amt;
      else if (line === "mobile_purchases" && row.transaction_type === "expense") otherPurchases += amt;
      else if (line === "pos_sale" && row.transaction_type === "sale") posSales += amt;
      else if (line === "expense_cash_line" && row.transaction_type === "expense") {
        cashExpenses += amt;
        const nm = mobileExpenseLineDisplayLabel(row, m);
        if (isSupplierRicarcheExpenseLabel(nm)) supplierBankTopups += amt;
      } else if (line === "expense_bank_line" && row.transaction_type === "expense") {
        bankExpenses += amt;
        const nm = mobileExpenseLineDisplayLabel(row, m);
        if (isSupplierRicarcheExpenseLabel(nm)) supplierBankTopups += amt;
      }
      else if (line === "mobile_expenses" && row.transaction_type === "expense") legacyLumpExpenses += amt;
      continue;
    }

    const displayD = normDesc(stripEmbeddedMetaFromDescription(row.description));

    if (row.transaction_type === "sale" && displayD === "product sales") {
      handsetSales += amt;
      legacyHandsetMetaProfit += metaNumber_nonneg(m, "profit");
    } else if (row.transaction_type === "sale" && displayD.includes("mobile phone")) {
      handsetSales += amt;
      legacyHandsetMetaProfit += metaNumber_nonneg(m, "profit");
    } else if (row.transaction_type === "sale" && (displayD.includes("mobile sim") || displayD.includes("sim")))
      legacySimTotal += amt;
    else if (row.transaction_type === "repair" && (displayD === "repairs" || displayD.includes("repair")))
      legacyRepairs += amt;
    else if (row.transaction_type === "expense" && displayD.includes("mobile purchase")) otherPurchases += amt;
    else if (row.transaction_type === "expense" && displayD.includes("mobile expense")) legacyLumpExpenses += amt;
  }

  const simSales = simSaleNew + legacySimTotal;
  const phoneSales = handsetSales + accSales;
  const hasMerchBuyRows = handsetBuys > 0 || accBuys > 0 || simBuy > 0;
  let phoneProfit = handsetSales + accSales - handsetBuys - accBuys;
  if (!hasMerchBuyRows && legacyHandsetMetaProfit > 0) {
    phoneProfit = legacyHandsetMetaProfit + (accSales - accBuys);
  }

  const packageSales = packW + packV;
  const repairs = repairLines + legacyRepairs;
  const purchases = otherPurchases + simBuy + handsetBuys + accBuys;

  const operatingExpenses = cashExpenses + bankExpenses + legacyLumpExpenses;
  const cashExpensesDisplay = cashExpenses + legacyLumpExpenses;
  const clientOperatingExpense = Math.max(0, operatingExpenses - supplierBankTopups);

  const revenue =
    handsetSales +
    accSales +
    simSales +
    repairLines +
    legacyRepairs +
    packW +
    packV +
    extraSales +
    posSales;
  const cogs = simBuy + handsetBuys + accBuys + otherPurchases;
  const profit = revenue - cogs - operatingExpenses;

  const totalSaleSheet = simSales + handsetSales + accSales + packW + packV + repairs + extraSales;
  const totalBuyCost = simBuy + handsetBuys + accBuys;
  const packageRetailSales = packageSales;
  /** Overview “Total recharges”: R.Wind + R.Voda daily entry totals. */
  const supplierRicarche = packageSales;
  const lastBalance = totalSaleSheet - purchases - supplierRicarche - cashExpensesDisplay;
  const lastBalanceWithBank =
    totalSaleSheet - purchases - supplierRicarche - (cashExpensesDisplay + bankExpenses);

  return {
    phoneSales,
    phoneProfit,
    simSales,
    simBuy,
    packageSales,
    repairs,
    extras: extraSales,
    posSales,
    cashExpenses: cashExpensesDisplay,
    bankExpenses,
    purchases,
    expenses: operatingExpenses,
    profit,
    lastBalance,
    lastBalanceWithBank,
    totalSaleSheet,
    totalBuyCost,
    packageRetailSales,
    supplierRicarche,
    clientOperatingExpense,
    /** Same as {@link supplierRicarche}: R.Wind + R.Voda package totals. */
    totalRecharges: supplierRicarche,
  };
}

export function summarizeMobileDay(rows: TransactionWithMeta[], date: string) {
  const dayRows = rows.filter((r) => r.transaction_date === date);
  return {
    date,
    ...mobileProfitFromTransactions(dayRows),
  };
}

/** Named line with a non‑negative euro amount (phones, accessories, repairs, extras). */
export type NamedMoneyLine = {
  item_name: string;
  amount: number;
};

/** One UI row: handset/accessory retail and stock cost for the same named line. */
export type MerchPairLine = {
  item_name: string;
  retail: number;
  buy: number;
};

/**
 * Rebuild unified merch rows from stored sale + buy lines (order preserved; buys match first
 * same-named row that does not yet have a buy amount).
 */
export function mergeSaleBuyNamedLines(sales: NamedMoneyLine[], buys: NamedMoneyLine[]): MerchPairLine[] {
  const norm = (s: string) => trimName(s).toLowerCase();
  const rows: MerchPairLine[] = sales.map((s) => ({
    item_name: trimName(s.item_name),
    retail: Math.max(0, s.amount),
    buy: 0,
  }));
  for (const b of buys) {
    const bAmt = Math.max(0, b.amount);
    if (bAmt <= 0) continue;
    const k = norm(b.item_name);
    const idx = rows.findIndex((r) => norm(r.item_name) === k && r.buy === 0);
    if (idx !== -1) {
      const rn = rows[idx].item_name;
      const bn = trimName(b.item_name);
      rows[idx] = { ...rows[idx], buy: bAmt, item_name: rn || bn };
    } else {
      rows.push({ item_name: trimName(b.item_name), retail: 0, buy: bAmt });
    }
  }
  if (rows.length === 0) return [{ item_name: "", retail: 0, buy: 0 }];
  return rows;
}

export function splitMerchFormToSaleBuy(lines: MerchPairLine[]): {
  sales: NamedMoneyLine[];
  buys: NamedMoneyLine[];
} {
  const sales: NamedMoneyLine[] = [];
  const buys: NamedMoneyLine[] = [];
  for (const line of lines) {
    const name = trimName(line.item_name);
    const retail = Math.max(0, line.retail);
    const buy = Math.max(0, line.buy);
    if (retail > 0) sales.push({ item_name: name, amount: retail });
    if (buy > 0) buys.push({ item_name: name, amount: buy });
  }
  return { sales, buys };
}

/** Convert string form rows (Daily Entry / Transactions modal) into sale + buy line arrays. */
export function merchFormStringsToSaleBuy(
  rows: { itemName: string; retail: string; buy: string }[],
): { sales: NamedMoneyLine[]; buys: NamedMoneyLine[] } {
  const parsed: MerchPairLine[] = rows.map((r) => ({
    item_name: r.itemName,
    retail: parseNonNegative(r.retail),
    buy: parseNonNegative(r.buy),
  }));
  return splitMerchFormToSaleBuy(parsed);
}

export type MobileDailyInput = {
  business_id: string;
  created_by_user_id: string;
  transaction_date: string;
  sim_buy: number;
  sim_sale: number;
  mobile_sales: NamedMoneyLine[];
  mobile_buys: NamedMoneyLine[];
  accessory_sales: NamedMoneyLine[];
  accessory_buys: NamedMoneyLine[];
  package_r_wind: number;
  package_r_voda: number;
  repairs: NamedMoneyLine[];
  extras: NamedMoneyLine[];
  /** Card / POS (bank terminal) sales for the day. */
  pos_sale: number;
  cash_expenses: NamedMoneyLine[];
  bank_expenses: NamedMoneyLine[];
  /** Rich HTML from Daily Entry notes (same storage pattern as restaurant `daily_notes`). */
  notes: string;
};

function descMobilePhoneSale(name: string, index: number) {
  const t = trimName(name);
  return t ? `Mobile Phone: ${t}` : `Mobile Phone (${index + 1})`;
}

function descMobilePhoneBuy(name: string, index: number) {
  const t = trimName(name);
  return t ? `Mobile handset buy: ${t}` : `Mobile handset buy (${index + 1})`;
}

function descAccessorySale(name: string, index: number) {
  const t = trimName(name);
  return t ? `Mobile accessory: ${t}` : `Mobile accessory sale (${index + 1})`;
}

function descAccessoryBuy(name: string, index: number) {
  const t = trimName(name);
  return t ? `Mobile accessory buy: ${t}` : `Mobile accessory buy (${index + 1})`;
}

function descRepair(name: string, index: number) {
  const t = trimName(name);
  return t ? `Mobile repair: ${t}` : `Mobile repair (${index + 1})`;
}

function descExtra(name: string, index: number) {
  const t = trimName(name);
  return t ? `Mobile extra: ${t}` : `Mobile extra (${index + 1})`;
}

function descCashExpense(detail: string, index: number) {
  const t = trimName(detail);
  return t ? `Mobile expense (cash): ${t}` : `Mobile expense (cash) (${index + 1})`;
}

function descBankExpense(detail: string, index: number) {
  const t = trimName(detail);
  return t ? `Mobile expense (bank): ${t}` : `Mobile expense (bank) (${index + 1})`;
}

export function buildMobileDailyRows(input: MobileDailyInput): TransactionInsert[] {
  const rows: TransactionInsert[] = [];
  const source = SOURCE_MOBILE;

  const simBuy = Math.max(0, input.sim_buy);
  if (simBuy > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: simBuy,
      description: "Mobile: SIM buy",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "sim_buy" satisfies MobileMetaLine },
    });
  }

  const simSale = Math.max(0, input.sim_sale);
  if (simSale > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: simSale,
      description: "Mobile: SIM sale",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "sim_sale" satisfies MobileMetaLine },
    });
  }

  for (let i = 0; i < input.mobile_sales.length; i += 1) {
    const line = input.mobile_sales[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: line.amount,
      description: descMobilePhoneSale(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "mobile_phone_sale" satisfies MobileMetaLine,
        item_name: name,
        selling_price: line.amount,
        profit: 0,
      },
    });
  }

  for (let i = 0; i < input.mobile_buys.length; i += 1) {
    const line = input.mobile_buys[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: descMobilePhoneBuy(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "mobile_phone_buy" satisfies MobileMetaLine, item_name: name },
    });
  }

  for (let i = 0; i < input.accessory_sales.length; i += 1) {
    const line = input.accessory_sales[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: line.amount,
      description: descAccessorySale(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "accessory_sale" satisfies MobileMetaLine, item_name: name },
    });
  }

  for (let i = 0; i < input.accessory_buys.length; i += 1) {
    const line = input.accessory_buys[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: line.amount,
      description: descAccessoryBuy(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "accessory_buy" satisfies MobileMetaLine, item_name: name },
    });
  }

  const pW = Math.max(0, input.package_r_wind);
  if (pW > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: pW,
      description: "Mobile package: R.Wind",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "package_r_wind" satisfies MobileMetaLine },
    });
  }

  const pV = Math.max(0, input.package_r_voda);
  if (pV > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: pV,
      description: "Mobile package: R.Voda",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "package_r_voda" satisfies MobileMetaLine },
    });
  }

  for (let i = 0; i < input.repairs.length; i += 1) {
    const line = input.repairs[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "repair",
      amount: line.amount,
      description: descRepair(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "repair_line" satisfies MobileMetaLine, item_name: name },
    });
  }

  for (let i = 0; i < input.extras.length; i += 1) {
    const line = input.extras[i];
    if (!line || line.amount <= 0) continue;
    const name = trimName(line.item_name);
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: line.amount,
      description: descExtra(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "extra_sale" satisfies MobileMetaLine, item_name: name },
    });
  }

  const pos = Math.max(0, input.pos_sale);
  if (pos > 0) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "sale",
      amount: pos,
      description: "Mobile: POS (card) sales",
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "pos_sale" satisfies MobileMetaLine },
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
      description: descCashExpense(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "expense_cash_line" satisfies MobileMetaLine, item_name: name },
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
      description: descBankExpense(line.item_name, i + 1),
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: { source, line: "expense_bank_line" satisfies MobileMetaLine, item_name: name },
    });
  }

  if (!isBlankNote(input.notes)) {
    rows.push({
      business_id: input.business_id,
      transaction_type: "expense",
      amount: 0,
      description: DESC_MOBILE_NOTES,
      transaction_date: input.transaction_date,
      created_by_user_id: input.created_by_user_id,
      metadata: {
        source,
        line: "daily_notes" satisfies MobileMetaLine,
        notes: input.notes.trim(),
      },
    });
  }

  return rows;
}

/** Rebuild mobile daily-entry form fields from stored transactions for one calendar day. */
export function parseMobileDailyFromTransactions(rows: TransactionWithMeta[], dateISO: string): Omit<
  MobileDailyInput,
  "business_id" | "created_by_user_id" | "transaction_date"
> {
  const dayRows = rows.filter((r) => r.transaction_date === dateISO);

  let sim_buy = 0;
  let sim_sale = 0;
  const mobile_sales: NamedMoneyLine[] = [];
  const mobile_buys: NamedMoneyLine[] = [];
  const accessory_sales: NamedMoneyLine[] = [];
  const accessory_buys: NamedMoneyLine[] = [];
  let package_r_wind = 0;
  let package_r_voda = 0;
  const repairs: NamedMoneyLine[] = [];
  const extras: NamedMoneyLine[] = [];
  let pos_sale = 0;
  let notes = "";
  const cash_expenses: NamedMoneyLine[] = [];
  const bank_expenses: NamedMoneyLine[] = [];
  let legacy_lump_expenses = 0;

  for (const row of dayRows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_MOBILE) continue;

    const line = metaString(m, "line") as MobileMetaLine | undefined;
    const amt = Number(row.amount) || 0;
    const itemName =
      typeof m["item_name"] === "string" ? (m["item_name"] as string) : "";

    if (line === "sim_buy" && row.transaction_type === "expense") sim_buy += amt;
    else if (line === "sim_sale" && row.transaction_type === "sale") sim_sale += amt;
    else if (line === "sim_sales" && row.transaction_type === "sale") {
      sim_sale += amt;
    } else if (line === "mobile_phone_sale" && row.transaction_type === "sale") {
      mobile_sales.push({ item_name: itemName, amount: amt });
    } else if (line === "mobile_phone_buy" && row.transaction_type === "expense") {
      mobile_buys.push({ item_name: itemName, amount: amt });
    } else if (line === "accessory_sale" && row.transaction_type === "sale") {
      accessory_sales.push({ item_name: itemName, amount: amt });
    } else if (line === "accessory_buy" && row.transaction_type === "expense") {
      accessory_buys.push({ item_name: itemName, amount: amt });
    } else if (line === "package_r_wind" && row.transaction_type === "sale") package_r_wind += amt;
    else if (line === "package_r_voda" && row.transaction_type === "sale") package_r_voda += amt;
    else if (line === "repair_line" && row.transaction_type === "repair") {
      repairs.push({ item_name: itemName, amount: amt });
    } else if (line === "extra_sale" && row.transaction_type === "sale") {
      extras.push({ item_name: itemName, amount: amt });
    } else if (line === "pos_sale" && row.transaction_type === "sale") {
      pos_sale += amt;
    } else if (line === "expense_cash_line" && row.transaction_type === "expense") {
      const label =
        trimName(mobileExpenseLineDisplayLabel(row, m) || itemName) || "Cash expense";
      cash_expenses.push({ item_name: label, amount: amt });
    } else if (line === "expense_bank_line" && row.transaction_type === "expense") {
      const label =
        trimName(mobileExpenseLineDisplayLabel(row, m) || itemName) || "Bank expense";
      bank_expenses.push({ item_name: label, amount: amt });
    } else if (line === "repair_income" && row.transaction_type === "repair") {
      repairs.push({ item_name: "", amount: amt });
    } else if (line === "daily_notes" && row.transaction_type === "expense") {
      const n = typeof m["notes"] === "string" ? m["notes"] : "";
      if (!isBlankNote(n)) notes = n;
    } else if (line === "mobile_purchases" && row.transaction_type === "expense") {
      /* legacy “other purchases” row — no longer edited in Daily Entry; still counted in aggregates */
    } else if (line === "mobile_expenses" && row.transaction_type === "expense") {
      legacy_lump_expenses += amt;
    }
  }

  /** Same legacy path as {@link mobileProfitFromTransactions}: rows without `source: daily_entry_mobile` but “Mobile expense …” in description. */
  for (const row of dayRows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") === SOURCE_MOBILE) continue;
    if (row.transaction_type !== "expense") continue;
    const amt = Number(row.amount) || 0;
    if (amt <= 0) continue;

    const displayD = normDesc(stripEmbeddedMetaFromDescription(row.description ?? null));
    if (!displayD.includes("mobile expense")) continue;
    if (displayD.includes("mobile purchase")) continue;

    const label =
      mobileExpenseLineDisplayLabel(row, m).trim() ||
      (typeof m["item_name"] === "string" ? trimName(m["item_name"] as string) : "") ||
      "Mobile expense (no line name)";

    cash_expenses.push({ item_name: label, amount: amt });
  }

  if (legacy_lump_expenses > 0) {
    cash_expenses.push({
      item_name: "Previous single total (split as needed)",
      amount: legacy_lump_expenses,
    });
  }

  return {
    sim_buy,
    sim_sale,
    mobile_sales: mobile_sales.length ? mobile_sales : [{ item_name: "", amount: 0 }],
    mobile_buys: mobile_buys.length ? mobile_buys : [{ item_name: "", amount: 0 }],
    accessory_sales: accessory_sales.length ? accessory_sales : [{ item_name: "", amount: 0 }],
    accessory_buys: accessory_buys.length ? accessory_buys : [{ item_name: "", amount: 0 }],
    package_r_wind,
    package_r_voda,
    repairs: repairs.length ? repairs : [{ item_name: "", amount: 0 }],
    extras: extras.length ? extras : [{ item_name: "", amount: 0 }],
    pos_sale,
    notes,
    cash_expenses: cash_expenses.length ? cash_expenses : [{ item_name: "", amount: 0 }],
    bank_expenses: bank_expenses.length ? bank_expenses : [{ item_name: "", amount: 0 }],
  };
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

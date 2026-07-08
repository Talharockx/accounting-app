import {
  SOURCE_MOBILE,
  getMetadata,
  metaString,
  stripEmbeddedMetaFromDescription,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";

/** Per-day mobile shop ledger row for the Transactions tab (spreadsheet layout). */
export type MobileTransactionLedgerRow = {
  date: string;
  simSale: number;
  simBuy: number;
  simProfit: number;
  mobileSale: number;
  mobileBuy: number;
  mobileProfit: number;
  accessorySale: number;
  accessoryBuy: number;
  accessoryProfit: number;
  rwind: number;
  rwoda: number;
  repair: number;
  extras: number;
  /** SIM + mobile + accessory + repair + extras + R.Wind + R.Voda (POS excluded). */
  totalSale: number;
  pos: number;
  totalCashSale: number;
  cashExpense: number;
  bankExpense: number;
  remainingCashSale: number;
  remainingBankSale: number;
  /** Total sale − (cash expense + bank expense). */
  lastBalance: number;
  /** simProfit + mobileProfit + accessoryProfit */
  merchandiseProfit: number;
};

function aggregateMobileLedgerComponents(rows: TransactionWithMeta[]) {
  let simBuy = 0;
  let simSale = 0;
  let mobileSale = 0;
  let mobileBuy = 0;
  let accessorySale = 0;
  let accessoryBuy = 0;
  let rwind = 0;
  let rwoda = 0;
  let repair = 0;
  let extras = 0;
  let pos = 0;
  let cashExpense = 0;
  let bankExpense = 0;
  let legacyLumpExpenses = 0;

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    const amt = Number(row.amount) || 0;

    if (metaString(m, "source") === SOURCE_MOBILE) {
      const line = metaString(m, "line");
      if (line === "sim_buy" && row.transaction_type === "expense") simBuy += amt;
      else if (line === "sim_sale" && row.transaction_type === "sale") simSale += amt;
      else if (line === "sim_sales" && row.transaction_type === "sale") simSale += amt;
      else if (line === "mobile_phone_sale" && row.transaction_type === "sale") mobileSale += amt;
      else if (line === "mobile_phone_buy" && row.transaction_type === "expense") mobileBuy += amt;
      else if (line === "accessory_sale" && row.transaction_type === "sale") accessorySale += amt;
      else if (line === "accessory_buy" && row.transaction_type === "expense") accessoryBuy += amt;
      else if (line === "package_r_wind" && row.transaction_type === "sale") rwind += amt;
      else if (line === "package_r_voda" && row.transaction_type === "sale") rwoda += amt;
      else if (line === "repair_line" && row.transaction_type === "repair") repair += amt;
      else if (line === "repair_income" && row.transaction_type === "repair") repair += amt;
      else if (line === "extra_sale" && row.transaction_type === "sale") extras += amt;
      else if (line === "pos_sale" && row.transaction_type === "sale") pos += amt;
      else if (line === "expense_cash_line" && row.transaction_type === "expense") cashExpense += amt;
      else if (line === "expense_bank_line" && row.transaction_type === "expense") bankExpense += amt;
      else if (line === "mobile_expenses" && row.transaction_type === "expense") legacyLumpExpenses += amt;
      continue;
    }

    const displayD = normDesc(stripEmbeddedMetaFromDescription(row.description));
    if (row.transaction_type === "sale" && (displayD === "product sales" || displayD.includes("mobile phone"))) {
      mobileSale += amt;
    } else if (row.transaction_type === "sale" && (displayD.includes("mobile sim") || displayD.includes("sim"))) {
      simSale += amt;
    } else if (row.transaction_type === "repair" && (displayD === "repairs" || displayD.includes("repair"))) {
      repair += amt;
    } else if (row.transaction_type === "expense" && displayD.includes("mobile expense")) {
      legacyLumpExpenses += amt;
    }
  }

  const cashExpenseTotal = cashExpense + legacyLumpExpenses;

  return {
    simSale,
    simBuy,
    mobileSale,
    mobileBuy,
    accessorySale,
    accessoryBuy,
    rwind,
    rwoda,
    repair,
    extras,
    pos,
    cashExpense: cashExpenseTotal,
    bankExpense,
  };
}

function ledgerRowFromComponents(date: string, c: ReturnType<typeof aggregateMobileLedgerComponents>): MobileTransactionLedgerRow {
  const simProfit = c.simSale - c.simBuy;
  const mobileProfit = c.mobileSale - c.mobileBuy;
  const accessoryProfit = c.accessorySale - c.accessoryBuy;
  const totalSale = c.simSale + c.mobileSale + c.accessorySale + c.repair + c.extras + c.rwind + c.rwoda;
  const totalCashSale = totalSale - c.pos;
  const remainingCashSale = totalCashSale - c.cashExpense;
  const remainingBankSale = c.pos - c.bankExpense;
  const lastBalance = totalSale - (c.cashExpense + c.bankExpense);
  const merchandiseProfit = simProfit + mobileProfit + accessoryProfit;

  return {
    date,
    ...c,
    simProfit,
    mobileProfit,
    accessoryProfit,
    totalSale,
    totalCashSale,
    remainingCashSale,
    remainingBankSale,
    lastBalance,
    merchandiseProfit,
  };
}

export function buildMobileTransactionLedgerRow(
  rows: TransactionWithMeta[],
  date: string,
): MobileTransactionLedgerRow {
  const dayRows = rows.filter((r) => r.transaction_date === date);
  return ledgerRowFromComponents(date, aggregateMobileLedgerComponents(dayRows));
}

/** Period totals for Overview / reports — same formulas as the Transactions ledger. */
export function mobileLedgerSummaryFromTransactions(rows: TransactionWithMeta[]): MobileTransactionLedgerRow {
  return ledgerRowFromComponents("summary", aggregateMobileLedgerComponents(rows));
}

/** Client-facing ledger columns (monthly report PDF + Transactions tab). */
export const MOBILE_LEDGER_CLIENT_COLUMNS = [
  "Sim sale",
  "Sim buy",
  "Sim profit",
  "Mobile sale",
  "Mobile buy",
  "Mobile profit",
  "Access. sale",
  "Access. buy",
  "Access. profit",
  "R.Wind",
  "R.Voda",
  "Repair",
  "Extras",
  "Total sale",
  "POS",
  "Total cash sale",
  "Cash expense",
  "Bank expense",
  "Total profit",
] as const;

/** Two-line PDF headers — avoids jspdf-autotable chopping labels mid-word. */
export const MOBILE_LEDGER_PDF_HEAD_LABELS: Record<(typeof MOBILE_LEDGER_CLIENT_COLUMNS)[number], string> = {
  "Sim sale": "Sim\nSale",
  "Sim buy": "Sim\nBuy",
  "Sim profit": "Sim\nProfit",
  "Mobile sale": "Mobile\nSale",
  "Mobile buy": "Mobile\nBuy",
  "Mobile profit": "Mobile\nProfit",
  "Access. sale": "Acc.\nSale",
  "Access. buy": "Acc.\nBuy",
  "Access. profit": "Acc.\nProfit",
  "R.Wind": "R.\nWind",
  "R.Voda": "R.\nVoda",
  Repair: "Repair",
  Extras: "Extras",
  "Total sale": "Total\nSale",
  POS: "POS",
  "Total cash sale": "Cash\nSale",
  "Cash expense": "Cash\nExp.",
  "Bank expense": "Bank\nExp.",
  "Total profit": "Total\nProfit",
};

export function mobileLedgerPdfHeadLabel(column: string): string {
  const key = column as (typeof MOBILE_LEDGER_CLIENT_COLUMNS)[number];
  return MOBILE_LEDGER_PDF_HEAD_LABELS[key] ?? column;
}

/** @deprecated Use {@link MOBILE_LEDGER_CLIENT_COLUMNS}. */
export const MOBILE_LEDGER_REPORT_COLUMNS = MOBILE_LEDGER_CLIENT_COLUMNS;

export type MobileTotalProfitRow = {
  date: string;
  totalSale: number;
  cashExpense: number;
  bankExpense: number;
  totalExpense: number;
  totalProfit: number;
};

/** Total profit = total sale − (cash expense + bank expense). */
export function computeTotalProfit(totalSale: number, cashExpense: number, bankExpense: number): number {
  return totalSale - (cashExpense + bankExpense);
}

export function ledgerRowToTotalProfit(row: MobileTransactionLedgerRow): MobileTotalProfitRow {
  const totalExpense = row.cashExpense + row.bankExpense;
  return {
    date: row.date,
    totalSale: row.totalSale,
    cashExpense: row.cashExpense,
    bankExpense: row.bankExpense,
    totalExpense,
    totalProfit: computeTotalProfit(row.totalSale, row.cashExpense, row.bankExpense),
  };
}

export function buildMobileTotalProfitRows(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): MobileTotalProfitRow[] {
  const inMonth = rows.filter(
    (r) => r.transaction_date >= monthStartISO && r.transaction_date <= monthEndISO,
  );
  const dates = Array.from(new Set(inMonth.map((r) => r.transaction_date))).sort((a, b) =>
    b.localeCompare(a),
  );
  return dates.map((dateISO) =>
    ledgerRowToTotalProfit(buildMobileTransactionLedgerRow(inMonth, dateISO)),
  );
}

export function sumMobileTotalProfitRows(rows: MobileTotalProfitRow[]): MobileTotalProfitRow {
  const sum = rows.reduce(
    (acc, row) => ({
      totalSale: acc.totalSale + row.totalSale,
      cashExpense: acc.cashExpense + row.cashExpense,
      bankExpense: acc.bankExpense + row.bankExpense,
    }),
    { totalSale: 0, cashExpense: 0, bankExpense: 0 },
  );
  const totalExpense = sum.cashExpense + sum.bankExpense;
  return {
    date: "total",
    ...sum,
    totalExpense,
    totalProfit: computeTotalProfit(sum.totalSale, sum.cashExpense, sum.bankExpense),
  };
}

export type MobileLedgerMatrixReport = {
  columns: string[];
  rows: { dateISO: string; displayDate: string; amounts: Record<string, number> }[];
  columnTotals: number[];
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function ledgerRowToColumnAmounts(row: MobileTransactionLedgerRow): Record<string, number> {
  return {
    "Sim sale": row.simSale,
    "Sim buy": row.simBuy,
    "Sim profit": row.simProfit,
    "Mobile sale": row.mobileSale,
    "Mobile buy": row.mobileBuy,
    "Mobile profit": row.mobileProfit,
    "Access. sale": row.accessorySale,
    "Access. buy": row.accessoryBuy,
    "Access. profit": row.accessoryProfit,
    "R.Wind": row.rwind,
    "R.Voda": row.rwoda,
    Repair: row.repair,
    Extras: row.extras,
    "Total sale": row.totalSale,
    POS: row.pos,
    "Total cash sale": row.totalCashSale,
    "Cash expense": row.cashExpense,
    "Bank expense": row.bankExpense,
    "Total profit": computeTotalProfit(row.totalSale, row.cashExpense, row.bankExpense),
    "Rem. cash sale": row.remainingCashSale,
    "Rem. bank sale": row.remainingBankSale,
    "Last balance": row.lastBalance,
    "Profit (sale−buy)": row.merchandiseProfit,
  };
}

/** Month grid for PDF — one row per day that has saved entries (same as Transactions). */
export function buildMobileTransactionLedgerMatrix(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): MobileLedgerMatrixReport {
  const inMonth = rows.filter(
    (r) => r.transaction_date >= monthStartISO && r.transaction_date <= monthEndISO,
  );
  const dates = Array.from(new Set(inMonth.map((r) => r.transaction_date))).sort((a, b) =>
    b.localeCompare(a),
  );
  const columns = [...MOBILE_LEDGER_CLIENT_COLUMNS];
  const ledgerRows = dates.map((dateISO) => buildMobileTransactionLedgerRow(inMonth, dateISO));
  const matrixRows = ledgerRows.map((row) => ({
    dateISO: row.date,
    displayDate: isoToDisplayDDMMYYYY(row.date),
    amounts: ledgerRowToColumnAmounts(row),
  }));
  const monthTotals = sumMobileTransactionLedgerRows(ledgerRows);
  const totalAmounts = ledgerRowToColumnAmounts(monthTotals);
  const columnTotals = columns.map((c) => totalAmounts[c] ?? 0);
  return { columns, rows: matrixRows, columnTotals };
}

export function ledgerMatrixColumnTotal(matrix: MobileLedgerMatrixReport, column: string): number {
  const i = matrix.columns.indexOf(column);
  if (i < 0) return 0;
  return matrix.columnTotals[i] ?? 0;
}

export function sumMobileTransactionLedgerRows(rows: MobileTransactionLedgerRow[]): MobileTransactionLedgerRow {
  const sum = rows.reduce(
    (acc, row) => ({
      simSale: acc.simSale + row.simSale,
      simBuy: acc.simBuy + row.simBuy,
      mobileSale: acc.mobileSale + row.mobileSale,
      mobileBuy: acc.mobileBuy + row.mobileBuy,
      accessorySale: acc.accessorySale + row.accessorySale,
      accessoryBuy: acc.accessoryBuy + row.accessoryBuy,
      rwind: acc.rwind + row.rwind,
      rwoda: acc.rwoda + row.rwoda,
      repair: acc.repair + row.repair,
      extras: acc.extras + row.extras,
      pos: acc.pos + row.pos,
      cashExpense: acc.cashExpense + row.cashExpense,
      bankExpense: acc.bankExpense + row.bankExpense,
    }),
    {
      simSale: 0,
      simBuy: 0,
      mobileSale: 0,
      mobileBuy: 0,
      accessorySale: 0,
      accessoryBuy: 0,
      rwind: 0,
      rwoda: 0,
      repair: 0,
      extras: 0,
      pos: 0,
      cashExpense: 0,
      bankExpense: 0,
    },
  );

  const simProfit = sum.simSale - sum.simBuy;
  const mobileProfit = sum.mobileSale - sum.mobileBuy;
  const accessoryProfit = sum.accessorySale - sum.accessoryBuy;
  const totalSale =
    sum.simSale + sum.mobileSale + sum.accessorySale + sum.repair + sum.extras + sum.rwind + sum.rwoda;
  const totalCashSale = totalSale - sum.pos;
  const remainingCashSale = totalCashSale - sum.cashExpense;
  const remainingBankSale = sum.pos - sum.bankExpense;
  const lastBalance = totalSale - (sum.cashExpense + sum.bankExpense);

  return {
    date: "total",
    ...sum,
    simProfit,
    mobileProfit,
    accessoryProfit,
    totalSale,
    totalCashSale,
    remainingCashSale,
    remainingBankSale,
    lastBalance,
    merchandiseProfit: simProfit + mobileProfit + accessoryProfit,
  };
}

function normDesc(description: string | null): string {
  return (description ?? "").trim().toLowerCase();
}

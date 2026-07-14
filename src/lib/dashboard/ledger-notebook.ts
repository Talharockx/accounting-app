import {
  getMetadata,
  metaString,
  type TransactionInsert,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";

/** Running balance ledger — separate from Notes and Notes +. */
export const SOURCE_LEDGER_NOTEBOOK = "ledger_notebook" as const;
export const DESC_LEDGER_NOTEBOOK = "Ledger Notebook";
export const LEDGER_LINE_ROW = "ledger_row" as const;

export type LedgerNotebookRow = {
  id: string;
  date: string;
  amount: number;
  paid: number;
  details: string;
  sortIndex: number;
};

export type LedgerNotebookRowWithBalance = LedgerNotebookRow & { balance: number };

function asNonNegNumber(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function buildLedgerRowInsert(input: {
  business_id: string;
  created_by_user_id: string;
  date: string;
  amount: number;
  paid: number;
  details: string;
  sortIndex: number;
}): TransactionInsert {
  const amount = Math.max(0, input.amount);
  const paid = Math.max(0, input.paid);
  const details = input.details.trim();
  return {
    business_id: input.business_id,
    transaction_type: "expense",
    amount: 0,
    description: details ? `${DESC_LEDGER_NOTEBOOK}: ${details.slice(0, 80)}` : DESC_LEDGER_NOTEBOOK,
    transaction_date: input.date,
    created_by_user_id: input.created_by_user_id,
    metadata: {
      source: SOURCE_LEDGER_NOTEBOOK,
      line: LEDGER_LINE_ROW,
      amount,
      paid,
      details,
      sort_index: input.sortIndex,
    },
  };
}

export function ledgerRowMetadataPatch(input: {
  amount: number;
  paid: number;
  details: string;
  sortIndex: number;
}): Record<string, unknown> {
  const amount = Math.max(0, input.amount);
  const paid = Math.max(0, input.paid);
  const details = input.details.trim();
  return {
    source: SOURCE_LEDGER_NOTEBOOK,
    line: LEDGER_LINE_ROW,
    amount,
    paid,
    details,
    sort_index: input.sortIndex,
  };
}

export function collectLedgerRows(
  rows: Array<TransactionWithMeta & { id?: string }>,
): LedgerNotebookRow[] {
  const out: LedgerNotebookRow[] = [];
  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_LEDGER_NOTEBOOK) continue;
    if (metaString(m, "line") !== LEDGER_LINE_ROW) continue;
    const amount = "amount" in m ? asNonNegNumber(m["amount"]) : asNonNegNumber(row.amount);
    const paid = asNonNegNumber(m["paid"]);
    const details = typeof m["details"] === "string" ? m["details"] : "";
    const sortRaw = m["sort_index"];
    const sortIndex =
      typeof sortRaw === "number" && Number.isFinite(sortRaw)
        ? sortRaw
        : Number.parseInt(String(sortRaw ?? "0"), 10) || 0;
    out.push({
      id: typeof row.id === "string" ? row.id : "",
      date: row.transaction_date,
      amount,
      paid,
      details,
      sortIndex,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.sortIndex - b.sortIndex || a.id.localeCompare(b.id));
  return out;
}

/** Running balance: previous + amount − paid (can go negative). */
export function withRunningBalances(
  rows: LedgerNotebookRow[],
  openingBalance = 0,
): LedgerNotebookRowWithBalance[] {
  let balance = openingBalance;
  return rows.map((row) => {
    balance = balance + row.amount - row.paid;
    return { ...row, balance };
  });
}

export function openingBalanceBefore(
  allSortedRows: LedgerNotebookRow[],
  rangeStartISO: string,
): number {
  let balance = 0;
  for (const row of allSortedRows) {
    if (row.date >= rangeStartISO) break;
    balance = balance + row.amount - row.paid;
  }
  return balance;
}

export function rowsInRange(rows: LedgerNotebookRow[], startISO: string, endISO: string): LedgerNotebookRow[] {
  return rows.filter((r) => r.date >= startISO && r.date <= endISO);
}

export function formatLedgerMoney(n: number): string {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyOrBlank(n: number): string {
  return n > 0 ? formatLedgerMoney(n) : "";
}

export function parseLedgerMoneyInput(raw: string): number {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return 0;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

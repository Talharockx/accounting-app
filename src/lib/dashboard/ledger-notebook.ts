import {
  getMetadata,
  metaString,
  type TransactionInsert,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";

/** Running balance ledger — separate from Notes and Notes +. */
export const SOURCE_LEDGER_NOTEBOOK = "ledger_notebook" as const;
export const DESC_LEDGER_NOTEBOOK = "Ledger Notebook";
export const DESC_LEDGER_KHATA = "Ledger Notebook Khata";
export const LEDGER_LINE_ROW = "ledger_row" as const;
export const LEDGER_LINE_KHATA = "ledger_khata" as const;

/** Sentinel date for khata registry rows. */
export const LEDGER_KHATA_DATE = "2000-01-01";

/** Legacy rows without a khata_id live under this bucket. */
export const DEFAULT_KHATA_ID = "default";
export const DEFAULT_KHATA_NAME = "General";

export type LedgerKhata = {
  id: string;
  name: string;
  /** Transaction id of the registry row (missing for synthetic default). */
  registryId: string;
};

export type LedgerNotebookRow = {
  id: string;
  khataId: string;
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

export function newLedgerKhataId(): string {
  return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeKhataId(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return DEFAULT_KHATA_ID;
}

export function buildLedgerKhataInsert(input: {
  business_id: string;
  created_by_user_id: string;
  khata_id: string;
  name: string;
}): TransactionInsert {
  const name = input.name.trim();
  return {
    business_id: input.business_id,
    transaction_type: "expense",
    amount: 0,
    description: `${DESC_LEDGER_KHATA}: ${name}`,
    transaction_date: LEDGER_KHATA_DATE,
    created_by_user_id: input.created_by_user_id,
    metadata: {
      source: SOURCE_LEDGER_NOTEBOOK,
      line: LEDGER_LINE_KHATA,
      khata_id: input.khata_id,
      khata_name: name,
    },
  };
}

export function buildLedgerRowInsert(input: {
  business_id: string;
  created_by_user_id: string;
  khata_id: string;
  date: string;
  amount: number;
  paid: number;
  details: string;
  sortIndex: number;
}): TransactionInsert {
  const amount = Math.max(0, input.amount);
  const paid = Math.max(0, input.paid);
  const details = input.details.trim();
  const khataId = normalizeKhataId(input.khata_id);
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
      khata_id: khataId,
      amount,
      paid,
      details,
      sort_index: input.sortIndex,
    },
  };
}

export function ledgerRowMetadataPatch(input: {
  khata_id: string;
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
    khata_id: normalizeKhataId(input.khata_id),
    amount,
    paid,
    details,
    sort_index: input.sortIndex,
  };
}

export function collectLedgerKhatas(
  rows: Array<TransactionWithMeta & { id?: string }>,
): LedgerKhata[] {
  const byId = new Map<string, LedgerKhata>();

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_LEDGER_NOTEBOOK) continue;
    if (metaString(m, "line") !== LEDGER_LINE_KHATA) continue;
    const id = normalizeKhataId(m["khata_id"]);
    if (id === DEFAULT_KHATA_ID) continue;
    const name =
      typeof m["khata_name"] === "string" && m["khata_name"].trim()
        ? m["khata_name"].trim()
        : id;
    byId.set(id, {
      id,
      name,
      registryId: typeof row.id === "string" ? row.id : "",
    });
  }

  // Include ids that appear on data rows (e.g. registry missing).
  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_LEDGER_NOTEBOOK) continue;
    if (metaString(m, "line") !== LEDGER_LINE_ROW) continue;
    const id = normalizeKhataId(m["khata_id"]);
    if (id === DEFAULT_KHATA_ID) continue;
    if (byId.has(id)) continue;
    byId.set(id, { id, name: id, registryId: "" });
  }

  const list = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  // Legacy notebook rows with no khata show up as General.
  const hasDefaultRows = rows.some((row) => {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_LEDGER_NOTEBOOK) return false;
    if (metaString(m, "line") !== LEDGER_LINE_ROW) return false;
    return normalizeKhataId(m["khata_id"]) === DEFAULT_KHATA_ID;
  });
  if (hasDefaultRows) {
    list.unshift({ id: DEFAULT_KHATA_ID, name: DEFAULT_KHATA_NAME, registryId: "" });
  }

  return list;
}

export function collectLedgerRows(
  rows: Array<TransactionWithMeta & { id?: string }>,
  khataId?: string,
): LedgerNotebookRow[] {
  const out: LedgerNotebookRow[] = [];
  const filterId = khataId ? normalizeKhataId(khataId) : null;

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_LEDGER_NOTEBOOK) continue;
    if (metaString(m, "line") !== LEDGER_LINE_ROW) continue;
    const rowKhata = normalizeKhataId(m["khata_id"]);
    if (filterId && rowKhata !== filterId) continue;

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
      khataId: rowKhata,
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

/** Latest running balance for a khata (all dates). */
export function closingBalanceForRows(rows: LedgerNotebookRow[]): number {
  if (!rows.length) return 0;
  const withBal = withRunningBalances(rows, 0);
  return withBal[withBal.length - 1]?.balance ?? 0;
}

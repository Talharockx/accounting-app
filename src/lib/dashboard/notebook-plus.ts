import {
  getMetadata,
  metaString,
  type TransactionInsert,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import {
  closingBalanceForRows,
  formatLedgerMoney,
  formatMoneyOrBlank,
  openingBalanceBefore,
  parseLedgerMoneyInput,
  rowsInRange,
  withRunningBalances,
  type LedgerKhata,
  type LedgerNotebookRow,
  type LedgerNotebookRowWithBalance,
} from "@/lib/dashboard/ledger-notebook";

/**
 * Command-center Notebook+ — completely separate from per-business Notebook (khatas).
 * Never shares source / description prefixes with `ledger_notebook`.
 */
export const SOURCE_NOTEBOOK_PLUS = "notebook_plus" as const;
export const DESC_NOTEBOOK_PLUS = "Notebook+";
export const DESC_NOTEBOOK_PLUS_KHATA = "Notebook+ Khata";
export const NOTEBOOK_PLUS_LINE_ROW = "notebook_plus_row" as const;
export const NOTEBOOK_PLUS_LINE_KHATA = "notebook_plus_khata" as const;

export const NOTEBOOK_PLUS_KHATA_DATE = "2000-01-01";
export const NOTEBOOK_PLUS_DEFAULT_KHATA_ID = "default";
export const NOTEBOOK_PLUS_DEFAULT_KHATA_NAME = "General";

/** Hidden businesses row used only as a storage carrier for Notebook+. */
export const NOTEBOOK_PLUS_WORKSPACE_VAT = "__LV_NOTEBOOK_PLUS__";
export const NOTEBOOK_PLUS_WORKSPACE_NAME = "Notebook+";

export type NotebookPlusKhata = LedgerKhata;
export type NotebookPlusRow = LedgerNotebookRow;
export type NotebookPlusRowWithBalance = LedgerNotebookRowWithBalance;

function asNonNegNumber(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function newNotebookPlusKhataId(): string {
  return `np_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeNotebookPlusKhataId(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return NOTEBOOK_PLUS_DEFAULT_KHATA_ID;
}

export function isNotebookPlusWorkspace(row: {
  vat_number?: string | null;
  name?: string | null;
}): boolean {
  return row.vat_number === NOTEBOOK_PLUS_WORKSPACE_VAT;
}

export function buildNotebookPlusKhataInsert(input: {
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
    description: `${DESC_NOTEBOOK_PLUS_KHATA}: ${name}`,
    transaction_date: NOTEBOOK_PLUS_KHATA_DATE,
    created_by_user_id: input.created_by_user_id,
    metadata: {
      source: SOURCE_NOTEBOOK_PLUS,
      line: NOTEBOOK_PLUS_LINE_KHATA,
      khata_id: input.khata_id,
      khata_name: name,
    },
  };
}

export function buildNotebookPlusRowInsert(input: {
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
  const khataId = normalizeNotebookPlusKhataId(input.khata_id);
  return {
    business_id: input.business_id,
    transaction_type: "expense",
    amount: 0,
    description: details ? `${DESC_NOTEBOOK_PLUS}: ${details.slice(0, 80)}` : DESC_NOTEBOOK_PLUS,
    transaction_date: input.date,
    created_by_user_id: input.created_by_user_id,
    metadata: {
      source: SOURCE_NOTEBOOK_PLUS,
      line: NOTEBOOK_PLUS_LINE_ROW,
      khata_id: khataId,
      amount,
      paid,
      details,
      sort_index: input.sortIndex,
    },
  };
}

export function notebookPlusRowMetadataPatch(input: {
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
    source: SOURCE_NOTEBOOK_PLUS,
    line: NOTEBOOK_PLUS_LINE_ROW,
    khata_id: normalizeNotebookPlusKhataId(input.khata_id),
    amount,
    paid,
    details,
    sort_index: input.sortIndex,
  };
}

export function collectNotebookPlusKhatas(
  rows: Array<TransactionWithMeta & { id?: string }>,
): NotebookPlusKhata[] {
  const byId = new Map<string, NotebookPlusKhata>();

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_NOTEBOOK_PLUS) continue;
    if (metaString(m, "line") !== NOTEBOOK_PLUS_LINE_KHATA) continue;
    const id = normalizeNotebookPlusKhataId(m["khata_id"]);
    if (id === NOTEBOOK_PLUS_DEFAULT_KHATA_ID) continue;
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

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_NOTEBOOK_PLUS) continue;
    if (metaString(m, "line") !== NOTEBOOK_PLUS_LINE_ROW) continue;
    const id = normalizeNotebookPlusKhataId(m["khata_id"]);
    if (id === NOTEBOOK_PLUS_DEFAULT_KHATA_ID) continue;
    if (byId.has(id)) continue;
    byId.set(id, { id, name: id, registryId: "" });
  }

  const list = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const hasDefaultRows = rows.some((row) => {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_NOTEBOOK_PLUS) return false;
    if (metaString(m, "line") !== NOTEBOOK_PLUS_LINE_ROW) return false;
    return normalizeNotebookPlusKhataId(m["khata_id"]) === NOTEBOOK_PLUS_DEFAULT_KHATA_ID;
  });
  if (hasDefaultRows) {
    list.unshift({
      id: NOTEBOOK_PLUS_DEFAULT_KHATA_ID,
      name: NOTEBOOK_PLUS_DEFAULT_KHATA_NAME,
      registryId: "",
    });
  }

  return list;
}

export function collectNotebookPlusRows(
  rows: Array<TransactionWithMeta & { id?: string }>,
  khataId?: string,
): NotebookPlusRow[] {
  const out: NotebookPlusRow[] = [];
  const filterId = khataId ? normalizeNotebookPlusKhataId(khataId) : null;

  for (const row of rows) {
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_NOTEBOOK_PLUS) continue;
    if (metaString(m, "line") !== NOTEBOOK_PLUS_LINE_ROW) continue;
    const rowKhata = normalizeNotebookPlusKhataId(m["khata_id"]);
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

export {
  closingBalanceForRows,
  formatLedgerMoney,
  formatMoneyOrBlank,
  openingBalanceBefore,
  parseLedgerMoneyInput,
  rowsInRange,
  withRunningBalances,
};

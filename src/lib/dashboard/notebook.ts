import {
  getMetadata,
  metaString,
  type TransactionInsert,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { isBlankNote } from "@/lib/utils/rich-text";

/** Independent workspace notebook (not Daily Entry notes). */
export const SOURCE_NOTEBOOK = "notebook" as const;
export const DESC_NOTEBOOK = "Notebook";
export const NOTEBOOK_LINE = "notebook_entry" as const;

export type NotebookEntry = {
  id: string;
  date: string;
  title: string;
  body: string;
};

export function buildNotebookInsert(input: {
  business_id: string;
  created_by_user_id: string;
  note_date: string;
  title: string;
  body: string;
}): TransactionInsert {
  const title = input.title.trim();
  const body = input.body.trim();
  return {
    business_id: input.business_id,
    transaction_type: "expense",
    amount: 0,
    description: title ? `${DESC_NOTEBOOK}: ${title}` : DESC_NOTEBOOK,
    transaction_date: input.note_date,
    created_by_user_id: input.created_by_user_id,
    metadata: {
      source: SOURCE_NOTEBOOK,
      line: NOTEBOOK_LINE,
      title,
      notes: body,
    },
  };
}

export function notebookMetadataPatch(title: string, body: string): Record<string, unknown> {
  const t = title.trim();
  const b = body.trim();
  return {
    source: SOURCE_NOTEBOOK,
    line: NOTEBOOK_LINE,
    title: t,
    notes: b,
  };
}

export function collectNotebookEntriesForRange(
  rows: Array<TransactionWithMeta & { id?: string }>,
  rangeStartISO: string,
  rangeEndISO: string,
): NotebookEntry[] {
  const out: NotebookEntry[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_NOTEBOOK) continue;
    if (metaString(m, "line") !== NOTEBOOK_LINE) continue;
    const body = typeof m["notes"] === "string" ? m["notes"] : "";
    if (isBlankNote(body) && !String(m["title"] ?? "").trim()) continue;
    const title = typeof m["title"] === "string" ? m["title"].trim() : "";
    out.push({
      id: typeof row.id === "string" ? row.id : "",
      date: row.transaction_date,
      title,
      body,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return out;
}

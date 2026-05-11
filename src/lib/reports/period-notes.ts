import {
  getMetadata,
  metaString,
  SOURCE_RESTAURANT,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";

/** Restaurant daily-entry notes (`daily_notes` line), scoped to calendar month. */
export function collectDailyEntryNotes(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): { date: string; text: string }[] {
  const out: { date: string; text: string }[] = [];
  for (const row of rows) {
    if (row.transaction_date < monthStartISO || row.transaction_date > monthEndISO) continue;
    const m = getMetadata(row.metadata, row.description);
    if (metaString(m, "source") !== SOURCE_RESTAURANT) continue;
    if (metaString(m, "line") !== "daily_notes") continue;
    const text = typeof m["notes"] === "string" ? m["notes"].trim() : "";
    if (!text) continue;
    out.push({ date: row.transaction_date, text });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

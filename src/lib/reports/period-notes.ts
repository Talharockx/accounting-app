import {
  getMetadata,
  metaString,
  SOURCE_MOBILE,
  SOURCE_RESTAURANT,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { isBlankNote } from "@/lib/utils/rich-text";

export type DailyNoteEntry = {
  date: string;
  /** Stored HTML from the rich editor (sanitized when rendered). */
  html: string;
};

/** Daily-entry notes (`daily_notes` line) for restaurant or mobile shop, in a date range. */
export function collectDailyEntryNotesForRange(
  rows: TransactionWithMeta[],
  rangeStartISO: string,
  rangeEndISO: string,
): DailyNoteEntry[] {
  const out: DailyNoteEntry[] = [];
  for (const row of rows) {
    if (row.transaction_date < rangeStartISO || row.transaction_date > rangeEndISO) continue;
    const m = getMetadata(row.metadata, row.description);
    const src = metaString(m, "source");
    if (src !== SOURCE_RESTAURANT && src !== SOURCE_MOBILE) continue;
    if (metaString(m, "line") !== "daily_notes") continue;
    const html = typeof m["notes"] === "string" ? m["notes"] : "";
    if (isBlankNote(html)) continue;
    out.push({ date: row.transaction_date, html });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** @deprecated Prefer {@link collectDailyEntryNotesForRange}; same data as `text` = HTML body. */
export function collectDailyEntryNotes(
  rows: TransactionWithMeta[],
  monthStartISO: string,
  monthEndISO: string,
): { date: string; text: string }[] {
  return collectDailyEntryNotesForRange(rows, monthStartISO, monthEndISO).map((e) => ({
    date: e.date,
    text: e.html,
  }));
}

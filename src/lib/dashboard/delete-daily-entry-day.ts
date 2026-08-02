import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getMetadata,
  metaString,
  stripEmbeddedMetaFromDescription,
} from "@/lib/dashboard/daily-entry";
import { SOURCE_LEDGER_NOTEBOOK, DESC_LEDGER_NOTEBOOK, DESC_LEDGER_KHATA } from "@/lib/dashboard/ledger-notebook";
import { SOURCE_NOTEBOOK, DESC_NOTEBOOK } from "@/lib/dashboard/notebook";
import {
  SOURCE_NOTEBOOK_PLUS,
  DESC_NOTEBOOK_PLUS,
  DESC_NOTEBOOK_PLUS_KHATA,
} from "@/lib/dashboard/notebook-plus";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";

/**
 * Sources that must never be wiped when Daily Entry / Transactions replaces a calendar day.
 * Notebook (ledger khatas), Notes+, and Notebook+ share the `transactions` table.
 */
const PROTECTED_DAY_SOURCES = new Set<string>([
  SOURCE_LEDGER_NOTEBOOK,
  SOURCE_NOTEBOOK,
  SOURCE_NOTEBOOK_PLUS,
]);

function descriptionLooksProtected(description: string | null | undefined): boolean {
  const d = stripEmbeddedMetaFromDescription(description ?? null).trim().toLowerCase();
  if (!d) return false;
  if (d === DESC_NOTEBOOK.toLowerCase() || d.startsWith(`${DESC_NOTEBOOK.toLowerCase()}:`)) return true;
  if (d.startsWith(DESC_LEDGER_NOTEBOOK.toLowerCase()) || d.startsWith(DESC_LEDGER_KHATA.toLowerCase())) {
    return true;
  }
  if (
    d.startsWith(DESC_NOTEBOOK_PLUS.toLowerCase()) ||
    d.startsWith(DESC_NOTEBOOK_PLUS_KHATA.toLowerCase())
  ) {
    return true;
  }
  return false;
}

/** True when a row must survive Daily Entry / day-replace deletes. */
export function isProtectedNonDailyEntryRow(
  description: string | null | undefined,
  metadata: unknown,
): boolean {
  const m = getMetadata(metadata, description);
  const source = metaString(m, "source");
  if (source && PROTECTED_DAY_SOURCES.has(source)) return true;
  return descriptionLooksProtected(description);
}

/**
 * Delete only Daily Entry (and other replaceable) rows for a business+date.
 * Leaves Notebook / Notes+ / Notebook+ rows intact.
 */
export async function deleteDailyEntryDayRows(
  client: SupabaseClient,
  businessId: string,
  transactionDate: string,
): Promise<{ error: Error | null; deletedCount: number }> {
  const result = await selectWithMetadataColumnFallback(
    async () =>
      await client
        .from("transactions")
        .select("id, description, metadata")
        .eq("business_id", businessId)
        .eq("transaction_date", transactionDate)
        .limit(20_000),
    async () =>
      await client
        .from("transactions")
        .select("id, description")
        .eq("business_id", businessId)
        .eq("transaction_date", transactionDate)
        .limit(20_000),
  );

  if (result.error) {
    return { error: new Error(result.error.message), deletedCount: 0 };
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  const idsToDelete: string[] = [];
  for (const row of rows) {
    const rec = row as { id?: unknown; description?: unknown; metadata?: unknown };
    if (typeof rec.id !== "string" || !rec.id) continue;
    const description = typeof rec.description === "string" ? rec.description : null;
    if (isProtectedNonDailyEntryRow(description, rec.metadata)) continue;
    idsToDelete.push(rec.id);
  }

  if (idsToDelete.length === 0) {
    return { error: null, deletedCount: 0 };
  }

  /** Chunk deletes to stay within PostgREST URL / payload limits. */
  const chunkSize = 200;
  let deletedCount = 0;
  for (let i = 0; i < idsToDelete.length; i += chunkSize) {
    const chunk = idsToDelete.slice(i, i + chunkSize);
    const { error } = await client
      .from("transactions")
      .delete()
      .eq("business_id", businessId)
      .in("id", chunk);
    if (error) {
      return { error: new Error(error.message), deletedCount };
    }
    deletedCount += chunk.length;
  }

  return { error: null, deletedCount };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TransactionInsert } from "@/lib/dashboard/daily-entry";
import {
  patchForUpdateWithoutMetadataColumn,
  rowsForInsertWithoutMetadataColumn,
} from "@/lib/dashboard/daily-entry";

/** PostgREST / Postgres when `transactions.metadata` has not been created yet. */
export function isMissingTransactionsMetadataColumnError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  /** PostgREST / Postgres when `transactions.metadata` is absent from DB or stale schema cache. */
  return (
    m.includes("metadata") &&
    (m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("could not find") ||
      m.includes("unknown column") ||
      m.includes("42703"))
  );
}

export async function insertTransactionsWithMetadataFallback(
  client: SupabaseClient,
  rows: TransactionInsert[],
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null };

  const first = await client.from("transactions").insert(rows as never);
  if (!first.error) return { error: null };

  if (!isMissingTransactionsMetadataColumnError(first.error.message)) {
    return { error: new Error(first.error.message) };
  }

  const second = await client.from("transactions").insert(rowsForInsertWithoutMetadataColumn(rows) as never);
  if (second.error) {
    return { error: new Error(second.error.message) };
  }
  return { error: null };
}

export async function updateTransactionWithMetadataFallback(
  client: SupabaseClient,
  id: string,
  businessId: string,
  patch: {
    metadata?: Record<string, unknown>;
    description?: string | null;
    [key: string]: unknown;
  },
): Promise<{ error: Error | null }> {
  const first = await client
    .from("transactions")
    .update(patch as never)
    .eq("id", id)
    .eq("business_id", businessId);
  if (!first.error) return { error: null };

  if (!isMissingTransactionsMetadataColumnError(first.error.message)) {
    return { error: new Error(first.error.message) };
  }

  const second = await client
    .from("transactions")
    .update(patchForUpdateWithoutMetadataColumn(patch) as never)
    .eq("id", id)
    .eq("business_id", businessId);
  if (second.error) {
    return { error: new Error(second.error.message) };
  }
  return { error: null };
}

type SelectResult<T> = { data: T | null; error: { message: string } | null };

/** Use when `select(..., metadata)` fails because the column was not migrated yet. */
export async function selectWithMetadataColumnFallback<T>(
  selectWithMetadata: () => Promise<SelectResult<T>>,
  selectWithoutMetadata: () => Promise<SelectResult<T>>,
): Promise<SelectResult<T>> {
  const first = await selectWithMetadata();
  if (first.error && isMissingTransactionsMetadataColumnError(first.error.message)) {
    return selectWithoutMetadata();
  }
  return first;
}

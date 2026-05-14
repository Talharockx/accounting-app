"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DESC_MOBILE_NOTES,
  DESC_REST_NOTES,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { collectDailyEntryNotesForRange } from "@/lib/reports/period-notes";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { noteToPlainText } from "@/lib/utils/rich-text";
import {
  getMonthBoundariesISO,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";

function formatNoteHeadingDate(iso: string): string {
  const [y, mo, d] = iso.split("-");
  if (!y || !mo || !d) return iso;
  return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${y}`;
}

function calendarMonthHeading(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 15).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function NotesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [bizLoading, setBizLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");
  const [transactions, setTransactions] = useState<TransactionWithMeta[]>([]);
  const [monthInput, setMonthInput] = useState(() =>
    toMonthInputValue(new Date().getFullYear(), new Date().getMonth()),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { businessId: bid } = await params;
      if (cancelled) return;
      setBusinessId(bid);
      try {
        const { data, error } = await supabase
          .from("businesses")
          .select("name")
          .eq("id", bid)
          .single();
        if (!cancelled && data?.name) setBusinessName(data.name as string);
        if (error && !cancelled) {
          setTxError(getUserFriendlyError(new Error(error.message)));
        }
      } catch (caught) {
        if (!cancelled) setTxError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      } finally {
        if (!cancelled) setBizLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const parsedMonth = useMemo(() => parseMonthInputValue(monthInput), [monthInput]);

  const monthRange = useMemo(() => {
    if (!parsedMonth) return null;
    return getMonthBoundariesISO(parsedMonth.year, parsedMonth.monthIndex);
  }, [parsedMonth]);

  const loadTransactions = useCallback(async () => {
    if (!businessId || !monthRange) return;

    setTxLoading(true);
    setTxError("");
    /** Daily notes are a handful of rows per month; never pull the full ledger here (was 20k). */
    const notesDescriptionOr = `description.like.${DESC_REST_NOTES}%,description.like.${DESC_MOBILE_NOTES}%`;
    try {
      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .gte("transaction_date", monthRange.start)
            .lte("transaction_date", monthRange.end)
            .or(notesDescriptionOr)
            .order("transaction_date", { ascending: true })
            .limit(124),
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .gte("transaction_date", monthRange.start)
            .lte("transaction_date", monthRange.end)
            .or(notesDescriptionOr)
            .order("transaction_date", { ascending: true })
            .limit(124),
      );

      if (fetchError) {
        const msg = getUserFriendlyError(new Error(fetchError.message));
        setTxError(msg);
        setTransactions([]);
        return;
      }

      setTransactions(mapTransactionRows(data ?? []));
    } catch (caught) {
      const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
      setTxError(msg);
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [businessId, monthRange]);

  useEffect(() => {
    if (!businessId || !monthRange) return;
    const id = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, monthRange, loadTransactions]);

  const monthDailyNotes = useMemo(() => {
    if (!monthRange) return [];
    return collectDailyEntryNotesForRange(transactions, monthRange.start, monthRange.end);
  }, [monthRange, transactions]);

  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());

  if (bizLoading) {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8">
        <Skeleton className="mb-6 h-9 w-48 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!parsedMonth || !monthRange) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
              Notes
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              Daily entry notes
            </h1>
            {businessName ? (
              <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">{businessName}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-semibold text-[var(--lv-muted)]" htmlFor="notes-month">
              Month
            </label>
            <input
              id="notes-month"
              type="month"
              max={maxMonthInput}
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="lv-tabular-mono rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-surface-muted)] px-3 py-2.5 text-sm text-[var(--lv-heading)] outline-none focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)] dark:bg-white/[0.07]"
            />
          </div>
        </div>
      </section>

      {!txError && txLoading ? (
        <p className="text-sm text-slate-400">Loading notes…</p>
      ) : null}

      <section className="rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-liquid-fill)] p-5 shadow-[var(--lv-bento-shadow)] backdrop-blur-3xl sm:p-7">
        <p className="mb-4 text-sm text-[var(--lv-muted-strong)]">
          Notes saved from Daily Entry for{" "}
          <span className="font-medium text-[var(--lv-heading)]">
            {calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)}
          </span>
          . Add or edit them under Daily Entry for each date.
        </p>

        {txError ? (
          <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
            {txError}
          </p>
        ) : txLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : monthDailyNotes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[var(--lv-surface-muted)] px-6 py-14 text-center dark:bg-white/[0.04]"
          >
            <p className="text-base font-semibold text-[var(--lv-heading)]">No notes this month</p>
            <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
              Open Daily Entry, pick a date, and use the day notes field at the bottom of the form.
            </p>
          </motion.div>
        ) : (
          <ul className="flex flex-col gap-4">
            {monthDailyNotes.map((n) => (
              <li
                key={n.date}
                className="rounded-xl border border-white/10 bg-[var(--lv-surface-muted)] p-4 dark:bg-white/[0.04]"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lv-accent)]">
                  {formatNoteHeadingDate(n.date)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--lv-heading)]">
                  {noteToPlainText(n.html)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PressableButton } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import {
  collectGroceryChequesForRange,
  formatGroceryChequeAmount,
  sumGroceryChequeAmounts,
} from "@/lib/reports/collect-grocery-cheques";
import { downloadGroceryChequesPdf } from "@/lib/reports/grocery-cheques-pdf";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { supabase } from "@/lib/supabaseClient";
import {
  getMonthBoundariesISO,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";
import { cn } from "@/lib/utils/cn";

function formatHeadingDate(iso: string): string {
  if (!iso) return "—";
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

export function GroceryChequesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [bizLoading, setBizLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
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
          .select("name, business_type")
          .eq("id", bid)
          .single();
        if (!cancelled && data?.name) setBusinessName(data.name as string);
        if (!cancelled && data?.business_type) setBusinessType(data.business_type as string);
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
  }, [params]);

  const parsedMonth = useMemo(() => parseMonthInputValue(monthInput), [monthInput]);

  const monthRange = useMemo(() => {
    if (!parsedMonth) return null;
    return getMonthBoundariesISO(parsedMonth.year, parsedMonth.monthIndex);
  }, [parsedMonth]);

  const loadTransactions = useCallback(async () => {
    if (!businessId || !monthRange) return;

    setTxLoading(true);
    setTxError("");
    try {
      // Load a wide window so cheques entered earlier (due this month) still appear,
      // and future entry months remain selectable.
      const lookbackStart = "2020-01-01";
      const lookaheadEnd = (() => {
        const [y, m] = monthRange.end.split("-").map(Number);
        if (!y || !m) return monthRange.end;
        const end = new Date(y, m - 1 + 24, 0); // ~24 months past selected month end
        const yy = end.getFullYear();
        const mm = String(end.getMonth() + 1).padStart(2, "0");
        const dd = String(end.getDate()).padStart(2, "0");
        return `${yy}-${mm}-${dd}`;
      })();

      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .gte("transaction_date", lookbackStart)
            .lte("transaction_date", lookaheadEnd)
            .order("transaction_date", { ascending: true })
            .limit(8000),
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .gte("transaction_date", lookbackStart)
            .lte("transaction_date", lookaheadEnd)
            .order("transaction_date", { ascending: true })
            .limit(8000),
      );

      if (fetchError) {
        setTxError(getUserFriendlyError(new Error(fetchError.message)));
        setTransactions([]);
        return;
      }

      setTransactions(mapTransactionRows(data ?? []));
    } catch (caught) {
      setTxError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [businessId, monthRange]);

  useEffect(() => {
    if (!businessId || !monthRange || businessType !== "grocery") return;
    const id = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, monthRange, businessType, loadTransactions]);

  const lines = useMemo(() => {
    if (!monthRange) return [];
    return collectGroceryChequesForRange(transactions, monthRange.start, monthRange.end);
  }, [monthRange, transactions]);

  const totalAmount = useMemo(() => sumGroceryChequeAmounts(lines), [lines]);
  const unpaidCount = useMemo(() => lines.filter((r) => !r.paid).length, [lines]);

  // Allow future months so due dates / entry dates ahead can be reviewed.
  const maxMonthInput = toMonthInputValue(new Date().getFullYear() + 2, new Date().getMonth());

  const periodTitle = parsedMonth
    ? calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)
    : "";

  const handleDownloadPdf = async () => {
    if (!businessName || !periodTitle) return;
    setPdfBusy(true);
    try {
      await downloadGroceryChequesPdf({
        businessName,
        periodTitle,
        lines,
      });
      toast.success("Cheques PDF downloaded.");
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setPdfBusy(false);
    }
  };

  if (bizLoading) {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8">
        <Skeleton className="mb-6 h-9 w-48 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (businessType !== "grocery") {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8 text-center">
        <p className="text-lg font-semibold text-[var(--lv-heading)]">Grocery only</p>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
          Cheques export is available for grocery workspaces.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-[1.625rem] p-6 sm:p-7"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
              Grocery
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              Cheques
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--lv-muted-strong)]">
              Month view of cheques whose entry date or due date falls in the selected month —
              including upcoming months.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-semibold text-[var(--lv-muted)]" htmlFor="grocery-cheques-month">
              Month
            </label>
            <input
              id="grocery-cheques-month"
              type="month"
              max={maxMonthInput}
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="lv-tabular-mono rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-surface-muted)] px-3 py-2.5 text-sm text-[var(--lv-heading)] outline-none focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)] dark:bg-white/[0.07]"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PressableButton
            type="button"
            variant="primary"
            disabled={pdfBusy || txLoading}
            onClick={() => void handleDownloadPdf()}
            className={cn(
              "min-h-12 gap-2 rounded-[1rem] px-5",
              "bg-gradient-to-r from-cyan-400/95 to-[color-mix(in_srgb,var(--lv-accent)_72%,#0e7490)]",
            )}
          >
            {pdfBusy ? "Generating PDF…" : "Download cheques (PDF)"}
          </PressableButton>
          {!txLoading && !txError ? (
            <p className="text-sm text-[var(--lv-muted-strong)]">
              {lines.length} cheque{lines.length === 1 ? "" : "s"}
              {unpaidCount > 0 ? ` · ${unpaidCount} unpaid` : ""} · Total{" "}
              <span className="font-semibold text-[var(--lv-heading)]">
                {formatGroceryChequeAmount(totalAmount)}
              </span>
            </p>
          ) : null}
        </div>
      </motion.div>

      {txError ? (
        <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
          {txError}
        </p>
      ) : txLoading ? (
        <Skeleton className="h-48 w-full rounded-[1.625rem]" />
      ) : lines.length === 0 ? (
        <div className="glass-panel rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] px-6 py-14 text-center">
          <p className="text-lg font-semibold text-[var(--lv-heading)]">No cheques this month</p>
          <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
            Add cheques in Daily Entry for each date.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-liquid-fill)] shadow-[var(--lv-bento-shadow)] backdrop-blur-3xl">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_50%,transparent)] text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--lv-muted-strong)]">
                <th className="px-4 py-3 font-semibold">Entry date</th>
                <th className="px-4 py-3 font-semibold">Cheque name</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Due date</th>
                <th className="px-4 py-3 font-semibold">Paid</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((row, index) => (
                <tr
                  key={`${row.date}-${row.name}-${row.dueDate}-${index}`}
                  className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_28%,transparent)] last:border-0"
                >
                  <td className="lv-tabular-mono whitespace-nowrap px-4 py-3 text-[var(--lv-heading)]">
                    {formatHeadingDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-[var(--lv-heading)]">{row.name}</td>
                  <td className="lv-tabular-mono px-4 py-3 text-right font-medium text-[var(--lv-heading)]">
                    {formatGroceryChequeAmount(row.amount)}
                  </td>
                  <td className="lv-tabular-mono whitespace-nowrap px-4 py-3 text-[var(--lv-muted-strong)]">
                    {formatHeadingDate(row.dueDate)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 font-medium",
                      row.paid
                        ? "text-[var(--lv-traffic-positive)]"
                        : "text-[var(--lv-traffic-critical)]",
                    )}
                  >
                    {row.paid ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[color-mix(in_srgb,var(--lv-glass-edge)_50%,transparent)]">
                <td className="px-4 py-3 font-semibold text-[var(--lv-heading)]" colSpan={2}>
                  Total
                </td>
                <td className="lv-tabular-mono px-4 py-3 text-right font-semibold text-[var(--lv-heading)]">
                  {formatGroceryChequeAmount(totalAmount)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

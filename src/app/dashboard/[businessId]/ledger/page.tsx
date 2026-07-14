"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeNonNegativeDecimalInput } from "@/lib/dashboard/daily-entry";
import {
  buildLedgerRowInsert,
  collectLedgerRows,
  DESC_LEDGER_NOTEBOOK,
  formatLedgerMoney,
  formatMoneyOrBlank,
  ledgerRowMetadataPatch,
  openingBalanceBefore,
  parseLedgerMoneyInput,
  rowsInRange,
  withRunningBalances,
  type LedgerNotebookRow,
  type LedgerNotebookRowWithBalance,
} from "@/lib/dashboard/ledger-notebook";
import {
  insertTransactionsWithMetadataFallback,
  selectWithMetadataColumnFallback,
} from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { downloadLedgerNotebookPdf } from "@/lib/reports/ledger-notebook-pdf";
import { mapTransactionListRows } from "@/lib/supabase/map-transactions";
import {
  getMonthBoundariesISO,
  getTodayLocalISO,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";
import { cn } from "@/lib/utils/cn";
import { supabase } from "@/lib/supabaseClient";

function formatHeadingDate(iso: string): string {
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

export default function LedgerNotebookPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [userId, setUserId] = useState("");
  const [bizLoading, setBizLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const [allRows, setAllRows] = useState<LedgerNotebookRow[]>([]);

  const [monthInput, setMonthInput] = useState(() =>
    toMonthInputValue(new Date().getFullYear(), new Date().getMonth()),
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowDate, setRowDate] = useState(() => getTodayLocalISO());
  const [rowAmount, setRowAmount] = useState("");
  const [rowPaid, setRowPaid] = useState("");
  const [rowDetails, setRowDetails] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { businessId: bid } = await params;
      if (cancelled) return;
      setBusinessId(bid);
      try {
        const { data: biz, error: bizErr } = await supabase
          .from("businesses")
          .select("name")
          .eq("id", bid)
          .single();
        if (cancelled) return;
        if (biz?.name) setBusinessName(biz.name as string);
        if (bizErr) setError(getUserFriendlyError(new Error(bizErr.message)));

        const { data: sessionData } = await supabase.auth.getSession();
        let uid = sessionData.session?.user?.id ?? "";
        if (!uid) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            uid = authData.user?.id ?? "";
          } catch {
            // Offline / Auth unreachable — page still usable for viewing.
          }
        }
        if (!cancelled && uid) setUserId(uid);
      } catch (caught) {
        if (!cancelled) setError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
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

  const loadLedger = useCallback(async () => {
    if (!businessId || !monthRange) return;
    setLoading(true);
    setError("");
    const notesOr = `description.like.${DESC_LEDGER_NOTEBOOK}%`;
    try {
      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .lte("transaction_date", monthRange.end)
            .or(notesOr)
            .order("transaction_date", { ascending: true })
            .limit(4000),
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .lte("transaction_date", monthRange.end)
            .or(notesOr)
            .order("transaction_date", { ascending: true })
            .limit(4000),
      );

      if (fetchError) {
        setError(getUserFriendlyError(new Error(fetchError.message)));
        setAllRows([]);
        return;
      }

      setAllRows(collectLedgerRows(mapTransactionListRows(data ?? [])));
    } catch (caught) {
      setError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, monthRange]);

  useEffect(() => {
    if (!businessId || !monthRange) return;
    const id = window.setTimeout(() => void loadLedger(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, monthRange, loadLedger]);

  const opening = useMemo(
    () => (monthRange ? openingBalanceBefore(allRows, monthRange.start) : 0),
    [allRows, monthRange],
  );

  const monthRows = useMemo((): LedgerNotebookRowWithBalance[] => {
    if (!monthRange) return [];
    return withRunningBalances(rowsInRange(allRows, monthRange.start, monthRange.end), opening);
  }, [allRows, monthRange, opening]);

  const periodTitle = parsedMonth
    ? calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)
    : "";
  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());
  const todayISO = getTodayLocalISO();

  const resetForm = () => {
    setEditingId(null);
    setRowDate(getTodayLocalISO());
    setRowAmount("");
    setRowPaid("");
    setRowDetails("");
  };

  const startEdit = (row: LedgerNotebookRowWithBalance) => {
    setEditingId(row.id);
    setRowDate(row.date);
    setRowAmount(row.amount > 0 ? String(row.amount) : "");
    setRowPaid(row.paid > 0 ? String(row.paid) : "");
    setRowDetails(row.details);
  };

  const handleSubmitRow = async (event: FormEvent) => {
    event.preventDefault();
    if (!businessId || !userId) {
      toast.error("Sign in again to save Notebook rows.");
      return;
    }
    const amount = parseLedgerMoneyInput(rowAmount);
    const paid = parseLedgerMoneyInput(rowPaid);
    const details = rowDetails.trim();
    if (amount <= 0 && paid <= 0 && !details) {
      toast.error("Enter amount, paid, or details.");
      return;
    }

    setSaving(true);
    try {
      const sortIndex = editingId
        ? (allRows.find((r) => r.id === editingId)?.sortIndex ?? Date.now())
        : Date.now();

      if (editingId) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            transaction_date: rowDate,
            amount: 0,
            description: details
              ? `${DESC_LEDGER_NOTEBOOK}: ${details.slice(0, 80)}`
              : DESC_LEDGER_NOTEBOOK,
            metadata: ledgerRowMetadataPatch({ amount, paid, details, sortIndex }),
          } as never)
          .eq("id", editingId)
          .eq("business_id", businessId);
        if (updateError) throw new Error(updateError.message);
        toast.success("Notebook row updated.");
      } else {
        const insert = buildLedgerRowInsert({
          business_id: businessId,
          created_by_user_id: userId,
          date: rowDate,
          amount,
          paid,
          details,
          sortIndex,
        });
        const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, [insert]);
        if (insertError) throw insertError;
        toast.success("Notebook row saved.");
      }

      const savedDate = rowDate;
      resetForm();
      const [y, m] = savedDate.split("-");
      if (y && m) {
        const nextMonth = `${y}-${m}`;
        if (nextMonth !== monthInput) {
          setMonthInput(nextMonth);
        } else {
          await loadLedger();
        }
      } else {
        await loadLedger();
      }
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId || !id) return;
    if (!window.confirm("Delete this Notebook row?")) return;
    try {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);
      if (deleteError) throw new Error(deleteError.message);
      toast.success("Notebook row deleted.");
      if (editingId === id) resetForm();
      await loadLedger();
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    }
  };

  const handleDownloadPdf = async () => {
    if (!businessName || !periodTitle) return;
    setPdfBusy(true);
    try {
      await downloadLedgerNotebookPdf({
        businessName,
        periodTitle,
        openingBalance: opening,
        rows: monthRows,
      });
      toast.success("Notebook PDF downloaded.");
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
              Workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              Notebook
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--lv-muted-strong)]">
              Date, Amount, Paid, Balance, and Details — running balance carries forward. Separate
              from Daily Entry, Notes, and Notes +.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-semibold text-[var(--lv-muted)]" htmlFor="ledger-month">
              View month
            </label>
            <input
              id="ledger-month"
              type="month"
              max={maxMonthInput}
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="lv-tabular-mono rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-surface-muted)] px-3 py-2.5 text-sm text-[var(--lv-heading)] outline-none focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)] dark:bg-white/[0.07]"
            />
          </div>
        </div>
      </motion.div>

      <form
        onSubmit={(e) => void handleSubmitRow(e)}
        className="glass-panel space-y-4 rounded-[1.625rem] p-6 sm:p-7"
      >
        <h2 className="text-lg font-semibold text-[var(--lv-heading)]">
          {editingId ? "Edit row" : "Add row"}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MidnightField
            id="ledger-date"
            label="Date"
            type="date"
            max={todayISO}
            required
            value={rowDate}
            onChange={(e) => setRowDate(e.target.value)}
          />
          <MidnightField
            id="ledger-amount"
            label="Amount"
            type="text"
            inputMode="decimal"
            value={rowAmount}
            onChange={(e) => {
              const next = sanitizeNonNegativeDecimalInput(e.target.value);
              if (next !== null) setRowAmount(next === "0" ? "" : next);
            }}
          />
          <MidnightField
            id="ledger-paid"
            label="Paid"
            type="text"
            inputMode="decimal"
            value={rowPaid}
            onChange={(e) => {
              const next = sanitizeNonNegativeDecimalInput(e.target.value);
              if (next !== null) setRowPaid(next === "0" ? "" : next);
            }}
          />
          <MidnightField
            id="ledger-details"
            label="Details"
            type="text"
            value={rowDetails}
            onChange={(e) => setRowDetails(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <PressableButton type="submit" variant="primary" disabled={saving} className="min-h-12 px-5">
            {saving ? "Saving…" : editingId ? "Update row" : "Save row"}
          </PressableButton>
          {editingId ? (
            <PressableButton type="button" variant="ghost" className="min-h-12 px-4" onClick={resetForm}>
              Cancel edit
            </PressableButton>
          ) : null}
        </div>
      </form>

      <div className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--lv-heading)]">{periodTitle || "Notebook"}</h2>
          </div>
          <PressableButton
            type="button"
            variant="primary"
            disabled={pdfBusy || loading}
            onClick={() => void handleDownloadPdf()}
            className={cn(
              "min-h-12 gap-2 rounded-[1rem] px-5",
              "bg-gradient-to-r from-cyan-400/95 to-[color-mix(in_srgb,var(--lv-accent)_72%,#0e7490)]",
            )}
          >
            {pdfBusy ? "Generating PDF…" : "Download Notebook (PDF)"}
          </PressableButton>
        </div>

        {error ? (
          <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
            {error}
          </p>
        ) : loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <div className="overflow-x-auto rounded-[1.25rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)]">
            <table className="lv-tabular-mono min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_50%,transparent)] text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--lv-muted-strong)]">
                  <th className="whitespace-nowrap px-3 py-3 font-medium">Date</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Amount</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Paid</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Balance</th>
                  <th className="min-w-[10rem] px-3 py-3 font-medium">Details</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[var(--lv-muted-strong)]">
                      No rows this month. Add one above — balance carries forward from earlier months.
                    </td>
                  </tr>
                ) : (
                  monthRows.map((row) => (
                    <tr
                      key={row.id || `${row.date}-${row.sortIndex}`}
                      className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_28%,transparent)] last:border-0"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--lv-heading)]">
                        {formatHeadingDate(row.date)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-[var(--lv-heading)]">
                        {formatMoneyOrBlank(row.amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-[var(--lv-heading)]">
                        {formatMoneyOrBlank(row.paid)}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-2.5 text-right font-semibold",
                          row.balance < 0
                            ? "text-[var(--lv-traffic-critical)]"
                            : "text-[var(--lv-heading)]",
                        )}
                      >
                        {formatLedgerMoney(row.balance)}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2.5 text-[var(--lv-muted-strong)]">
                        {row.details || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <div className="inline-flex gap-2">
                          <PressableButton
                            type="button"
                            variant="secondary"
                            className="min-h-9 px-3 text-xs"
                            disabled={!row.id}
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </PressableButton>
                          <PressableButton
                            type="button"
                            variant="ghost"
                            className="min-h-9 px-3 text-xs text-[var(--lv-traffic-critical)]"
                            disabled={!row.id}
                            onClick={() => void handleDelete(row.id)}
                          >
                            Delete
                          </PressableButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

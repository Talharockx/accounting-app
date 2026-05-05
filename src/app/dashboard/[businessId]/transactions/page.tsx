"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SOURCE_RESTAURANT,
  buildMobileDailyRows,
  buildRestaurantDailyRows,
  getMetadata,
  metaString,
  parseNonNegative,
  summarizeMobileDay,
  summarizeRestaurantDay,
} from "@/lib/dashboard/daily-entry";
import {
  insertTransactionsWithMetadataFallback,
  selectWithMetadataColumnFallback,
} from "@/lib/dashboard/transaction-metadata-fallback";
import { getUserFriendlyError } from "@/lib/errors";
import type { TransactionListRow } from "@/lib/supabase/map-transactions";
import { mapTransactionListRows } from "@/lib/supabase/map-transactions";
import { supabase } from "@/lib/supabaseClient";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type BusinessType = "restaurant" | "mobile_shop";

type TransactionRow = TransactionListRow;

type RestaurantTotals = ReturnType<typeof summarizeRestaurantDay>;
type MobileTotals = ReturnType<typeof summarizeMobileDay>;

type RestaurantEdit = {
  kind: "restaurant";
  originalDate: string;
  date: string;
  cash: string;
  bank: string;
  purchases: string;
  expenses: string;
  notes: string;
};

type MobileEdit = {
  kind: "mobile_shop";
  originalDate: string;
  date: string;
  phoneSalesTotal: string;
  vodafone: string;
  wind: string;
  repairs: string;
  purchases: string;
  expenses: string;
};

type DayEdit = RestaurantEdit | MobileEdit;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function extractRestaurantNotes(rows: TransactionRow[]): string {
  for (const row of rows) {
    const meta = getMetadata(row.metadata, row.description);
    if (
      metaString(meta, "source") === SOURCE_RESTAURANT &&
      metaString(meta, "line") === "daily_notes"
    ) {
      const noteValue = typeof meta["notes"] === "string" ? meta["notes"] : "";
      if (noteValue.trim().length > 0) return noteValue;
    }
  }
  return "";
}

export default function TransactionsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [businessId, setBusinessId] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("restaurant");
  const [rawRows, setRawRows] = useState<TransactionRow[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DayEdit | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [pendingDeleteDate, setPendingDeleteDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (bid: string) => {
    setLoading(true);
    setError("");
    try {
      const { data: biz, error: bizError } = await supabase
        .from("businesses")
        .select("business_type")
        .eq("id", bid)
        .single();

      if (bizError) {
        setError(getUserFriendlyError(new Error(bizError.message)));
        setLoading(false);
        return;
      }
      if (biz?.business_type) {
        setBusinessType(biz.business_type as BusinessType);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? "");

      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, transaction_date, transaction_type, description, amount, metadata")
            .eq("business_id", bid)
            .order("transaction_date", { ascending: false }),
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, transaction_date, transaction_type, description, amount")
            .eq("business_id", bid)
            .order("transaction_date", { ascending: false }),
      );

      if (fetchError) {
        setError(getUserFriendlyError(new Error(fetchError.message)));
        setRawRows([]);
        setLoading(false);
        return;
      }
      setRawRows(mapTransactionListRows(data ?? []));
    } catch (caught) {
      setError(getUserFriendlyError(caught));
      setRawRows([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const resolved = await params;
      const bid = resolved.businessId;
      setBusinessId(bid);
      await loadData(bid);
    })();
  }, [params, loadData]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const row of rawRows) set.add(row.transaction_date);
    return Array.from(set).sort((a, b) => (a > b ? -1 : 1));
  }, [rawRows]);

  const summariesRestaurant = useMemo(
    () => dates.map((date) => summarizeRestaurantDay(rawRows, date)),
    [dates, rawRows],
  );

  const summariesMobile = useMemo(
    () => dates.map((date) => summarizeMobileDay(rawRows, date)),
    [dates, rawRows],
  );

  const runDeleteDay = async (date: string) => {
    setDeletingDate(date);
    setError("");
    const { error: delError } = await supabase
      .from("transactions")
      .delete()
      .eq("business_id", businessId)
      .eq("transaction_date", date);

    setDeletingDate(null);
    if (delError) {
      const msg = getUserFriendlyError(new Error(delError.message));
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success(`All entries for ${date} were deleted.`);
    await loadData(businessId);
  };

  const handleSaveDayEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !businessId || !userId) {
      setError("You must be signed in to save.");
      return;
    }

    setSaving(true);
    setError("");

    const { originalDate, date: targetDate } = editing;

    const { error: delError } = await supabase
      .from("transactions")
      .delete()
      .eq("business_id", businessId)
      .eq("transaction_date", originalDate);

    if (delError) {
      setSaving(false);
      setError(delError.message);
      return;
    }

    try {
      if (editing.kind === "restaurant") {
        const rows = buildRestaurantDailyRows({
          business_id: businessId,
          created_by_user_id: userId,
          transaction_date: targetDate,
          cash_sales: parseNonNegative(editing.cash),
          bank_sales: parseNonNegative(editing.bank),
          purchases: parseNonNegative(editing.purchases),
          expenses: parseNonNegative(editing.expenses),
          notes: editing.notes,
        });

        if (rows.length) {
          const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, rows);
          if (insertError) throw insertError;
        }
      } else {
        const rows = buildMobileDailyRows({
          business_id: businessId,
          created_by_user_id: userId,
          transaction_date: targetDate,
          phones: [
            {
              item_name: "",
              selling_price: parseNonNegative(editing.phoneSalesTotal),
              profit: 0,
            },
          ],
          sim_vodafone: parseNonNegative(editing.vodafone),
          sim_wind: parseNonNegative(editing.wind),
          repair_income: parseNonNegative(editing.repairs),
          purchases: parseNonNegative(editing.purchases),
          expenses: parseNonNegative(editing.expenses),
        });

        if (rows.length) {
          const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, rows);
          if (insertError) throw insertError;
        }
      }

      setEditing(null);
      toast.success("Day updated.");
      await loadData(businessId);
    } catch (caughtError) {
      const err = getUserFriendlyError(caughtError, "Unable to save changes.");
      setError(err);
      toast.error(err);
      await loadData(businessId);
    }

    setSaving(false);
  };

  const openEditRestaurant = (row: RestaurantTotals) => {
    const dayRows = rawRows.filter((item) => item.transaction_date === row.date);
    setEditing({
      kind: "restaurant",
      originalDate: row.date,
      date: row.date,
      cash: String(row.cash || 0),
      bank: String(row.bank || 0),
      purchases: String(row.purchases || 0),
      expenses: String(row.expenses || 0),
      notes: extractRestaurantNotes(dayRows),
    });
  };

  const openEditMobile = (row: MobileTotals) => {
    const dayRows = rawRows.filter((item) => item.transaction_date === row.date);

    let vod = "";
    let wind = "";
    const simRow = dayRows.find((line) => metaString(getMetadata(line.metadata, line.description), "line") === "sim_sales");

    if (simRow) {
      const meta = getMetadata(simRow.metadata, simRow.description);
      if (typeof meta["vodafone"] === "number") vod = String(meta["vodafone"]);
      if (typeof meta["wind"] === "number") wind = String(meta["wind"]);
    }

    if ((!vod || vod === "0") && (!wind || wind === "0") && row.simSales > 0) {
      wind = String(row.simSales);
    }

    setEditing({
      kind: "mobile_shop",
      originalDate: row.date,
      date: row.date,
      phoneSalesTotal: String(row.phoneSales || 0),
      vodafone: vod || "0",
      wind: wind || "0",
      repairs: String(row.repairs || 0),
      purchases: String(row.purchases || 0),
      expenses: String(row.expenses || 0),
    });
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">
        <h1 className="text-2xl font-semibold text-white">Transactions</h1>
        <p className="mt-2 text-sm text-slate-300">
          Consolidated snapshots per calendar day derived from structured Daily Entry records.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading records…</p>
      ) : rawRows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
          No transactions yet. Use <strong className="text-slate-300">Daily Entry</strong> to add
          records.
        </p>
      ) : businessType === "restaurant" ? (
        <div className="overflow-x-auto rounded-2xl border border-white/15 bg-white/5 backdrop-blur">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Cash</th>
                <th className="px-4 py-3 text-right font-medium">Bank</th>
                <th className="px-4 py-3 text-right font-medium">Purchases</th>
                <th className="px-4 py-3 text-right font-medium">Expenses</th>
                <th className="px-4 py-3 text-right font-medium">Profit</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summariesRestaurant.map((row) => (
                <tr
                  key={row.date}
                  className="border-b border-white/5 text-slate-200 last:border-0 hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">{row.date}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-white">
                    {formatCurrency(row.cash)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-white">
                    {formatCurrency(row.bank)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                    {formatCurrency(row.purchases)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                    {formatCurrency(row.expenses)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${row.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {formatCurrency(row.profit)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label="Edit day"
                        title="Edit day"
                        onClick={() => openEditRestaurant(row)}
                        className="rounded-lg border border-white/15 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete day"
                        title="Delete day"
                        disabled={deletingDate === row.date}
                        onClick={() => setPendingDeleteDate(row.date)}
                        className="rounded-lg border border-white/15 p-2 text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-50"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] backdrop-blur dark:bg-white/5">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--lv-border)] text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Phones (rev)</th>
                <th className="px-4 py-3 text-right font-medium">Margin</th>
                <th className="px-4 py-3 text-right font-medium">SIM</th>
                <th className="px-4 py-3 text-right font-medium">Repairs</th>
                <th className="px-4 py-3 text-right font-medium">Purchases</th>
                <th className="px-4 py-3 text-right font-medium">Expenses</th>
                <th className="px-4 py-3 text-right font-medium">Profit</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summariesMobile.map((row) => (
                <tr
                  key={row.date}
                  className="border-b border-white/5 text-slate-200 last:border-0 hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--lv-muted-strong)]">{row.date}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--lv-heading)]">
                    {formatCurrency(row.phoneSales)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--lv-muted-strong)]">
                    {formatCurrency(row.phoneProfit)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--lv-muted-strong)]">
                    {formatCurrency(row.simSales)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                    {formatCurrency(row.repairs)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                    {formatCurrency(row.purchases)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                    {formatCurrency(row.expenses)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${row.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {formatCurrency(row.profit)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label="Edit day"
                        title="Edit day"
                        onClick={() => openEditMobile(row)}
                        className="rounded-lg border border-white/15 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete day"
                        title="Delete day"
                        disabled={deletingDate === row.date}
                        onClick={() => setPendingDeleteDate(row.date)}
                        className="rounded-lg border border-white/15 p-2 text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-50"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing?.kind === "restaurant" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-day-title"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-day-title" className="text-lg font-semibold text-white">
              Edit daily entry ({editing.originalDate})
            </h2>
            <form className="mt-4 space-y-4" onSubmit={handleSaveDayEdit}>
              <Field
                label="Entry date"
                id="edit-r-date"
                type="date"
                value={editing.date}
                onChange={(value) => setEditing({ ...editing, date: value })}
              />
              <Field
                label="Cash sales"
                id="edit-r-cash"
                type="number"
                min={0}
                step={0.01}
                value={editing.cash}
                onChange={(value) => setEditing({ ...editing, cash: value })}
              />
              <Field
                label="Bank sales"
                id="edit-r-bank"
                type="number"
                min={0}
                step={0.01}
                value={editing.bank}
                onChange={(value) => setEditing({ ...editing, bank: value })}
              />
              <Field
                label="Purchases"
                id="edit-r-purchases"
                type="number"
                min={0}
                step={0.01}
                value={editing.purchases}
                onChange={(value) => setEditing({ ...editing, purchases: value })}
              />
              <Field
                label="Expenses"
                id="edit-r-expenses"
                type="number"
                min={0}
                step={0.01}
                value={editing.expenses}
                onChange={(value) => setEditing({ ...editing, expenses: value })}
              />
              <div className="space-y-1.5">
                <label htmlFor="edit-r-notes" className="text-sm text-slate-300">
                  Notes
                </label>
                <textarea
                  id="edit-r-notes"
                  rows={3}
                  value={editing.notes}
                  onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save day"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing?.kind === "mobile_shop" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-day-title-mobile"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-day-title-mobile" className="text-lg font-semibold text-white">
              Edit daily entry ({editing.originalDate})
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Handset detail is preserved when metadata exists. Otherwise phone totals save as a single
              consolidated line.
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleSaveDayEdit}>
              <Field
                label="Entry date"
                id="edit-m-date"
                type="date"
                value={editing.date}
                onChange={(value) => setEditing({ ...editing, date: value })}
              />
              <Field
                label="Phone sales (total)"
                id="edit-m-phones"
                type="number"
                min={0}
                step={0.01}
                value={editing.phoneSalesTotal}
                onChange={(value) => setEditing({ ...editing, phoneSalesTotal: value })}
              />
              <Field
                label="SIM · Vodafone"
                id="edit-m-vod"
                type="number"
                min={0}
                step={0.01}
                value={editing.vodafone}
                onChange={(value) => setEditing({ ...editing, vodafone: value })}
              />
              <Field
                label="SIM · Wind"
                id="edit-m-wind"
                type="number"
                min={0}
                step={0.01}
                value={editing.wind}
                onChange={(value) => setEditing({ ...editing, wind: value })}
              />
              <Field
                label="Repair income"
                id="edit-m-repairs"
                type="number"
                min={0}
                step={0.01}
                value={editing.repairs}
                onChange={(value) => setEditing({ ...editing, repairs: value })}
              />
              <Field
                label="Purchases"
                id="edit-m-purch"
                type="number"
                min={0}
                step={0.01}
                value={editing.purchases}
                onChange={(value) => setEditing({ ...editing, purchases: value })}
              />
              <Field
                label="Expenses"
                id="edit-m-exp"
                type="number"
                min={0}
                step={0.01}
                value={editing.expenses}
                onChange={(value) => setEditing({ ...editing, expenses: value })}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save day"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteDate !== null}
        title="Delete daily records?"
        description={
          pendingDeleteDate
            ? `This removes every transaction row stored for ${pendingDeleteDate}. You cannot undo this.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deletingDate !== null}
        onCancel={() => !deletingDate && setPendingDeleteDate(null)}
        onConfirm={() => {
          const d = pendingDeleteDate;
          if (!d) return;
          void (async () => {
            await runDeleteDay(d);
            setPendingDeleteDate(null);
          })();
        }}
      />
    </section>
  );
}

function Field({
  label,
  id,
  type,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  id: string;
  type: "date" | "number";
  value: string;
  onChange: (value: string) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={type === "number" ? min : undefined}
        step={type === "number" ? step : undefined}
        value={value}
        required={type === "date"}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
      />
    </div>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

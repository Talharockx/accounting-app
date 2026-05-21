"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SOURCE_RESTAURANT,
  buildMobileDailyRows,
  buildRestaurantDailyRows,
  getMetadata,
  mergeSaleBuyNamedLines,
  merchFormStringsToSaleBuy,
  metaString,
  parseMobileDailyFromTransactions,
  parseNonNegative,
  summarizeRestaurantDay,
} from "@/lib/dashboard/daily-entry";
import { buildMobileTransactionLedgerRow } from "@/lib/dashboard/mobile-transaction-ledger";
import { MobileTransactionsLedgerTable } from "@/components/dashboard/mobile-transactions-ledger-table";
import {
  MerchNamedBlock,
  NamedLinesOnly,
  useMerchListHelpers,
  useNamedListHelpers,
  type MerchRowStr,
  type NamedRowStr,
} from "@/components/dashboard/mobile-shop-fields";
import {
  insertTransactionsWithMetadataFallback,
  selectWithMetadataColumnFallback,
} from "@/lib/dashboard/transaction-metadata-fallback";
import { getUserFriendlyError } from "@/lib/errors";
import {
  getMonthBoundariesISO,
  getTodayLocalISO,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";
import { formatCurrency } from "@/lib/utils/formatters";
import { isBlankNote } from "@/lib/utils/rich-text";
import type { TransactionListRow } from "@/lib/supabase/map-transactions";
import { mapTransactionListRows } from "@/lib/supabase/map-transactions";
import { supabase } from "@/lib/supabaseClient";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";

type BusinessType = "restaurant" | "mobile_shop";

type TransactionRow = TransactionListRow;

type RestaurantTotals = ReturnType<typeof summarizeRestaurantDay>;

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
  simBuy: string;
  simSale: string;
  mobileMerch: MerchRowStr[];
  accessoryMerch: MerchRowStr[];
  packageRWind: string;
  packageRVoda: string;
  repairs: NamedRowStr[];
  extras: NamedRowStr[];
  posSale: string;
  notes: string;
  cashExpenses: NamedRowStr[];
  bankExpenses: NamedRowStr[];
};

type DayEdit = RestaurantEdit | MobileEdit;

function calendarMonthHeading(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 15).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function extractRestaurantNotes(rows: TransactionRow[]): string {
  for (const row of rows) {
    const meta = getMetadata(row.metadata, row.description);
    if (
      metaString(meta, "source") === SOURCE_RESTAURANT &&
      metaString(meta, "line") === "daily_notes"
    ) {
      const noteValue = typeof meta["notes"] === "string" ? meta["notes"] : "";
      if (!isBlankNote(noteValue)) return noteValue;
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
  const [monthInput, setMonthInput] = useState(() =>
    toMonthInputValue(new Date().getFullYear(), new Date().getMonth()),
  );
  const [dateFilter, setDateFilter] = useState("");

  const namedListHelpers = useNamedListHelpers();
  const merchListHelpers = useMerchListHelpers();

  const mobileEditHasAmount = (m: MobileEdit) => {
    const sumNamed = (list: NamedRowStr[]) => list.reduce((acc, row) => acc + parseNonNegative(row.amount), 0);
    const sumMerch = (list: MerchRowStr[]) =>
      list.reduce((acc, row) => acc + parseNonNegative(row.retail) + parseNonNegative(row.buy), 0);
    const hasMoney =
      parseNonNegative(m.simBuy) +
        parseNonNegative(m.simSale) +
        sumMerch(m.mobileMerch) +
        sumMerch(m.accessoryMerch) +
        parseNonNegative(m.packageRWind) +
        parseNonNegative(m.packageRVoda) +
        sumNamed(m.repairs) +
        sumNamed(m.extras) +
        parseNonNegative(m.posSale) +
        sumNamed(m.cashExpenses) +
        sumNamed(m.bankExpenses) >
      0;
    return hasMoney || !isBlankNote(m.notes);
  };

  const loadData = useCallback(async (bid: string, monthYYYYMM: string) => {
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

      let parsed = parseMonthInputValue(monthYYYYMM);
      if (!parsed) {
        const now = new Date();
        parsed = { year: now.getFullYear(), monthIndex: now.getMonth() };
      }
      const { start: monthStart, end: monthEnd } = getMonthBoundariesISO(parsed.year, parsed.monthIndex);

      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, transaction_date, transaction_type, description, amount, metadata")
            .eq("business_id", bid)
            .gte("transaction_date", monthStart)
            .lte("transaction_date", monthEnd)
            .order("transaction_date", { ascending: false })
            .limit(20_000),
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, transaction_date, transaction_type, description, amount")
            .eq("business_id", bid)
            .gte("transaction_date", monthStart)
            .lte("transaction_date", monthEnd)
            .order("transaction_date", { ascending: false })
            .limit(20_000),
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
    let cancelled = false;
    (async () => {
      const resolved = await params;
      const bid = resolved.businessId;
      if (cancelled) return;
      setBusinessId(bid);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const id = window.setTimeout(() => void loadData(businessId, monthInput), 0);
    return () => window.clearTimeout(id);
  }, [businessId, monthInput, loadData]);

  const parsedMonth = useMemo(() => parseMonthInputValue(monthInput), [monthInput]);
  const monthHeading =
    parsedMonth !== null ? calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex) : monthInput;
  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());
  const monthBounds = useMemo(() => {
    if (!parsedMonth) return null;
    return getMonthBoundariesISO(parsedMonth.year, parsedMonth.monthIndex);
  }, [parsedMonth]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const row of rawRows) set.add(row.transaction_date);
    return Array.from(set).sort((a, b) => (a > b ? -1 : 1));
  }, [rawRows]);

  const summariesRestaurant = useMemo(
    () => dates.map((date) => summarizeRestaurantDay(rawRows, date)),
    [dates, rawRows],
  );

  const filteredDates = useMemo(() => {
    if (!dateFilter) return dates;
    return dates.filter((d) => d === dateFilter);
  }, [dates, dateFilter]);

  const mobileLedgerRows = useMemo(
    () => filteredDates.map((date) => buildMobileTransactionLedgerRow(rawRows, date)),
    [filteredDates, rawRows],
  );

  const restaurantTotalsSum = useMemo(
    () =>
      summariesRestaurant.reduce(
        (acc, row) => ({
          cash: acc.cash + row.cash,
          bank: acc.bank + row.bank,
          purchases: acc.purchases + row.purchases,
          expenses: acc.expenses + row.expenses,
          profit: acc.profit + row.profit,
        }),
        { cash: 0, bank: 0, purchases: 0, expenses: 0, profit: 0 },
      ),
    [summariesRestaurant],
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
    await loadData(businessId, monthInput);
  };

  const handleSaveDayEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !businessId || !userId) {
      setError("You must be signed in to save.");
      return;
    }

    setSaving(true);
    setError("");

    if (editing.kind === "mobile_shop" && !mobileEditHasAmount(editing)) {
      toast.error("Add at least one amount or a note before saving.");
      setSaving(false);
      return;
    }

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
        const m = editing;
        const toLines = (list: NamedRowStr[]) =>
          list
            .map((r) => ({
              item_name: r.itemName,
              amount: parseNonNegative(r.amount),
            }))
            .filter((r) => r.amount > 0);

        const { sales: mobile_sales, buys: mobile_buys } = merchFormStringsToSaleBuy(m.mobileMerch);
        const { sales: accessory_sales, buys: accessory_buys } = merchFormStringsToSaleBuy(m.accessoryMerch);

        const rows = buildMobileDailyRows({
          business_id: businessId,
          created_by_user_id: userId,
          transaction_date: targetDate,
          sim_buy: parseNonNegative(m.simBuy),
          sim_sale: parseNonNegative(m.simSale),
          mobile_sales,
          mobile_buys,
          accessory_sales,
          accessory_buys,
          package_r_wind: parseNonNegative(m.packageRWind),
          package_r_voda: parseNonNegative(m.packageRVoda),
          repairs: toLines(m.repairs),
          extras: toLines(m.extras),
          pos_sale: parseNonNegative(m.posSale),
          notes: m.notes,
          cash_expenses: toLines(m.cashExpenses),
          bank_expenses: toLines(m.bankExpenses),
        });

        if (rows.length) {
          const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, rows);
          if (insertError) throw insertError;
        }
      }

      setEditing(null);
      toast.success("Day updated.");
      await loadData(businessId, monthInput);
    } catch (caughtError) {
      const err = getUserFriendlyError(caughtError, "Unable to save changes.");
      setError(err);
      toast.error(err);
      await loadData(businessId, monthInput);
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

  const openEditMobile = (date: string) => {
    const dayMeta = rawRows
      .filter((item) => item.transaction_date === date)
      .map((r) => ({
        amount: r.amount,
        transaction_type: r.transaction_type,
        description: r.description,
        transaction_date: r.transaction_date,
        metadata: r.metadata,
      }));
    const d = parseMobileDailyFromTransactions(dayMeta, date);
    const mapLines = (lines: { item_name: string; amount: number }[]) =>
      lines.map((r) => ({ itemName: r.item_name, amount: String(r.amount) }));
    const mapMerch = (sales: typeof d.mobile_sales, buys: typeof d.mobile_buys) =>
      mergeSaleBuyNamedLines(sales, buys).map((r) => ({
        itemName: r.item_name,
        retail: String(r.retail),
        buy: String(r.buy),
      }));

    setEditing({
      kind: "mobile_shop",
      originalDate: date,
      date,
      simBuy: String(d.sim_buy),
      simSale: String(d.sim_sale),
      mobileMerch: mapMerch(d.mobile_sales, d.mobile_buys),
      accessoryMerch: mapMerch(d.accessory_sales, d.accessory_buys),
      packageRWind: String(d.package_r_wind),
      packageRVoda: String(d.package_r_voda),
      repairs: mapLines(d.repairs),
      extras: mapLines(d.extras),
      posSale: String(d.pos_sale),
      notes: d.notes ?? "",
      cashExpenses: mapLines(d.cash_expenses),
      bankExpenses: mapLines(d.bank_expenses),
    });
  };

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
          Ledger
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">Transactions</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--lv-muted-strong)]">
          {businessType === "mobile_shop"
            ? "Mobile shop ledger: one row per day with sale, buy, profit, POS, expenses, and balance columns. Filter by month, then optionally by date."
            : "Day-by-day totals for the month you select below, compiled from saved Daily Entry."}
        </p>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transactions-month" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
              Month
            </label>
            <input
              id="transactions-month"
              type="month"
              max={maxMonthInput}
              value={monthInput}
              onChange={(e) => {
                setMonthInput(e.target.value);
                setDateFilter("");
              }}
              className="lv-input max-w-[12rem] rounded-xl"
            />
          </div>
          {businessType === "mobile_shop" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="transactions-date" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                Date (optional)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="transactions-date"
                  type="date"
                  value={dateFilter}
                  min={monthBounds?.start}
                  max={
                    monthBounds
                      ? monthBounds.end < getTodayLocalISO()
                        ? monthBounds.end
                        : getTodayLocalISO()
                      : undefined
                  }
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="lv-input max-w-[12rem] rounded-xl"
                />
                {dateFilter ? (
                  <button
                    type="button"
                    onClick={() => setDateFilter("")}
                    className="rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--lv-muted-strong)] transition hover:text-[var(--lv-heading)]"
                  >
                    Clear date
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-[1rem] border border-[color-mix(in_srgb,var(--lv-traffic-critical)_42%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_10%,transparent)] px-4 py-3 text-sm text-[var(--lv-traffic-critical)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--lv-muted-strong)]">Loading records…</p>
      ) : rawRows.length === 0 ? (
        <p className="rounded-[1rem] border border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[var(--lv-surface-muted)] px-4 py-6 text-sm text-[var(--lv-muted-strong)] dark:bg-white/[0.04]">
          No transactions in <span className="font-semibold text-[var(--lv-heading)]">{monthHeading}</span>. Choose
          another month above, or use{" "}
          <strong className="font-semibold text-[var(--lv-heading)]">Daily Entry</strong> to add records for this month.
        </p>
      ) : businessType === "restaurant" ? (
        <div className="overflow-x-auto rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-liquid-fill)] backdrop-blur-3xl shadow-[var(--lv-bento-shadow)]">
          <table className="lv-tabular-mono w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_42%,transparent)] text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">
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
                  className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_35%,transparent)] text-[var(--lv-heading)] last:border-0 hover:bg-[color-mix(in_srgb,var(--lv-accent)_05%,transparent)]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--lv-muted-strong)]">{row.date}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatCurrency(row.cash)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatCurrency(row.bank)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--lv-muted-strong)]">
                    {formatCurrency(row.purchases)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--lv-muted-strong)]">
                    {formatCurrency(row.expenses)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold tracking-tight ${
                      row.profit > 0
                        ? "text-[var(--lv-traffic-positive)]"
                        : row.profit < 0
                          ? "text-[var(--lv-traffic-critical)]"
                          : "text-[var(--lv-traffic-neutral)]"
                    }`}
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
                        className="inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-xl border border-[#ffffff10] p-2 text-[var(--lv-muted-strong)] transition hover:bg-[#ffffff07] hover:text-[var(--lv-heading)] active:scale-[0.97]"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete day"
                        title="Delete day"
                        disabled={deletingDate === row.date}
                        onClick={() => setPendingDeleteDate(row.date)}
                        className="inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-xl border border-[#ffffff10] p-2 text-[var(--lv-traffic-critical)] transition hover:bg-[color-mix(in_srgb,var(--lv-traffic-critical)_12%,transparent)] hover:text-[var(--lv-traffic-critical)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] text-[var(--lv-heading)]">
                <th scope="row" className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-[var(--lv-accent)]">
                  Total
                </th>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold">{formatCurrency(restaurantTotalsSum.cash)}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold">{formatCurrency(restaurantTotalsSum.bank)}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-[var(--lv-muted-strong)]">
                  {formatCurrency(restaurantTotalsSum.purchases)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-[var(--lv-muted-strong)]">
                  {formatCurrency(restaurantTotalsSum.expenses)}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3.5 text-right text-base font-bold tracking-tight ${
                    restaurantTotalsSum.profit > 0
                      ? "text-[var(--lv-traffic-positive)]"
                      : restaurantTotalsSum.profit < 0
                        ? "text-[var(--lv-traffic-critical)]"
                        : "text-[var(--lv-traffic-neutral)]"
                  }`}
                >
                  {formatCurrency(restaurantTotalsSum.profit)}
                </td>
                <td className="px-4 py-3.5" aria-hidden />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : dateFilter && mobileLedgerRows.length === 0 ? (
        <p className="rounded-[1rem] border border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[var(--lv-surface-muted)] px-4 py-6 text-sm text-[var(--lv-muted-strong)] dark:bg-white/[0.04]">
          No daily entry for <span className="font-semibold text-[var(--lv-heading)]">{dateFilter}</span> in{" "}
          {monthHeading}. Clear the date filter or pick another day.
        </p>
      ) : (
        <MobileTransactionsLedgerTable
          rows={mobileLedgerRows}
          deletingDate={deletingDate}
          onEdit={openEditMobile}
          onDelete={setPendingDeleteDate}
          footerLabel={dateFilter ? `Total (${dateFilter})` : `Total (${monthHeading})`}
        />
      )}

      {editing?.kind === "restaurant" ? (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-day-title"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md cursor-default rounded-2xl border border-[#ffffff10] bg-[#151921]/95 p-6 shadow-2xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-day-title" className="text-lg font-semibold text-[var(--lv-heading)]">
              Edit daily entry ({editing.originalDate})
            </h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleSaveDayEdit}>
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
              <MidnightField
                id="edit-r-notes"
                label="Notes"
                rows={4}
                value={editing.notes}
                onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                disabled={saving}
              />
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <PressableButton type="button" variant="secondary" className="min-h-12 w-full sm:w-auto" onClick={() => setEditing(null)}>
                  Cancel
                </PressableButton>
                <PressableButton type="submit" className="min-h-12 w-full sm:w-auto" disabled={saving}>
                  {saving ? "Saving…" : "Save day"}
                </PressableButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing?.kind === "mobile_shop" ? (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-day-title-mobile"
          onClick={() => setEditing(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl cursor-default overflow-y-auto rounded-2xl border border-[#ffffff10] bg-[#151921]/95 p-6 shadow-2xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-day-title-mobile" className="text-lg font-semibold text-[var(--lv-heading)]">
              Edit daily entry ({editing.originalDate})
            </h2>
            <p className="mt-2 text-xs text-[var(--lv-muted-strong)]">
              Same structure as Daily Entry. Saving replaces all rows for this business and date.
            </p>
            <form className="mt-4 flex flex-col gap-6" onSubmit={handleSaveDayEdit}>
              <Field
                label="Entry date"
                id="edit-m-date"
                type="date"
                value={editing.date}
                onChange={(value) => setEditing({ ...editing, date: value })}
              />

              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-[var(--lv-heading)]">SIM</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <MidnightField
                    id="edit-m-sim-buy"
                    label="SIM buy (shop cost)"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={editing.simBuy}
                    onChange={(e) =>
                      setEditing((p) =>
                        p?.kind === "mobile_shop"
                          ? { ...p, simBuy: String(Math.max(0, parseNonNegative(e.target.value))) }
                          : p,
                      )
                    }
                  />
                  <MidnightField
                    id="edit-m-sim-sale"
                    label="SIM sale (retail)"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={editing.simSale}
                    onChange={(e) =>
                      setEditing((p) =>
                        p?.kind === "mobile_shop"
                          ? { ...p, simSale: String(Math.max(0, parseNonNegative(e.target.value))) }
                          : p,
                      )
                    }
                  />
                </div>
              </section>

              <MerchNamedBlock
                idPrefix="tx-phone"
                title="Mobile phones"
                hint="Each line: optional name, retail sale, and stock cost."
                rows={editing.mobileMerch}
                setRows={(action) =>
                  setEditing((p) => {
                    if (!p || p.kind !== "mobile_shop") return p;
                    const next = typeof action === "function" ? action(p.mobileMerch) : action;
                    return { ...p, mobileMerch: next };
                  })
                }
                retailLabel="Retail (sale)"
                buyLabel="Buy (cost)"
                helpers={merchListHelpers}
              />

              <MerchNamedBlock
                idPrefix="tx-acc"
                title="Accessories"
                hint="Each line: optional name, retail sale, and purchase cost."
                rows={editing.accessoryMerch}
                setRows={(action) =>
                  setEditing((p) => {
                    if (!p || p.kind !== "mobile_shop") return p;
                    const next = typeof action === "function" ? action(p.accessoryMerch) : action;
                    return { ...p, accessoryMerch: next };
                  })
                }
                retailLabel="Retail (sale)"
                buyLabel="Buy (cost)"
                helpers={merchListHelpers}
              />

              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-[var(--lv-heading)]">Packages sale</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <MidnightField
                    id="edit-m-pkg-w"
                    label="R.Wind"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={editing.packageRWind}
                    onChange={(e) =>
                      setEditing((p) =>
                        p?.kind === "mobile_shop"
                          ? { ...p, packageRWind: String(Math.max(0, parseNonNegative(e.target.value))) }
                          : p,
                      )
                    }
                  />
                  <MidnightField
                    id="edit-m-pkg-v"
                    label="R.Voda"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={editing.packageRVoda}
                    onChange={(e) =>
                      setEditing((p) =>
                        p?.kind === "mobile_shop"
                          ? { ...p, packageRVoda: String(Math.max(0, parseNonNegative(e.target.value))) }
                          : p,
                      )
                    }
                  />
                </div>
              </section>

              <NamedLinesOnly
                idPrefix="tx-repair"
                title="Repairs"
                hint="Label + amount per job."
                rows={editing.repairs}
                setRows={(action) =>
                  setEditing((p) => {
                    if (!p || p.kind !== "mobile_shop") return p;
                    const next = typeof action === "function" ? action(p.repairs) : action;
                    return { ...p, repairs: next };
                  })
                }
                helpers={namedListHelpers}
              />

              <NamedLinesOnly
                idPrefix="tx-extra"
                title="Extras"
                hint="Other named income."
                rows={editing.extras}
                setRows={(action) =>
                  setEditing((p) => {
                    if (!p || p.kind !== "mobile_shop") return p;
                    const next = typeof action === "function" ? action(p.extras) : action;
                    return { ...p, extras: next };
                  })
                }
                helpers={namedListHelpers}
              />

              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-[var(--lv-heading)]">POS</h3>
                <MidnightField
                  id="edit-m-pos"
                  label="POS (card) sales"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={editing.posSale}
                  onChange={(e) =>
                    setEditing((p) =>
                      p?.kind === "mobile_shop"
                        ? { ...p, posSale: String(Math.max(0, parseNonNegative(e.target.value))) }
                        : p,
                    )
                  }
                />
              </section>

              <NamedLinesOnly
                idPrefix="tx-exp-cash"
                title="Cash expenses"
                hint="Detail + amount per cash payment."
                rows={editing.cashExpenses}
                setRows={(action) =>
                  setEditing((p) => {
                    if (!p || p.kind !== "mobile_shop") return p;
                    const next = typeof action === "function" ? action(p.cashExpenses) : action;
                    return { ...p, cashExpenses: next };
                  })
                }
                helpers={namedListHelpers}
                nameFieldLabel="Detail"
              />

              <NamedLinesOnly
                idPrefix="tx-exp-bank"
                title="Bank expenses"
                hint="Detail + amount per bank/card payment."
                rows={editing.bankExpenses}
                setRows={(action) =>
                  setEditing((p) => {
                    if (!p || p.kind !== "mobile_shop") return p;
                    const next = typeof action === "function" ? action(p.bankExpenses) : action;
                    return { ...p, bankExpenses: next };
                  })
                }
                helpers={namedListHelpers}
                nameFieldLabel="Detail"
              />

              <MidnightField
                id="edit-m-notes"
                label="Day notes"
                rows={4}
                value={editing.notes}
                onChange={(e) =>
                  setEditing((p) => (p?.kind === "mobile_shop" ? { ...p, notes: e.target.value } : p))
                }
                disabled={saving}
              />

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <PressableButton type="button" variant="secondary" className="min-h-12 w-full sm:w-auto" onClick={() => setEditing(null)}>
                  Cancel
                </PressableButton>
                <PressableButton type="submit" className="min-h-12 w-full sm:w-auto" disabled={saving}>
                  {saving ? "Saving…" : "Save day"}
                </PressableButton>
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
    <MidnightField
      id={id}
      label={label}
      type={type}
      min={min}
      step={step}
      inputMode={type === "number" ? "decimal" : undefined}
      required={type === "date"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
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

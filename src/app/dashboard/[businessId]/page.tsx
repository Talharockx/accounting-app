"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { mobileProfitFromTransactions } from "@/lib/dashboard/daily-entry";
import { groceryProfitFromTransactions } from "@/lib/dashboard/grocery-daily-entry";
import { restaurantProfitFromTransactions } from "@/lib/dashboard/restaurant-daily-entry";
import type { BusinessType } from "@/lib/business-types";
import { mobileLedgerSummaryFromTransactions } from "@/lib/dashboard/mobile-transaction-ledger";
import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import type { TrafficTone } from "@/components/ui/sparkline";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";
import { getMonthBoundariesISO, getTodayLocalISO, minISODate, parseMonthInputValue, toMonthInputValue } from "@/lib/utils/date-range";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { BentoCell } from "@/components/ui/bento-cell";
import { PressableButton } from "@/components/ui/pressable";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/formatters";

type Business = {
  id: string;
  name: string;
  business_type: BusinessType;
};

type PeriodFilter = "today" | "pick" | "range" | "month";

function calendarMonthHeading(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function defaultMonthToDateRange(): { start: string; end: string } {
  const now = new Date();
  const { start, end: monthEnd } = getMonthBoundariesISO(now.getFullYear(), now.getMonth());
  const today = getTodayLocalISO(now);
  return { start, end: minISODate(monthEnd, today) };
}

/** End date of the active overview window (inclusive). */
function overviewWindowEndISO(
  period: PeriodFilter,
  range: { start: string; end: string },
  singleDay: string,
  monthValue: string,
): string {
  if (period === "today") return getTodayLocalISO();
  if (period === "pick") return singleDay;
  if (period === "month") {
    const parsed = parseMonthInputValue(monthValue);
    if (parsed) return getMonthBoundariesISO(parsed.year, parsed.monthIndex).end;
    return getTodayLocalISO();
  }
  return range.start <= range.end ? range.end : range.start;
}

/** Last Balance (Cash/Bank) for a transaction set — same formulas as Overview period cards. */
function lastBalancesFromTransactions(
  businessType: BusinessType,
  rows: TransactionWithMeta[],
): { cash: number; bank: number } {
  if (businessType === "grocery") {
    const t = groceryProfitFromTransactions(rows);
    return { cash: t.cashSaleTotal - t.cashExpense, bank: t.bankSaleTotal - t.spesaPos };
  }
  if (businessType === "restaurant") {
    const t = restaurantProfitFromTransactions(rows);
    return { cash: t.cashSaleTotal - t.cashExpenses, bank: t.bankSaleTotal - t.bankExpenses };
  }
  const t = mobileLedgerSummaryFromTransactions(rows);
  return { cash: t.remainingCashSale, bank: t.remainingBankSale };
}

export default function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessId, setBusinessId] = useState("");
  const [transactions, setTransactions] = useState<TransactionWithMeta[]>([]);
  /** Default to month-to-date range so saved entries appear; "Today" alone hides all other days. */
  const [period, setPeriod] = useState<PeriodFilter>("range");
  const [pickedDate, setPickedDate] = useState(() => getTodayLocalISO());
  const [rangeStart, setRangeStart] = useState(() => defaultMonthToDateRange().start);
  const [rangeEnd, setRangeEnd] = useState(() => defaultMonthToDateRange().end);
  const [draftStart, setDraftStart] = useState(() => defaultMonthToDateRange().start);
  const [draftEnd, setDraftEnd] = useState(() => defaultMonthToDateRange().end);
  const [monthInput, setMonthInput] = useState(() =>
    toMonthInputValue(new Date().getFullYear(), new Date().getMonth()),
  );
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState("");
  /** All transactions from the beginning through the window end (for Current Last Balance). */
  const [cumulativeTransactions, setCumulativeTransactions] = useState<TransactionWithMeta[]>([]);

  const windowEndISO = useMemo(
    () =>
      overviewWindowEndISO(period, { start: rangeStart, end: rangeEnd }, pickedDate, monthInput),
    [period, rangeStart, rangeEnd, pickedDate, monthInput],
  );

  const loadTransactions = useCallback(
    async (
      id: string,
      p: PeriodFilter,
      range: { start: string; end: string },
      singleDay: string,
      monthValue: string,
    ) => {
    setTxLoading(true);
    setTxError("");

    const buildQuery = (selectColumns: string) => {
      let query = supabase.from("transactions").select(selectColumns).eq("business_id", id);

      if (p === "today") {
        query = query.eq("transaction_date", getTodayLocalISO());
      } else if (p === "pick") {
        query = query.eq("transaction_date", singleDay);
      } else if (p === "month") {
        const parsed = parseMonthInputValue(monthValue);
        if (parsed) {
          const { start, end } = getMonthBoundariesISO(parsed.year, parsed.monthIndex);
          query = query.gte("transaction_date", start).lte("transaction_date", end);
        } else {
          query = query.eq("transaction_date", "0000-00-00");
        }
      } else {
        const lo = range.start <= range.end ? range.start : range.end;
        const hi = range.start <= range.end ? range.end : range.start;
        query = query.gte("transaction_date", lo).lte("transaction_date", hi);
      }

      return query.order("transaction_date", { ascending: false }).limit(20_000);
    };

    try {
      const result = await selectWithMetadataColumnFallback(
        async () =>
          await buildQuery("amount, transaction_type, description, transaction_date, metadata"),
        async () => await buildQuery("amount, transaction_type, description, transaction_date"),
      );

      if (result.error) {
        const msg = getUserFriendlyError(new Error(result.error.message));
        setTxError(msg);
        setTransactions([]);
        setTxLoading(false);
        return;
      }

      setTransactions(mapTransactionRows(result.data ?? []));
    } catch (caught) {
      const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
      setTxError(msg);
      setTransactions([]);
    }

    setTxLoading(false);
  },
  [],
);

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const resolvedParams = await params;
        const id = resolvedParams.businessId;
        setBusinessId(id);

        const { data: businessData, error } = await supabase
          .from("businesses")
          .select("id, name, business_type")
          .eq("id", id)
          .single();

        if (error || !businessData) {
          return;
        }
        setBusiness(businessData as Business);
      } catch {
      } finally {
        setBusinessLoading(false);
      }
    };

    void loadBusiness();
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const id = window.setTimeout(
      () =>
        void loadTransactions(
          businessId,
          period,
          { start: rangeStart, end: rangeEnd },
          pickedDate,
          monthInput,
        ),
      0,
    );
    return () => window.clearTimeout(id);
  }, [businessId, period, rangeStart, rangeEnd, pickedDate, monthInput, loadTransactions]);

  /** Load all history through window end for Current Last Balance (Cash/Bank). */
  useEffect(() => {
    if (!businessId || !windowEndISO) return;
    let cancelled = false;

    const loadCumulative = async () => {
      const buildQuery = (selectColumns: string) =>
        supabase
          .from("transactions")
          .select(selectColumns)
          .eq("business_id", businessId)
          .lte("transaction_date", windowEndISO)
          .order("transaction_date", { ascending: false })
          .limit(50_000);

      try {
        const result = await selectWithMetadataColumnFallback(
          async () =>
            await buildQuery("amount, transaction_type, description, transaction_date, metadata"),
          async () => await buildQuery("amount, transaction_type, description, transaction_date"),
        );
        if (cancelled) return;
        if (result.error) {
          setCumulativeTransactions([]);
          return;
        }
        setCumulativeTransactions(mapTransactionRows(result.data ?? []));
      } catch {
        if (!cancelled) setCumulativeTransactions([]);
      }
    };

    const id = window.setTimeout(() => void loadCumulative(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [businessId, windowEndISO]);

  const todayISO = getTodayLocalISO();
  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());
  const parsedMonth = parseMonthInputValue(monthInput);

  const periodLabel = (() => {
    if (period === "today") return `Today (${todayISO})`;
    if (period === "pick") return `Selected day (${pickedDate})`;
    if (period === "month") {
      if (parsedMonth) {
        const { start, end } = getMonthBoundariesISO(parsedMonth.year, parsedMonth.monthIndex);
        return `Month · ${calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)} (${start} → ${end})`;
      }
      return `Month (${monthInput})`;
    }
    const lo = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const hi = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    return `Custom range (${lo} → ${hi})`;
  })();

  const openCustomRange = () => {
    const d = defaultMonthToDateRange();
    setDraftStart(d.start);
    setDraftEnd(d.end);
    setRangeStart(d.start);
    setRangeEnd(d.end);
    setPeriod("range");
  };

  const openMonthly = () => {
    setMonthInput(toMonthInputValue(new Date().getFullYear(), new Date().getMonth()));
    setPeriod("month");
  };

  const applyCustomRange = () => {
    let start = draftStart;
    let end = draftEnd;
    if (start > end) {
      const t = start;
      start = end;
      end = t;
    }
    setRangeStart(start);
    setRangeEnd(end);
    setDraftStart(start);
    setDraftEnd(end);
    toast.success("Date range applied.");
  };

  const pill =
    "rounded-xl px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--lv-accent)_50%,transparent)]";
  const pillActive = cn(
    pill,
    "bg-[var(--lv-accent-soft)] text-[var(--lv-heading)] ring-1 ring-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)]",
  );
  const pillIdle = cn(
    pill,
    "border border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] bg-[var(--lv-liquid-fill)] text-[var(--lv-muted-strong)] backdrop-blur-md hover:border-[color-mix(in_srgb,var(--lv-glass-edge)_75%,transparent)] hover:text-[var(--lv-heading)]",
  );

  function toneProfitNumeric(current: number): TrafficTone {
    if (current < 0) return "critical";
    if (current === 0) return "neutral";
    return "positive";
  }

  if (businessLoading) {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8">
        <Skeleton className="mb-6 h-8 w-56 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="col-span-2 row-span-2 min-h-[220px] rounded-[1.625rem]" />
          <Skeleton className="min-h-[120px] rounded-[1.625rem]" />
          <Skeleton className="min-h-[120px] rounded-[1.625rem]" />
          <Skeleton className="min-h-[120px] rounded-[1.625rem]" />
          <Skeleton className="min-h-[120px] rounded-[1.625rem]" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8 text-[var(--lv-muted-strong)]">
        Unable to load this workspace.
      </div>
    );
  }

  const isRestaurant = business.business_type === "restaurant";
  const isGrocery = business.business_type === "grocery";
  const groceryTotals = groceryProfitFromTransactions(transactions);
  const restaurantTotals = restaurantProfitFromTransactions(transactions);
  const mobileTotals = mobileProfitFromTransactions(transactions);
  const mobileSummary = mobileLedgerSummaryFromTransactions(transactions);
  const mobileTotalProfit = mobileSummary.lastBalance;
  const currentLastBalance = lastBalancesFromTransactions(business.business_type, cumulativeTransactions);
  const currentLastBalanceHint = (() => {
    if (period === "month" && parsedMonth) {
      return `All months through ${calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)}`;
    }
    return `All history through ${windowEndISO} (previous months + this window)`;
  })();

  return (
    <section className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="glass-panel rounded-[1.625rem] p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
              Workspace overview
            </p>
            <h1 className="mt-2 text-balance font-sans text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              {business.name}
            </h1>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={period === "today" ? pillActive : pillIdle} onClick={() => setPeriod("today")}>
              Today
            </button>
            <button
              type="button"
              className={period === "pick" ? pillActive : pillIdle}
              onClick={() => setPeriod("pick")}
              title="Totals for one calendar day"
            >
              Pick a date
            </button>
            <button
              type="button"
              className={period === "range" ? pillActive : pillIdle}
              onClick={() => {
                if (period !== "range") openCustomRange();
              }}
              title="Choose start and end dates (your browser calendar)"
            >
              Custom range
            </button>
            <button
              type="button"
              className={period === "month" ? pillActive : pillIdle}
              onClick={() => {
                if (period !== "month") openMonthly();
                else setPeriod("month");
              }}
              title="Totals for one calendar month"
            >
              Monthly
            </button>
          </div>
          {period === "pick" ? (
            <div
              className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_55%,transparent)] p-4 backdrop-blur-md sm:flex-row sm:items-end"
              role="region"
              aria-label="Pick a calendar day"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[12rem]">
                <label htmlFor="overview-pick-date" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                  Date
                </label>
                <input
                  id="overview-pick-date"
                  type="date"
                  value={pickedDate}
                  max={todayISO}
                  onChange={(event) => setPickedDate(event.target.value)}
                  className="lv-input rounded-xl"
                />
              </div>
            </div>
          ) : null}
          {period === "range" ? (
            <div
              className="flex flex-col gap-4 rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_55%,transparent)] p-4 backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-end"
              role="region"
              aria-label="Custom date range"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[12rem]">
                <label htmlFor="overview-range-start" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                  From
                </label>
                <input
                  id="overview-range-start"
                  type="date"
                  value={draftStart}
                  onChange={(event) => setDraftStart(event.target.value)}
                  className="lv-input rounded-xl"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[12rem]">
                <label htmlFor="overview-range-end" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                  Through
                </label>
                <input
                  id="overview-range-end"
                  type="date"
                  value={draftEnd}
                  onChange={(event) => setDraftEnd(event.target.value)}
                  className="lv-input rounded-xl"
                />
              </div>
              <PressableButton type="button" className="min-h-12 w-full sm:w-auto sm:shrink-0" onClick={() => applyCustomRange()}>
                Apply range
              </PressableButton>
            </div>
          ) : null}
          {period === "month" ? (
            <div
              className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_55%,transparent)] p-4 backdrop-blur-md sm:flex-row sm:items-end"
              role="region"
              aria-label="Pick a calendar month"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[14rem]">
                <label htmlFor="overview-month" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                  Month
                </label>
                <input
                  id="overview-month"
                  type="month"
                  value={monthInput}
                  max={maxMonthInput}
                  onChange={(event) => setMonthInput(event.target.value)}
                  className="lv-input rounded-xl"
                />
              </div>
            </div>
          ) : null}
        </div>

        <p className="mt-4 font-mono text-xs tabular-nums text-[var(--lv-muted)]">
          Window:{" "}
          <span className="text-[var(--lv-heading)]">
            {periodLabel}
            {txLoading ? " · loading…" : ""}
          </span>
        </p>

        {txError ? (
          <p
            className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--lv-traffic-critical)_35%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_10%,transparent)] px-3 py-2.5 text-sm text-[var(--lv-traffic-critical)]"
            role="alert"
          >
            {txError}
          </p>
        ) : null}
      </motion.div>

      {isGrocery ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-min">
          <BentoCell featured className="col-span-2 row-span-2 min-h-[260px] p-7 sm:p-8">
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
                  Total profit
                </p>
                <p
                  className={cn(
                    "lv-tabular-mono mt-3 text-4xl font-semibold tracking-tighter sm:text-[2.85rem]",
                    toneProfitNumeric(groceryTotals.totalProfit) === "positive" && "text-[var(--lv-traffic-positive)]",
                    toneProfitNumeric(groceryTotals.totalProfit) === "neutral" && "text-[var(--lv-traffic-neutral)]",
                    toneProfitNumeric(groceryTotals.totalProfit) === "critical" && "text-[var(--lv-traffic-critical)]",
                  )}
                >
                  {formatCurrency(groceryTotals.totalProfit)}
                </p>
                <p className="mt-2 text-xs text-[var(--lv-muted-strong)]">Total sale − Spesa total</p>
              </div>
              <NetProfitArrow profit={groceryTotals.totalProfit} />
            </div>
          </BentoCell>
          <MetricMini label="Bank sale total" value={formatCurrency(groceryTotals.bankSaleTotal)} />
          <MetricMini label="Cash sale total" value={formatCurrency(groceryTotals.cashSaleTotal)} />
          <MetricMini label="Total sale" value={formatCurrency(groceryTotals.totalSale)} className="lg:col-span-2" />
          <MetricMini label="Spesa total" value={formatCurrency(groceryTotals.spesaTotal)} className="lg:col-span-2" />
          <MetricMini label="Cheques total" value={formatCurrency(groceryTotals.cheques)} />
          <MetricMini
            label="Last Balance (Cash)"
            value={formatCurrency(groceryTotals.cashSaleTotal - groceryTotals.cashExpense)}
            profitTone={toneProfitNumeric(groceryTotals.cashSaleTotal - groceryTotals.cashExpense)}
          />
          <MetricMini
            label="Last Balance (Bank)"
            value={formatCurrency(groceryTotals.bankSaleTotal - groceryTotals.spesaPos)}
            profitTone={toneProfitNumeric(groceryTotals.bankSaleTotal - groceryTotals.spesaPos)}
          />
          <MetricMini
            label="Current Last Balance (Cash)"
            value={formatCurrency(currentLastBalance.cash)}
            hint={currentLastBalanceHint}
            profitTone={toneProfitNumeric(currentLastBalance.cash)}
            className="lg:col-span-2"
          />
          <MetricMini
            label="Current Last Balance (Bank)"
            value={formatCurrency(currentLastBalance.bank)}
            hint={currentLastBalanceHint}
            profitTone={toneProfitNumeric(currentLastBalance.bank)}
            className="lg:col-span-2"
          />
        </div>
      ) : isRestaurant ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-min">
          <BentoCell featured className="col-span-2 row-span-2 min-h-[260px] p-7 sm:p-8">
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
                  Total profit / loss
                </p>
                <p
                  className={cn(
                    "lv-tabular-mono mt-3 text-4xl font-semibold tracking-tighter sm:text-[2.85rem]",
                    toneProfitNumeric(restaurantTotals.totalProfit) === "positive" && "text-[var(--lv-traffic-positive)]",
                    toneProfitNumeric(restaurantTotals.totalProfit) === "neutral" && "text-[var(--lv-traffic-neutral)]",
                    toneProfitNumeric(restaurantTotals.totalProfit) === "critical" && "text-[var(--lv-traffic-critical)]",
                  )}
                >
                  {formatCurrency(restaurantTotals.totalProfit)}
                </p>
                <p className="mt-2 text-xs text-[var(--lv-muted-strong)]">Total sale − Total spesa</p>
              </div>
              <NetProfitArrow profit={restaurantTotals.totalProfit} />
            </div>
          </BentoCell>
          <MetricMini label="Total bank sale" value={formatCurrency(restaurantTotals.bankSaleTotal)} />
          <MetricMini label="Total cash sale" value={formatCurrency(restaurantTotals.cashSaleTotal)} />
          <MetricMini
            label="Glovo, Just Eat, Deliveroo"
            value={formatCurrency(restaurantTotals.companySaleTotal)}
            className="lg:col-span-2"
          />
          <MetricMini label="Total sale" value={formatCurrency(restaurantTotals.totalSale)} />
          <MetricMini label="Total spesa" value={formatCurrency(restaurantTotals.totalSpesa)} className="lg:col-span-2" />
          <MetricMini
            label="Last Balance (Cash)"
            value={formatCurrency(restaurantTotals.cashSaleTotal - restaurantTotals.cashExpenses)}
            profitTone={toneProfitNumeric(restaurantTotals.cashSaleTotal - restaurantTotals.cashExpenses)}
          />
          <MetricMini
            label="Last Balance (Bank)"
            value={formatCurrency(restaurantTotals.bankSaleTotal - restaurantTotals.bankExpenses)}
            profitTone={toneProfitNumeric(restaurantTotals.bankSaleTotal - restaurantTotals.bankExpenses)}
          />
          <MetricMini
            label="Current Last Balance (Cash)"
            value={formatCurrency(currentLastBalance.cash)}
            hint={currentLastBalanceHint}
            profitTone={toneProfitNumeric(currentLastBalance.cash)}
            className="lg:col-span-2"
          />
          <MetricMini
            label="Current Last Balance (Bank)"
            value={formatCurrency(currentLastBalance.bank)}
            hint={currentLastBalanceHint}
            profitTone={toneProfitNumeric(currentLastBalance.bank)}
            className="lg:col-span-2"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-min">
            <BentoCell featured className="col-span-2 row-span-2 min-h-[260px] p-7 sm:p-8">
              <div className="flex h-full flex-col justify-between gap-6">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
                    Total profit
                  </p>
                  <p className="mt-1 text-xs text-[var(--lv-muted-strong)]">
                    Total sale − (Cash expense + Bank expense)
                  </p>
                  <p
                    className={cn(
                      "lv-tabular-mono mt-3 text-4xl font-semibold tracking-tighter sm:text-[2.85rem]",
                      toneProfitNumeric(mobileTotalProfit) === "positive" && "text-[var(--lv-traffic-positive)]",
                      toneProfitNumeric(mobileTotalProfit) === "neutral" && "text-[var(--lv-traffic-neutral)]",
                      toneProfitNumeric(mobileTotalProfit) === "critical" && "text-[var(--lv-traffic-critical)]",
                    )}
                  >
                    {formatCurrency(mobileTotalProfit)}
                  </p>
                </div>
                <div className="flex items-end">
                  <NetProfitArrow profit={mobileTotalProfit} />
                </div>
              </div>
            </BentoCell>

            <MetricMini label="Total sale" value={formatCurrency(mobileTotals.totalSaleSheet)} />
            <MetricMini label="Total cost" value={formatCurrency(mobileTotals.purchases)} />
            <MetricMini label="Total recharges" value={formatCurrency(mobileTotals.supplierRicarche)} />
            <MetricMini label="Total expense" value={formatCurrency(mobileTotals.cashExpenses)} />
            <MetricMini label="Bank expenses" value={formatCurrency(mobileTotals.bankExpenses)} />

            <MetricMini
              label="Last Balance (Cash)"
              value={formatCurrency(mobileSummary.remainingCashSale)}
              profitTone={toneProfitNumeric(mobileSummary.remainingCashSale)}
            />
            <MetricMini
              label="Last Balance (Bank)"
              value={formatCurrency(mobileSummary.remainingBankSale)}
              profitTone={toneProfitNumeric(mobileSummary.remainingBankSale)}
            />
            <MetricMini
              label="Current Last Balance (Cash)"
              value={formatCurrency(currentLastBalance.cash)}
              hint={currentLastBalanceHint}
              profitTone={toneProfitNumeric(currentLastBalance.cash)}
              className="lg:col-span-2"
            />
            <MetricMini
              label="Current Last Balance (Bank)"
              value={formatCurrency(currentLastBalance.bank)}
              hint={currentLastBalanceHint}
              profitTone={toneProfitNumeric(currentLastBalance.bank)}
              className="lg:col-span-2"
            />

            <MetricMini
              label="Sim profit"
              value={formatCurrency(mobileSummary.simProfit)}
              profitTone={toneProfitNumeric(mobileSummary.simProfit)}
            />
            <MetricMini
              label="Mobile profit"
              value={formatCurrency(mobileSummary.mobileProfit)}
              profitTone={toneProfitNumeric(mobileSummary.mobileProfit)}
            />
            <MetricMini
              label="Access profit"
              value={formatCurrency(mobileSummary.accessoryProfit)}
              profitTone={toneProfitNumeric(mobileSummary.accessoryProfit)}
            />
            <MetricMini label="R.Wind" value={formatCurrency(mobileSummary.rwind)} />
            <MetricMini label="R.Voda" value={formatCurrency(mobileSummary.rwoda)} />
            <MetricMini label="Repairs" value={formatCurrency(mobileSummary.repair)} />
            <MetricMini label="Extras" value={formatCurrency(mobileSummary.extras)} />
          </div>
        </div>
      )}

      {!isGrocery && !txLoading && transactions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] px-5 py-4 text-sm text-[var(--lv-muted-strong)]"
        >
          No transactions in this window. If you saved daily entries in another month, open{" "}
          <span className="font-semibold text-[var(--lv-heading)]">Custom range</span> and set From / Through to cover
          those dates (the default is this calendar month through today). You can also use{" "}
          <span className="font-semibold text-[var(--lv-heading)]">Pick a date</span> for a single day.
          <span className="mt-2 block text-xs opacity-80">
            Save each day in Daily Entry so rows exist in the database.
          </span>
        </motion.div>
      ) : null}
    </section>
  );
}

/** Net profit / loss: up when profit &gt; 0, down when &lt; 0, neutral when zero. */
function NetProfitArrow({ profit }: { profit: number }) {
  const direction = profit > 0 ? "up" : profit < 0 ? "down" : "flat";
  return <TrendArrow direction={direction} size="lg" label={profit > 0 ? "Profit" : profit < 0 ? "Loss" : "Break-even"} />;
}

function MetricMini({
  label,
  value,
  className,
  profitTone,
  hint,
}: {
  label: string;
  value: string;
  className?: string;
  profitTone?: TrafficTone;
  hint?: string;
}) {
  return (
    <BentoCell className={cn("justify-between gap-4 p-5 sm:p-6", className)}>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--lv-muted-strong)]">{label}</p>
        {hint ? <p className="mt-1 text-[0.6875rem] leading-snug text-[var(--lv-muted)]">{hint}</p> : null}
        <p
          className={cn(
            "lv-tabular-mono mt-2 text-xl font-semibold tracking-tight sm:text-2xl",
            profitTone === "positive" && "text-[var(--lv-traffic-positive)]",
            profitTone === "neutral" && "text-[var(--lv-traffic-neutral)]",
            profitTone === "critical" && "text-[var(--lv-traffic-critical)]",
            !profitTone && "text-[var(--lv-heading)]",
          )}
        >
          {value}
        </p>
      </div>
    </BentoCell>
  );
}

function TrendArrow({
  direction,
  size,
  label,
}: {
  direction: "up" | "down" | "flat";
  size: "sm" | "lg";
  label: string;
}) {
  const box =
    size === "lg"
      ? "h-14 w-14 rounded-2xl sm:h-16 sm:w-16"
      : "h-10 w-10 rounded-xl";
  const icon = size === "lg" ? "h-8 w-8 sm:h-9 sm:w-9" : "h-5 w-5";
  const color =
    direction === "up"
      ? "border-[color-mix(in_srgb,var(--lv-traffic-positive)_40%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-positive)_12%,transparent)] text-[var(--lv-traffic-positive)]"
      : direction === "down"
        ? "border-[color-mix(in_srgb,var(--lv-traffic-critical)_40%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_12%,transparent)] text-[var(--lv-traffic-critical)]"
        : "border-[#ffffff10] bg-[#ffffff06] text-[var(--lv-muted-strong)]";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center border", box, color)}
      role="img"
      aria-label={label}
    >
      {direction === "up" ? (
        <svg className={icon} viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 5L20 18H4L12 5z" />
        </svg>
      ) : direction === "down" ? (
        <svg className={icon} viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 19L4 7h16L12 19z" />
        </svg>
      ) : (
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" d="M6 12h12" />
        </svg>
      )}
    </span>
  );
}

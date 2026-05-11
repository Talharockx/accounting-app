"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReportsPerformanceCharts } from "@/components/dashboard/reports-performance-charts";
import { BentoCell } from "@/components/ui/bento-cell";
import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import {
  buildDailySeries,
  monthlyTotalsForRange,
  type ReportsBusinessType,
} from "@/lib/dashboard/reports-metrics";
import {
  businessTypeLabel,
  downloadMonthlyReportPdf,
} from "@/lib/reports/monthly-report-pdf";
import { collectDailyEntryNotes } from "@/lib/reports/period-notes";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";
import {
  addCalendarDaysISO,
  eachISODateInclusive,
  getMonthBoundariesISO,
  getTodayLocalISO,
  maxISODate,
  minISODate,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { supabase } from "@/lib/supabaseClient";
import { PressableButton } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

type BusinessRow = {
  id: string;
  name: string;
  business_type: ReportsBusinessType;
};

function isoToShortTick(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function calendarMonthHeading(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 15).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function currency(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function ReportsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [businessId, setBusinessId] = useState("");
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithMeta[]>([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfError, setPdfError] = useState("");
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
        const { data: bizRow, error: bizErr } = await supabase
          .from("businesses")
          .select("id, name, business_type")
          .eq("id", bid)
          .single();

        if (cancelled) return;

        if (bizErr || !bizRow) {
          const msg = getUserFriendlyError(new Error(bizErr?.message ?? "Business not found."));
          setTxError(msg);
          setBizLoading(false);
          return;
        }

        setBusiness(bizRow as BusinessRow);
      } catch (caught) {
        if (!cancelled) {
          setTxError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
        }
      }
      setBizLoading(false);
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

  const todayISO = getTodayLocalISO();

  const chartFetchRange = useMemo(() => {
    if (!parsedMonth || !monthRange) return null;

    const isCurrentCalendarMonth =
      parsedMonth.year === new Date().getFullYear() &&
      parsedMonth.monthIndex === new Date().getMonth();

    const barEnd = isCurrentCalendarMonth ? minISODate(monthRange.end, todayISO) : monthRange.end;
    const barStart = addCalendarDaysISO(barEnd, -29);

    const fetchStart = minISODate(monthRange.start, barStart);
    const fetchEnd = maxISODate(monthRange.end, barEnd);
    return { fetchStart, fetchEnd, barStart, barEnd };
  }, [parsedMonth, monthRange, todayISO]);

  const loadTransactions = useCallback(async () => {
    if (!businessId || !chartFetchRange) return;

    setTxLoading(true);
    setTxError("");
    try {
      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .gte("transaction_date", chartFetchRange.fetchStart)
            .lte("transaction_date", chartFetchRange.fetchEnd)
            .order("transaction_date", { ascending: true }),
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .gte("transaction_date", chartFetchRange.fetchStart)
            .lte("transaction_date", chartFetchRange.fetchEnd)
            .order("transaction_date", { ascending: true }),
      );

      if (fetchError) {
        const msg = getUserFriendlyError(new Error(fetchError.message));
        setTxError(msg);
        toast.error(msg);
        setTransactions([]);
        setTxLoading(false);
        return;
      }

      setTransactions(mapTransactionRows(data ?? []));
    } catch (caught) {
      const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
      setTxError(msg);
      toast.error(msg);
      setTransactions([]);
    }

    setTxLoading(false);
  }, [businessId, chartFetchRange]);

  useEffect(() => {
    if (!businessId || !chartFetchRange) return;
    const id = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, chartFetchRange, loadTransactions]);

  const businessType = business?.business_type ?? "restaurant";

  const monthlyTotals = useMemo(() => {
    if (!monthRange) {
      return { sales: 0, purchases: 0, operatingExpenses: 0, expenses: 0, profit: 0 };
    }
    return monthlyTotalsForRange(businessType, transactions, monthRange.start, monthRange.end);
  }, [businessType, monthRange, transactions]);

  const profitLineEndISO = useMemo(() => {
    if (!parsedMonth || !monthRange) return todayISO;

    const isCurrentCalendarMonth =
      parsedMonth.year === new Date().getFullYear() &&
      parsedMonth.monthIndex === new Date().getMonth();

    if (isCurrentCalendarMonth) {
      return minISODate(monthRange.end, todayISO);
    }
    return monthRange.end;
  }, [parsedMonth, monthRange, todayISO]);

  const salesVsExpensesData = useMemo(() => {
    if (!chartFetchRange) return [];
    const days = eachISODateInclusive(chartFetchRange.barStart, chartFetchRange.barEnd);
    return buildDailySeries(businessType, transactions, days).map((row) => ({
      label: isoToShortTick(row.date),
      sales: row.sales,
      expenses: row.expenses,
    }));
  }, [businessType, chartFetchRange, transactions]);

  const profitTrendData = useMemo(() => {
    if (!monthRange) return [];
    const days = eachISODateInclusive(monthRange.start, profitLineEndISO);
    return buildDailySeries(businessType, transactions, days).map((row) => ({
      label: isoToShortTick(row.date),
      profit: row.profit,
    }));
  }, [businessType, monthRange, profitLineEndISO, transactions]);

  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());

  const handleDownloadPdf = async () => {
    if (!business || !monthRange || !parsedMonth) return;
    setPdfBusy(true);
    setPdfMessage("");
    setPdfError("");
    try {
      const days = eachISODateInclusive(monthRange.start, monthRange.end);
      const dailyRows = buildDailySeries(businessType, transactions, days);
      const totals = monthlyTotalsForRange(businessType, transactions, monthRange.start, monthRange.end);
      const monthNotes = collectDailyEntryNotes(transactions, monthRange.start, monthRange.end);
      await downloadMonthlyReportPdf({
        businessName: business.name,
        dateRangeLabel: `${monthRange.start} → ${monthRange.end}`,
        businessTypeLabel: businessTypeLabel(businessType),
        periodTitle: calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex),
        dailyRows,
        totals,
        salesVsExpensesChart: salesVsExpensesData,
        profitTrendChart: profitTrendData,
        monthNotes,
      });
      setPdfMessage("PDF report downloaded.");
      toast.success("Monthly report downloaded.");
    } catch (e) {
      const msg = getUserFriendlyError(e, "Could not generate PDF.");
      setPdfError(msg);
      toast.error(msg);
    }
    setPdfBusy(false);
  };

  const hasTransactionsInRange = transactions.length > 0;

  if (bizLoading) {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8">
        <Skeleton className="mb-6 h-9 w-56 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-[1.625rem]" />
          <Skeleton className="h-32 rounded-[1.625rem]" />
          <Skeleton className="h-32 rounded-[1.625rem]" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-traffic-critical)_42%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_10%,transparent)] p-6 text-sm text-[var(--lv-traffic-critical)]">
        {txError || "Business not found."}
      </div>
    );
  }

  if (!business || !parsedMonth || !monthRange || !chartFetchRange) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
              Reports
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              Performance & exports
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-semibold text-[var(--lv-muted)]" htmlFor="report-month">
              Month
            </label>
            <input
              id="report-month"
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
        <p className="text-sm text-slate-400">Updating figures…</p>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BentoCell className="p-6 sm:col-span-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
            Monthly sales
          </p>
          <p className="lv-tabular-mono mt-4 text-3xl font-semibold tracking-tight text-[var(--lv-heading)] sm:text-[2.1rem]">
            {txLoading || txError ? "—" : currency(monthlyTotals.sales)}
          </p>
        </BentoCell>
        <BentoCell className="p-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
            Operating expenses
          </p>
          <p className="lv-tabular-mono mt-4 text-3xl font-semibold tracking-tight text-[var(--lv-heading)] sm:text-[2.1rem]">
            {txLoading || txError ? "—" : currency(monthlyTotals.operatingExpenses)}
          </p>
        </BentoCell>
        <BentoCell featured className="p-6">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-accent)]">
            Net profit
          </p>
          <p
            className={cn(
              "lv-tabular-mono mt-4 text-3xl font-semibold tracking-tight sm:text-[2.35rem]",
              monthlyTotals.profit > 0 && "text-[var(--lv-traffic-positive)]",
              monthlyTotals.profit < 0 && "text-[var(--lv-traffic-critical)]",
              monthlyTotals.profit === 0 && "text-[var(--lv-traffic-neutral)]",
            )}
          >
            {txLoading || txError ? "—" : currency(monthlyTotals.profit)}
          </p>
        </BentoCell>
      </section>

      <section className="rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-liquid-fill)] p-5 shadow-[var(--lv-bento-shadow)] backdrop-blur-3xl sm:p-7">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold tracking-tight text-[var(--lv-heading)]">Performance trends</h2>
          <PressableButton
            type="button"
            variant="primary"
            disabled={pdfBusy || txLoading}
            onClick={() => void handleDownloadPdf()}
            className={cn(
              "min-h-12 shrink-0 gap-2 rounded-[1rem] px-5 shadow-[var(--lv-bento-shadow)] transition-[transform,box-shadow]",
              "bg-gradient-to-r from-cyan-400/95 to-[color-mix(in_srgb,var(--lv-accent)_72%,#0e7490)]",
              "hover:scale-[1.02] hover:shadow-[var(--lv-bento-shadow-hover)] disabled:hover:scale-100",
            )}
          >
            {pdfBusy ? (
              <>
                <span
                  className="size-4 animate-spin rounded-full border-2 border-[#080b11]/25 border-t-[#080b11]"
                  aria-hidden
                />
                Generating PDF…
              </>
            ) : (
              "Download monthly report (PDF)"
            )}
          </PressableButton>
        </div>
        {(pdfMessage || pdfError) && (
          <p
            className={cn(
              "mb-4 text-sm font-medium",
              pdfError ? "text-[var(--lv-traffic-critical)]" : "text-[var(--lv-traffic-positive)]",
            )}
          >
            {pdfError || pdfMessage}
          </p>
        )}
        {txError ? (
          <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
            {txError}
          </p>
        ) : txLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full max-w-[100vw] rounded-[1.625rem]" />
            <Skeleton className="h-72 w-full max-w-[100vw] rounded-[1.625rem]" />
          </div>
        ) : !hasTransactionsInRange ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_40%,transparent)] bg-[var(--lv-surface-muted)] px-6 py-16 text-center dark:bg-white/[0.04]"
          >
            <ReportsEmptyGlyph className="h-24 w-24 text-[var(--lv-accent)] opacity-80" />
            <div className="max-w-md">
              <p className="text-lg font-semibold text-[var(--lv-heading)]">No activity in this range</p>
              <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
                Charts appear once Daily Entry saves transactions overlapping this month / 30‑day trend
                window. Try another month or add today&apos;s totals.
              </p>
            </div>
          </motion.div>
        ) : (
          <ReportsPerformanceCharts
            salesVsExpenses={salesVsExpensesData}
            profitTrend={profitTrendData}
          />
        )}
      </section>
    </div>
  );
}

function ReportsEmptyGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 120 120"
      className={className}
      aria-hidden
    >
      <rect x="14" y="68" width="92" height="28" rx="6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        strokeOpacity="0.55"
        d="M24 92V72l17 14 22-34 27 38 16-26v28"
      />
      <circle cx="90" cy="28" r="12" stroke="currentColor" strokeWidth="2" strokeOpacity="0.35" />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        strokeOpacity="0.55"
        d="M96 66h16M104 58v16"
      />
    </svg>
  );
}

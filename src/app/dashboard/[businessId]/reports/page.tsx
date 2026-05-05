"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReportsPerformanceCharts } from "@/components/dashboard/reports-performance-charts";
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
import { Skeleton } from "@/components/ui/skeleton";

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
    void loadTransactions();
  }, [businessId, chartFetchRange, loadTransactions]);

  const businessType = business?.business_type ?? "restaurant";

  const monthlyTotals = useMemo(() => {
    if (!monthRange) return { sales: 0, expenses: 0, profit: 0 };
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
      await downloadMonthlyReportPdf({
        businessName: business.name,
        dateRangeLabel: `${monthRange.start} → ${monthRange.end}`,
        businessTypeLabel: businessTypeLabel(businessType),
        periodTitle: calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex),
        dailyRows,
        totals,
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
      <div className="glass-panel rounded-2xl p-8">
        <Skeleton className="mb-6 h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        {txError || "Business not found."}
      </div>
    );
  }

  if (!business || !parsedMonth || !monthRange || !chartFetchRange) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-cyan-200">Reports</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Performance & exports</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Visual trends and monthly totals follow the same daily-entry rules as the rest of your
              dashboard. Pick any month to review history on desktop or mobile.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-medium text-slate-400" htmlFor="report-month">
              Month
            </label>
            <input
              id="report-month"
              type="month"
              max={maxMonthInput}
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="rounded-xl border border-white/20 bg-slate-900/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60"
            />
          </div>
        </div>
      </section>

      {!txError && txLoading ? (
        <p className="text-sm text-slate-400">Updating figures…</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/15 to-slate-900/60 p-5 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/90">
            Total monthly sales
          </p>
          <p className="mt-3 text-2xl font-semibold text-white tabular-nums sm:text-3xl">
            {txLoading || txError ? "—" : currency(monthlyTotals.sales)}
          </p>
          <p className="mt-2 text-xs text-slate-400">{calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)}</p>
        </div>
        <div className="rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/15 to-slate-900/60 p-5 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-100/85">
            Total monthly expenses
          </p>
          <p className="mt-3 text-2xl font-semibold text-white tabular-nums sm:text-3xl">
            {txLoading || txError ? "—" : currency(monthlyTotals.expenses)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Purchases + operating expenses (restaurant); inventory + overhead (mobile)
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 to-slate-900/60 p-5 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-100/90">
            Total net profit
          </p>
          <p
            className={`mt-3 text-2xl font-semibold tabular-nums sm:text-3xl ${
              monthlyTotals.profit >= 0 ? "text-emerald-200" : "text-rose-300"
            }`}
          >
            {txLoading || txError ? "—" : currency(monthlyTotals.profit)}
          </p>
          <p className="mt-2 text-xs text-slate-400">Sales + repair income − expenses for the full month.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Performance trends</h2>
            <p className="mt-1 text-sm text-slate-400">
              Bar comparison uses the last 30 days ending on{" "}
              <span className="text-slate-200">{chartFetchRange.barEnd}</span> (aligned with your chosen
              month). The profit line spans the selected month through today where applicable.
            </p>
          </div>
          <button
            type="button"
            disabled={pdfBusy || txLoading}
            onClick={() => void handleDownloadPdf()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02] hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-none disabled:hover:scale-100 dark:bg-cyan-400/90"
          >
            {pdfBusy ? (
              <>
                <span
                  className="size-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900"
                  aria-hidden
                />
                Generating PDF…
              </>
            ) : (
              "Download monthly report (PDF)"
            )}
          </button>
        </div>
        {(pdfMessage || pdfError) && (
          <p className={`mb-4 text-sm ${pdfError ? "text-rose-300" : "text-emerald-200"}`}>
            {pdfError || pdfMessage}
          </p>
        )}
        {txError ? (
          <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
            {txError}
          </p>
        ) : txLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full max-w-[100vw] rounded-2xl" />
            <Skeleton className="h-72 w-full max-w-[100vw] rounded-2xl" />
          </div>
        ) : !hasTransactionsInRange ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--lv-border)] bg-[var(--lv-surface-muted)] px-6 py-16 text-center dark:bg-white/[0.04]"
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

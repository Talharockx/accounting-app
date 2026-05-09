"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  mobileProfitFromTransactions,
  restaurantProfitFromTransactions,
} from "@/lib/dashboard/daily-entry";
import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import {
  mobileSparkSeries,
  restaurantSparkSeries,
  rollingDaysISOIncludingToday,
  seriesFromMobile,
  seriesFromRestaurant,
  sparkTrendTone,
} from "@/lib/dashboard/sparkline-series";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";
import { getTodayLocalISO, getWeekToDateRangeLocal } from "@/lib/utils/date-range";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { BentoCell } from "@/components/ui/bento-cell";
import { Sparkline, type TrafficTone } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils/cn";

type Business = {
  id: string;
  name: string;
  business_type: "restaurant" | "mobile_shop";
};

type PeriodFilter = "today" | "week" | "day";

export default function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessId, setBusinessId] = useState("");
  const [transactions, setTransactions] = useState<TransactionWithMeta[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [selectedDay, setSelectedDay] = useState(() => getTodayLocalISO());
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState("");

  const [sparkTransactions, setSparkTransactions] = useState<TransactionWithMeta[]>([]);
  const [sparkLoading, setSparkLoading] = useState(false);

  const sparkDays = useMemo(() => rollingDaysISOIncludingToday(7), []);

  const loadTransactions = useCallback(async (id: string, p: PeriodFilter, dayISO: string) => {
    setTxLoading(true);
    setTxError("");

    const buildQuery = (selectColumns: string) => {
      let query = supabase.from("transactions").select(selectColumns).eq("business_id", id);

      if (p === "today") {
        const t = getTodayLocalISO();
        query = query.eq("transaction_date", t);
      } else if (p === "week") {
        const { start, end } = getWeekToDateRangeLocal();
        query = query.gte("transaction_date", start).lte("transaction_date", end);
      } else {
        query = query.eq("transaction_date", dayISO);
      }

      return query.order("transaction_date", { ascending: false });
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
        toast.error(msg);
        setTransactions([]);
        setTxLoading(false);
        return;
      }

      setTransactions(mapTransactionRows(result.data ?? []));
    } catch (caught) {
      const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
      setTxError(msg);
      toast.error(msg);
      setTransactions([]);
    }

    setTxLoading(false);
  }, []);

  const loadSparkWindow = useCallback(async (id: string) => {
    setSparkLoading(true);
    const start = sparkDays[0]!;
    const end = sparkDays[sparkDays.length - 1]!;
    try {
      const result = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", id)
            .gte("transaction_date", start)
            .lte("transaction_date", end)
            .order("transaction_date", { ascending: true }),
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date")
            .eq("business_id", id)
            .gte("transaction_date", start)
            .lte("transaction_date", end)
            .order("transaction_date", { ascending: true }),
      );
      if (result.error) {
        setSparkTransactions([]);
      } else {
        setSparkTransactions(mapTransactionRows(result.data ?? []));
      }
    } catch {
      setSparkTransactions([]);
    }
    setSparkLoading(false);
  }, [sparkDays]);

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
      } catch (caught) {
        toast.error(getUserFriendlyError(caught));
      } finally {
        setBusinessLoading(false);
      }
    };

    void loadBusiness();
  }, [params]);

  useEffect(() => {
    if (!businessId) return;
    const id = window.setTimeout(() => void loadSparkWindow(businessId), 0);
    return () => window.clearTimeout(id);
  }, [businessId, loadSparkWindow]);

  useEffect(() => {
    if (!businessId) return;
    const id = window.setTimeout(() => void loadTransactions(businessId, period, selectedDay), 0);
    return () => window.clearTimeout(id);
  }, [businessId, period, selectedDay, loadTransactions]);

  const periodLabel = (() => {
    if (period === "today") return `Today (${getTodayLocalISO()})`;
    if (period === "week") {
      const { start, end } = getWeekToDateRangeLocal();
      return `Week to date (${start} → ${end})`;
    }
    return `Selected day (${selectedDay})`;
  })();

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

  const restaurantSlices = useMemo(() => restaurantSparkSeries(sparkTransactions, sparkDays), [sparkTransactions, sparkDays]);
  const mobileSlices = useMemo(() => mobileSparkSeries(sparkTransactions, sparkDays), [sparkTransactions, sparkDays]);

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
  const restaurantTotals = restaurantProfitFromTransactions(transactions);
  const mobileTotals = mobileProfitFromTransactions(transactions);

  const rCashS = seriesFromRestaurant(restaurantSlices, "cash");
  const rBankS = seriesFromRestaurant(restaurantSlices, "bank");
  const rPurchS = seriesFromRestaurant(restaurantSlices, "purchases");
  const rExpS = seriesFromRestaurant(restaurantSlices, "expenses");
  const rProfS = seriesFromRestaurant(restaurantSlices, "profit");

  const mPhoneRevS = seriesFromMobile(mobileSlices, "phoneSales");
  const mPhoneMargS = seriesFromMobile(mobileSlices, "phoneProfit");
  const mSimS = seriesFromMobile(mobileSlices, "simSales");
  const mRepairS = seriesFromMobile(mobileSlices, "repairs");
  const mPurchS = seriesFromMobile(mobileSlices, "purchases");
  const mExpS = seriesFromMobile(mobileSlices, "expenses");
  const mProfS = seriesFromMobile(mobileSlices, "profit");

  const restaurantProfitSparkTone: TrafficTone =
    restaurantTotals.profit < 0 ? "critical" : sparkTrendTone(rProfS);
  const mobileProfitSparkTone: TrafficTone =
    mobileTotals.profit < 0 ? "critical" : sparkTrendTone(mProfS);

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
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--lv-muted-strong)]">
              Bento tiles below follow your selected window. Sparklines trace the{" "}
              <span className="text-[var(--lv-heading)]">last 7 local days</span> regardless of filters.
              {sparkLoading ? <span className="opacity-70"> Updating trends…</span> : null}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={period === "today" ? pillActive : pillIdle} onClick={() => setPeriod("today")}>
              Today
            </button>
            <button
              type="button"
              className={period === "week" ? pillActive : pillIdle}
              onClick={() => setPeriod("week")}
              title="Monday through today"
            >
              Week to date
            </button>
            <button type="button" className={period === "day" ? pillActive : pillIdle} onClick={() => setPeriod("day")}>
              Pick a date
            </button>
          </div>
          {period === "day" ? (
            <div className="flex items-center gap-2">
              <label htmlFor="overview-date" className="text-xs font-medium text-[var(--lv-muted)]">
                Date
              </label>
              <input
                id="overview-date"
                type="date"
                value={selectedDay}
                onChange={(event) => setSelectedDay(event.target.value)}
                className="lv-input max-w-[11rem] rounded-xl"
              />
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

      {isRestaurant ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-[minmax(128px,auto)]">
          <BentoCell
            featured
            className="col-span-2 row-span-2 min-h-[240px] p-7 sm:p-8"
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
                  Net profit
                </p>
                <p
                  className={cn(
                    "lv-tabular-mono mt-3 text-4xl font-semibold tracking-tighter sm:text-[2.85rem]",
                    toneProfitNumeric(restaurantTotals.profit) === "positive" && "text-[var(--lv-traffic-positive)]",
                    toneProfitNumeric(restaurantTotals.profit) === "neutral" && "text-[var(--lv-traffic-neutral)]",
                    toneProfitNumeric(restaurantTotals.profit) === "critical" && "text-[var(--lv-traffic-critical)]",
                  )}
                >
                  {formatCurrency(restaurantTotals.profit)}
                </p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <Sparkline values={rProfS} tone={restaurantProfitSparkTone} width={172} height={52} />
                <p className="max-w-[14rem] text-xs leading-relaxed text-[var(--lv-muted-strong)] opacity-70 transition-opacity duration-300 group-hover/lv-bento:opacity-100">
                  Cash + bank sales − purchases − expenses for the active window above.
                </p>
              </div>
            </div>
          </BentoCell>

          <MetricMini
            label="Cash sales"
            value={formatCurrency(restaurantTotals.cash)}
            series={rCashS}
            hint="Card & till in structured daily entry"
          />
          <MetricMini
            label="Bank sales"
            value={formatCurrency(restaurantTotals.bank)}
            series={rBankS}
            hint="Transfers & card settlements grouped as bank takings"
          />
          <MetricMini
            label="Purchases"
            value={formatCurrency(restaurantTotals.purchases)}
            series={rPurchS}
            hint="Ingredient & supply purchasing for this window"
          />
          <MetricMini
            label="Expenses"
            value={formatCurrency(restaurantTotals.expenses)}
            series={rExpS}
            hint="Operating overhead captured in Daily Entry"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-[minmax(120px,auto)]">
          <BentoCell featured className="col-span-2 row-span-2 min-h-[260px] p-7 sm:p-8">
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-muted-strong)]">
                  Net profit
                </p>
                <p
                  className={cn(
                    "lv-tabular-mono mt-3 text-4xl font-semibold tracking-tighter sm:text-[2.85rem]",
                    toneProfitNumeric(mobileTotals.profit) === "positive" && "text-[var(--lv-traffic-positive)]",
                    toneProfitNumeric(mobileTotals.profit) === "neutral" && "text-[var(--lv-traffic-neutral)]",
                    toneProfitNumeric(mobileTotals.profit) === "critical" && "text-[var(--lv-traffic-critical)]",
                  )}
                >
                  {formatCurrency(mobileTotals.profit)}
                </p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <Sparkline values={mProfS} tone={mobileProfitSparkTone} width={172} height={52} />
                <p className="max-w-[15rem] text-xs leading-relaxed text-[var(--lv-muted-strong)] opacity-75 transition-opacity duration-300 group-hover/lv-bento:opacity-100">
                  Handset margin + SIM + repairs − inventory purchases − overhead.
                </p>
              </div>
            </div>
          </BentoCell>

          <MetricMini
            label="Phone revenue"
            value={formatCurrency(mobileTotals.phoneSales)}
            series={mPhoneRevS}
            hint="Sum of handset selling prices in Daily Entry"
          />
          <MetricMini
            label="Phone margin"
            value={formatCurrency(mobileTotals.phoneProfit)}
            series={mPhoneMargS}
            hint="Profit field captured per handset row"
          />
          <MetricMini label="SIM sales" value={formatCurrency(mobileTotals.simSales)} series={mSimS} hint="Vodafone + Wind bundle" />
          <MetricMini label="Repairs" value={formatCurrency(mobileTotals.repairs)} series={mRepairS} hint="Repair services income" />
          <MetricMini
            label="Purchases"
            value={formatCurrency(mobileTotals.purchases)}
            series={mPurchS}
            hint="Operational inventory buys"
            className="lg:col-span-2"
          />
          <MetricMini
            label="Expenses"
            value={formatCurrency(mobileTotals.expenses)}
            series={mExpS}
            hint="Shop overhead for the window"
            className="lg:col-span-2"
          />
        </div>
      )}

      {!txLoading && transactions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] px-5 py-4 text-sm text-[var(--lv-muted-strong)]"
        >
          No transactions in this window. Capture figures in{" "}
          <span className="font-semibold text-[var(--lv-heading)]">Daily Entry</span> or widen the filters.
          <span className="mt-2 block text-xs opacity-80">
            Need history? Tip: Sparklines above still summarize the trailing week once data exists.
          </span>
        </motion.div>
      ) : null}
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function MetricMini({
  label,
  value,
  series,
  hint,
  className,
}: {
  label: string;
  value: string;
  series: number[];
  hint: string;
  className?: string;
}) {
  const tone = sparkTrendTone(series);
  return (
    <BentoCell className={cn("justify-between gap-4 p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--lv-muted-strong)]">{label}</p>
          <p className="lv-tabular-mono mt-2 text-xl font-semibold tracking-tight text-[var(--lv-heading)] sm:text-2xl">{value}</p>
        </div>
        <Sparkline values={series} tone={tone} width={116} height={40} />
      </div>
      <p className="text-xs leading-snug text-[var(--lv-muted-strong)] opacity-0 max-h-0 translate-y-1 overflow-hidden transition-all duration-300 group-hover/lv-bento:max-h-24 group-hover/lv-bento:translate-y-0 group-hover/lv-bento:opacity-100">
        {hint}
      </p>
    </BentoCell>
  );
}

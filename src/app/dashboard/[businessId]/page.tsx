"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  mobileProfitFromTransactions,
  restaurantProfitFromTransactions,
} from "@/lib/dashboard/daily-entry";
import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";
import { getTodayLocalISO, getWeekToDateRangeLocal } from "@/lib/utils/date-range";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

type Business = {
  id: string;
  name: string;
  business_type: "restaurant" | "mobile_shop";
};

type TransactionRow = TransactionWithMeta;

type PeriodFilter = "today" | "week" | "day";

export default function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessId, setBusinessId] = useState("");
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("today");
  const [selectedDay, setSelectedDay] = useState(() => getTodayLocalISO());
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState("");

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
    void loadTransactions(businessId, period, selectedDay);
  }, [businessId, period, selectedDay, loadTransactions]);

  const periodLabel = (() => {
    if (period === "today") return `Today (${getTodayLocalISO()})`;
    if (period === "week") {
      const { start, end } = getWeekToDateRangeLocal();
      return `Week to date (${start} → ${end})`;
    }
    return `Selected day (${selectedDay})`;
  })();

  if (businessLoading) {
    return (
      <div className="glass-panel rounded-2xl p-8">
        <Skeleton className="mb-6 h-7 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-[var(--lv-muted-strong)]">
        Unable to load this workspace.
      </div>
    );
  }

  const isRestaurant = business.business_type === "restaurant";
  const restaurantTotals = restaurantProfitFromTransactions(transactions);
  const mobileTotals = mobileProfitFromTransactions(transactions);

  const pill =
    "rounded-lg px-3 py-2 text-sm font-medium transition hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:focus-visible:ring-cyan-400/55";
  const pillActive = cn(
    pill,
    "bg-blue-600/90 text-white ring-1 ring-blue-400/55 dark:bg-cyan-400/25 dark:text-white dark:ring-cyan-400/50",
  );
  const pillIdle = cn(
    pill,
    "border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] text-[var(--lv-muted-strong)] hover:bg-[var(--lv-surface-muted)] hover:text-[var(--lv-heading)] dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-white",
  );

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-2xl p-6 shadow-lg shadow-slate-900/10 dark:shadow-black/35">
        <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-cyan-200">Overview</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--lv-heading)]">{business.name}</h1>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
          Figures below include only transactions in the selected window.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
              <label htmlFor="overview-date" className="text-xs text-[var(--lv-muted)]">
                Date
              </label>
              <input
                id="overview-date"
                type="date"
                value={selectedDay}
                onChange={(event) => setSelectedDay(event.target.value)}
                className="lv-input max-w-[11rem]"
              />
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-[var(--lv-muted)]">
          Showing: <span className="text-[var(--lv-heading)]">{periodLabel}</span>
          {txLoading ? <span className="opacity-75"> · Loading…</span> : null}
        </p>

        {txError ? (
          <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-200" role="alert">
            {txError}
          </p>
        ) : null}
      </div>

      {isRestaurant ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Cash sales"
            value={formatCurrency(restaurantTotals.cash)}
            note="Structured daily entry"
          />
          <StatCard
            title="Bank sales"
            value={formatCurrency(restaurantTotals.bank)}
            note="Structured daily entry"
          />
          <StatCard title="Purchases" value={formatCurrency(restaurantTotals.purchases)} note="Period total" />
          <StatCard title="Expenses" value={formatCurrency(restaurantTotals.expenses)} note="Period total" />
          <StatCard
            title="Profit"
            value={formatCurrency(restaurantTotals.profit)}
            note="Combined sales − purchases − expenses"
            positive={restaurantTotals.profit >= 0}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Phone sales (revenue)" value={formatCurrency(mobileTotals.phoneSales)} note="Selling prices" />
          <StatCard title="Phone profit (margin)" value={formatCurrency(mobileTotals.phoneProfit)} note="From daily entry handset rows" />
          <StatCard title="SIM sales" value={formatCurrency(mobileTotals.simSales)} note="Combined carriers" />
          <StatCard title="Repairs income" value={formatCurrency(mobileTotals.repairs)} note="Repair services" />
          <StatCard title="Purchases" value={formatCurrency(mobileTotals.purchases)} note="Operational" />
          <StatCard title="Expenses" value={formatCurrency(mobileTotals.expenses)} note="Overhead" />
          <StatCard
            title="Profit"
            value={formatCurrency(mobileTotals.profit)}
            note="Phone profit + SIM + repairs − purchases − expenses"
            positive={mobileTotals.profit >= 0}
          />
        </div>
      )}

      {!txLoading && transactions.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-[var(--lv-border)] bg-[var(--lv-surface-muted)] px-4 py-3 text-sm text-[var(--lv-muted-strong)] dark:bg-white/5"
        >
          No transactions in this window. Use{" "}
          <strong className="text-[var(--lv-heading)]">Daily Entry</strong> or adjust filters.
        </motion.p>
      ) : null}
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function StatCard({
  title,
  value,
  note,
  positive,
}: {
  title: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.28 }}
      whileHover={{ scale: 1.025 }}
      className="glass-panel rounded-2xl p-5 shadow-xl shadow-slate-900/10 dark:shadow-black/35"
    >
      <p className="text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">{title}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold",
          positive !== undefined
            ? positive
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-rose-600 dark:text-rose-300"
            : "text-[var(--lv-heading)]",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">{note}</p>
    </motion.article>
  );
}

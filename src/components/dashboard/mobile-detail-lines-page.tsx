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
  collectBankExpensesForBusiness,
  collectCashExpensesForBusiness,
  collectMobileExtrasForRange,
  formatDetailLineAmount,
  sumDetailLineAmounts,
  type MobileDetailLineRow,
} from "@/lib/reports/collect-mobile-detail-lines";
import { downloadDetailExportPdf, type DetailExportKind } from "@/lib/reports/detail-export-pdf";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { supabase } from "@/lib/supabaseClient";
import {
  getMonthBoundariesISO,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";
import { cn } from "@/lib/utils/cn";

type PageConfig = {
  kind: Extract<DetailExportKind, "extras" | "cash_expenses" | "bank_expenses">;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyHint: string;
  nameHeader: string;
};

const PAGE_CONFIG: Record<PageConfig["kind"], Omit<PageConfig, "kind">> = {
  extras: {
    title: "Extras",
    subtitle: "Other income lines saved from Daily Entry.",
    emptyTitle: "No extras this month",
    emptyHint: "Add named extra lines under Daily Entry for each date.",
    nameHeader: "Item",
  },
  cash_expenses: {
    title: "Cash expenses",
    subtitle: "Cash payments saved from Daily Entry.",
    emptyTitle: "No cash expenses this month",
    emptyHint: "Add cash expense lines under Daily Entry for each date.",
    nameHeader: "Detail",
  },
  bank_expenses: {
    title: "Bank expenses",
    subtitle: "Bank / card payments saved from Daily Entry.",
    emptyTitle: "No bank expenses this month",
    emptyHint: "Add bank expense lines under Daily Entry for each date.",
    nameHeader: "Detail",
  },
};

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

type Props = {
  params: Promise<{ businessId: string }>;
  kind: PageConfig["kind"];
};

export function MobileDetailLinesPage({ params, kind }: Props) {
  const config = PAGE_CONFIG[kind];
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
      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .gte("transaction_date", monthRange.start)
            .lte("transaction_date", monthRange.end)
            .order("transaction_date", { ascending: true })
            .limit(5000),
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .gte("transaction_date", monthRange.start)
            .lte("transaction_date", monthRange.end)
            .order("transaction_date", { ascending: true })
            .limit(5000),
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
    if (!businessId || !monthRange || !businessType) return;
    if (kind === "extras" && businessType !== "mobile_shop") return;
    if (
      (kind === "cash_expenses" || kind === "bank_expenses") &&
      businessType !== "mobile_shop" &&
      businessType !== "restaurant" &&
      businessType !== "grocery"
    ) {
      return;
    }
    const id = window.setTimeout(() => void loadTransactions(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, monthRange, businessType, loadTransactions, kind]);

  const detailLines = useMemo(() => {
    if (!monthRange || !businessType) return [];
    if (kind === "extras") {
      if (businessType !== "mobile_shop") return [];
      return collectMobileExtrasForRange(transactions, monthRange.start, monthRange.end);
    }
    if (kind === "cash_expenses") {
      return collectCashExpensesForBusiness(
        businessType,
        transactions,
        monthRange.start,
        monthRange.end,
      );
    }
    return collectBankExpensesForBusiness(
      businessType,
      transactions,
      monthRange.start,
      monthRange.end,
    );
  }, [kind, monthRange, transactions, businessType]);

  const totalAmount = useMemo(() => sumDetailLineAmounts(detailLines), [detailLines]);

  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());

  const periodTitle = parsedMonth
    ? calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)
    : "";

  const handleDownloadPdf = async () => {
    if (!businessName || !periodTitle) return;
    setPdfBusy(true);
    try {
      await downloadDetailExportPdf({
        businessName,
        periodTitle,
        kind,
        lines: detailLines,
      });
      toast.success("PDF downloaded.");
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

  const allowedForKind =
    kind === "extras"
      ? businessType === "mobile_shop"
      : businessType === "mobile_shop" ||
        businessType === "restaurant" ||
        businessType === "grocery";

  if (!allowedForKind) {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8 text-center">
        <p className="text-lg font-semibold text-[var(--lv-heading)]">{config.title}</p>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
          This section is not available for this workspace type.
        </p>
      </div>
    );
  }

  if (!parsedMonth || !monthRange) return null;

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
              {config.title}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              {config.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">{config.subtitle}</p>
            {businessName ? (
              <p className="mt-1 text-sm text-[var(--lv-muted-strong)]">{businessName}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-col gap-2 sm:items-end">
              <label className="text-xs font-semibold text-[var(--lv-muted)]" htmlFor={`${kind}-month`}>
                Month
              </label>
              <input
                id={`${kind}-month`}
                type="month"
                max={maxMonthInput}
                value={monthInput}
                onChange={(e) => setMonthInput(e.target.value)}
                className="lv-tabular-mono rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-surface-muted)] px-3 py-2.5 text-sm text-[var(--lv-heading)] outline-none focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)] dark:bg-white/[0.07]"
              />
            </div>
            <PressableButton
              type="button"
              variant="primary"
              disabled={pdfBusy || txLoading}
              onClick={() => void handleDownloadPdf()}
              className={cn(
                "min-h-11 w-full gap-2 rounded-[1rem] px-5 sm:w-auto",
                "bg-gradient-to-r from-cyan-400/95 to-[color-mix(in_srgb,var(--lv-accent)_72%,#0e7490)]",
              )}
            >
              {pdfBusy ? "Generating PDF…" : `Download ${config.title.toLowerCase()} (PDF)`}
            </PressableButton>
          </div>
        </div>
      </section>

      <section className="rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-liquid-fill)] p-5 shadow-[var(--lv-bento-shadow)] backdrop-blur-3xl sm:p-7">
        <p className="mb-4 text-sm text-[var(--lv-muted-strong)]">
          Entries for{" "}
          <span className="font-medium text-[var(--lv-heading)]">{periodTitle}</span>
          {detailLines.length > 0 ? (
            <>
              {" "}
              · Total{" "}
              <span className="font-medium text-[var(--lv-heading)]">
                {formatDetailLineAmount(totalAmount)}
              </span>
            </>
          ) : null}
        </p>

        {txError ? (
          <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
            {txError}
          </p>
        ) : txLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : detailLines.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[var(--lv-surface-muted)] px-6 py-14 text-center dark:bg-white/[0.04]"
          >
            <p className="text-base font-semibold text-[var(--lv-heading)]">{config.emptyTitle}</p>
            <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">{config.emptyHint}</p>
          </motion.div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[var(--lv-surface-muted)] text-xs font-semibold uppercase tracking-wide text-[var(--lv-muted-strong)] dark:bg-white/[0.04]">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">{config.nameHeader}</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detailLines.map((row, idx) => (
                  <tr
                    key={`${row.date}-${row.itemName}-${idx}`}
                    className="border-b border-white/5 text-[var(--lv-heading)]"
                  >
                    <td className="lv-tabular-mono px-4 py-3 text-[var(--lv-accent)]">
                      {formatNoteHeadingDate(row.date)}
                    </td>
                    <td className="px-4 py-3">{row.itemName}</td>
                    <td className="lv-tabular-mono px-4 py-3 text-right font-medium">
                      {formatDetailLineAmount(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--lv-surface-muted)] font-semibold dark:bg-white/[0.04]">
                  <td className="px-4 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="lv-tabular-mono px-4 py-3 text-right">
                    {formatDetailLineAmount(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  mergeSaleBuyNamedLines,
  parseMobileDailyFromTransactions,
  type MerchPairLine,
  type TransactionWithMeta,
} from "@/lib/dashboard/daily-entry";
import {
  parseRestaurantDailyFromTransactions,
  restaurantDayHasContent,
  restaurantProfitFromTransactions,
  RESTAURANT_DELIVERY_PLATFORMS,
  RESTAURANT_SPESA_COMPANIES,
} from "@/lib/dashboard/restaurant-daily-entry";
import { buildMobileTransactionLedgerRow } from "@/lib/dashboard/mobile-transaction-ledger";
import { selectWithMetadataColumnFallback } from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { groceryDayHasContent, groceryProfitFromTransactions, parseGroceryDailyFromTransactions } from "@/lib/dashboard/grocery-daily-entry";
import { businessTypeLabel, normalizeBusinessType, type BusinessType } from "@/lib/business-types";
import { formatCurrency } from "@/lib/utils/formatters";
import { getTodayLocalISO } from "@/lib/utils/date-range";
import { isBlankNote, noteToPlainText } from "@/lib/utils/rich-text";

function displayName(s: string): string {
  const t = s.trim();
  return t.length ? t : "—";
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-surface-muted)] p-4 dark:bg-white/[0.04] sm:p-5">
      <h2 className="text-base font-semibold text-[var(--lv-heading)]">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-[var(--lv-muted-strong)]">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((row) => (
        <div
          key={row.label}
          className="flex flex-col gap-0.5 rounded-lg border border-[color-mix(in_srgb,var(--lv-glass-edge)_35%,transparent)] bg-[var(--lv-liquid-fill)] px-3 py-2.5"
        >
          <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--lv-muted-strong)]">
            {row.label}
          </dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-[var(--lv-heading)]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MerchTable({ rows, emptyLabel }: { rows: MerchPairLine[]; emptyLabel: string }) {
  const visible = rows.filter((r) => r.retail > 0 || r.buy > 0 || r.item_name.trim().length > 0);
  if (visible.length === 0) {
    return <p className="text-sm text-[var(--lv-muted-strong)]">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[color-mix(in_srgb,var(--lv-glass-edge)_40%,transparent)]">
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-card)] text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--lv-muted-strong)]">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2 text-right">Retail</th>
            <th className="px-3 py-2 text-right">Buy (cost)</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr
              key={`${r.item_name}-${i}`}
              className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_25%,transparent)] last:border-0"
            >
              <td className="px-3 py-2 text-[var(--lv-heading)]">{displayName(r.item_name)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--lv-heading)]">
                {formatCurrency(r.retail)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--lv-heading)]">
                {formatCurrency(r.buy)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NamedAmountTable({
  rows,
  emptyLabel,
  nameHeader,
}: {
  rows: { item_name: string; amount: number }[];
  emptyLabel: string;
  nameHeader: string;
}) {
  const visible = rows.filter((r) => r.amount > 0 || r.item_name.trim().length > 0);
  if (visible.length === 0) {
    return <p className="text-sm text-[var(--lv-muted-strong)]">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[color-mix(in_srgb,var(--lv-glass-edge)_40%,transparent)]">
      <table className="w-full min-w-[240px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-card)] text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--lv-muted-strong)]">
            <th className="px-3 py-2">{nameHeader}</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr
              key={`${r.item_name}-${i}`}
              className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_25%,transparent)] last:border-0"
            >
              <td className="px-3 py-2 text-[var(--lv-heading)]">{displayName(r.item_name)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--lv-heading)]">
                {formatCurrency(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DayReviewPage({ params }: { params: Promise<{ businessId: string }> }) {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("restaurant");
  const [viewDate, setViewDate] = useState(getTodayLocalISO());
  const [bizLoading, setBizLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState<TransactionWithMeta[]>([]);

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
        if (cancelled) return;
        if (error) {
          setLoadError(getUserFriendlyError(new Error(error.message)));
          return;
        }
        if (data?.name) setBusinessName(data.name as string);
        const bt = normalizeBusinessType(data?.business_type);
        if (bt) setBusinessType(bt);
      } catch (caught) {
        if (!cancelled) setLoadError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      } finally {
        if (!cancelled) setBizLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDay = useCallback(async () => {
    if (!businessId) return;
    setTxLoading(true);
    setLoadError("");
    try {
      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .eq("transaction_date", viewDate),
        async () =>
          await supabase
            .from("transactions")
            .select("amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .eq("transaction_date", viewDate),
      );
      if (fetchError) {
        setLoadError(getUserFriendlyError(new Error(fetchError.message)));
        setRows([]);
        return;
      }
      setRows(mapTransactionRows(data ?? []));
    } catch (caught) {
      setLoadError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      setRows([]);
    } finally {
      setTxLoading(false);
    }
  }, [businessId, viewDate]);

  useEffect(() => {
    if (!businessId || bizLoading) return;
    const id = window.setTimeout(() => void loadDay(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, viewDate, bizLoading, loadDay]);

  const dayRows = useMemo(
    () => rows.filter((r) => r.transaction_date === viewDate),
    [rows, viewDate],
  );

  const restaurantDraft = useMemo(() => parseRestaurantDailyFromTransactions(dayRows, viewDate), [dayRows, viewDate]);
  const restaurantTotals = useMemo(() => restaurantProfitFromTransactions(dayRows), [dayRows]);

  const restaurantNotes = useMemo(() => restaurantDraft.notes, [restaurantDraft.notes]);

  const mobileDraft = useMemo(
    () => parseMobileDailyFromTransactions(dayRows, viewDate),
    [dayRows, viewDate],
  );

  const mobileHandsets = useMemo(
    () => mergeSaleBuyNamedLines(mobileDraft.mobile_sales, mobileDraft.mobile_buys),
    [mobileDraft.mobile_sales, mobileDraft.mobile_buys],
  );

  const mobileAccessories = useMemo(
    () => mergeSaleBuyNamedLines(mobileDraft.accessory_sales, mobileDraft.accessory_buys),
    [mobileDraft.accessory_sales, mobileDraft.accessory_buys],
  );

  const mobileSummary = useMemo(
    () => buildMobileTransactionLedgerRow(dayRows, viewDate),
    [dayRows, viewDate],
  );

  const groceryDraft = useMemo(() => parseGroceryDailyFromTransactions(dayRows, viewDate), [dayRows, viewDate]);
  const groceryTotals = useMemo(() => groceryProfitFromTransactions(dayRows), [dayRows]);

  const hasGroceryEntry = useMemo(
    () => groceryDayHasContent(dayRows) || !isBlankNote(groceryDraft.notes),
    [dayRows, groceryDraft.notes],
  );

  const hasRestaurantEntry = useMemo(
    () => restaurantDayHasContent(dayRows) || !isBlankNote(restaurantNotes),
    [dayRows, restaurantNotes],
  );

  const hasMobileEntry = useMemo(() => {
    if (mobileDraft.sim_buy > 0 || mobileDraft.sim_sale > 0) return true;
    if (mobileDraft.package_r_wind > 0 || mobileDraft.package_r_voda > 0) return true;
    if (mobileDraft.pos_sale > 0) return true;
    if (!isBlankNote(mobileDraft.notes)) return true;
    const anyMerch = (list: MerchPairLine[]) =>
      list.some((r) => r.retail > 0 || r.buy > 0 || r.item_name.trim().length > 0);
    if (anyMerch(mobileHandsets) || anyMerch(mobileAccessories)) return true;
    const anyNamed = (list: { item_name: string; amount: number }[]) =>
      list.some((r) => r.amount > 0 || r.item_name.trim().length > 0);
    if (
      anyNamed(mobileDraft.repairs) ||
      anyNamed(mobileDraft.extras) ||
      anyNamed(mobileDraft.cash_expenses) ||
      anyNamed(mobileDraft.bank_expenses)
    ) {
      return true;
    }
    return false;
  }, [mobileDraft, mobileHandsets, mobileAccessories]);

  const todayISO = getTodayLocalISO();

  if (bizLoading) {
    return (
      <div className="glass-panel rounded-[1.625rem] p-8">
        <Skeleton className="mb-6 h-9 w-56 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
              Read-only
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">Day review</h1>
            {businessName ? (
              <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
                {businessName} · {businessTypeLabel(businessType)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="day-review-date" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                Date
              </label>
              <input
                id="day-review-date"
                type="date"
                max={todayISO}
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="lv-input rounded-xl"
              />
            </div>
            <Link
              href={`/dashboard/${businessId}/daily-entry`}
              className="text-sm font-semibold text-[var(--lv-accent)] underline-offset-4 hover:underline"
            >
              Edit in Daily Entry
            </Link>
          </div>
        </div>
      </section>

      {loadError ? (
        <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
          {loadError}
        </p>
      ) : null}

      {txLoading && !loadError ? (
        <div className="glass-panel rounded-[1.625rem] p-8">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : null}

      {!txLoading && !loadError && businessType === "grocery" ? (
        hasGroceryEntry ? (
          <div className="space-y-5">
            <Section title="Summary" hint="Totals from saved grocery daily entry for this date.">
              <StatGrid
                items={[
                  { label: "Bank sale total", value: formatCurrency(groceryTotals.bankSaleTotal) },
                  { label: "Cash sale total", value: formatCurrency(groceryTotals.cashSaleTotal) },
                  { label: "Total sale", value: formatCurrency(groceryTotals.totalSale) },
                  { label: "Amadari", value: formatCurrency(groceryTotals.companyAmadari) },
                  { label: "Cip./Pat.", value: formatCurrency(groceryTotals.companyCipPat) },
                  { label: "Eurospin", value: formatCurrency(groceryTotals.companyEurospin) },
                  { label: "Aia", value: formatCurrency(groceryTotals.companyAia) },
                  { label: "Spesa total", value: formatCurrency(groceryTotals.spesaTotal) },
                  { label: "Cheques total", value: formatCurrency(groceryTotals.cheques) },
                  { label: "Total profit", value: formatCurrency(groceryTotals.totalProfit) },
                ]}
              />
            </Section>
            <Section title="Day notes">
              {isBlankNote(groceryDraft.notes) ? (
                <p className="text-sm text-[var(--lv-muted-strong)]">No notes for this date.</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--lv-heading)]">
                  {noteToPlainText(groceryDraft.notes)}
                </p>
              )}
            </Section>
          </div>
        ) : (
          <div className="rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] bg-[var(--lv-liquid-fill)] px-6 py-12 text-center backdrop-blur-md">
            <p className="text-base font-semibold text-[var(--lv-heading)]">No grocery entry for this date</p>
            <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
              Save a day from Daily Entry, or pick another date.
            </p>
          </div>
        )
      ) : null}

      {!txLoading && !loadError && businessType === "restaurant" ? (
        hasRestaurantEntry ? (
          <div className="space-y-5">
            <Section title="Summary" hint="Totals from saved restaurant daily entry for this date.">
              <StatGrid
                items={[
                  { label: "Total bank sale", value: formatCurrency(restaurantTotals.bankSaleTotal) },
                  { label: "Total cash sale", value: formatCurrency(restaurantTotals.cashSaleTotal) },
                  {
                    label: "Glovo, Just Eat, Deliveroo",
                    value: formatCurrency(restaurantTotals.companySaleTotal),
                  },
                  { label: "Total sale", value: formatCurrency(restaurantTotals.totalSale) },
                  { label: "Kebab purchase", value: formatCurrency(restaurantTotals.kebabPurchase) },
                  { label: "C & C purchase", value: formatCurrency(restaurantTotals.ccPurchase) },
                  { label: "Other spesa", value: formatCurrency(restaurantTotals.otherSpesa) },
                  { label: "Rent", value: formatCurrency(restaurantTotals.rent) },
                  { label: "Person purchases", value: formatCurrency(restaurantTotals.personPurchases) },
                  { label: "Total spesa", value: formatCurrency(restaurantTotals.totalSpesa) },
                  { label: "Total profit / loss", value: formatCurrency(restaurantTotals.totalProfit) },
                ]}
              />
            </Section>

            <Section title="Shop sales" hint="Bank and cash turnover for the day.">
              <StatGrid
                items={[
                  { label: "Bank sale", value: formatCurrency(restaurantDraft.bank_sales) },
                  { label: "Cash sale", value: formatCurrency(restaurantDraft.cash_sales) },
                ]}
              />
            </Section>

            <Section title="Company sales" hint="Delivery platform sales — Glovo, Just Eat, Deliveroo.">
              <NamedAmountTable
                rows={restaurantDraft.company_sales.map((r) => ({
                  item_name: RESTAURANT_DELIVERY_PLATFORMS.find((p) => p.key === r.company_key)?.label ?? r.company_key,
                  amount: r.amount,
                }))}
                nameHeader="Company"
                emptyLabel="No company sales for this date."
              />
            </Section>

            <Section title="Company spesa" hint="Kebab and C & C supplier purchases.">
              <NamedAmountTable
                rows={restaurantDraft.company_spesa.map((r) => ({
                  item_name: RESTAURANT_SPESA_COMPANIES.find((c) => c.key === r.company_key)?.label ?? r.company_key,
                  amount: r.amount,
                }))}
                nameHeader="Company"
                emptyLabel="No company spesa for this date."
              />
            </Section>

            <Section title="Other spesa" hint="Other supplier or company costs with free-text names.">
              <NamedAmountTable
                rows={restaurantDraft.other_spesa}
                nameHeader="Company / detail"
                emptyLabel="No other spesa for this date."
              />
            </Section>

            <Section title="Rent" hint="Daily or periodic rent (Affitto).">
              <StatGrid items={[{ label: "Rent", value: formatCurrency(restaurantDraft.rent) }]} />
            </Section>

            <Section title="Person purchases" hint="Named person purchases for this day.">
              <NamedAmountTable
                rows={restaurantDraft.person_purchases}
                nameHeader="Person"
                emptyLabel="No person purchases for this date."
              />
            </Section>

            <Section title="Day notes">
              {isBlankNote(restaurantNotes) ? (
                <p className="text-sm text-[var(--lv-muted-strong)]">No notes for this date.</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--lv-heading)]">
                  {noteToPlainText(restaurantNotes)}
                </p>
              )}
            </Section>
          </div>
        ) : (
          <div className="rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] bg-[var(--lv-liquid-fill)] px-6 py-12 text-center backdrop-blur-md">
            <p className="text-base font-semibold text-[var(--lv-heading)]">No restaurant entry for this date</p>
            <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
              Save a day from Daily Entry, or pick another date.
            </p>
          </div>
        )
      ) : null}

      {!txLoading && !loadError && businessType === "mobile_shop" ? (
        hasMobileEntry ? (
          <div className="space-y-5">
            <Section title="Summary" hint="Key figures for this date.">
              <StatGrid
                items={[
                  { label: "Sim profit", value: formatCurrency(mobileSummary.simProfit) },
                  { label: "Mobile profit", value: formatCurrency(mobileSummary.mobileProfit) },
                  { label: "Access profit", value: formatCurrency(mobileSummary.accessoryProfit) },
                  { label: "R.Wind", value: formatCurrency(mobileSummary.rwind) },
                  { label: "R.Voda", value: formatCurrency(mobileSummary.rwoda) },
                  { label: "Repairs", value: formatCurrency(mobileSummary.repair) },
                  { label: "Extras", value: formatCurrency(mobileSummary.extras) },
                ]}
              />
            </Section>

            <Section title="SIM" hint="Shop SIM cost and SIM retail.">
              <StatGrid
                items={[
                  { label: "SIM buy (shop cost)", value: formatCurrency(mobileDraft.sim_buy) },
                  { label: "SIM sale (retail)", value: formatCurrency(mobileDraft.sim_sale) },
                ]}
              />
            </Section>

            <Section title="Mobile phones" hint="Each named line: retail sale and stock cost.">
              <MerchTable rows={mobileHandsets} emptyLabel="No handset lines for this date." />
            </Section>

            <Section title="Accessories" hint="Accessory retail and purchase cost.">
              <MerchTable rows={mobileAccessories} emptyLabel="No accessory lines for this date." />
            </Section>

            <Section title="Packages sale" hint="Carrier packages (R.Wind / R.Voda).">
              <StatGrid
                items={[
                  { label: "R.Wind", value: formatCurrency(mobileDraft.package_r_wind) },
                  { label: "R.Voda", value: formatCurrency(mobileDraft.package_r_voda) },
                ]}
              />
            </Section>

            <Section title="Repairs" hint="Repair jobs: label + amount.">
              <NamedAmountTable
                rows={mobileDraft.repairs}
                nameHeader="Repair"
                emptyLabel="No repair lines for this date."
              />
            </Section>

            <Section title="Extras" hint="Other income with a name.">
              <NamedAmountTable rows={mobileDraft.extras} nameHeader="Item" emptyLabel="No extra lines for this date." />
            </Section>

            <Section title="POS" hint="Card-terminal / POS turnover.">
              <StatGrid items={[{ label: "POS (card) sales", value: formatCurrency(mobileDraft.pos_sale) }]} />
            </Section>

            <Section title="Cash expenses" hint="Cash payments — names as entered.">
              <NamedAmountTable
                rows={mobileDraft.cash_expenses}
                nameHeader="Detail"
                emptyLabel="No cash expense lines for this date."
              />
            </Section>

            <Section title="Bank expenses" hint="Card or bank charges — names as entered.">
              <NamedAmountTable
                rows={mobileDraft.bank_expenses}
                nameHeader="Detail"
                emptyLabel="No bank expense lines for this date."
              />
            </Section>

            <Section title="Day notes">
              {isBlankNote(mobileDraft.notes) ? (
                <p className="text-sm text-[var(--lv-muted-strong)]">No notes for this date.</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--lv-heading)]">
                  {noteToPlainText(mobileDraft.notes)}
                </p>
              )}
            </Section>
          </div>
        ) : (
          <div className="rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] bg-[var(--lv-liquid-fill)] px-6 py-12 text-center backdrop-blur-md">
            <p className="text-base font-semibold text-[var(--lv-heading)]">No mobile shop entry for this date</p>
            <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
              Save a day from Daily Entry, or pick another date.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}

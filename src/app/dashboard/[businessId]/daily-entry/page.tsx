"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
  restaurantProfitFromTransactions,
} from "@/lib/dashboard/daily-entry";
import {
  insertTransactionsWithMetadataFallback,
  selectWithMetadataColumnFallback,
} from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { getTodayLocalISO } from "@/lib/utils/date-range";
import { supabase } from "@/lib/supabaseClient";
import {
  MerchNamedBlock,
  NamedLinesOnly,
  emptyMerch,
  emptyNamed,
  useMerchListHelpers,
  useNamedListHelpers,
  type MerchRowStr,
  type NamedRowStr,
} from "@/components/dashboard/mobile-shop-fields";
import { GlassFormCard } from "@/components/ui/glass-form-card";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { isBlankNote } from "@/lib/utils/rich-text";

type BusinessType = "restaurant" | "mobile_shop";

type BusinessRow = {
  id: string;
  business_type: BusinessType;
};

type TxRecord = {
  amount: number;
  transaction_type: "sale" | "expense" | "repair";
  description: string | null;
  transaction_date: string;
  metadata: unknown;
};

export default function DailyEntryPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [businessId, setBusinessId] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("restaurant");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [entryDate, setEntryDate] = useState(getTodayLocalISO());

  const [restCash, setRestCash] = useState("0");
  const [restBank, setRestBank] = useState("0");
  const [restPurchases, setRestPurchases] = useState("0");
  const [restExpenses, setRestExpenses] = useState("0");
  const [restNotes, setRestNotes] = useState("");

  const [simBuy, setSimBuy] = useState("0");
  const [simSale, setSimSale] = useState("0");
  const [mobileMerch, setMobileMerch] = useState<MerchRowStr[]>([emptyMerch()]);
  const [accessoryMerch, setAccessoryMerch] = useState<MerchRowStr[]>([emptyMerch()]);
  const [packageRWind, setPackageRWind] = useState("0");
  const [packageRVoda, setPackageRVoda] = useState("0");
  const [repairs, setRepairs] = useState<NamedRowStr[]>([emptyNamed()]);
  const [extras, setExtras] = useState<NamedRowStr[]>([emptyNamed()]);
  const [posSale, setPosSale] = useState("0");
  const [mobileNotes, setMobileNotes] = useState("");
  const [cashExpenses, setCashExpenses] = useState<NamedRowStr[]>([emptyNamed()]);
  const [bankExpenses, setBankExpenses] = useState<NamedRowStr[]>([emptyNamed()]);

  const applyMobileDraftStrings = useCallback((draft: ReturnType<typeof parseMobileDailyFromTransactions>) => {
    setSimBuy(String(draft.sim_buy));
    setSimSale(String(draft.sim_sale));
    setMobileMerch(
      mergeSaleBuyNamedLines(draft.mobile_sales, draft.mobile_buys).map((r) => ({
        itemName: r.item_name,
        retail: String(r.retail),
        buy: String(r.buy),
      })),
    );
    setAccessoryMerch(
      mergeSaleBuyNamedLines(draft.accessory_sales, draft.accessory_buys).map((r) => ({
        itemName: r.item_name,
        retail: String(r.retail),
        buy: String(r.buy),
      })),
    );
    setPackageRWind(String(draft.package_r_wind));
    setPackageRVoda(String(draft.package_r_voda));
    setRepairs(
      draft.repairs.map((r) => ({
        itemName: r.item_name,
        amount: String(r.amount),
      })),
    );
    setExtras(
      draft.extras.map((r) => ({
        itemName: r.item_name,
        amount: String(r.amount),
      })),
    );
    setPosSale(String(draft.pos_sale));
    setMobileNotes(draft.notes ?? "");
    setCashExpenses(
      draft.cash_expenses.map((r) => ({
        itemName: r.item_name,
        amount: String(r.amount),
      })),
    );
    setBankExpenses(
      draft.bank_expenses.map((r) => ({
        itemName: r.item_name,
        amount: String(r.amount),
      })),
    );
  }, []);

  const hydrateForms = useCallback(
    (bt: BusinessType, rows: TxRecord[], dateISO: string) => {
      const dayRows = rows.filter((row) => row.transaction_date === dateISO);

      if (bt === "restaurant") {
        const totals = restaurantProfitFromTransactions(dayRows);
        setRestCash(String(totals.cash));
        setRestBank(String(totals.bank));
        setRestPurchases(String(totals.purchases));
        setRestExpenses(String(totals.expenses));

        let noteText = "";
        for (const row of dayRows) {
          const meta = getMetadata(row.metadata, row.description);
          if (
            metaString(meta, "source") === SOURCE_RESTAURANT &&
            metaString(meta, "line") === "daily_notes"
          ) {
            const notes = typeof meta["notes"] === "string" ? (meta["notes"] as string) : "";
            if (!isBlankNote(notes)) noteText = notes;
          }
        }
        setRestNotes(noteText);
        return;
      }

      const draft = parseMobileDailyFromTransactions(dayRows, dateISO);
      applyMobileDraftStrings(draft);
    },
    [applyMobileDraftStrings],
  );

  const loadDay = useCallback(
    async (bid: string, dateISO: string, bt: BusinessType, shouldHydrate: boolean) => {
      setError("");
      try {
        const { data, error: fetchError } = await selectWithMetadataColumnFallback(
          async () =>
            await supabase
              .from("transactions")
              .select("amount, transaction_type, description, transaction_date, metadata")
              .eq("business_id", bid)
              .eq("transaction_date", dateISO),
          async () =>
            await supabase
              .from("transactions")
              .select("amount, transaction_type, description, transaction_date")
              .eq("business_id", bid)
              .eq("transaction_date", dateISO),
        );

        if (fetchError) {
          setError(getUserFriendlyError(new Error(fetchError.message)));
          return;
        }

        const rows = (data ?? []) as TxRecord[];
        if (shouldHydrate) {
          hydrateForms(bt, rows, dateISO);
        }
      } catch (caught) {
        const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
        setError(msg);
      }
    },
    [hydrateForms],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await params;
      const bid = resolved.businessId;
      setBusinessId(bid);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        if (!user) setError("Please login first.");
        return;
      }
      setUserId(user.id);

      try {
        const { data, error: bizErr } = await supabase
          .from("businesses")
          .select("id, business_type")
          .eq("id", bid)
          .single();

        if (cancelled) return;

        if (bizErr) {
          setError(getUserFriendlyError(new Error(bizErr.message)));
          setLoading(false);
          return;
        }

        let bt: BusinessType = "restaurant";
        if (data) {
          bt = (data as BusinessRow).business_type;
          setBusinessType(bt);
        }

        const todayISO = getTodayLocalISO();
        setEntryDate(todayISO);
        await loadDay(bid, todayISO, bt, true);
      } catch (caught) {
        if (!cancelled) {
          setError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!businessId || loading) return;
    const id = window.setTimeout(() => void loadDay(businessId, entryDate, businessType, true), 0);
    return () => window.clearTimeout(id);
  }, [businessId, entryDate, businessType, loadDay, loading]);

  const clampInput = (value: string, setter: (next: string) => void) => {
    setter(String(Math.max(0, parseNonNegative(value))));
  };

  const namedListHelpers = useNamedListHelpers();
  const merchListHelpers = useMerchListHelpers();

  const mobileEntryHasContent = () => {
    const sumNamed = (list: NamedRowStr[]) =>
      list.reduce((acc, row) => acc + parseNonNegative(row.amount), 0);
    const sumMerch = (list: MerchRowStr[]) =>
      list.reduce((acc, row) => acc + parseNonNegative(row.retail) + parseNonNegative(row.buy), 0);
    const hasMoney =
      parseNonNegative(simBuy) +
        parseNonNegative(simSale) +
        sumMerch(mobileMerch) +
        sumMerch(accessoryMerch) +
        parseNonNegative(packageRWind) +
        parseNonNegative(packageRVoda) +
        sumNamed(repairs) +
        sumNamed(extras) +
        parseNonNegative(posSale) +
        sumNamed(cashExpenses) +
        sumNamed(bankExpenses) >
      0;
    return hasMoney || !isBlankNote(mobileNotes);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!businessId || !userId || !entryDate) return;

    setSaving(true);
    setError("");

    if (businessType === "restaurant") {
      const cash = parseNonNegative(restCash);
      const bank = parseNonNegative(restBank);
      const purchases = parseNonNegative(restPurchases);
      const expenses = parseNonNegative(restExpenses);
      const hasMoney = cash + bank + purchases + expenses > 0;
      const hasNotes = !isBlankNote(restNotes);
      if (!hasMoney && !hasNotes) {
        toast.error("Add at least one amount or a note before saving.");
        setSaving(false);
        return;
      }
    } else if (!mobileEntryHasContent()) {
      toast.error("Add at least one amount or a note before saving.");
      setSaving(false);
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("business_id", businessId)
        .eq("transaction_date", entryDate);

      if (deleteError) {
        const msg = getUserFriendlyError(new Error(deleteError.message));
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }

      if (businessType === "restaurant") {
        const rows = buildRestaurantDailyRows({
          business_id: businessId,
          created_by_user_id: userId,
          transaction_date: entryDate,
          cash_sales: parseNonNegative(restCash),
          bank_sales: parseNonNegative(restBank),
          purchases: parseNonNegative(restPurchases),
          expenses: parseNonNegative(restExpenses),
          notes: restNotes,
        });

        if (rows.length) {
          const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, rows);
          if (insertError) throw insertError;
        }
      } else {
        const toLines = (list: NamedRowStr[]) =>
          list
            .map((r) => ({
              item_name: r.itemName,
              amount: parseNonNegative(r.amount),
            }))
            .filter((r) => r.amount > 0);

        const { sales: mobile_sales, buys: mobile_buys } = merchFormStringsToSaleBuy(mobileMerch);
        const { sales: accessory_sales, buys: accessory_buys } = merchFormStringsToSaleBuy(accessoryMerch);

        const rows = buildMobileDailyRows({
          business_id: businessId,
          created_by_user_id: userId,
          transaction_date: entryDate,
          sim_buy: parseNonNegative(simBuy),
          sim_sale: parseNonNegative(simSale),
          mobile_sales,
          mobile_buys,
          accessory_sales,
          accessory_buys,
          package_r_wind: parseNonNegative(packageRWind),
          package_r_voda: parseNonNegative(packageRVoda),
          repairs: toLines(repairs),
          extras: toLines(extras),
          pos_sale: parseNonNegative(posSale),
          notes: mobileNotes,
          cash_expenses: toLines(cashExpenses),
          bank_expenses: toLines(bankExpenses),
        });

        if (rows.length) {
          const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, rows);
          if (insertError) throw insertError;
        }
      }

      toast.success(
        `${businessType === "restaurant" ? "Restaurant" : "Mobile shop"} daily entry saved successfully.`,
      );
      await loadDay(businessId, entryDate, businessType, true);
    } catch (caughtError) {
      const err = getUserFriendlyError(caughtError, "Unable to save entry.");
      setError(err);
      toast.error(err);
    }

    setSaving(false);
  };

  return (
    <GlassFormCard>
        <h1 className="text-2xl font-semibold text-[var(--lv-heading)]">
          Daily entry · {businessType === "restaurant" ? "Restaurant" : "Mobile shop"}
        </h1>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
          Amounts cannot be negative. Saving replaces Supabase rows for this business/date, then inserts the new
          bundle.
        </p>

        {loading ? <p className="mt-6 text-sm text-[var(--lv-muted-strong)]">Loading business…</p> : null}
        {error ? (
          <p className="mt-4 text-sm text-[var(--lv-traffic-critical)]" role="alert">
            {error}
          </p>
        ) : null}

        {!loading ? (
          <form className="mt-6 flex flex-col gap-6" onSubmit={handleSubmit}>
            <MidnightField
              id="entryDate"
              label="Entry date"
              type="date"
              value={entryDate}
              onChange={(event) => {
                setEntryDate(event.target.value);
              }}
              required
            />

            {businessType === "restaurant" ? (
              <div className="flex flex-col gap-4">
                {[
                  { id: "cash", label: "Cash sales", value: restCash, setter: setRestCash },
                  { id: "bank", label: "Bank sales", value: restBank, setter: setRestBank },
                  {
                    id: "purch",
                    label: "Purchases",
                    value: restPurchases,
                    setter: setRestPurchases,
                  },
                  { id: "exp", label: "Expenses", value: restExpenses, setter: setRestExpenses },
                ].map((field) => (
                  <MidnightField
                    key={field.id}
                    id={field.id}
                    label={field.label}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={field.value}
                    onChange={(event) => clampInput(event.target.value, field.setter)}
                  />
                ))}
                <MidnightField
                  id="rest-notes"
                  label="Notes"
                  rows={5}
                  value={restNotes}
                  onChange={(event) => setRestNotes(event.target.value)}
                  disabled={saving}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <section className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-[var(--lv-heading)]">SIM</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MidnightField
                      id="sim-buy"
                      label="SIM buy (shop cost)"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={simBuy}
                      onChange={(e) => clampInput(e.target.value, setSimBuy)}
                    />
                    <MidnightField
                      id="sim-sale"
                      label="SIM sale (retail)"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={simSale}
                      onChange={(e) => clampInput(e.target.value, setSimSale)}
                    />
                  </div>
                </section>

                <MerchNamedBlock
                  idPrefix="m-phone"
                  title="Mobile phones"
                  hint="Each line: optional name, retail sale, and stock cost for the same handset."
                  rows={mobileMerch}
                  setRows={setMobileMerch}
                  retailLabel="Retail (sale)"
                  buyLabel="Buy (cost)"
                  helpers={merchListHelpers}
                />

                <MerchNamedBlock
                  idPrefix="m-acc"
                  title="Accessories"
                  hint="Each line: optional name, retail sale, and purchase cost."
                  rows={accessoryMerch}
                  setRows={setAccessoryMerch}
                  retailLabel="Retail (sale)"
                  buyLabel="Buy (cost)"
                  helpers={merchListHelpers}
                />

                <section className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Packages sale</h3>
                  <p className="text-xs text-[var(--lv-muted-strong)]">Carrier packages (top-up / bundle retail).</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MidnightField
                      id="pkg-wind"
                      label="R.Wind"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={packageRWind}
                      onChange={(e) => clampInput(e.target.value, setPackageRWind)}
                    />
                    <MidnightField
                      id="pkg-voda"
                      label="R.Voda"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={packageRVoda}
                      onChange={(e) => clampInput(e.target.value, setPackageRVoda)}
                    />
                  </div>
                </section>

                <NamedLinesOnly
                  idPrefix="m-repair"
                  title="Repairs"
                  hint="Each repair job: short label + amount."
                  rows={repairs}
                  setRows={setRepairs}
                  helpers={namedListHelpers}
                />

                <NamedLinesOnly
                  idPrefix="m-extra"
                  title="Extras"
                  hint="Other income lines with a name (e.g. commission, service)."
                  rows={extras}
                  setRows={setExtras}
                  helpers={namedListHelpers}
                />

                <section className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-[var(--lv-heading)]">POS</h3>
                  <p className="text-xs text-[var(--lv-muted-strong)]">
                    Card-terminal / POS turnover for the day (bank-acquired sales).
                  </p>
                  <MidnightField
                    id="pos-sale"
                    label="POS (card) sales"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={posSale}
                    onChange={(e) => clampInput(e.target.value, setPosSale)}
                  />
                </section>

                <NamedLinesOnly
                  idPrefix="m-exp-cash"
                  title="Cash expenses"
                  hint="Paid in cash — one line per payment. Use recognizable names (e.g. Ric. Wind, Mobilax) for supplier top-ups so Total expense can separate them from other costs."
                  rows={cashExpenses}
                  setRows={setCashExpenses}
                  helpers={namedListHelpers}
                  nameFieldLabel="Detail"
                />

                <NamedLinesOnly
                  idPrefix="m-exp-bank"
                  title="Bank expenses"
                  hint="Paid by card or bank — one line per charge. Same naming as cash for supplier top-ups (Ric. Wind, Ric. Shop, …)."
                  rows={bankExpenses}
                  setRows={setBankExpenses}
                  helpers={namedListHelpers}
                  nameFieldLabel="Detail"
                />

                <MidnightField
                  id="mobile-daily-notes"
                  label="Day notes"
                  rows={5}
                  value={mobileNotes}
                  onChange={(e) => setMobileNotes(e.target.value)}
                  disabled={saving}
                />
              </div>
            )}

            <PressableButton type="submit" className="min-h-12 w-full sm:w-auto sm:self-start" disabled={saving}>
              {saving ? "Saving..." : "Save entry"}
            </PressableButton>
          </form>
        ) : null}
    </GlassFormCard>
  );
}

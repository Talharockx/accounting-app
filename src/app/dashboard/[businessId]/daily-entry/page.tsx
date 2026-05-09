"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  SOURCE_MOBILE,
  SOURCE_RESTAURANT,
  buildMobileDailyRows,
  buildRestaurantDailyRows,
  getMetadata,
  metaString,
  mobileProfitFromTransactions,
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
import { GlassFormCard } from "@/components/ui/glass-form-card";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function summarizeRows(bt: BusinessType, rows: TxRecord[]) {
  if (bt === "restaurant") {
    const totals = restaurantProfitFromTransactions(rows);
    return {
      headline: totals.profit,
      details: {
        "Cash sales": formatCurrency(totals.cash),
        "Bank sales": formatCurrency(totals.bank),
        Purchases: formatCurrency(totals.purchases),
        Expenses: formatCurrency(totals.expenses),
        "Daily profit": formatCurrency(totals.profit),
      },
    };
  }

  const mobileTotals = mobileProfitFromTransactions(rows);
  return {
    headline: mobileTotals.profit,
    details: {
      "Phone sales (revenue)": formatCurrency(mobileTotals.phoneSales),
      "Phone profit (margin)": formatCurrency(mobileTotals.phoneProfit),
      "SIM sales": formatCurrency(mobileTotals.simSales),
      Repairs: formatCurrency(mobileTotals.repairs),
      Purchases: formatCurrency(mobileTotals.purchases),
      Expenses: formatCurrency(mobileTotals.expenses),
      "Daily profit": formatCurrency(mobileTotals.profit),
    },
  };
}

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

  const defaultPhoneRow = useMemo(() => ({ itemName: "", sellingPrice: "0", profit: "0" }), []);
  const [phones, setPhones] = useState([{ ...defaultPhoneRow }]);
  const [simVodafone, setSimVodafone] = useState("0");
  const [simWind, setSimWind] = useState("0");
  const [repairIncome, setRepairIncome] = useState("0");
  const [mobilePurchases, setMobilePurchases] = useState("0");
  const [mobileExpenses, setMobileExpenses] = useState("0");

  const [summary, setSummary] = useState<ReturnType<typeof summarizeRows> | null>(null);

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
            if (notes.trim().length) noteText = notes;
          }
        }
        setRestNotes(noteText);
        return;
      }

      const phoneRows = dayRows.filter((row) => {
        const meta = getMetadata(row.metadata, row.description);
        return (
          metaString(meta, "source") === SOURCE_MOBILE && metaString(meta, "line") === "mobile_phone_sale"
        );
      });

      if (phoneRows.length > 0) {
        const mapped = phoneRows.map((row, index) => {
          const meta = getMetadata(row.metadata, row.description);
          const name =
            typeof meta["item_name"] === "string" ? (meta["item_name"] as string) : `Phone ${index + 1}`;
          const profit = typeof meta["profit"] === "number" ? (meta["profit"] as number) : 0;
          return {
            itemName: name,
            sellingPrice: String(Number(row.amount) || 0),
            profit: String(Math.max(0, profit)),
          };
        });
        setPhones(mapped);
      } else {
        setPhones([{ ...defaultPhoneRow }]);
      }

      const simRow = dayRows.find((row) => metaString(getMetadata(row.metadata, row.description), "line") === "sim_sales");
      if (simRow) {
        const meta = getMetadata(simRow.metadata, simRow.description);
        const vod = typeof meta["vodafone"] === "number" ? String(meta["vodafone"]) : "0";
        const wind = typeof meta["wind"] === "number" ? String(meta["wind"]) : "0";
        setSimVodafone(vod);
        setSimWind(wind);
      } else {
        setSimVodafone("0");
        setSimWind("0");
      }

      let repairs = "0";
      dayRows.forEach((row) => {
        const meta = getMetadata(row.metadata, row.description);
        if (metaString(meta, "line") === "repair_income") {
          repairs = String(Number(row.amount) || 0);
        }
      });
      setRepairIncome(repairs);

      let purchases = "0";
      let expenses = "0";
      dayRows.forEach((row) => {
        const meta = getMetadata(row.metadata, row.description);
        const line = metaString(meta, "line");
        if (line === "mobile_purchases") purchases = String(Number(row.amount) || 0);
        if (line === "mobile_expenses") expenses = String(Number(row.amount) || 0);
      });
      setMobilePurchases(purchases);
      setMobileExpenses(expenses);
    },
    [defaultPhoneRow],
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
          setSummary(null);
          return;
        }

        const rows = (data ?? []) as TxRecord[];
        if (shouldHydrate) {
          hydrateForms(bt, rows, dateISO);
        }
        setSummary(summarizeRows(bt, rows));
      } catch (caught) {
        const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
        setError(msg);
        setSummary(null);
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
  }, [params, loadDay]);

  useEffect(() => {
    if (!businessId || loading) return;
    const id = window.setTimeout(() => void loadDay(businessId, entryDate, businessType, true), 0);
    return () => window.clearTimeout(id);
  }, [businessId, entryDate, businessType, loadDay, loading]);

  const addPhoneRow = () =>
    setPhones((prev) => [...prev, { itemName: "", sellingPrice: "0", profit: "0" }]);

  const updatePhoneRow = (index: number, field: keyof (typeof phones)[number], value: string) =>
    setPhones((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));

  const removePhoneRow = (index: number) =>
    setPhones((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));

  const clampInput = (value: string, setter: (next: string) => void) => {
    setter(String(Math.max(0, parseNonNegative(value))));
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
      const hasNotes = restNotes.trim().length > 0;
      if (!hasMoney && !hasNotes) {
        toast.error("Add at least one amount or a note before saving.");
        setSaving(false);
        return;
      }
    } else {
      const phonesPayload = phones
        .map((phone) => ({
          selling_price: parseNonNegative(phone.sellingPrice),
        }))
        .filter((phone) => phone.selling_price > 0);
      const simSum = parseNonNegative(simVodafone) + parseNonNegative(simWind);
      const repairs = parseNonNegative(repairIncome);
      const purch = parseNonNegative(mobilePurchases);
      const exp = parseNonNegative(mobileExpenses);
      if (
        phonesPayload.length === 0 &&
        simSum === 0 &&
        repairs === 0 &&
        purch === 0 &&
        exp === 0
      ) {
        toast.error("Add handset sales, SIM totals, repairs, purchases, or expenses before saving.");
        setSaving(false);
        return;
      }
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
        const phonesPayload = phones
          .map((phone) => ({
            item_name: phone.itemName,
            selling_price: parseNonNegative(phone.sellingPrice),
            profit: parseNonNegative(phone.profit),
          }))
          .filter((phone) => phone.selling_price > 0);

        const rows = buildMobileDailyRows({
          business_id: businessId,
          created_by_user_id: userId,
          transaction_date: entryDate,
          phones: phonesPayload,
          sim_vodafone: parseNonNegative(simVodafone),
          sim_wind: parseNonNegative(simWind),
          repair_income: parseNonNegative(repairIncome),
          purchases: parseNonNegative(mobilePurchases),
          expenses: parseNonNegative(mobileExpenses),
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
    <div className="space-y-6">
      <section className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--lv-heading)]">
              Daily summary ({entryDate || "pending"})
            </h2>
            <p className="mt-2 text-xs opacity-90 text-[var(--lv-muted-strong)]">
              Restaurant profit = combined sales − purchases − expenses. Mobile profit = handset margin
              + SIM sales + repairs − purchases − expenses.
            </p>
          </div>
          {summary ? (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--lv-accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--lv-accent)_10%,transparent)] px-4 py-3 text-right backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--lv-accent)]">Daily profit</p>
              <p className="text-3xl font-semibold text-[var(--lv-traffic-positive)]">
                {formatCurrency(summary.headline)}
              </p>
            </div>
          ) : null}
        </div>
        {summary ? (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(summary.details).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_70%,transparent)] px-4 py-3 backdrop-blur-sm"
              >
                <dt className="text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">{label}</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--lv-heading)]">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-[var(--lv-muted-strong)]">Loading summary…</p>
        )}
      </section>

      <GlassFormCard>
        <h1 className="text-2xl font-semibold text-[var(--lv-heading)]">
          Daily entry · {businessType === "restaurant" ? "Restaurant" : "Mobile shop"}
        </h1>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
          Amounts cannot be negative. Saving replaces Supabase rows for this business/date, then inserts the new bundle.
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
                <MidnightField id="notes" label="Notes" rows={4} value={restNotes} onChange={(event) => setRestNotes(event.target.value)} />
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Mobile phone sales</h3>
                    <p className="text-xs text-[var(--lv-muted-strong)]">
                      Add one row per handset with metadata-backed profit tracking.
                    </p>
                  </div>
                  <PressableButton type="button" variant="secondary" className="min-h-12 w-full shrink-0 sm:w-auto" onClick={addPhoneRow}>
                    Add phone
                  </PressableButton>
                </div>

                {phones.map((phone, index) => (
                  <div
                    key={`phone-${index}`}
                    className="rounded-2xl border border-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_55%,transparent)] p-4 backdrop-blur-md"
                  >
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">Phone {index + 1}</p>
                      <PressableButton
                        type="button"
                        variant="ghost"
                        className="min-h-12 w-full text-[var(--lv-traffic-critical)] sm:w-auto"
                        disabled={phones.length === 1}
                        onClick={() => removePhoneRow(index)}
                      >
                        Remove
                      </PressableButton>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <MidnightField
                        id={`phone-${index}-name`}
                        label="Item name"
                        type="text"
                        value={phone.itemName}
                        onChange={(event) => updatePhoneRow(index, "itemName", event.target.value)}
                      />
                      <MidnightField
                        id={`phone-${index}-price`}
                        label="Selling price"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={phone.sellingPrice}
                        onChange={(event) =>
                          updatePhoneRow(index, "sellingPrice", String(Math.max(0, parseNonNegative(event.target.value))))
                        }
                      />
                      <MidnightField
                        id={`phone-${index}-profit`}
                        label="Profit (per item)"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={phone.profit}
                        onChange={(event) =>
                          updatePhoneRow(index, "profit", String(Math.max(0, parseNonNegative(event.target.value))))
                        }
                      />
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { id: "vod", label: "SIM · Vodafone total", state: simVodafone, setter: setSimVodafone },
                    { id: "wnd", label: "SIM · Wind total", state: simWind, setter: setSimWind },
                  ].map((field) => (
                    <MidnightField
                      key={field.id}
                      id={field.id}
                      label={field.label}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={field.state}
                      onChange={(event) => clampInput(event.target.value, field.setter)}
                    />
                  ))}
                </div>

                {[
                  {
                    id: "repairs",
                    label: "Repair services income",
                    value: repairIncome,
                    setter: setRepairIncome,
                  },
                  {
                    id: "mpurchases",
                    label: "Purchases",
                    value: mobilePurchases,
                    setter: setMobilePurchases,
                  },
                  {
                    id: "mexpenses",
                    label: "Expenses",
                    value: mobileExpenses,
                    setter: setMobileExpenses,
                  },
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
              </div>
            )}

            <PressableButton type="submit" className="min-h-12 w-full sm:w-auto sm:self-start" disabled={saving}>
              {saving ? "Saving..." : "Save entry"}
            </PressableButton>
          </form>
        ) : null}
      </GlassFormCard>
    </div>
  );
}

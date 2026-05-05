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
    void loadDay(businessId, entryDate, businessType, true);
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

  const numberInputClass = "lv-input";

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-6 shadow-lg shadow-slate-900/8 dark:shadow-black/35">
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
            <div className="rounded-xl border border-blue-400/35 bg-blue-500/10 px-4 py-3 text-right dark:border-cyan-400/35 dark:bg-cyan-500/10">
              <p className="text-xs uppercase tracking-wide text-blue-800 dark:text-cyan-100">
                Daily profit
              </p>
              <p className="text-3xl font-semibold text-emerald-600 dark:text-emerald-300">
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
                className="rounded-xl border border-[var(--lv-border)] bg-[var(--lv-surface-muted)] px-4 py-3 dark:bg-slate-900/55"
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

      <section className="glass-panel rounded-2xl p-6 shadow-lg shadow-slate-900/8 dark:shadow-black/35">
        <h1 className="text-2xl font-semibold text-[var(--lv-heading)]">
          Daily entry · {businessType === "restaurant" ? "Restaurant" : "Mobile shop"}
        </h1>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
          Amounts cannot be negative. Saving replaces Supabase rows for this business/date, then inserts
          the new bundle.
        </p>

        {loading ? <p className="mt-6 text-sm text-[var(--lv-muted-strong)]">Loading business…</p> : null}
        {error ? (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        {!loading ? (
          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="entryDate" className="text-sm font-medium text-[var(--lv-heading)]">
                Entry date
              </label>
              <input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(event) => {
                  setEntryDate(event.target.value);
                }}
                className="w-full max-w-xs rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/70"
                required
              />
            </div>

            {businessType === "restaurant" ? (
              <div className="space-y-4">
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
                  <div key={field.id} className="space-y-2">
                    <label htmlFor={field.id} className="text-sm font-medium text-slate-200">
                      {field.label}
                    </label>
                    <input
                      id={field.id}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={field.value}
                      onChange={(event) => clampInput(event.target.value, field.setter)}
                      className={numberInputClass}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label htmlFor="notes" className="text-sm font-medium text-slate-200">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    value={restNotes}
                    onChange={(event) => setRestNotes(event.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/70"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Mobile phone sales</h3>
                    <p className="text-xs text-slate-400">Add one row per handset with metadata-backed profit tracking.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addPhoneRow}
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-white/10"
                  >
                    Add phone
                  </button>
                </div>

                {phones.map((phone, index) => (
                  <div key={`phone-${index}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Phone {index + 1}</p>
                      <button
                        type="button"
                        disabled={phones.length === 1}
                        onClick={() => removePhoneRow(index)}
                        className="text-xs font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm text-slate-200">Item name</label>
                        <input
                          type="text"
                          value={phone.itemName}
                          onChange={(event) =>
                            updatePhoneRow(index, "itemName", event.target.value)
                          }
                          className={numberInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-slate-200">Selling price</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={phone.sellingPrice}
                          onChange={(event) =>
                            updatePhoneRow(
                              index,
                              "sellingPrice",
                              String(Math.max(0, parseNonNegative(event.target.value))),
                            )
                          }
                          className={numberInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-slate-200">Profit (per item)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={phone.profit}
                          onChange={(event) =>
                            updatePhoneRow(
                              index,
                              "profit",
                              String(Math.max(0, parseNonNegative(event.target.value))),
                            )
                          }
                          className={numberInputClass}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { id: "vod", label: "SIM · Vodafone total", state: simVodafone, setter: setSimVodafone },
                    { id: "wnd", label: "SIM · Wind total", state: simWind, setter: setSimWind },
                  ].map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label htmlFor={field.id} className="text-sm font-medium text-slate-200">
                        {field.label}
                      </label>
                      <input
                        id={field.id}
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.state}
                        onChange={(event) => clampInput(event.target.value, field.setter)}
                        className={numberInputClass}
                      />
                    </div>
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
                  <div key={field.id} className="space-y-2">
                    <label htmlFor={field.id} className="text-sm font-medium text-slate-200">
                      {field.label}
                    </label>
                    <input
                      id={field.id}
                      type="number"
                      min={0}
                      step="0.01"
                      value={field.value}
                      onChange={(event) => clampInput(event.target.value, field.setter)}
                      className={numberInputClass}
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save entry"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

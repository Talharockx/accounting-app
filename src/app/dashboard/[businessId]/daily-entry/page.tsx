"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildMobileDailyRows,
  getMetadata,
  mergeSaleBuyNamedLines,
  merchFormStringsToSaleBuy,
  metaString,
  parseMobileDailyFromTransactions,
  parseNonNegative,
  sanitizeNonNegativeDecimalInput,
  formatMoneyInputValue,
} from "@/lib/dashboard/daily-entry";
import {
  buildRestaurantDailyRows,
  emptyCompanySaleRow,
  emptySpesaCompanyRow,
  hydrateCompanySaleRows,
  hydrateSpesaCompanyRows,
  parseRestaurantDailyFromTransactions,
  restaurantCompanySalesFromForm,
  restaurantCompanySpesaFromForm,
  restaurantDayHasContent,
  restaurantNamedLinesFromForm,
  restaurantProfitFromTransactions,
} from "@/lib/dashboard/restaurant-daily-entry";
import {
  insertTransactionsWithMetadataFallback,
  selectWithMetadataColumnFallback,
} from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { getTodayLocalISO } from "@/lib/utils/date-range";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import { mapTransactionRows } from "@/lib/supabase/map-transactions";
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
import {
  ChequesBlock,
  PersonSalesBlock,
  emptyCheque,
  emptyPersonSale,
  useChequeListHelpers,
  usePersonSaleListHelpers,
  type ChequeRowStr,
  type PersonSaleRowStr,
} from "@/components/dashboard/grocery-shop-fields";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { businessTypeLabel, type BusinessType } from "@/lib/business-types";
import {
  buildGroceryDailyRows,
  emptyCompanyExpenseRows,
  groceryBankExpenseAmount,
  groceryCashExpenseAmount,
  groceryChequesFromForm,
  groceryNamedLinesFromForm,
  groceryPersonSalesFromForm,
  groceryProfitFromTransactions,
  hydrateCompanyExpenseRows,
  parseGroceryDailyFromTransactions,
} from "@/lib/dashboard/grocery-daily-entry";
import { buildMobileTransactionLedgerRow } from "@/lib/dashboard/mobile-transaction-ledger";
import {
  RestaurantDailyEntryFields,
  useCompanySaleListHelpers,
  useSpesaCompanyListHelpers,
} from "@/components/dashboard/restaurant-shop-fields";
import { isBlankNote } from "@/lib/utils/rich-text";

type BusinessRow = {
  id: string;
  business_type: BusinessType;
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

  const [restCash, setRestCash] = useState("");
  const [restBank, setRestBank] = useState("");
  const [restCompanySales, setRestCompanySales] = useState([emptyCompanySaleRow()]);
  const [restCompanySpesa, setRestCompanySpesa] = useState([emptySpesaCompanyRow()]);
  const [restOtherSpesa, setRestOtherSpesa] = useState<NamedRowStr[]>([emptyNamed()]);
  const [restNotes, setRestNotes] = useState("");

  const [simBuy, setSimBuy] = useState("");
  const [simSale, setSimSale] = useState("");
  const [mobileMerch, setMobileMerch] = useState<MerchRowStr[]>([emptyMerch()]);
  const [accessoryMerch, setAccessoryMerch] = useState<MerchRowStr[]>([emptyMerch()]);
  const [packageRWind, setPackageRWind] = useState("");
  const [packageRVoda, setPackageRVoda] = useState("");
  const [repairs, setRepairs] = useState<NamedRowStr[]>([emptyNamed()]);
  const [extras, setExtras] = useState<NamedRowStr[]>([emptyNamed()]);
  const [posSale, setPosSale] = useState("");
  const [mobileNotes, setMobileNotes] = useState("");
  const [cashExpenses, setCashExpenses] = useState<NamedRowStr[]>([emptyNamed()]);
  const [bankExpenses, setBankExpenses] = useState<NamedRowStr[]>([emptyNamed()]);

  const [groceryBank, setGroceryBank] = useState("");
  const [groceryCash, setGroceryCash] = useState("");
  const [personSales, setPersonSales] = useState<PersonSaleRowStr[]>([emptyPersonSale()]);
  const [companyExpenses, setCompanyExpenses] = useState<NamedRowStr[]>(emptyCompanyExpenseRows());
  const [cheques, setCheques] = useState<ChequeRowStr[]>([emptyCheque()]);
  const [groceryBankExpense, setGroceryBankExpense] = useState("");
  const [groceryCashExpense, setGroceryCashExpense] = useState("");
  const [groceryNotes, setGroceryNotes] = useState("");

  const applyRestaurantDraftStrings = useCallback(
    (draft: ReturnType<typeof parseRestaurantDailyFromTransactions>) => {
      setRestBank(formatMoneyInputValue(draft.bank_sales));
      setRestCash(formatMoneyInputValue(draft.cash_sales));
      setRestCompanySales(hydrateCompanySaleRows(draft.company_sales));
      setRestCompanySpesa(hydrateSpesaCompanyRows(draft.company_spesa));
      setRestOtherSpesa(
        draft.other_spesa.length
          ? draft.other_spesa.map((r) => ({
              itemName: r.item_name,
              amount: formatMoneyInputValue(r.amount),
            }))
          : [emptyNamed()],
      );
      setCashExpenses(
        draft.cash_expenses.length
          ? draft.cash_expenses.map((r) => ({
              itemName: r.item_name,
              amount: formatMoneyInputValue(r.amount),
            }))
          : [emptyNamed()],
      );
      setBankExpenses(
        draft.bank_expenses.length
          ? draft.bank_expenses.map((r) => ({
              itemName: r.item_name,
              amount: formatMoneyInputValue(r.amount),
            }))
          : [emptyNamed()],
      );
      setRestNotes(draft.notes ?? "");
    },
    [],
  );

  const applyMobileDraftStrings = useCallback((draft: ReturnType<typeof parseMobileDailyFromTransactions>) => {
    setSimBuy(formatMoneyInputValue(draft.sim_buy));
    setSimSale(formatMoneyInputValue(draft.sim_sale));
    setMobileMerch(
      mergeSaleBuyNamedLines(draft.mobile_sales, draft.mobile_buys).map((r) => ({
        itemName: r.item_name,
        retail: formatMoneyInputValue(r.retail),
        buy: formatMoneyInputValue(r.buy),
      })),
    );
    setAccessoryMerch(
      mergeSaleBuyNamedLines(draft.accessory_sales, draft.accessory_buys).map((r) => ({
        itemName: r.item_name,
        retail: formatMoneyInputValue(r.retail),
        buy: formatMoneyInputValue(r.buy),
      })),
    );
    setPackageRWind(formatMoneyInputValue(draft.package_r_wind));
    setPackageRVoda(formatMoneyInputValue(draft.package_r_voda));
    setRepairs(
      draft.repairs.map((r) => ({
        itemName: r.item_name,
        amount: formatMoneyInputValue(r.amount),
      })),
    );
    setExtras(
      draft.extras.map((r) => ({
        itemName: r.item_name,
        amount: formatMoneyInputValue(r.amount),
      })),
    );
    setPosSale(formatMoneyInputValue(draft.pos_sale));
    setMobileNotes(draft.notes ?? "");
    setCashExpenses(
      draft.cash_expenses.map((r) => ({
        itemName: r.item_name,
        amount: formatMoneyInputValue(r.amount),
      })),
    );
    setBankExpenses(
      draft.bank_expenses.map((r) => ({
        itemName: r.item_name,
        amount: formatMoneyInputValue(r.amount),
      })),
    );
  }, []);

  const applyGroceryDraftStrings = useCallback(
    (draft: ReturnType<typeof parseGroceryDailyFromTransactions>) => {
      setGroceryBank(formatMoneyInputValue(draft.bank_sales));
      setGroceryCash(formatMoneyInputValue(draft.cash_sales));
      setPersonSales(
        draft.person_sales.map((r) => ({
          itemName: r.item_name,
          bank: formatMoneyInputValue(r.bank),
          cash: formatMoneyInputValue(r.cash),
        })),
      );
      setCompanyExpenses(
        hydrateCompanyExpenseRows([
          ...draft.company_expenses,
          ...draft.person_expenses,
          ...draft.kametti_expenses,
        ]),
      );
      setCheques(
        draft.cheques.map((r) => ({
          itemName: r.item_name,
          amount: formatMoneyInputValue(r.amount),
          dueDate: r.due_date,
          paid: r.paid,
        })),
      );
      setGroceryBankExpense(formatMoneyInputValue(groceryBankExpenseAmount(draft.fixed_expenses)));
      setGroceryCashExpense(formatMoneyInputValue(groceryCashExpenseAmount(draft.fixed_expenses)));
      setGroceryNotes(draft.notes ?? "");
    },
    [],
  );

  const hydrateForms = useCallback(
    (bt: BusinessType, rows: ReturnType<typeof mapTransactionRows>, dateISO: string) => {
      const dayRows = rows.filter((row) => row.transaction_date === dateISO);

      if (bt === "restaurant") {
        const draft = parseRestaurantDailyFromTransactions(dayRows, dateISO);
        applyRestaurantDraftStrings(draft);
        return;
      }

      if (bt === "grocery") {
        const draft = parseGroceryDailyFromTransactions(dayRows, dateISO);
        applyGroceryDraftStrings(draft);
        return;
      }

      const draft = parseMobileDailyFromTransactions(dayRows, dateISO);
      applyMobileDraftStrings(draft);
    },
    [applyMobileDraftStrings, applyGroceryDraftStrings, applyRestaurantDraftStrings],
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

        const rows = mapTransactionRows(data ?? []);
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
    const next = sanitizeNonNegativeDecimalInput(value);
    if (next !== null) setter(next);
  };

  const namedListHelpers = useNamedListHelpers();
  const merchListHelpers = useMerchListHelpers();
  const personSaleHelpers = usePersonSaleListHelpers();
  const chequeHelpers = useChequeListHelpers();
  const companySaleHelpers = useCompanySaleListHelpers();
  const spesaCompanyHelpers = useSpesaCompanyListHelpers();

  const previewMetaRows = (rows: ReturnType<typeof buildRestaurantDailyRows>) =>
    rows.map((row) => ({
      amount: row.amount,
      transaction_type: row.transaction_type,
      description: row.description,
      transaction_date: row.transaction_date,
      metadata: row.metadata,
    }));

  /** Live last balance for the selected entry date from current form values. */
  const dayLastBalance = useMemo(() => {
    const bid = businessId || "preview";
    const uid = userId || "preview";

    if (businessType === "grocery") {
      const bankExpenseAmt = parseNonNegative(groceryBankExpense);
      const cashExpenseAmt = parseNonNegative(groceryCashExpense);
      const fixed_expenses: { category: "bank_expense" | "cash_expense"; amount: number }[] = [];
      if (cashExpenseAmt > 0) fixed_expenses.push({ category: "cash_expense", amount: cashExpenseAmt });
      if (bankExpenseAmt > 0) fixed_expenses.push({ category: "bank_expense", amount: bankExpenseAmt });
      const t = groceryProfitFromTransactions(
        previewMetaRows(
          buildGroceryDailyRows({
            business_id: bid,
            created_by_user_id: uid,
            transaction_date: entryDate,
            bank_sales: parseNonNegative(groceryBank),
            cash_sales: parseNonNegative(groceryCash),
            person_sales: groceryPersonSalesFromForm(personSales),
            company_expenses: groceryNamedLinesFromForm(companyExpenses),
            person_expenses: [],
            kametti_expenses: [],
            cheques: groceryChequesFromForm(cheques),
            fixed_expenses,
            notes: groceryNotes,
          }),
        ),
      );
      return {
        totalSale: t.totalSale,
        totalExpense: t.spesaTotal,
        lastBalance: t.totalSale - t.spesaTotal,
      };
    }

    if (businessType === "restaurant") {
      const t = restaurantProfitFromTransactions(
        previewMetaRows(
          buildRestaurantDailyRows({
            business_id: bid,
            created_by_user_id: uid,
            transaction_date: entryDate,
            bank_sales: parseNonNegative(restBank),
            cash_sales: parseNonNegative(restCash),
            company_sales: restaurantCompanySalesFromForm(restCompanySales),
            company_spesa: restaurantCompanySpesaFromForm(restCompanySpesa),
            other_spesa: restaurantNamedLinesFromForm(restOtherSpesa),
            rent: 0,
            person_purchases: [],
            cash_expenses: restaurantNamedLinesFromForm(cashExpenses),
            bank_expenses: restaurantNamedLinesFromForm(bankExpenses),
            notes: restNotes,
          }),
        ),
      );
      return {
        totalSale: t.totalSale,
        totalExpense: t.totalSpesa,
        lastBalance: t.totalSale - t.totalSpesa,
      };
    }

    const toLines = (list: NamedRowStr[]) =>
      list
        .map((r) => ({
          item_name: r.itemName,
          amount: parseNonNegative(r.amount),
        }))
        .filter((r) => r.amount > 0);
    const { sales: mobile_sales, buys: mobile_buys } = merchFormStringsToSaleBuy(mobileMerch);
    const { sales: accessory_sales, buys: accessory_buys } = merchFormStringsToSaleBuy(accessoryMerch);
    const ledger = buildMobileTransactionLedgerRow(
      previewMetaRows(
        buildMobileDailyRows({
          business_id: bid,
          created_by_user_id: uid,
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
        }),
      ),
      entryDate,
    );
    const totalExpense = ledger.cashExpense + ledger.bankExpense;
    return {
      totalSale: ledger.totalSale,
      totalExpense,
      lastBalance: ledger.totalSale - totalExpense,
    };
  }, [
    businessId,
    userId,
    businessType,
    entryDate,
    groceryBank,
    groceryCash,
    groceryBankExpense,
    groceryCashExpense,
    personSales,
    companyExpenses,
    cheques,
    groceryNotes,
    restBank,
    restCash,
    restCompanySales,
    restCompanySpesa,
    restOtherSpesa,
    restNotes,
    cashExpenses,
    bankExpenses,
    simBuy,
    simSale,
    mobileMerch,
    accessoryMerch,
    packageRWind,
    packageRVoda,
    repairs,
    extras,
    posSale,
    mobileNotes,
  ]);

  const restaurantEntryHasContent = () => {
    const draft = {
      bank_sales: parseNonNegative(restBank),
      cash_sales: parseNonNegative(restCash),
      company_sales: restaurantCompanySalesFromForm(restCompanySales),
      company_spesa: restaurantCompanySpesaFromForm(restCompanySpesa),
      other_spesa: restaurantNamedLinesFromForm(restOtherSpesa),
      rent: 0,
      person_purchases: [],
      cash_expenses: restaurantNamedLinesFromForm(cashExpenses),
      bank_expenses: restaurantNamedLinesFromForm(bankExpenses),
      notes: restNotes,
    };
    const previewRows = buildRestaurantDailyRows({
      business_id: businessId || "preview",
      created_by_user_id: userId || "preview",
      transaction_date: entryDate,
      ...draft,
    }).map((row) => ({
      amount: row.amount,
      transaction_type: row.transaction_type,
      description: row.description,
      transaction_date: row.transaction_date,
      metadata: row.metadata,
    }));
    return restaurantDayHasContent(previewRows) || !isBlankNote(restNotes);
  };
  const groceryEntryHasContent = () => {
    const bankExpenseAmt = parseNonNegative(groceryBankExpense);
    const cashExpenseAmt = parseNonNegative(groceryCashExpense);
    const fixed_expenses: { category: "bank_expense" | "cash_expense"; amount: number }[] = [];
    if (cashExpenseAmt > 0) fixed_expenses.push({ category: "cash_expense", amount: cashExpenseAmt });
    if (bankExpenseAmt > 0) fixed_expenses.push({ category: "bank_expense", amount: bankExpenseAmt });
    const draft = {
      bank_sales: parseNonNegative(groceryBank),
      cash_sales: parseNonNegative(groceryCash),
      person_sales: groceryPersonSalesFromForm(personSales),
      company_expenses: groceryNamedLinesFromForm(companyExpenses),
      person_expenses: [],
      kametti_expenses: [],
      cheques: groceryChequesFromForm(cheques),
      fixed_expenses,
      notes: groceryNotes,
    };
    const totals = groceryProfitFromTransactions(
      buildGroceryDailyRows({
        business_id: businessId || "preview",
        created_by_user_id: userId || "preview",
        transaction_date: entryDate,
        ...draft,
      }).map((row) => ({
        amount: row.amount,
        transaction_type: row.transaction_type,
        description: row.description,
        transaction_date: row.transaction_date,
        metadata: row.metadata,
      })),
    );
    return (
      totals.totalSale +
        totals.spesaTotal +
        parseNonNegative(groceryBank) +
        parseNonNegative(groceryCash) >
        0 || !isBlankNote(groceryNotes)
    );
  };

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
      if (!restaurantEntryHasContent()) {
        toast.error("Add at least one amount or a note before saving.");
        setSaving(false);
        return;
      }
    } else if (businessType === "grocery") {
      if (!groceryEntryHasContent()) {
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
          bank_sales: parseNonNegative(restBank),
          cash_sales: parseNonNegative(restCash),
          company_sales: restaurantCompanySalesFromForm(restCompanySales),
          company_spesa: restaurantCompanySpesaFromForm(restCompanySpesa),
          other_spesa: restaurantNamedLinesFromForm(restOtherSpesa),
          rent: 0,
          person_purchases: [],
          cash_expenses: restaurantNamedLinesFromForm(cashExpenses),
          bank_expenses: restaurantNamedLinesFromForm(bankExpenses),
          notes: restNotes,
        });

        if (rows.length) {
          const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, rows);
          if (insertError) throw insertError;
        }
      } else if (businessType === "grocery") {
        const bankExpenseAmt = parseNonNegative(groceryBankExpense);
        const cashExpenseAmt = parseNonNegative(groceryCashExpense);
        const fixed_expenses: { category: "bank_expense" | "cash_expense"; amount: number }[] = [];
        if (cashExpenseAmt > 0) fixed_expenses.push({ category: "cash_expense", amount: cashExpenseAmt });
        if (bankExpenseAmt > 0) fixed_expenses.push({ category: "bank_expense", amount: bankExpenseAmt });
        const rows = buildGroceryDailyRows({
          business_id: businessId,
          created_by_user_id: userId,
          transaction_date: entryDate,
          bank_sales: parseNonNegative(groceryBank),
          cash_sales: parseNonNegative(groceryCash),
          person_sales: groceryPersonSalesFromForm(personSales),
          company_expenses: groceryNamedLinesFromForm(companyExpenses),
          person_expenses: [],
          kametti_expenses: [],
          cheques: groceryChequesFromForm(cheques),
          fixed_expenses,
          notes: groceryNotes,
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
        `${businessTypeLabel(businessType)} daily entry saved successfully.`,
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
          Daily entry · {businessTypeLabel(businessType)}
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

            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--lv-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--lv-accent)_8%,transparent)] px-4 py-4 sm:px-5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--lv-muted-strong)]">
                Last balance · this date
              </p>
              <p className="mt-1 text-xs text-[var(--lv-muted-strong)]">
                Total sale − total expense for {entryDate}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-[var(--lv-muted-strong)]">Total sale</p>
                  <p className="lv-tabular-mono mt-1 text-base font-semibold text-[var(--lv-heading)]">
                    {formatCurrency(dayLastBalance.totalSale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--lv-muted-strong)]">Total expense</p>
                  <p className="lv-tabular-mono mt-1 text-base font-semibold text-[var(--lv-heading)]">
                    {formatCurrency(dayLastBalance.totalExpense)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--lv-muted-strong)]">Last balance</p>
                  <p
                    className={cn(
                      "lv-tabular-mono mt-1 text-lg font-bold",
                      dayLastBalance.lastBalance > 0 && "text-[var(--lv-traffic-positive)]",
                      dayLastBalance.lastBalance < 0 && "text-[var(--lv-traffic-critical)]",
                      dayLastBalance.lastBalance === 0 && "text-[var(--lv-heading)]",
                    )}
                  >
                    {formatCurrency(dayLastBalance.lastBalance)}
                  </p>
                </div>
              </div>
            </div>

            {businessType === "grocery" ? (
              <div className="flex flex-col gap-8">
                <section className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-[var(--lv-heading)]">Shop sales</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MidnightField
                      id="grocery-bank"
                      label="Bank sale"
                      type="text"
                      inputMode="decimal"
                      value={groceryBank}
                      onChange={(e) => clampInput(e.target.value, setGroceryBank)}
                    />
                    <MidnightField
                      id="grocery-cash"
                      label="Cash sale"
                      type="text"
                      inputMode="decimal"
                      value={groceryCash}
                      onChange={(e) => clampInput(e.target.value, setGroceryCash)}
                    />
                  </div>
                </section>

                <PersonSalesBlock
                  idPrefix="g-person-sale"
                  rows={personSales}
                  setRows={setPersonSales}
                  helpers={personSaleHelpers}
                />

                <NamedLinesOnly
                  idPrefix="g-expense"
                  title="Expenses"
                  hint="Company name and expense amount — add as many lines as needed."
                  nameFieldLabel="Company name"
                  rows={companyExpenses}
                  setRows={setCompanyExpenses}
                  helpers={namedListHelpers}
                />

                <MidnightField
                  id="grocery-cash-expense"
                  label="Cash expense"
                  type="text"
                  inputMode="decimal"
                  value={groceryCashExpense}
                  onChange={(e) => clampInput(e.target.value, setGroceryCashExpense)}
                />

                <MidnightField
                  id="grocery-bank-expense"
                  label="Bank expense"
                  type="text"
                  inputMode="decimal"
                  value={groceryBankExpense}
                  onChange={(e) => clampInput(e.target.value, setGroceryBankExpense)}
                />

                <ChequesBlock idPrefix="g-cheque" rows={cheques} setRows={setCheques} helpers={chequeHelpers} />

                <MidnightField
                  id="grocery-notes"
                  label="Day notes"
                  rows={5}
                  value={groceryNotes}
                  onChange={(event) => setGroceryNotes(event.target.value)}
                  disabled={saving}
                />
              </div>
            ) : businessType === "restaurant" ? (
              <RestaurantDailyEntryFields
                idPrefix="rest-daily"
                bank={restBank}
                onBankChange={setRestBank}
                cash={restCash}
                onCashChange={setRestCash}
                companySales={restCompanySales}
                setCompanySales={setRestCompanySales}
                companySaleHelpers={companySaleHelpers}
                companySpesa={restCompanySpesa}
                setCompanySpesa={setRestCompanySpesa}
                spesaCompanyHelpers={spesaCompanyHelpers}
                otherSpesa={restOtherSpesa}
                setOtherSpesa={setRestOtherSpesa}
                cashExpenses={cashExpenses}
                setCashExpenses={setCashExpenses}
                bankExpenses={bankExpenses}
                setBankExpenses={setBankExpenses}
                namedHelpers={namedListHelpers}
                notes={restNotes}
                onNotesChange={setRestNotes}
                saving={saving}
              />
            ) : (
              <div className="flex flex-col gap-8">
                <section className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-[var(--lv-heading)]">SIM</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MidnightField
                      id="sim-sale"
                      label="SIM sale (retail)"
                      type="text"
                      inputMode="decimal"
                      value={simSale}
                      onChange={(e) => clampInput(e.target.value, setSimSale)}
                    />
                    <MidnightField
                      id="sim-buy"
                      label="SIM buy (shop cost)"
                      type="text"
                      inputMode="decimal"
                      value={simBuy}
                      onChange={(e) => clampInput(e.target.value, setSimBuy)}
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
                      type="text"
                      inputMode="decimal"
                      value={packageRWind}
                      onChange={(e) => clampInput(e.target.value, setPackageRWind)}
                    />
                    <MidnightField
                      id="pkg-voda"
                      label="R.Voda"
                      type="text"
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
                    type="text"
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

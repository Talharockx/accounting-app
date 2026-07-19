"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BusinessesNav } from "@/components/dashboard/businesses-nav";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeNonNegativeDecimalInput } from "@/lib/dashboard/daily-entry";
import {
  buildNotebookPlusKhataInsert,
  buildNotebookPlusRowInsert,
  closingBalanceForRows,
  collectNotebookPlusKhatas,
  collectNotebookPlusRows,
  DESC_NOTEBOOK_PLUS,
  DESC_NOTEBOOK_PLUS_KHATA,
  formatLedgerMoney,
  formatMoneyOrBlank,
  newNotebookPlusKhataId,
  notebookPlusRowMetadataPatch,
  openingBalanceBefore,
  parseLedgerMoneyInput,
  rowsInRange,
  withRunningBalances,
  type NotebookPlusKhata,
  type NotebookPlusRow,
  type NotebookPlusRowWithBalance,
} from "@/lib/dashboard/notebook-plus";
import { ensureNotebookPlusWorkspaceId } from "@/lib/dashboard/notebook-plus-workspace";
import {
  insertTransactionsWithMetadataFallback,
  selectWithMetadataColumnFallback,
  updateTransactionWithMetadataFallback,
} from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { downloadLedgerNotebookPdf } from "@/lib/reports/ledger-notebook-pdf";
import { mapTransactionListRows } from "@/lib/supabase/map-transactions";
import {
  getMonthBoundariesISO,
  getTodayLocalISO,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";
import { cn } from "@/lib/utils/cn";
import { supabase } from "@/lib/supabaseClient";

function formatHeadingDate(iso: string): string {
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

export default function NotebookPlusPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("");
  const [userId, setUserId] = useState("");
  const [bizLoading, setBizLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  const [khatas, setKhatas] = useState<NotebookPlusKhata[]>([]);
  const [selectedKhataId, setSelectedKhataId] = useState<string | null>(null);
  const [newKhataName, setNewKhataName] = useState("");
  const [allRows, setAllRows] = useState<NotebookPlusRow[]>([]);

  const [monthInput, setMonthInput] = useState(() =>
    toMonthInputValue(new Date().getFullYear(), new Date().getMonth()),
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowDate, setRowDate] = useState(() => getTodayLocalISO());
  const [rowAmount, setRowAmount] = useState("");
  const [rowPaid, setRowPaid] = useState("");
  const [rowDetails, setRowDetails] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let uid = session?.user?.id ?? "";
        if (!uid) {
          const { data: authData } = await supabase.auth.getUser();
          uid = authData.user?.id ?? "";
        }
        if (!uid) {
          router.replace("/login");
          return;
        }
        if (cancelled) return;
        setUserId(uid);

        const { businessId: workspaceId, error: workspaceError } =
          await ensureNotebookPlusWorkspaceId(supabase, uid);
        if (cancelled) return;
        if (workspaceError || !workspaceId) {
          setError(getUserFriendlyError(workspaceError ?? new Error("Notebook+ unavailable.")));
          return;
        }
        setBusinessId(workspaceId);
      } catch (caught) {
        if (!cancelled) {
          setError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
          router.replace("/login");
        }
      } finally {
        if (!cancelled) setBizLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const parsedMonth = useMemo(() => parseMonthInputValue(monthInput), [monthInput]);

  const monthRange = useMemo(() => {
    if (!parsedMonth) return null;
    return getMonthBoundariesISO(parsedMonth.year, parsedMonth.monthIndex);
  }, [parsedMonth]);

  const selectedKhata = useMemo(
    () => khatas.find((k) => k.id === selectedKhataId) ?? null,
    [khatas, selectedKhataId],
  );

  const loadNotebookPlus = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError("");
    const notesOr = `description.like.${DESC_NOTEBOOK_PLUS}%,description.like.${DESC_NOTEBOOK_PLUS_KHATA}%`;
    try {
      const endCap = monthRange?.end ?? getTodayLocalISO();
      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .lte("transaction_date", endCap)
            .or(notesOr)
            .order("transaction_date", { ascending: true })
            .limit(5000),
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .lte("transaction_date", endCap)
            .or(notesOr)
            .order("transaction_date", { ascending: true })
            .limit(5000),
      );

      if (fetchError) {
        setError(getUserFriendlyError(new Error(fetchError.message)));
        setKhatas([]);
        setAllRows([]);
        return;
      }

      const mapped = mapTransactionListRows(data ?? []);
      const nextKhatas = collectNotebookPlusKhatas(mapped);
      setKhatas(nextKhatas);

      if (selectedKhataId) {
        setAllRows(collectNotebookPlusRows(mapped, selectedKhataId));
        if (!nextKhatas.some((k) => k.id === selectedKhataId)) {
          setSelectedKhataId(null);
          setAllRows([]);
        }
      } else {
        setAllRows([]);
      }
    } catch (caught) {
      setError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      setKhatas([]);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, monthRange, selectedKhataId]);

  useEffect(() => {
    if (!businessId) return;
    const id = window.setTimeout(() => void loadNotebookPlus(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, loadNotebookPlus]);

  const listBalances = useMemo(() => {
    const map: Record<string, number> = {};
    // Balances are filled after a full reload when on the list — approximate from current allRows only for selected.
    for (const k of khatas) {
      map[k.id] = 0;
    }
    return map;
  }, [khatas]);

  const [khataBalances, setKhataBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!businessId || selectedKhataId) return;
    let cancelled = false;
    (async () => {
      const notesOr = `description.like.${DESC_NOTEBOOK_PLUS}%,description.like.${DESC_NOTEBOOK_PLUS_KHATA}%`;
      const { data } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .or(notesOr)
            .limit(5000),
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .or(notesOr)
            .limit(5000),
      );
      if (cancelled) return;
      const mapped = mapTransactionListRows(data ?? []);
      const next: Record<string, number> = {};
      for (const k of collectNotebookPlusKhatas(mapped)) {
        next[k.id] = closingBalanceForRows(collectNotebookPlusRows(mapped, k.id));
      }
      setKhataBalances(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, selectedKhataId, khatas.length]);

  const opening = useMemo(() => {
    if (!monthRange) return 0;
    return openingBalanceBefore(allRows, monthRange.start);
  }, [allRows, monthRange]);

  const monthRows: NotebookPlusRowWithBalance[] = useMemo(() => {
    if (!monthRange) return [];
    const inMonth = rowsInRange(allRows, monthRange.start, monthRange.end);
    return withRunningBalances(inMonth, opening);
  }, [allRows, monthRange, opening]);

  const periodTitle = useMemo(() => {
    if (!parsedMonth) return "";
    return calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex);
  }, [parsedMonth]);

  const todayISO = getTodayLocalISO();
  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());

  const resetForm = () => {
    setEditingId(null);
    setRowDate(getTodayLocalISO());
    setRowAmount("");
    setRowPaid("");
    setRowDetails("");
  };

  const openKhata = (id: string) => {
    resetForm();
    setSelectedKhataId(id);
  };

  const backToKhatas = () => {
    resetForm();
    setSelectedKhataId(null);
    setAllRows([]);
  };

  const handleCreateKhata = async (event: FormEvent) => {
    event.preventDefault();
    if (!businessId || !userId) {
      toast.error("Sign in again to create a Notebook+ khata.");
      return;
    }
    const name = newKhataName.trim();
    if (!name) {
      toast.error("Enter a khata name.");
      return;
    }
    if (khatas.some((k) => k.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A khata with that name already exists.");
      return;
    }

    setSaving(true);
    try {
      const khataId = newNotebookPlusKhataId();
      const row = buildNotebookPlusKhataInsert({
        business_id: businessId,
        created_by_user_id: userId,
        khata_id: khataId,
        name,
      });
      const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, [row]);
      if (insertError) throw insertError;
      setNewKhataName("");
      toast.success(`Khata “${name}” created.`);
      setSelectedKhataId(khataId);
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKhata = async (khata: NotebookPlusKhata) => {
    if (!businessId) return;
    if (
      !window.confirm(
        `Delete khata “${khata.name}” and all its Notebook+ rows? This cannot be undone.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const notesOr = `description.like.${DESC_NOTEBOOK_PLUS}%,description.like.${DESC_NOTEBOOK_PLUS_KHATA}%`;
      const { data } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .or(notesOr)
            .limit(5000),
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .or(notesOr)
            .limit(5000),
      );
      const mapped = mapTransactionListRows(data ?? []);
      const rowIds = collectNotebookPlusRows(mapped, khata.id)
        .map((r) => r.id)
        .filter(Boolean);
      const registryId =
        khata.registryId ||
        collectNotebookPlusKhatas(mapped).find((k) => k.id === khata.id)?.registryId;
      const ids = [...rowIds];
      if (registryId) ids.push(registryId);

      if (ids.length) {
        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .eq("business_id", businessId)
          .in("id", ids);
        if (deleteError) throw new Error(deleteError.message);
      }

      toast.success(`Khata “${khata.name}” deleted.`);
      if (selectedKhataId === khata.id) backToKhatas();
      await loadNotebookPlus();
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: NotebookPlusRowWithBalance) => {
    setEditingId(row.id);
    setRowDate(row.date);
    setRowAmount(row.amount > 0 ? String(row.amount) : "");
    setRowPaid(row.paid > 0 ? String(row.paid) : "");
    setRowDetails(row.details);
  };

  const handleSubmitRow = async (event: FormEvent) => {
    event.preventDefault();
    if (!businessId || !userId || !selectedKhataId) {
      toast.error("Sign in again to save Notebook+ rows.");
      return;
    }
    const amount = parseLedgerMoneyInput(rowAmount);
    const paid = parseLedgerMoneyInput(rowPaid);
    const details = rowDetails.trim();
    if (amount <= 0 && paid <= 0 && !details) {
      toast.error("Enter amount, paid, or details.");
      return;
    }

    setSaving(true);
    try {
      const sortIndex = editingId
        ? (allRows.find((r) => r.id === editingId)?.sortIndex ?? Date.now())
        : Date.now();

      if (editingId) {
        const { error: updateError } = await updateTransactionWithMetadataFallback(
          supabase,
          editingId,
          businessId,
          {
            transaction_date: rowDate,
            amount: 0,
            description: details
              ? `${DESC_NOTEBOOK_PLUS}: ${details.slice(0, 80)}`
              : DESC_NOTEBOOK_PLUS,
            metadata: notebookPlusRowMetadataPatch({
              khata_id: selectedKhataId,
              amount,
              paid,
              details,
              sortIndex,
            }),
          },
        );
        if (updateError) throw updateError;
        toast.success("Notebook+ row updated.");
      } else {
        const insert = buildNotebookPlusRowInsert({
          business_id: businessId,
          created_by_user_id: userId,
          khata_id: selectedKhataId,
          date: rowDate,
          amount,
          paid,
          details,
          sortIndex,
        });
        const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, [
          insert,
        ]);
        if (insertError) throw insertError;
        toast.success("Notebook+ row saved.");
      }

      const savedDate = rowDate;
      resetForm();
      const [y, m] = savedDate.split("-");
      if (y && m) {
        const nextMonth = `${y}-${m}`;
        if (nextMonth !== monthInput) {
          setMonthInput(nextMonth);
        } else {
          await loadNotebookPlus();
        }
      } else {
        await loadNotebookPlus();
      }
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (id: string) => {
    if (!businessId || !id) return;
    if (!window.confirm("Delete this Notebook+ row?")) return;
    try {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);
      if (deleteError) throw new Error(deleteError.message);
      toast.success("Notebook+ row deleted.");
      if (editingId === id) resetForm();
      await loadNotebookPlus();
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    }
  };

  const handleDownloadPdf = async () => {
    if (!periodTitle || !selectedKhata) return;
    setPdfBusy(true);
    try {
      await downloadLedgerNotebookPdf({
        businessName: "Notebook+",
        khataName: selectedKhata.name,
        periodTitle,
        openingBalance: opening,
        rows: monthRows,
      });
      toast.success("Notebook+ PDF downloaded.");
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setPdfBusy(false);
    }
  };

  const executeSignOut = async () => {
    try {
      const { error: signErr } = await supabase.auth.signOut();
      if (signErr) {
        toast.error(signErr.message);
        return;
      }
      toast.success("Signed out.");
      router.replace("/login");
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    }
  };

  const scrollToAddOnDashboard = () => {
    router.push("/dashboard#add-business");
  };

  const balancesForList = Object.keys(khataBalances).length ? khataBalances : listBalances;

  return (
    <main className="lv-dashboard-canvas min-h-screen text-[var(--foreground)] pb-16">
      <div className="lv-dashboard-mesh-bg" aria-hidden>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      <BusinessesNav
        onAddRestaurant={scrollToAddOnDashboard}
        onAddMobileShop={scrollToAddOnDashboard}
        onAddGrocery={scrollToAddOnDashboard}
        onSignOutIntent={() => setSignOutConfirm(true)}
      />

      <section className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:px-10">
        {bizLoading ? (
          <div className="glass-panel rounded-[1.625rem] p-8">
            <Skeleton className="mb-6 h-9 w-48 rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : !selectedKhataId ? (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-[1.625rem] p-6 sm:p-7"
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
                Command center
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
                Notebook+
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--lv-muted-strong)]">
                Your personal khatas — separate from every client business Notebook. Client khatas
                never appear here.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-flex text-sm font-medium text-[var(--lv-accent)] hover:underline"
              >
                ← Back to businesses
              </Link>
            </motion.div>

            <form
              onSubmit={(e) => void handleCreateKhata(e)}
              className="glass-panel space-y-4 rounded-[1.625rem] p-6 sm:p-7"
            >
              <h2 className="text-lg font-semibold text-[var(--lv-heading)]">New khata</h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <MidnightField
                    id="np-khata-name"
                    label="Name"
                    type="text"
                    value={newKhataName}
                    onChange={(e) => setNewKhataName(e.target.value)}
                    maxLength={80}
                  />
                </div>
                <PressableButton type="submit" variant="primary" disabled={saving} className="min-h-12 px-5">
                  {saving ? "Saving…" : "Add khata"}
                </PressableButton>
              </div>
            </form>

            <div className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
              <h2 className="mb-4 text-lg font-semibold text-[var(--lv-heading)]">Khatas</h2>
              {error ? (
                <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
                  {error}
                </p>
              ) : loading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : khatas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] px-6 py-12 text-center">
                  <p className="font-semibold text-[var(--lv-heading)]">No khatas yet</p>
                  <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
                    Add a name above to open the first ledger.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {khatas.map((khata) => (
                    <li
                      key={khata.id}
                      className="flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_50%,transparent)] p-4"
                    >
                      <div>
                        <p className="text-lg font-semibold text-[var(--lv-heading)]">{khata.name}</p>
                        <p className="mt-1 lv-tabular-mono text-sm text-[var(--lv-muted-strong)]">
                          Balance {formatLedgerMoney(balancesForList[khata.id] ?? 0)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <PressableButton
                          type="button"
                          variant="primary"
                          className="min-h-10 px-4 text-sm"
                          onClick={() => openKhata(khata.id)}
                        >
                          Open
                        </PressableButton>
                        <PressableButton
                          type="button"
                          variant="ghost"
                          disabled={saving}
                          className="min-h-10 px-4 text-sm text-[var(--lv-traffic-critical)]"
                          onClick={() => void handleDeleteKhata(khata)}
                        >
                          Delete
                        </PressableButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-[1.625rem] p-6 sm:p-7"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <PressableButton
                    type="button"
                    variant="ghost"
                    className="mb-2 min-h-9 px-0 text-sm text-[var(--lv-muted-strong)]"
                    onClick={backToKhatas}
                  >
                    ← All khatas
                  </PressableButton>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
                    Notebook+ · Khata
                  </p>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
                    {selectedKhata?.name ?? "Notebook+"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--lv-muted-strong)]">
                    Date, Amount, Paid, Balance, Details — balance = previous + Amount − Paid.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <label className="text-xs font-semibold text-[var(--lv-muted)]" htmlFor="np-month">
                    View month
                  </label>
                  <input
                    id="np-month"
                    type="month"
                    max={maxMonthInput}
                    value={monthInput}
                    onChange={(e) => setMonthInput(e.target.value)}
                    className="lv-tabular-mono rounded-xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-surface-muted)] px-3 py-2.5 text-sm text-[var(--lv-heading)] outline-none focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)] dark:bg-white/[0.07]"
                  />
                </div>
              </div>
            </motion.div>

            <form
              onSubmit={(e) => void handleSubmitRow(e)}
              className="glass-panel space-y-4 rounded-[1.625rem] p-6 sm:p-7"
            >
              <h2 className="text-lg font-semibold text-[var(--lv-heading)]">
                {editingId ? "Edit row" : "Add row"}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MidnightField
                  id="np-date"
                  label="Date"
                  type="date"
                  max={todayISO}
                  required
                  value={rowDate}
                  onChange={(e) => setRowDate(e.target.value)}
                />
                <MidnightField
                  id="np-amount"
                  label="Amount"
                  type="text"
                  inputMode="decimal"
                  value={rowAmount}
                  onChange={(e) => {
                    const next = sanitizeNonNegativeDecimalInput(e.target.value);
                    if (next !== null) setRowAmount(next === "0" ? "" : next);
                  }}
                />
                <MidnightField
                  id="np-paid"
                  label="Paid"
                  type="text"
                  inputMode="decimal"
                  value={rowPaid}
                  onChange={(e) => {
                    const next = sanitizeNonNegativeDecimalInput(e.target.value);
                    if (next !== null) setRowPaid(next === "0" ? "" : next);
                  }}
                />
                <MidnightField
                  id="np-details"
                  label="Details"
                  type="text"
                  value={rowDetails}
                  onChange={(e) => setRowDetails(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <PressableButton type="submit" variant="primary" disabled={saving} className="min-h-12 px-5">
                  {saving ? "Saving…" : editingId ? "Update row" : "Save row"}
                </PressableButton>
                {editingId ? (
                  <PressableButton type="button" variant="ghost" className="min-h-12 px-4" onClick={resetForm}>
                    Cancel edit
                  </PressableButton>
                ) : null}
              </div>
            </form>

            <div className="glass-panel rounded-[1.625rem] p-6 sm:p-7">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-[var(--lv-heading)]">
                  {periodTitle || "Notebook+"}
                </h2>
                <PressableButton
                  type="button"
                  variant="primary"
                  disabled={pdfBusy || loading}
                  onClick={() => void handleDownloadPdf()}
                  className={cn(
                    "min-h-12 gap-2 rounded-[1rem] px-5",
                    "bg-gradient-to-r from-cyan-400/95 to-[color-mix(in_srgb,var(--lv-accent)_72%,#0e7490)]",
                  )}
                >
                  {pdfBusy ? "Generating PDF…" : "Download Notebook+ (PDF)"}
                </PressableButton>
              </div>

              {error ? (
                <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
                  {error}
                </p>
              ) : loading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : (
                <div className="overflow-x-auto rounded-[1.25rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)]">
                  <table className="lv-tabular-mono min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_50%,transparent)] text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--lv-muted-strong)]">
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Date</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Amount</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Paid</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Balance</th>
                        <th className="min-w-[10rem] px-3 py-3 font-medium">Details</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-[var(--lv-muted-strong)]">
                            No rows this month for this khata. Add one above.
                          </td>
                        </tr>
                      ) : (
                        monthRows.map((row) => (
                          <tr
                            key={row.id || `${row.date}-${row.sortIndex}`}
                            className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_28%,transparent)] last:border-0"
                          >
                            <td className="whitespace-nowrap px-3 py-2.5 text-[var(--lv-heading)]">
                              {formatHeadingDate(row.date)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-[var(--lv-heading)]">
                              {formatMoneyOrBlank(row.amount)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-[var(--lv-heading)]">
                              {formatMoneyOrBlank(row.paid)}
                            </td>
                            <td
                              className={cn(
                                "whitespace-nowrap px-3 py-2.5 text-right font-semibold",
                                row.balance < 0
                                  ? "text-[var(--lv-traffic-critical)]"
                                  : "text-[var(--lv-heading)]",
                              )}
                            >
                              {formatLedgerMoney(row.balance)}
                            </td>
                            <td className="max-w-[16rem] px-3 py-2.5 text-[var(--lv-muted-strong)]">
                              {row.details || "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right">
                              <div className="inline-flex gap-2">
                                <PressableButton
                                  type="button"
                                  variant="secondary"
                                  className="min-h-9 px-3 text-xs"
                                  disabled={!row.id}
                                  onClick={() => startEdit(row)}
                                >
                                  Edit
                                </PressableButton>
                                <PressableButton
                                  type="button"
                                  variant="ghost"
                                  className="min-h-9 px-3 text-xs text-[var(--lv-traffic-critical)]"
                                  disabled={!row.id}
                                  onClick={() => void handleDeleteRow(row.id)}
                                >
                                  Delete
                                </PressableButton>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={signOutConfirm}
        title="Sign out?"
        description="You will need to sign in again to manage businesses and Notebook+."
        confirmLabel="Sign out"
        cancelLabel="Stay"
        destructive
        onCancel={() => setSignOutConfirm(false)}
        onConfirm={() => {
          setSignOutConfirm(false);
          void executeSignOut();
        }}
      />
    </main>
  );
}

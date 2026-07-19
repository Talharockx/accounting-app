"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildNotebookInsert,
  collectNotebookEntriesForRange,
  DESC_NOTEBOOK,
  notebookMetadataPatch,
  type NotebookEntry,
} from "@/lib/dashboard/notebook";
import {
  insertTransactionsWithMetadataFallback,
  selectWithMetadataColumnFallback,
  updateTransactionWithMetadataFallback,
} from "@/lib/dashboard/transaction-metadata-fallback";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { downloadNotebookPdf } from "@/lib/reports/notebook-pdf";
import { mapTransactionListRows } from "@/lib/supabase/map-transactions";
import { getTodayLocalISO } from "@/lib/utils/date-range";
import {
  getMonthBoundariesISO,
  parseMonthInputValue,
  toMonthInputValue,
} from "@/lib/utils/date-range";
import { noteToPlainText } from "@/lib/utils/rich-text";
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

export default function NotebookPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [userId, setUserId] = useState("");
  const [bizLoading, setBizLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [monthInput, setMonthInput] = useState(() =>
    toMonthInputValue(new Date().getFullYear(), new Date().getMonth()),
  );
  const [noteDate, setNoteDate] = useState(() => getTodayLocalISO());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { businessId: bid } = await params;
      if (cancelled) return;
      setBusinessId(bid);
      try {
        const [{ data: biz, error: bizErr }, { data: authData }] = await Promise.all([
          supabase.from("businesses").select("name").eq("id", bid).single(),
          supabase.auth.getUser(),
        ]);
        if (cancelled) return;
        if (biz?.name) setBusinessName(biz.name as string);
        if (authData.user?.id) setUserId(authData.user.id);
        if (bizErr) setError(getUserFriendlyError(new Error(bizErr.message)));
      } catch (caught) {
        if (!cancelled) setError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
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

  const loadEntries = useCallback(async () => {
    if (!businessId || !monthRange) return;
    setLoading(true);
    setError("");
    const notesOr = `description.like.${DESC_NOTEBOOK}%`;
    try {
      const { data, error: fetchError } = await selectWithMetadataColumnFallback(
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date, metadata")
            .eq("business_id", businessId)
            .gte("transaction_date", monthRange.start)
            .lte("transaction_date", monthRange.end)
            .or(notesOr)
            .order("transaction_date", { ascending: true })
            .limit(500),
        async () =>
          await supabase
            .from("transactions")
            .select("id, business_id, amount, transaction_type, description, transaction_date")
            .eq("business_id", businessId)
            .gte("transaction_date", monthRange.start)
            .lte("transaction_date", monthRange.end)
            .or(notesOr)
            .order("transaction_date", { ascending: true })
            .limit(500),
      );

      if (fetchError) {
        setError(getUserFriendlyError(new Error(fetchError.message)));
        setEntries([]);
        return;
      }

      const rows = mapTransactionListRows(data ?? []);
      setEntries(collectNotebookEntriesForRange(rows, monthRange.start, monthRange.end));
    } catch (caught) {
      setError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, monthRange]);

  useEffect(() => {
    if (!businessId || !monthRange) return;
    const id = window.setTimeout(() => void loadEntries(), 0);
    return () => window.clearTimeout(id);
  }, [businessId, monthRange, loadEntries]);

  const periodTitle = parsedMonth
    ? calendarMonthHeading(parsedMonth.year, parsedMonth.monthIndex)
    : "";
  const maxMonthInput = toMonthInputValue(new Date().getFullYear(), new Date().getMonth());
  const todayISO = getTodayLocalISO();

  const resetForm = () => {
    setEditingId(null);
    setNoteDate(getTodayLocalISO());
    setTitle("");
    setBody("");
  };

  const startEdit = (entry: NotebookEntry) => {
    setEditingId(entry.id);
    setNoteDate(entry.date);
    setTitle(entry.title);
    setBody(noteToPlainText(entry.body));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!businessId || !userId) {
      toast.error("Sign in again to save Notes + entries.");
      return;
    }
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      toast.error("Write a note before saving.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const titleTrim = title.trim();
        const { error: updateError } = await updateTransactionWithMetadataFallback(
          supabase,
          editingId,
          businessId,
          {
            transaction_date: noteDate,
            description: titleTrim ? `${DESC_NOTEBOOK}: ${titleTrim}` : DESC_NOTEBOOK,
            metadata: notebookMetadataPatch(titleTrim, trimmedBody),
          },
        );

        if (updateError) throw updateError;
        toast.success("Notes + entry updated.");
      } else {
        const row = buildNotebookInsert({
          business_id: businessId,
          created_by_user_id: userId,
          note_date: noteDate,
          title,
          body: trimmedBody,
        });
        const { error: insertError } = await insertTransactionsWithMetadataFallback(supabase, [row]);
        if (insertError) throw insertError;
        toast.success("Notes + entry saved.");
      }
      const savedDate = noteDate;
      resetForm();
      // Jump month picker to the note’s month so the new entry is visible.
      const [y, m] = savedDate.split("-");
      if (y && m) {
        const nextMonth = `${y}-${m}`;
        if (nextMonth !== monthInput) {
          setMonthInput(nextMonth);
        } else {
          await loadEntries();
        }
      } else {
        await loadEntries();
      }
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId || !id) return;
    if (!window.confirm("Delete this Notes + entry?")) return;
    try {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);
      if (deleteError) throw new Error(deleteError.message);
      toast.success("Notes + entry deleted.");
      if (editingId === id) resetForm();
      await loadEntries();
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    }
  };

  const handleDownloadPdf = async () => {
    if (!businessName || !periodTitle) return;
    setPdfBusy(true);
    try {
      await downloadNotebookPdf({
        businessName,
        periodTitle,
        entries,
      });
      toast.success("Notes + PDF downloaded.");
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

  return (
    <section className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-[1.625rem] p-6 sm:p-7"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
              Workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              Notes +
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--lv-muted-strong)]">
              Free-form notes by date — separate from Daily Entry. Add entries anytime and download a month PDF.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-semibold text-[var(--lv-muted)]" htmlFor="notebook-month">
              View month
            </label>
            <input
              id="notebook-month"
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
        onSubmit={(e) => void handleSubmit(e)}
        className="glass-panel space-y-4 rounded-[1.625rem] p-6 sm:p-7"
      >
        <h2 className="text-lg font-semibold text-[var(--lv-heading)]">
          {editingId ? "Edit note" : "Add note"}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MidnightField
            id="notebook-date"
            label="Date"
            type="date"
            max={todayISO}
            required
            value={noteDate}
            onChange={(e) => setNoteDate(e.target.value)}
          />
          <MidnightField
            id="notebook-title"
            label="Title (optional)"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>
        <MidnightField
          id="notebook-body"
          label="Note"
          type="textarea"
          rows={5}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <PressableButton type="submit" variant="primary" disabled={saving} className="min-h-12 px-5">
            {saving ? "Saving…" : editingId ? "Update note" : "Save note"}
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
          <div>
            <h2 className="text-lg font-semibold text-[var(--lv-heading)]">{periodTitle || "Notes"}</h2>
            <p className="text-sm text-[var(--lv-muted-strong)]">
              {loading ? "Loading…" : `${entries.length} note${entries.length === 1 ? "" : "s"}`}
            </p>
          </div>
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
            {pdfBusy ? "Generating PDF…" : "Download Notes + (PDF)"}
          </PressableButton>
        </div>

        {error ? (
          <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
            {error}
          </p>
        ) : loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] px-6 py-12 text-center">
            <p className="font-semibold text-[var(--lv-heading)]">No notes this month</p>
            <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
              Add a note above — it is not linked to Daily Entry.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id || `${entry.date}-${entry.title}-${entry.body.slice(0, 12)}`}
                className="rounded-2xl border border-[color-mix(in_srgb,var(--lv-glass-edge)_40%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_50%,transparent)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="lv-tabular-mono text-xs font-semibold uppercase tracking-wide text-[var(--lv-muted-strong)]">
                      {formatHeadingDate(entry.date)}
                    </p>
                    {entry.title ? (
                      <p className="mt-1 font-semibold text-[var(--lv-heading)]">{entry.title}</p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lv-muted-strong)]">
                      {noteToPlainText(entry.body)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <PressableButton
                      type="button"
                      variant="secondary"
                      className="min-h-10 px-3 text-sm"
                      disabled={!entry.id}
                      onClick={() => startEdit(entry)}
                    >
                      Edit
                    </PressableButton>
                    <PressableButton
                      type="button"
                      variant="ghost"
                      className="min-h-10 px-3 text-sm text-[var(--lv-traffic-critical)]"
                      disabled={!entry.id}
                      onClick={() => void handleDelete(entry.id)}
                    >
                      Delete
                    </PressableButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

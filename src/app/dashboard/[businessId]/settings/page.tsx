"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserFriendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";

type Business = {
  id: string;
  name: string;
  business_type: string;
};

export default function SettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await params;
        const id = resolved.businessId;
        setBusinessId(id);

        const { data, error: fetchError } = await supabase
          .from("businesses")
          .select("id, name, business_type")
          .eq("id", id)
          .single();

        if (cancelled) return;

        if (fetchError || !data) {
          setError(getUserFriendlyError(new Error(fetchError?.message ?? "Business not found.")));
          return;
        }
        setBusiness(data as Business);
      } catch (caught) {
        if (!cancelled) setError(getUserFriendlyError(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const runDelete = async () => {
    if (!business) return;
    setDeleting(true);
    setError("");
    try {
      const { error: delError } = await supabase.from("businesses").delete().eq("id", business.id);
      if (delError) {
        const msg = getUserFriendlyError(new Error(delError.message));
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`“${business.name}” deleted.`);
      router.replace("/dashboard");
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <section className="glass-panel rounded-2xl p-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-4 h-24 w-full max-w-xl" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="glass-panel rounded-2xl p-6 shadow-lg shadow-slate-900/10 dark:shadow-black/35">
        <h1 className="text-2xl font-semibold text-[var(--lv-heading)]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
          {business
            ? `Managing “${business.name}”. Dangerous actions stay below — delete only when you intend to wipe this workspace from LedgerView.`
            : error || "Workspace could not be loaded."}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200" role="alert">
          {error}
        </p>
      ) : null}

      {business ? (
        <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-6 dark:bg-rose-950/35">
          <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-200">Danger zone</h2>
          <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
            Deleting removes this location. If PostgreSQL cascading deletes transactions, related daily
            entries go with it; otherwise Supabase may block the delete until data is cleared.
          </p>
          <button
            type="button"
            disabled={deleting || !businessId}
            onClick={() => setDeleteConfirm(true)}
            className="mt-4 rounded-xl border border-rose-500/50 bg-rose-600/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            Delete “{business.name}”
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteConfirm && !!business}
        title="Remove this workspace?"
        description={
          business
            ? `“${business.name}” (${business.business_type.replace("_", " ")}) will disappear from LedgerView permanently. Confirm only if backups are handled elsewhere.`
            : ""
        }
        confirmLabel="Delete workspace"
        cancelLabel="Cancel"
        destructive
        busy={deleting}
        onCancel={() => !deleting && setDeleteConfirm(false)}
        onConfirm={() => void runDelete()}
      />
    </section>
  );
}

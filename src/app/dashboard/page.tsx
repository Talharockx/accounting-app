"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AddBusinessSection, type BusinessType } from "@/components/dashboard/add-business-section";
import { BusinessesNav } from "@/components/dashboard/businesses-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils/cn";
import { supabase } from "@/lib/supabaseClient";

type Business = {
  id: string;
  name: string;
  business_type: BusinessType;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<Business | null>(null);

  const hasBusinesses = businesses.length > 0;

  const title = useMemo(() => {
    if (loading) return "Loading dashboard…";
    if (!hasBusinesses) return "Set up your first business";
    return "Your businesses";
  }, [hasBusinesses, loading]);

  const scrollToAddBusiness = () => {
    requestAnimationFrame(() => {
      document.getElementById("add-business")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleNavAddRestaurant = () => {
    setSelectedType("restaurant");
    scrollToAddBusiness();
  };

  const handleNavAddMobileShop = () => {
    setSelectedType("mobile_shop");
    scrollToAddBusiness();
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

  const loadBusinesses = async (userId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("businesses")
        .select("id, name, business_type, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        const msg = getUserFriendlyError(new Error(fetchError.message));
        setError(msg);
        toast.error(msg);
        return;
      }

      setOwnerUserId(userId);
      const rows = Array.isArray(data) ? data : [];
      const next: Business[] = [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const id = r.id;
        const name = r.name;
        const bt = r.business_type;
        const created = r.created_at;
        if (
          typeof id === "string" &&
          typeof name === "string" &&
          typeof created === "string" &&
          (bt === "restaurant" || bt === "mobile_shop")
        ) {
          next.push({ id, name, business_type: bt, created_at: created });
        }
      }
      setBusinesses(next);
    } catch (caught) {
      const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
      setError(msg);
      toast.error(msg);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        await loadBusinesses(user.id);
      } catch (caught) {
        toast.error(getUserFriendlyError(caught));
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [router]);

  const handleCreateBusiness = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ownerUserId || !selectedType || !businessName.trim()) return;

    setSaving(true);
    setError("");

    try {
      const { error: insertError } = await supabase.from("businesses").insert({
        owner_user_id: ownerUserId,
        name: businessName.trim(),
        business_type: selectedType,
      });

      if (insertError) {
        const msg = getUserFriendlyError(new Error(insertError.message));
        setError(msg);
        toast.error(msg);
        setSaving(false);
        return;
      }

      toast.success("Business workspace created.");
      setBusinessName("");
      setSelectedType(null);
      await loadBusinesses(ownerUserId);
    } catch (caught) {
      const msg = getUserFriendlyError(caught);
      setError(msg);
      toast.error(msg);
    }

    setSaving(false);
  };

  const runDeleteBusiness = async (business: Business) => {
    setError("");
    setDeletingId(business.id);

    try {
      const { error: deleteError } = await supabase.from("businesses").delete().eq("id", business.id);

      if (deleteError) {
        const msg = getUserFriendlyError(new Error(deleteError.message));
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success(`“${business.name}” was removed.`);
      if (ownerUserId) {
        await loadBusinesses(ownerUserId);
      }
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="relative min-h-screen lv-page text-[var(--foreground)]">
      <BusinessesNav
        onAddRestaurant={handleNavAddRestaurant}
        onAddMobileShop={handleNavAddMobileShop}
        onSignOutIntent={() => setSignOutConfirm(true)}
      />

      <section className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--lv-heading)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
            Manage your restaurants and mobile shops from one place. Open a card to work inside that
            business.
          </p>
        </div>

        {error ? (
          <p className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="glass-panel rounded-2xl p-8">
            <Skeleton className="mb-4 h-8 w-64" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          </div>
        ) : null}

        {!loading && !hasBusinesses ? (
          <AddBusinessSection
            selectedType={selectedType}
            onSelectType={setSelectedType}
            businessName={businessName}
            onBusinessNameChange={setBusinessName}
            onSubmit={handleCreateBusiness}
            saving={saving}
            title="Choose a business type"
            subtitle="Add a restaurant or mobile shop to start tracking sales and expenses."
          />
        ) : null}

        {!loading && hasBusinesses ? (
          <div className="space-y-12">
            <div>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-[var(--lv-muted-strong)]">
                Your locations
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {businesses.map((business) => (
                  <motion.div
                    key={business.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col overflow-hidden rounded-2xl glass-panel shadow-xl shadow-slate-900/10 dark:shadow-black/35"
                  >
                    <Link
                      href={`/dashboard/${business.id}`}
                      className="flex flex-1 flex-col p-6 transition hover:bg-[var(--lv-surface-muted)] dark:hover:bg-white/[0.06]"
                    >
                      <p className="text-xs uppercase tracking-wide text-[var(--lv-accent)]">
                        {business.business_type === "restaurant" ? "Restaurant" : "Mobile shop"}
                      </p>
                      <h3 className="mt-3 text-xl font-semibold text-[var(--lv-heading)]">{business.name}</h3>
                      <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
                        Created {new Date(business.created_at).toLocaleDateString()}
                      </p>
                      <p className="mt-4 text-sm font-medium text-[var(--lv-accent)]">Open workspace →</p>
                    </Link>
                    <div className="flex items-center justify-end gap-2 border-t border-[var(--lv-border)] px-4 py-3">
                      <button
                        type="button"
                        disabled={deletingId === business.id}
                        onClick={(event) => {
                          event.preventDefault();
                          setBusinessToDelete(business);
                        }}
                        className={cn(
                          "rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-200",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      >
                        {deletingId === business.id ? "Deleting…" : "Delete business"}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <AddBusinessSection
              selectedType={selectedType}
              onSelectType={setSelectedType}
              businessName={businessName}
              onBusinessNameChange={setBusinessName}
              onSubmit={handleCreateBusiness}
              saving={saving}
              title="Add another business"
              subtitle="Create a restaurant or mobile shop without leaving this page. Use the top bar for quick access."
            />
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={signOutConfirm}
        title="Sign out?"
        description="You will return to the login screen. Unsaved data in other tabs will not be saved."
        confirmLabel="Sign out"
        cancelLabel="Stay"
        destructive
        onCancel={() => setSignOutConfirm(false)}
        onConfirm={() => {
          setSignOutConfirm(false);
          void executeSignOut();
        }}
      />

      <ConfirmDialog
        open={businessToDelete !== null}
        title="Delete this business?"
        description={
          businessToDelete
            ? `“${businessToDelete.name}” and its linked data will be removed per your database rules. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete business"
        cancelLabel="Cancel"
        destructive
        busy={deletingId !== null}
        onCancel={() => !deletingId && setBusinessToDelete(null)}
        onConfirm={() => {
          const b = businessToDelete;
          if (!b) return;
          void (async () => {
            await runDeleteBusiness(b);
            setBusinessToDelete(null);
          })();
        }}
      />
    </main>
  );
}

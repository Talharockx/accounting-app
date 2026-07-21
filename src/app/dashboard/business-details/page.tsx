"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BusinessesNav } from "@/components/dashboard/businesses-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { businessTypeLabel, normalizeBusinessType, type BusinessType } from "@/lib/business-types";
import { isNotebookPlusWorkspace } from "@/lib/dashboard/notebook-plus";
import { cn } from "@/lib/utils/cn";
import { supabase } from "@/lib/supabaseClient";

type BusinessDetail = {
  id: string;
  name: string;
  business_type: BusinessType;
  created_at: string;
  phone_number: string;
  vat_number: string;
  address: string;
  contact_email: string;
};

function coerceCreatedAt(raw: unknown): string {
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return new Date(raw).toISOString();
  return new Date(0).toISOString();
}

function parseBusinessRow(r: Record<string, unknown>): BusinessDetail | null {
  const id = r.id;
  const name = r.name;
  const bt = normalizeBusinessType(r.business_type);
  if (typeof id !== "string" || typeof name !== "string" || !bt) return null;
  return {
    id,
    name,
    business_type: bt,
    created_at: coerceCreatedAt(r.created_at),
    phone_number: typeof r.phone_number === "string" ? r.phone_number : "",
    vat_number: typeof r.vat_number === "string" ? r.vat_number : "",
    address: typeof r.address === "string" ? r.address : "",
    contact_email: typeof r.contact_email === "string" ? r.contact_email : "",
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const display = value.trim() || "—";
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--lv-muted-strong)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-[var(--lv-heading)]">{display}</dd>
    </div>
  );
}

export default function BusinessDetailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<BusinessDetail[]>([]);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | BusinessType>("");

  const scrollToAddOnDashboard = () => {
    router.push("/dashboard#add-business");
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let userId = session?.user?.id;
        if (!userId) {
          const {
            data: { user },
            error: userErr,
          } = await supabase.auth.getUser();
          if (!user || userErr) {
            router.replace("/login");
            return;
          }
          userId = user.id;
        }

        const { data, error: fetchError } = await supabase
          .from("businesses")
          .select("id, name, business_type, created_at, phone_number, vat_number, address, contact_email")
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (fetchError) {
          const msg = getUserFriendlyError(new Error(fetchError.message));
          setError(msg);
          toast.error(msg);
          return;
        }

        const next: BusinessDetail[] = [];
        for (const row of Array.isArray(data) ? data : []) {
          const raw = row as Record<string, unknown>;
          if (isNotebookPlusWorkspace(raw)) continue;
          const parsed = parseBusinessRow(raw);
          if (parsed) next.push(parsed);
        }
        setBusinesses(next);
      } catch (caught) {
        if (!cancelled) {
          const msg = getUserFriendlyError(caught, SYSTEM_UNAVAILABLE);
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filtered = useMemo(() => {
    if (!typeFilter) return businesses;
    return businesses.filter((b) => b.business_type === typeFilter);
  }, [businesses, typeFilter]);

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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
          className="mb-8"
        >
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
            Command center
          </p>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-4xl">
            Business details
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--lv-muted-strong)]">
            Contact and registration info entered when each workspace was created — not ledger or daily
            totals. Use Edit on My businesses to correct a mistake.
          </p>
        </motion.div>

        {error ? (
          <p
            className="mb-6 rounded-[1rem] border border-[color-mix(in_srgb,var(--lv-traffic-critical)_42%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_10%,transparent)] px-4 py-3 text-sm text-[var(--lv-traffic-critical)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="glass-panel rounded-[1.625rem] p-8">
            <Skeleton className="mb-4 h-8 w-64 rounded-xl" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-56 rounded-[1.625rem]" />
              <Skeleton className="h-56 rounded-[1.625rem]" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex max-w-md flex-col gap-2">
              <label htmlFor="business-details-type" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                Filter by type
              </label>
              <select
                id="business-details-type"
                value={typeFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setTypeFilter(v === "" ? "" : (v as BusinessType));
                }}
                className={cn(
                  "lv-field-midnight lv-tabular-mono min-h-12 w-full rounded-xl border px-4 py-3 text-sm outline-none",
                  "border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)]",
                  "focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)]",
                  typeFilter ? "text-[var(--lv-heading)]" : "text-[var(--lv-muted-strong)]",
                )}
              >
                <option value="">All businesses</option>
                <option value="restaurant">Restaurant</option>
                <option value="mobile_shop">Mobile shop</option>
                <option value="grocery">Grocery</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] bg-[var(--lv-liquid-fill)] px-6 py-14 text-center backdrop-blur-md">
                <p className="text-base font-semibold text-[var(--lv-heading)]">No businesses to show</p>
                <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">
                  {businesses.length === 0
                    ? "Create a workspace from My businesses first."
                    : "No workspaces match this type filter."}
                </p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-flex text-sm font-semibold text-[var(--lv-accent)] underline-offset-4 hover:underline"
                >
                  ← Back to My businesses
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filtered.map((business, idx) => (
                  <motion.article
                    key={business.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.24) }}
                    className="rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-liquid-fill)] p-6 shadow-[var(--lv-bento-shadow)] backdrop-blur-3xl sm:p-7"
                  >
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-accent)]">
                      {businessTypeLabel(business.business_type)}
                    </p>
                    <h2 className="mt-3 text-xl font-bold tracking-tight text-[var(--lv-heading)]">
                      {business.name}
                    </h2>
                    <p className="lv-tabular-mono mt-2 text-xs text-[var(--lv-muted-strong)]">
                      Created{" "}
                      {new Date(business.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                    <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DetailRow label="Phone" value={business.phone_number} />
                      <DetailRow label="VAT number" value={business.vat_number} />
                      <DetailRow label="Email" value={business.contact_email} />
                      <DetailRow label="Address" value={business.address} />
                    </dl>
                  </motion.article>
                ))}
              </div>
            )}
          </div>
        )}
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
    </main>
  );
}

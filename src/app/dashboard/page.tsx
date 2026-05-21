"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AddBusinessSection, type BusinessType } from "@/components/dashboard/add-business-section";
import { BusinessesNav } from "@/components/dashboard/businesses-nav";
import { BentoCell } from "@/components/ui/bento-cell";
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
  phone_number: string;
  vat_number: string;
  address: string;
  contact_email: string;
};

function normalizeBusinessType(raw: unknown): BusinessType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (t === "restaurant") return "restaurant";
  if (t === "mobile_shop") return "mobile_shop";
  if (t === "mobile" || t === "mobileshop" || t === "phone_shop" || t === "phoneshop") return "mobile_shop";
  return null;
}

function coerceCreatedAt(raw: unknown): string {
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return new Date(raw).toISOString();
  return new Date(0).toISOString();
}

function parseBusinessRow(r: Record<string, unknown>): Business | null {
  const id = r.id;
  const name = r.name;
  const bt = normalizeBusinessType(r.business_type);
  const created = coerceCreatedAt(r.created_at);
  if (typeof id !== "string" || typeof name !== "string" || !bt) {
    return null;
  }
  const phone_number = typeof r.phone_number === "string" ? r.phone_number : "";
  const vat_number = typeof r.vat_number === "string" ? r.vat_number : "";
  const address = typeof r.address === "string" ? r.address : "";
  const contact_email = typeof r.contact_email === "string" ? r.contact_email : "";
  return { id, name, business_type: bt, created_at: created, phone_number, vat_number, address, contact_email };
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [modularWorkspaceType, setModularWorkspaceType] = useState<"" | BusinessType>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<Business | null>(null);

  const hasBusinesses = businesses.length > 0;

  const displayedWorkspaces = useMemo(() => {
    if (!modularWorkspaceType) return [];
    return businesses.filter((b) => b.business_type === modularWorkspaceType);
  }, [businesses, modularWorkspaceType]);

  const countSelectedType = useMemo(
    () => businesses.filter((b) => b.business_type === modularWorkspaceType).length,
    [businesses, modularWorkspaceType],
  );

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
        .select("id, name, business_type, created_at, phone_number, vat_number, address, contact_email")
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
        const parsed = parseBusinessRow(row as Record<string, unknown>);
        if (parsed) next.push(parsed);
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
          data: { session },
        } = await supabase.auth.getSession();
        const sessionUser = session?.user;
        if (sessionUser) {
          await loadBusinesses(sessionUser.id);
        } else {
          const {
            data: { user },
            error: userErr,
          } = await supabase.auth.getUser();
          if (!user || userErr) {
            router.replace("/login");
            return;
          }
          await loadBusinesses(user.id);
        }
      } catch (caught) {
        toast.error(getUserFriendlyError(caught));
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    const id = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(id);
  }, [router]);

  const handleCreateBusiness = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ownerUserId || !selectedType || !businessName.trim()) return;
    if (!phoneNumber.trim() || !vatNumber.trim() || !address.trim() || !contactEmail.trim()) {
      toast.error("Fill in phone, VAT, address, and email for this workspace.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: insertError } = await supabase.from("businesses").insert({
        owner_user_id: ownerUserId,
        name: businessName.trim(),
        business_type: selectedType,
        phone_number: phoneNumber.trim(),
        vat_number: vatNumber.trim(),
        address: address.trim(),
        contact_email: contactEmail.trim(),
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
      setPhoneNumber("");
      setVatNumber("");
      setAddress("");
      setContactEmail("");
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
    <main className="lv-dashboard-canvas min-h-screen text-[var(--foreground)] pb-16">
      <div className="lv-dashboard-mesh-bg" aria-hidden>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      <BusinessesNav
        onAddRestaurant={handleNavAddRestaurant}
        onAddMobileShop={handleNavAddMobileShop}
        onSignOutIntent={() => setSignOutConfirm(true)}
      />

      <section className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
          className="mb-10"
        >
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-muted-strong)]">
            LedgerView command center
          </p>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--lv-muted-strong)]">
            Modular workspaces keep accounting separated by location. Larger cards highlight momentum—open
            anywhere to drill into journals, receipts, or monthly rollups.
          </p>
        </motion.div>

        {error ? (
          <p className="mb-6 rounded-[1rem] border border-[color-mix(in_srgb,var(--lv-traffic-critical)_42%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_10%,transparent)] px-4 py-3 text-sm text-[var(--lv-traffic-critical)]">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="glass-panel rounded-[1.625rem] p-8">
            <Skeleton className="mb-4 h-8 w-64 rounded-xl" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-48 rounded-[1.625rem]" />
              <Skeleton className="h-48 rounded-[1.625rem]" />
              <Skeleton className="h-48 rounded-[1.625rem]" />
            </div>
          </div>
        ) : null}

        {!loading && !hasBusinesses ? (
          <AddBusinessSection
            selectedType={selectedType}
            onSelectType={setSelectedType}
            businessName={businessName}
            onBusinessNameChange={setBusinessName}
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
            vatNumber={vatNumber}
            onVatNumberChange={setVatNumber}
            address={address}
            onAddressChange={setAddress}
            contactEmail={contactEmail}
            onContactEmailChange={setContactEmail}
            onSubmit={handleCreateBusiness}
            saving={saving}
            title="Choose a business type"
            subtitle="Add a restaurant or mobile shop to start tracking sales and expenses."
          />
        ) : null}

        {!loading && hasBusinesses ? (
          <div className="space-y-14">
            <div id="modular-workspaces">
              <h2 className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-[var(--lv-muted-strong)]">
                Modular workspaces
              </h2>
              <p className="mb-6 max-w-2xl text-sm text-[var(--lv-muted-strong)]">
                Choose restaurant or mobile shop to list those workspaces.
              </p>
              <div className="mb-6 max-w-md space-y-2">
                <label htmlFor="workspace-business-type" className="text-xs font-semibold text-[var(--lv-muted-strong)]">
                  Business type
                </label>
                <select
                  id="workspace-business-type"
                  value={modularWorkspaceType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setModularWorkspaceType(v === "" ? "" : (v as BusinessType));
                  }}
                  aria-label="Filter workspaces by business type"
                  className={cn(
                    "lv-field-midnight lv-tabular-mono min-h-12 w-full rounded-xl border px-4 py-3 text-sm outline-none",
                    "border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)]",
                    "focus:border-[color-mix(in_srgb,var(--lv-accent)_48%,transparent)]",
                    modularWorkspaceType ? "text-[var(--lv-heading)]" : "text-[var(--lv-muted-strong)]",
                  )}
                >
                  <option value="">Choose type…</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="mobile_shop">Mobile shop</option>
                </select>
              </div>

              {!modularWorkspaceType ? (
                <div className="rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_40%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_55%,transparent)] px-6 py-14 text-center backdrop-blur-md">
                  <p className="text-sm font-medium text-[var(--lv-heading)]">No type selected</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[var(--lv-muted-strong)]">
                    Pick <span className="font-semibold text-[var(--lv-heading)]">Restaurant</span> or{" "}
                    <span className="font-semibold text-[var(--lv-heading)]">Mobile shop</span> to see your workspaces
                    here.
                  </p>
                </div>
              ) : displayedWorkspaces.length === 0 ? (
                <div className="space-y-4 rounded-[1rem] border border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[var(--lv-surface-muted)] px-4 py-6 text-sm text-[var(--lv-muted-strong)] dark:bg-white/[0.04]">
                  <p>
                    No {modularWorkspaceType === "restaurant" ? "restaurants" : "mobile shops"} in this account&apos;s
                    list yet. Add one below or from the top bar.
                  </p>
                  {hasBusinesses && countSelectedType === 0 ? (
                    <div className="rounded-lg border border-[color-mix(in_srgb,var(--lv-glass-edge)_50%,transparent)] bg-[var(--lv-card)]/80 p-4 text-xs leading-relaxed text-[var(--lv-muted-strong)]">
                      <p className="font-semibold text-[var(--lv-heading)]">If this business already exists in Supabase</p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4">
                        <li>
                          Sign in with the <strong className="text-[var(--lv-heading)]">same user</strong> as{" "}
                          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.65rem]">owner_user_id</code>{" "}
                          on that row (production login is often a different email than local testing).
                        </li>
                        <li>
                          In Vercel → Settings → Environment Variables, confirm{" "}
                          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.65rem]">
                            NEXT_PUBLIC_SUPABASE_URL
                          </code>{" "}
                          and{" "}
                          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.65rem]">
                            NEXT_PUBLIC_SUPABASE_ANON_KEY
                          </code>{" "}
                          point to this Supabase project (not an empty duplicate project).
                        </li>
                        <li>
                          In Supabase → Authentication → URL configuration, add your production site URL and redirect
                          URLs so the session is created on your Vercel domain.
                        </li>
                        <li>
                          In Supabase → Table Editor → <strong className="text-[var(--lv-heading)]">businesses</strong>{" "}
                          → RLS policies: <strong className="text-[var(--lv-heading)]">SELECT</strong> for authenticated
                          users should allow rows where{" "}
                          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.65rem]">
                            owner_user_id = auth.uid()
                          </code>
                          . Avoid policies that filter by{" "}
                          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.65rem]">business_type</code>{" "}
                          unless you intend to hide whole categories.
                        </li>
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {displayedWorkspaces.map((business, idx) => (
                    <BentoCell
                      key={business.id}
                      className="flex flex-col overflow-hidden p-0"
                      featured={idx === 0}
                    >
                      <Link
                        href={`/dashboard/${business.id}`}
                        className="flex flex-1 flex-col p-7 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--lv-accent)_06%,transparent)]"
                      >
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--lv-accent)]">
                          {business.business_type === "restaurant" ? "Restaurant" : "Mobile shop"}
                        </p>
                        <h3 className="mt-4 text-xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-2xl">
                          {business.name}
                        </h3>
                        <p className="lv-tabular-mono mt-3 text-xs text-[var(--lv-muted-strong)] opacity-70 transition-opacity group-hover/lv-bento:opacity-100">
                          Created {new Date(business.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-[var(--lv-accent)]">
                          Open cockpit
                          <span aria-hidden>→</span>
                        </div>
                        <p className="pointer-events-none mt-3 max-w-none text-xs text-[var(--lv-muted-strong)] opacity-0 transition-all duration-300 group-hover/lv-bento:opacity-100">
                          Jumps straight into LedgerView dashboards, journals, exports, and automations scoped to this
                          workspace.
                        </p>
                      </Link>
                      <div className="flex items-center justify-end gap-2 border-t border-[color-mix(in_srgb,var(--lv-glass-edge)_42%,transparent)] px-5 py-3.5">
                        <button
                          type="button"
                          disabled={deletingId === business.id}
                          onClick={(event) => {
                            event.preventDefault();
                            setBusinessToDelete(business);
                          }}
                          className={cn(
                            "rounded-[0.75rem] border border-[color-mix(in_srgb,var(--lv-traffic-critical)_45%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_12%,transparent)] px-3.5 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--lv-traffic-critical)] transition hover:bg-[color-mix(in_srgb,var(--lv-traffic-critical)_20%,transparent)]",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                          )}
                        >
                          {deletingId === business.id ? "Deleting…" : "Remove"}
                        </button>
                      </div>
                    </BentoCell>
                  ))}
                </div>
              )}
            </div>

            <AddBusinessSection
              formInstanceId="secondary"
              selectedType={selectedType}
              onSelectType={setSelectedType}
              businessName={businessName}
              onBusinessNameChange={setBusinessName}
              phoneNumber={phoneNumber}
              onPhoneNumberChange={setPhoneNumber}
              vatNumber={vatNumber}
              onVatNumberChange={setVatNumber}
              address={address}
              onAddressChange={setAddress}
              contactEmail={contactEmail}
              onContactEmailChange={setContactEmail}
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

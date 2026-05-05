"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { SYSTEM_UNAVAILABLE, getUserFriendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils/cn";

type Business = {
  id: string;
  name: string;
  business_type: "restaurant" | "mobile_shop";
};

export default function BusinessDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      setInitError("");
      try {
        const resolvedParams = await params;
        setBusinessId(resolvedParams.businessId);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          router.replace("/login");
          return;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("businesses")
          .select("id, name, business_type")
          .eq("id", resolvedParams.businessId)
          .single();

        if (error || !data) {
          router.replace("/dashboard");
          return;
        }

        setBusiness(data as Business);
      } catch (caught) {
        setInitError(getUserFriendlyError(caught, SYSTEM_UNAVAILABLE));
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [params, router]);

  const confirmSignOut = async () => {
    setSignOutBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Signed out securely.");
      router.replace("/login");
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    } finally {
      setSignOutBusy(false);
      setSignOutOpen(false);
    }
  };

  if (loading) {
    return (
      <main className="relative lv-page">
        <section className="relative mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
          <div className="glass-panel space-y-4 rounded-2xl p-8">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="grid gap-4 pt-6 lg:grid-cols-[280px_1fr]">
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (initError && !business) {
    return (
      <main className="relative lv-page">
        <section className="relative mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
          <div className="glass-panel rounded-2xl p-8 text-[var(--lv-heading)]">
            <p className="text-sm text-rose-600 dark:text-rose-300">{initError}</p>
          </div>
        </section>
      </main>
    );
  }

  if (!business) return null;

  return (
    <main className="relative lv-page">
      <section className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:contents">
            <button
              type="button"
              className={cn(
                "glass-panel inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-[var(--lv-heading)] transition hover:scale-105 lg:hidden",
              )}
              aria-expanded={mobileNav}
              aria-controls="workspace-sidebar-nav"
              onClick={() => setMobileNav((o) => !o)}
            >
              <span className="sr-only">Toggle navigation</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 lg:flex-none lg:min-w-auto">
              <Link
                href="/dashboard"
                className="inline-flex rounded-xl border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--lv-heading)] transition hover:scale-[1.02] hover:bg-[var(--lv-surface-muted)] dark:hover:bg-white/10"
              >
                Back to businesses
              </Link>
            </div>
          </div>

          <button
            type="button"
            className="rounded-xl border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--lv-heading)] transition hover:scale-[1.02] hover:bg-[var(--lv-surface-muted)] dark:hover:bg-white/10"
            onClick={() => setSignOutOpen(true)}
          >
            Sign out
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <DashboardSidebar
            businessId={businessId}
            businessName={business.name}
            mobileOpen={mobileNav}
            onCloseMobile={() => setMobileNav(false)}
          />

          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </section>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out?"
        description="You will need to sign in again to access your businesses and accounting data."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        destructive
        busy={signOutBusy}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => void confirmSignOut()}
      />
    </main>
  );
}

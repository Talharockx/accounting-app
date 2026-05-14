"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardBottomNav } from "@/components/dashboard/dashboard-bottom-nav";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PressableButton } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      setInitError("");
      try {
        const resolvedParams = await params;
        setBusinessId(resolvedParams.businessId);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError || !user) {
            router.replace("/login");
            return;
          }
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
  }, []);

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
      <main className="lv-dashboard-canvas min-h-screen">
        <div className="lv-dashboard-mesh-bg" aria-hidden>
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>
        <section className="relative mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
          <div className="glass-panel space-y-4 rounded-[1.625rem] p-8">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-md rounded-lg" />
            <div className="grid gap-4 pt-6 md:grid-cols-[280px_1fr]">
              <Skeleton className="h-80 rounded-[1.625rem]" />
              <Skeleton className="h-96 rounded-[1.625rem]" />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (initError && !business) {
    return (
      <main className="lv-dashboard-canvas min-h-screen">
        <div className="lv-dashboard-mesh-bg" aria-hidden>
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>
        <section className="relative mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
          <div className="glass-panel rounded-[1.625rem] p-8 text-[var(--lv-heading)]">
            <p className="text-sm text-[var(--lv-traffic-critical)]">{initError}</p>
          </div>
        </section>
      </main>
    );
  }

  if (!business) return null;

  return (
    <main className="lv-dashboard-canvas min-h-screen pb-28 md:pb-12">
      <div className="lv-dashboard-mesh-bg" aria-hidden>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      <section className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href="/dashboard"
              className={cn(
                "glass-panel inline-flex min-h-12 cursor-pointer touch-manipulation items-center rounded-[0.875rem] px-4 text-sm font-semibold text-[var(--lv-heading)] transition-[transform,box-shadow] hover:shadow-[var(--lv-bento-shadow-hover)] active:scale-[0.98]",
              )}
            >
              Back to businesses
            </Link>
          </div>

          <PressableButton
            type="button"
            variant="secondary"
            className="min-h-12"
            onClick={() => setSignOutOpen(true)}
          >
            Sign out
          </PressableButton>
        </header>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <DashboardSidebar businessId={businessId} businessName={business.name} />

          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="min-w-0"
          >
            {children}
          </motion.div>
        </div>
      </section>

      <DashboardBottomNav businessId={businessId} />

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

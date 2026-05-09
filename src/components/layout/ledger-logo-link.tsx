"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils/cn";

type LedgerLogoNavLinkProps = {
  className?: string;
};

/**
 * Logged in → `/dashboard`. Already on a dashboard route → soft refresh (no full navigation).
 * Logged out → `/`
 */
export function LedgerLogoNavLink({ className }: LedgerLogoNavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setAuthenticated(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthenticated(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const dashboardHref = "/dashboard";

  return (
    <Link
      href={authenticated ? dashboardHref : "/"}
      className={cn(
        "inline-flex shrink-0 cursor-pointer touch-manipulation items-center text-base font-bold tracking-tight text-[var(--lv-heading)] transition-opacity hover:opacity-90 md:text-lg",
        className,
      )}
      onClick={(e) => {
        if (!authenticated) return;
        if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
          e.preventDefault();
          router.refresh();
        }
      }}
    >
      Ledger<span className="text-[var(--lv-accent)]">View</span>
    </Link>
  );
}

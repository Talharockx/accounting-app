"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LedgerLogoNavLink } from "@/components/layout/ledger-logo-link";
import { PressableButton } from "@/components/ui/pressable";
import { cn } from "@/lib/utils/cn";

type BusinessesNavProps = {
  onAddRestaurant: () => void;
  onAddMobileShop: () => void;
  onAddGrocery: () => void;
  onSignOutIntent: () => void;
};

export function BusinessesNav({ onAddRestaurant, onAddMobileShop, onAddGrocery, onSignOutIntent }: BusinessesNavProps) {
  const pillIdle =
    "inline-flex min-h-12 shrink-0 cursor-pointer touch-manipulation items-center rounded-[0.875rem] border border-[#ffffff10] px-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lv-muted-strong)] transition-[transform,opacity] hover:border-[#ffffff24] hover:text-[var(--lv-heading)] active:scale-[0.98]";
  const pillAccent =
    "inline-flex min-h-12 shrink-0 cursor-pointer touch-manipulation items-center rounded-[0.875rem] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lv-heading)] ring-1 ring-[#ffffff14] transition-[transform,opacity] active:scale-[0.98] bg-[color-mix(in_srgb,var(--lv-accent)_12%,transparent)]";

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="sticky top-0 z-30 border-b border-[#ffffff10] bg-[#0b0e14]/88 shadow-[var(--lv-bento-shadow)] backdrop-blur-md"
      style={{
        WebkitBackdropFilter: "blur(16px)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 md:gap-4 md:px-10 md:py-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 md:gap-5">
          <LedgerLogoNavLink />

          <nav aria-label="Main" className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Link href="/dashboard" className={pillAccent}>
              My businesses
            </Link>
            <button type="button" onClick={onAddRestaurant} className={pillIdle}>
              Add restaurant
            </button>
            <button type="button" onClick={onAddMobileShop} className={pillIdle}>
              Add mobile shop
            </button>
            <button type="button" onClick={onAddGrocery} className={pillIdle}>
              Add grocery
            </button>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className={cn(pillIdle, "hidden px-4 sm:inline-flex", "justify-center")}
          >
            Home
          </Link>
          <PressableButton type="button" variant="secondary" className="min-h-12 !px-4 text-xs uppercase tracking-[0.12em]" onClick={onSignOutIntent}>
            Sign out
          </PressableButton>
        </div>
      </div>
    </motion.header>
  );
}

"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

type BusinessesNavProps = {
  onAddRestaurant: () => void;
  onAddMobileShop: () => void;
  onSignOutIntent: () => void;
};

export function BusinessesNav({ onAddRestaurant, onAddMobileShop, onSignOutIntent }: BusinessesNavProps) {
  const pill =
    "rounded-lg px-3 py-2 text-sm font-medium transition hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lv-accent)]/50";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--lv-border)] bg-[var(--lv-glass)] backdrop-blur-md dark:bg-[#0c122080]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 md:gap-4 md:px-10 md:py-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 md:gap-6">
          <Link
            href="/"
            className="shrink-0 text-base font-semibold tracking-tight text-[var(--lv-heading)] md:text-lg"
          >
            Ledger<span className="text-[var(--lv-accent)]">View</span>
          </Link>

          <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Link
              href="/dashboard"
              className={`${pill} bg-[var(--lv-accent-soft)] text-[var(--lv-heading)] ring-1 ring-[var(--lv-border)]`}
            >
              My businesses
            </Link>
            <button
              type="button"
              onClick={onAddRestaurant}
              className={`${pill} border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] text-[var(--lv-muted-strong)] hover:bg-[var(--lv-surface-muted)] hover:text-[var(--lv-heading)]`}
            >
              Add restaurant
            </button>
            <button
              type="button"
              onClick={onAddMobileShop}
              className={`${pill} border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] text-[var(--lv-muted-strong)] hover:bg-[var(--lv-surface-muted)] hover:text-[var(--lv-heading)]`}
            >
              Add mobile shop
            </button>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            className={`${pill} hidden border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] text-[var(--lv-muted-strong)] hover:bg-[var(--lv-surface-muted)] hover:text-[var(--lv-heading)] sm:inline-flex`}
          >
            Home
          </Link>
          <button
            type="button"
            onClick={onSignOutIntent}
            className={`${pill} border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] text-[var(--lv-heading)] hover:bg-[var(--lv-surface-muted)]`}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

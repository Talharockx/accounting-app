"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils/cn";

type DashboardSidebarProps = {
  businessId: string;
  businessName: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const navItems = [
  { label: "Overview", slug: "" },
  { label: "Daily Entry", slug: "daily-entry" },
  { label: "Transactions", slug: "transactions" },
  { label: "Reports", slug: "reports" },
  { label: "Settings", slug: "settings" },
];

export function DashboardSidebar({
  businessId,
  businessName,
  mobileOpen,
  onCloseMobile,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    cn(
      "block rounded-xl px-4 py-2.5 text-sm font-medium transition hover:scale-[1.01]",
      active
        ? "bg-[var(--lv-accent-soft)] text-[var(--lv-heading)] ring-1 ring-blue-500/25 dark:ring-cyan-400/35"
        : "text-[var(--lv-muted-strong)] hover:bg-[var(--lv-surface-muted)] hover:text-[var(--lv-heading)]",
    );

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />
      <aside
        id="workspace-sidebar-nav"
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-[min(19rem,92vw)] overflow-y-auto border-r p-5 transition-transform duration-300 ease-out lg:static lg:z-0 lg:h-auto lg:w-full lg:translate-x-0 lg:overflow-visible lg:border-r-0 lg:p-0 lg:duration-0 dark:border-white/10 lg:dark:border-transparent",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "glass-panel-strong rounded-none lg:rounded-2xl lg:p-5",
        )}
      >
        <div className="mb-6 border-b border-[var(--lv-border)] pb-4">
          <p className="text-xs uppercase tracking-wide text-[var(--lv-accent)]">LedgerView workspace</p>
          <p className="mt-2 text-lg font-semibold text-[var(--lv-heading)]">{businessName}</p>
          <div className="mt-4">
            <ThemeToggle className="w-full justify-center sm:w-auto" />
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const href = item.slug
              ? `/dashboard/${businessId}/${item.slug}`
              : `/dashboard/${businessId}`;
            const active = pathname === href;

            return (
              <Link
                key={item.label}
                href={href}
                onClick={() => onCloseMobile()}
                className={linkClass(active)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

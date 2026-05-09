"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

import { WORKSPACE_NAV } from "./workspace-nav";

type Props = {
  businessId: string;
};

/** Primary workspace navigation on viewports &lt; 768px (replaces sidebar). */
export function DashboardBottomNav({ businessId }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-[60] pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden pointer-events-none"
      aria-label="Workspace"
    >
      <div className="pointer-events-auto mx-3 flex max-w-lg items-stretch gap-1 rounded-2xl rounded-b-xl border border-[#ffffff10] bg-[#0B0E14]/94 px-2 py-2 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-md">
        {WORKSPACE_NAV.map((item) => {
          const href = item.slug ? `/dashboard/${businessId}/${item.slug}` : `/dashboard/${businessId}`;
          const active = pathname === href;
          return (
            <Link
              key={item.slug || "overview"}
              href={href}
              className={cn(
                "flex min-h-[52px] min-w-0 flex-1 cursor-pointer touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold uppercase tracking-wide transition-colors active:scale-[0.97]",
                active
                  ? "bg-[color-mix(in_srgb,var(--lv-accent)_14%,transparent)] text-[var(--lv-heading)] ring-1 ring-[#ffffff12]"
                  : "text-[var(--lv-muted-strong)] hover:bg-[#ffffff06] hover:text-[var(--lv-heading)]",
              )}
            >
              <span className="leading-tight">{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

import type { BusinessType } from "@/lib/business-types";

import { workspaceNavForBusiness } from "./workspace-nav";

type DashboardSidebarProps = {
  businessId: string;
  businessName: string;
  businessType: BusinessType;
};

/** Tablet/desktop sidebar (≥768px); smaller viewports use `DashboardBottomNav` */
export function DashboardSidebar({ businessId, businessName, businessType }: DashboardSidebarProps) {
  const pathname = usePathname();
  const navItems = workspaceNavForBusiness(businessType);

  const linkClass = (active: boolean) =>
    cn(
      "relative flex min-h-[48px] cursor-pointer touch-manipulation items-center rounded-xl px-4 text-sm font-semibold tracking-tight transition-colors duration-200 active:scale-[0.98]",
      active
        ? "bg-[color-mix(in_srgb,var(--lv-accent)_16%,transparent)] text-[var(--lv-heading)] ring-1 ring-[#ffffff14]"
        : "text-[var(--lv-muted-strong)] hover:bg-[#ffffff08] hover:text-[var(--lv-heading)]",
    );

  return (
    <aside
      id="workspace-sidebar-nav"
      className={cn(
        "hidden h-fit w-full flex-col rounded-[1.625rem] border border-[#ffffff10] bg-[#151921]/80 p-6 backdrop-blur-md md:flex",
        "shadow-[var(--lv-bento-shadow)]",
      )}
    >
      <div className="mb-6 border-b border-[#ffffff10] pb-5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-accent)]">
          LedgerView
        </p>
        <p className="mt-2 text-lg font-bold tracking-tight text-[var(--lv-heading)]">{businessName}</p>
      </div>

      <nav className="flex flex-col gap-1.5">
        {navItems.map((item, i) => {
          const href = item.slug ? `/dashboard/${businessId}/${item.slug}` : `/dashboard/${businessId}`;
          const active = pathname === href;

          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32, delay: i * 0.04 }}
            >
              <Link href={href} className={linkClass(active)}>
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>
    </aside>
  );
}

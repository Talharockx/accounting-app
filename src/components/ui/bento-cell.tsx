"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

const hoverSpring = { type: "spring" as const, stiffness: 420, damping: 28 };

type BentoCellProps = {
  children: ReactNode;
  className?: string;
  featured?: boolean;
  layoutId?: string;
};

/** Bento tile: exaggerated rounding, liquid-glass styling, lift on hover */
export function BentoCell({ children, className, featured, layoutId }: BentoCellProps) {
  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      whileHover={{
        y: -5,
        transition: hoverSpring,
      }}
      className={cn(
        "group/lv-bento relative flex min-h-0 flex-col rounded-[1.625rem]",
        "border border-[color-mix(in_srgb,var(--lv-glass-edge)_72%,transparent)]",
        "bg-[var(--lv-liquid-fill)] backdrop-blur-2xl backdrop-saturate-200",
        "shadow-[var(--lv-bento-shadow)]",
        "outline outline-1 outline-white/[0.04] dark:outline-white/[0.06]",
        "transition-[background-color,backdrop-filter,box-shadow,border-color,border-radius] duration-[420ms] ease-out",
        "hover:border-[color-mix(in_srgb,var(--lv-glass-edge)_92%,transparent)]",
        "hover:bg-[var(--lv-liquid-fill-hover)] hover:backdrop-blur-3xl",
        "hover:shadow-[var(--lv-bento-shadow-hover)]",
        featured &&
          "ring-1 ring-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] dark:ring-[color-mix(in_srgb,var(--lv-accent)_28%,transparent)]",
        className,
      )}
    >
      {/* Soft inner sheen */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[1.625rem] opacity-40 dark:opacity-25 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--lv-accent)_12%,transparent),transparent_45%,color-mix(in_srgb,var(--lv-heading)_06%,transparent))]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.div>
  );
}

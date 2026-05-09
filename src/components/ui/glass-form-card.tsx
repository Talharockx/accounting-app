"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function GlassFormCard({
  children,
  title,
  description,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border border-[#ffffff10] bg-[#151921]/90 p-6 shadow-lg shadow-black/30 backdrop-blur-md sm:p-7 ${className}`}
    >
      {title ? (
        <div className="mb-5">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--lv-heading)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-[var(--lv-muted-strong)]">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </motion.div>
  );
}

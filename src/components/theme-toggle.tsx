"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? resolvedTheme ?? theme : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch theme (current ${current})`}
      disabled={!mounted}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--lv-muted-strong)] transition hover:border-cyan-500/35 hover:bg-[var(--lv-surface-muted)] hover:text-[var(--lv-heading)] dark:hover:border-cyan-400/30 ${className}`}
      onClick={() => setTheme(current === "dark" ? "light" : "dark")}
    >
      <span aria-hidden>{current === "dark" ? "Light" : "Dark"} mode</span>
      <span
        className="flex h-5 w-10 items-center rounded-full bg-slate-300 p-0.5 dark:bg-slate-700"
        aria-hidden
      >
        <span
          className={`inline-block size-4 rounded-full bg-white shadow-sm transition-all dark:bg-slate-900 ${current === "dark" ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}

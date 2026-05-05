import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen lv-page px-6 py-12 text-[var(--foreground)] sm:px-8">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex text-lg font-semibold tracking-tight text-[var(--lv-heading)] hover:opacity-90"
          >
            Ledger<span className="text-[var(--lv-accent)]">View</span>
          </Link>
          <div className="glass-panel-strong mt-6 rounded-[1.65rem] p-10 text-center shadow-xl shadow-slate-900/10 dark:shadow-black/35">
            <h1 className="text-balance text-3xl font-semibold text-[var(--lv-heading)]">{title}</h1>
            <p className="mt-4 text-[var(--lv-muted-strong)]">{subtitle}</p>
            <div className="mt-8 text-left">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { LedgerLogoNavLink } from "@/components/layout/ledger-logo-link";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen lv-page px-4 py-10 text-[var(--foreground)] sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="text-center">
          <LedgerLogoNavLink className="justify-center" />
          <div className="mt-6 rounded-[1.65rem] border border-[#ffffff10] bg-[#151921]/75 p-8 text-center shadow-[var(--lv-bento-shadow)] backdrop-blur-md sm:p-10">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--lv-muted-strong)]">{subtitle}</p>
            <div className="mt-8 text-left">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

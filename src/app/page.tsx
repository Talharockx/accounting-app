import Link from "next/link";

import { formatCurrency } from "@/lib/utils/formatters";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#2563eb40,_transparent_55%)]" />
      <div className="absolute -left-24 top-28 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -right-24 bottom-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-24 md:px-10">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              LedgerView
            </span>

            <div className="space-y-5">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Smart Accounting for
                <span className="bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                  {" "}
                  Restaurants & Mobile Shops
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-300">
                Manage daily sales, expenses, invoices, and cash flow in one modern dashboard.
                Built for fast-moving restaurant operations and mobile retail businesses that need
                clarity at a glance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-7 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:scale-[1.01] hover:from-cyan-300 hover:to-blue-400"
              >
                Get Started
              </Link>
              <p className="text-sm text-slate-400">No setup hassle. Start in minutes.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
            <div className="space-y-4">
              <p className="text-sm font-medium text-cyan-200">Business Snapshot</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs text-slate-400">Today Sales</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(4280)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs text-slate-400">Net Profit</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrency(1190)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs text-slate-400">Open Invoices</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(980)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs text-slate-400">Expenses</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-300">{formatCurrency(730)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

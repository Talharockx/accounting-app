"use client";

import { formatCurrency } from "@/lib/utils/formatters";
import type { GroceryDayTotals } from "@/lib/dashboard/grocery-daily-entry";

export type GroceryLedgerRow = GroceryDayTotals & { date: string };

function sumLedgerRows(rows: GroceryLedgerRow[]): GroceryDayTotals {
  return rows.reduce(
    (acc, row) => ({
      bankSaleTotal: acc.bankSaleTotal + row.bankSaleTotal,
      cashSaleTotal: acc.cashSaleTotal + row.cashSaleTotal,
      totalSale: acc.totalSale + row.totalSale,
      companyAmadari: acc.companyAmadari + row.companyAmadari,
      companyCipPat: acc.companyCipPat + row.companyCipPat,
      companyEurospin: acc.companyEurospin + row.companyEurospin,
      companyAia: acc.companyAia + row.companyAia,
      companyExpenses: acc.companyExpenses + row.companyExpenses,
      cheques: acc.cheques + row.cheques,
      affitto: acc.affitto + row.affitto,
      bolletta: acc.bolletta + row.bolletta,
      commercialista: acc.commercialista + row.commercialista,
      stipendio: acc.stipendio + row.stipendio,
      personExpenses: acc.personExpenses + row.personExpenses,
      kametti: acc.kametti + row.kametti,
      vodafone: acc.vodafone + row.vodafone,
      spesaPos: acc.spesaPos + row.spesaPos,
      cashExpense: acc.cashExpense + row.cashExpense,
      extra: acc.extra + row.extra,
      spesaTotal: acc.spesaTotal + row.spesaTotal,
      totalProfit: acc.totalProfit + row.totalProfit,
    }),
    {
      bankSaleTotal: 0,
      cashSaleTotal: 0,
      totalSale: 0,
      companyAmadari: 0,
      companyCipPat: 0,
      companyEurospin: 0,
      companyAia: 0,
      companyExpenses: 0,
      cheques: 0,
      affitto: 0,
      bolletta: 0,
      commercialista: 0,
      stipendio: 0,
      personExpenses: 0,
      kametti: 0,
      vodafone: 0,
      spesaPos: 0,
      cashExpense: 0,
      extra: 0,
      spesaTotal: 0,
      totalProfit: 0,
    },
  );
}

export function GroceryTransactionsTable({ rows }: { rows: GroceryLedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--lv-muted-strong)]">
        No grocery entries for this month. Save days in Daily Entry first.
      </p>
    );
  }

  const totals = sumLedgerRows(rows);

  const columns: { key: keyof GroceryDayTotals; label: string; profit?: boolean }[] = [
    { key: "bankSaleTotal", label: "Bank sale" },
    { key: "cashSaleTotal", label: "Cash sale" },
    { key: "totalSale", label: "Total sale" },
    { key: "companyAmadari", label: "Amadari" },
    { key: "companyCipPat", label: "Cip./Pat." },
    { key: "companyEurospin", label: "Eurospin" },
    { key: "companyAia", label: "Aia" },
    { key: "spesaTotal", label: "Spesa total" },
    { key: "cheques", label: "Cheques" },
    { key: "totalProfit", label: "Total profit", profit: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="lv-tabular-mono min-w-[1100px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">
            <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-3 text-right font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.date}
              className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_35%,transparent)] text-[var(--lv-heading)] last:border-0 hover:bg-[color-mix(in_srgb,var(--lv-accent)_05%,transparent)]"
            >
              <td className="whitespace-nowrap px-4 py-3.5 text-[var(--lv-muted-strong)]">{row.date}</td>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3.5 text-right ${
                    col.key === "totalSale" ? "font-semibold" : ""
                  } ${
                    col.profit
                      ? row.totalProfit >= 0
                        ? "font-semibold text-[var(--lv-traffic-positive)]"
                        : "font-semibold text-[var(--lv-traffic-critical)]"
                      : ""
                  }`}
                >
                  {formatCurrency(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--lv-accent)_8%,transparent)] font-semibold">
            <td className="whitespace-nowrap px-4 py-3.5">Month total</td>
            {columns.map((col) => (
              <td
                key={col.key}
                className={`whitespace-nowrap px-4 py-3.5 text-right ${
                  col.profit
                    ? totals.totalProfit >= 0
                      ? "text-[var(--lv-traffic-positive)]"
                      : "text-[var(--lv-traffic-critical)]"
                    : ""
                }`}
              >
                {formatCurrency(totals[col.key])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

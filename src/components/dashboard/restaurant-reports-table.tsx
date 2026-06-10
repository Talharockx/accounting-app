"use client";

import { formatCurrency } from "@/lib/utils/formatters";
import type { RestaurantReportMatrix } from "@/lib/reports/restaurant-report-matrix";

export function RestaurantReportsTable({ matrix }: { matrix: RestaurantReportMatrix }) {
  if (matrix.rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--lv-muted-strong)]">
        No restaurant entries for this month. Save days in Daily Entry first.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="lv-tabular-mono min-w-[1100px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">
            <th className="sticky left-0 z-[1] whitespace-nowrap bg-[var(--lv-liquid-fill)] px-4 py-3 font-medium">
              Date
            </th>
            {matrix.columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-4 py-3 text-right font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr
              key={row.dateISO}
              className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_35%,transparent)] text-[var(--lv-heading)] last:border-0 hover:bg-[color-mix(in_srgb,var(--lv-accent)_05%,transparent)]"
            >
              <td className="sticky left-0 z-[1] whitespace-nowrap bg-[var(--lv-liquid-fill)] px-4 py-3.5 text-[var(--lv-muted-strong)]">
                {row.displayDate}
              </td>
              {matrix.columns.map((col) => {
                const v = row.amounts[col] ?? 0;
                const isTotalSale = col === "Total Sale";
                const isTotalSpesa = col === "Total Spesa";
                return (
                  <td
                    key={col}
                    className={`whitespace-nowrap px-4 py-3.5 text-right ${
                      isTotalSale ? "font-semibold" : ""
                    } ${isTotalSpesa ? "font-semibold text-[var(--lv-muted-strong)]" : ""}`}
                  >
                    {v > 0 ? formatCurrency(v) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] font-semibold text-[var(--lv-heading)]">
            <th
              scope="row"
              className="sticky left-0 z-[1] whitespace-nowrap bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-[var(--lv-accent)]"
            >
              Grand total
            </th>
            {matrix.columnTotals.map((total, i) => (
              <td key={matrix.columns[i]} className="whitespace-nowrap px-4 py-3.5 text-right">
                {formatCurrency(total)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

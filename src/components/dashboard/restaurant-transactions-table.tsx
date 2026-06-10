"use client";

import { formatCurrency } from "@/lib/utils/formatters";
import type { RestaurantDayTotals } from "@/lib/dashboard/restaurant-daily-entry";

export type RestaurantLedgerRow = RestaurantDayTotals & { date: string };

function sumLedgerRows(rows: RestaurantLedgerRow[]): RestaurantDayTotals {
  return rows.reduce(
    (acc, row) => ({
      bankSaleTotal: acc.bankSaleTotal + row.bankSaleTotal,
      cashSaleTotal: acc.cashSaleTotal + row.cashSaleTotal,
      companySaleTotal: acc.companySaleTotal + row.companySaleTotal,
      glovo: acc.glovo + row.glovo,
      justEat: acc.justEat + row.justEat,
      deliveroo: acc.deliveroo + row.deliveroo,
      totalSale: acc.totalSale + row.totalSale,
      kebabPurchase: acc.kebabPurchase + row.kebabPurchase,
      ccPurchase: acc.ccPurchase + row.ccPurchase,
      otherSpesa: acc.otherSpesa + row.otherSpesa,
      rent: acc.rent + row.rent,
      personPurchases: acc.personPurchases + row.personPurchases,
      totalSpesa: acc.totalSpesa + row.totalSpesa,
      totalProfit: acc.totalProfit + row.totalProfit,
    }),
    {
      bankSaleTotal: 0,
      cashSaleTotal: 0,
      companySaleTotal: 0,
      glovo: 0,
      justEat: 0,
      deliveroo: 0,
      totalSale: 0,
      kebabPurchase: 0,
      ccPurchase: 0,
      otherSpesa: 0,
      rent: 0,
      personPurchases: 0,
      totalSpesa: 0,
      totalProfit: 0,
    },
  );
}

type RestaurantTransactionsTableProps = {
  rows: RestaurantLedgerRow[];
  deletingDate?: string | null;
  onEdit?: (row: RestaurantLedgerRow) => void;
  onDelete?: (date: string) => void;
  footerLabel?: string;
};

export function RestaurantTransactionsTable({
  rows,
  deletingDate,
  onEdit,
  onDelete,
  footerLabel = "Total",
}: RestaurantTransactionsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--lv-muted-strong)]">
        No restaurant entries for this month. Save days in Daily Entry first.
      </p>
    );
  }

  const totals = sumLedgerRows(rows);

  const columns: { key: keyof RestaurantDayTotals; label: string; profit?: boolean }[] = [
    { key: "bankSaleTotal", label: "Bank sale" },
    { key: "cashSaleTotal", label: "Cash sale" },
    { key: "companySaleTotal", label: "Glovo / Just Eat / Deliveroo" },
    { key: "totalSale", label: "Total sale" },
    { key: "kebabPurchase", label: "Kebab" },
    { key: "ccPurchase", label: "C & C" },
    { key: "otherSpesa", label: "Other spesa" },
    { key: "rent", label: "Rent" },
    { key: "personPurchases", label: "Person purch." },
    { key: "totalSpesa", label: "Total spesa" },
    { key: "totalProfit", label: "Profit / loss", profit: true },
  ];

  const hasActions = onEdit || onDelete;

  return (
    <div className="overflow-x-auto">
      <table className="lv-tabular-mono min-w-[1200px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_55%,transparent)] text-xs uppercase tracking-wide text-[var(--lv-muted-strong)]">
            <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-3 text-right font-medium">
                {col.label}
              </th>
            ))}
            {hasActions ? <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th> : null}
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
              {hasActions ? (
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit ? (
                      <button
                        type="button"
                        aria-label="Edit day"
                        title="Edit day"
                        onClick={() => onEdit(row)}
                        className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border border-[#ffffff10] p-2 text-[var(--lv-muted-strong)] transition hover:bg-[#ffffff07] hover:text-[var(--lv-heading)]"
                      >
                        ✎
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        aria-label="Delete day"
                        title="Delete day"
                        disabled={deletingDate === row.date}
                        onClick={() => onDelete(row.date)}
                        className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border border-[#ffffff10] p-2 text-[var(--lv-traffic-critical)] transition hover:bg-[color-mix(in_srgb,var(--lv-traffic-critical)_12%,transparent)] disabled:opacity-50"
                      >
                        🗑
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] font-semibold text-[var(--lv-heading)]">
            <th scope="row" className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-[var(--lv-accent)]">
              {footerLabel}
            </th>
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
            {hasActions ? <td className="px-4 py-3.5" aria-hidden /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

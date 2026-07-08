"use client";

import { sumMobileTransactionLedgerRows, type MobileTransactionLedgerRow } from "@/lib/dashboard/mobile-transaction-ledger";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";

function formatLedgerDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function profitClass(value: number): string {
  if (value > 0) return "text-[var(--lv-traffic-positive)]";
  if (value < 0) return "text-[var(--lv-traffic-critical)]";
  return "text-[var(--lv-traffic-neutral)]";
}

function AmountCell({
  value,
  emphasize,
  profitTone,
}: {
  value: number;
  emphasize?: boolean;
  profitTone?: boolean;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-right tabular-nums",
        emphasize && "font-semibold text-[var(--lv-heading)]",
        !emphasize && !profitTone && "text-[var(--lv-muted-strong)]",
        profitTone && `font-semibold ${profitClass(value)}`,
      )}
    >
      {formatCurrency(value)}
    </td>
  );
}

function LedgerRowCells({ row }: { row: MobileTransactionLedgerRow }) {
  return (
    <>
      <td className="sticky left-0 z-[1] whitespace-nowrap bg-[color-mix(in_srgb,var(--lv-liquid-fill)_92%,transparent)] px-3 py-2.5 text-[var(--lv-muted-strong)] backdrop-blur-sm">
        {formatLedgerDate(row.date)}
      </td>
      <AmountCell value={row.simSale} />
      <AmountCell value={row.simBuy} />
      <AmountCell value={row.simProfit} profitTone />
      <AmountCell value={row.mobileSale} />
      <AmountCell value={row.mobileBuy} />
      <AmountCell value={row.mobileProfit} profitTone />
      <AmountCell value={row.accessorySale} />
      <AmountCell value={row.accessoryBuy} />
      <AmountCell value={row.accessoryProfit} profitTone />
      <AmountCell value={row.rwind} />
      <AmountCell value={row.rwoda} />
      <AmountCell value={row.repair} />
      <AmountCell value={row.extras} />
      <AmountCell value={row.totalSale} emphasize />
      <AmountCell value={row.pos} />
      <AmountCell value={row.totalCashSale} />
      <AmountCell value={row.cashExpense} />
      <AmountCell value={row.bankExpense} />
      <AmountCell value={row.lastBalance} profitTone />
    </>
  );
}

const HEADERS: { label: string; title?: string }[] = [
  { label: "Date" },
  { label: "Sim sale" },
  { label: "Sim buy" },
  { label: "Sim profit", title: "Sim sale − Sim buy" },
  { label: "Mobile sale" },
  { label: "Mobile buy" },
  { label: "Mobile profit", title: "Mobile sale − Mobile buy" },
  { label: "Access. sale" },
  { label: "Access. buy" },
  { label: "Access. profit", title: "Accessories sale − Accessories buy" },
  { label: "R.Wind" },
  { label: "R.Voda" },
  { label: "Repair" },
  { label: "Extras" },
  { label: "Total sale", title: "SIM + mobile + accessories + repair + extras + R.Wind + R.Voda" },
  { label: "POS" },
  { label: "Total cash sale", title: "Total sale − POS" },
  { label: "Cash expense" },
  { label: "Bank expense" },
  {
    label: "Total profit",
    title: "Total sale − (Cash expense + Bank expense)",
  },
];

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function MobileTransactionsLedgerTable({
  rows,
  deletingDate,
  onEdit,
  onDelete,
  footerLabel,
}: {
  rows: MobileTransactionLedgerRow[];
  deletingDate: string | null;
  onEdit: (date: string) => void;
  onDelete: (date: string) => void;
  footerLabel: string;
}) {
  const totals = sumMobileTransactionLedgerRows(rows);

  return (
    <div className="overflow-x-auto rounded-[1.625rem] border border-[color-mix(in_srgb,var(--lv-glass-edge)_45%,transparent)] bg-[var(--lv-liquid-fill)] shadow-[var(--lv-bento-shadow)] backdrop-blur-3xl">
      <table className="lv-tabular-mono w-full min-w-[2200px] text-left text-sm">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_42%,transparent)] text-[0.65rem] uppercase tracking-wide text-[var(--lv-muted-strong)]">
            {HEADERS.map((h) => (
              <th key={h.label} className="px-3 py-3 font-medium" title={h.title}>
                {h.label}
              </th>
            ))}
            <th className="sticky right-0 z-[1] bg-[color-mix(in_srgb,var(--lv-liquid-fill)_92%,transparent)] px-3 py-3 text-right font-medium backdrop-blur-sm">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.date}
              className="border-b border-[color-mix(in_srgb,var(--lv-glass-edge)_35%,transparent)] text-[var(--lv-heading)] last:border-0 hover:bg-[color-mix(in_srgb,var(--lv-accent)_05%,transparent)]"
            >
              <LedgerRowCells row={row} />
              <td className="sticky right-0 z-[1] whitespace-nowrap bg-[color-mix(in_srgb,var(--lv-liquid-fill)_92%,transparent)] px-3 py-2.5 text-right backdrop-blur-sm">
                <RowActions date={row.date} deletingDate={deletingDate} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)]">
            <th
              scope="row"
              className="sticky left-0 z-[1] whitespace-nowrap bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-[var(--lv-accent)] backdrop-blur-sm"
            >
              {footerLabel}
            </th>
            <AmountCell value={totals.simSale} emphasize />
            <AmountCell value={totals.simBuy} emphasize />
            <AmountCell value={totals.simProfit} profitTone />
            <AmountCell value={totals.mobileSale} emphasize />
            <AmountCell value={totals.mobileBuy} emphasize />
            <AmountCell value={totals.mobileProfit} profitTone />
            <AmountCell value={totals.accessorySale} emphasize />
            <AmountCell value={totals.accessoryBuy} emphasize />
            <AmountCell value={totals.accessoryProfit} profitTone />
            <AmountCell value={totals.rwind} emphasize />
            <AmountCell value={totals.rwoda} emphasize />
            <AmountCell value={totals.repair} emphasize />
            <AmountCell value={totals.extras} emphasize />
            <AmountCell value={totals.totalSale} emphasize />
            <AmountCell value={totals.pos} emphasize />
            <AmountCell value={totals.totalCashSale} emphasize />
            <AmountCell value={totals.cashExpense} emphasize />
            <AmountCell value={totals.bankExpense} emphasize />
            <AmountCell value={totals.lastBalance} profitTone />
            <td className="sticky right-0 z-[1] bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] px-3 py-3.5 backdrop-blur-sm" aria-hidden />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}


function RowActions({
  date,
  deletingDate,
  onEdit,
  onDelete,
}: {
  date: string;
  deletingDate: string | null;
  onEdit: (date: string) => void;
  onDelete: (date: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        aria-label={`Edit ${date}`}
        title="Edit day"
        onClick={() => onEdit(date)}
        className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border border-[#ffffff10] p-2 text-[var(--lv-muted-strong)] transition hover:bg-[#ffffff07] hover:text-[var(--lv-heading)] active:scale-[0.97]"
      >
        <IconPencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Delete ${date}`}
        title="Delete day"
        disabled={deletingDate === date}
        onClick={() => onDelete(date)}
        className="inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-xl border border-[#ffffff10] p-2 text-[var(--lv-traffic-critical)] transition hover:bg-[color-mix(in_srgb,var(--lv-traffic-critical)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconTrash className="h-4 w-4" />
      </button>
    </div>
  );
}


import type { TransactionWithMeta } from "@/lib/dashboard/daily-entry";
import { roundMoney } from "@/lib/dashboard/daily-entry";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asTxType(v: unknown): TransactionWithMeta["transaction_type"] {
  if (v === "sale" || v === "expense" || v === "repair") return v;
  return "expense";
}

function asMoneyAmount(raw: unknown): number {
  const amount = typeof raw === "string" ? Number.parseFloat(raw.replace(/,/g, ".")) : Number(raw);
  if (!Number.isFinite(amount)) return 0;
  return roundMoney(amount);
}

/** Normalize PostgREST rows into `TransactionWithMeta` without `any`. */
export function mapTransactionRows(raw: unknown): TransactionWithMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: TransactionWithMeta[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    out.push({
      amount: asMoneyAmount(item.amount),
      transaction_type: asTxType(item.transaction_type),
      description: typeof item.description === "string" ? item.description : null,
      transaction_date: typeof item.transaction_date === "string" ? item.transaction_date : "",
      metadata: "metadata" in item ? item.metadata : null,
    });
  }
  return out;
}

export type TransactionListRow = TransactionWithMeta & {
  id: string;
  business_id: string;
};

export function mapTransactionListRows(raw: unknown): TransactionListRow[] {
  if (!Array.isArray(raw)) return [];
  const out: TransactionListRow[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    out.push({
      id: typeof item.id === "string" ? item.id : "",
      business_id: typeof item.business_id === "string" ? item.business_id : "",
      amount: asMoneyAmount(item.amount),
      transaction_type: asTxType(item.transaction_type),
      description: typeof item.description === "string" ? item.description : null,
      transaction_date: typeof item.transaction_date === "string" ? item.transaction_date : "",
      metadata: "metadata" in item ? item.metadata : null,
    });
  }
  return out;
}

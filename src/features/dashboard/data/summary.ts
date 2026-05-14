import type { CashFlowPoint, SummaryMetric } from "@/types/finance";
import { formatCurrency } from "@/lib/utils/formatters";

export const summaryMetrics: SummaryMetric[] = [
  { title: "Total Revenue", value: formatCurrency(128430), change: "+12.8%", trend: "up" },
  { title: "Operating Expense", value: formatCurrency(47215), change: "-4.3%", trend: "down" },
  { title: "Net Profit", value: formatCurrency(81215), change: "+18.1%", trend: "up" },
  { title: "Outstanding Invoices", value: formatCurrency(19780), change: "+2.6%", trend: "up" },
];

export const cashFlowData: CashFlowPoint[] = [
  { month: "Jan", income: 21000, expense: 14500 },
  { month: "Feb", income: 18000, expense: 13900 },
  { month: "Mar", income: 23000, expense: 15100 },
  { month: "Apr", income: 26000, expense: 15900 },
  { month: "May", income: 30000, expense: 16800 },
];

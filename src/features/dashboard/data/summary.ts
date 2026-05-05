import type { CashFlowPoint, SummaryMetric } from "@/types/finance";

export const summaryMetrics: SummaryMetric[] = [
  { title: "Total Revenue", value: "$128,430", change: "+12.8%", trend: "up" },
  { title: "Operating Expense", value: "$47,215", change: "-4.3%", trend: "down" },
  { title: "Net Profit", value: "$81,215", change: "+18.1%", trend: "up" },
  { title: "Outstanding Invoices", value: "$19,780", change: "+2.6%", trend: "up" },
];

export const cashFlowData: CashFlowPoint[] = [
  { month: "Jan", income: 21000, expense: 14500 },
  { month: "Feb", income: 18000, expense: 13900 },
  { month: "Mar", income: 23000, expense: 15100 },
  { month: "Apr", income: 26000, expense: 15900 },
  { month: "May", income: 30000, expense: 16800 },
];

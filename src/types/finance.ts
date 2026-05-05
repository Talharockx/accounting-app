export type SummaryMetric = {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
};

export type CashFlowPoint = {
  month: string;
  income: number;
  expense: number;
};

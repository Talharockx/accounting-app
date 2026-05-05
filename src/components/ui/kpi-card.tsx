import type { SummaryMetric } from "@/types/finance";

type KpiCardProps = {
  metric: SummaryMetric;
};

export function KpiCard({ metric }: KpiCardProps) {
  const trendColor = metric.trend === "up" ? "text-emerald-600" : "text-rose-600";

  return (
    <article className="rounded-xl border border-card-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted">{metric.title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
      <p className={`mt-2 text-sm font-medium ${trendColor}`}>{metric.change} vs last month</p>
    </article>
  );
}

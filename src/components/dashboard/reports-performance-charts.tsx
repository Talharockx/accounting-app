"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatCompactMoney(value: number) {
  if (Math.abs(value) >= 1000)
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return value.toFixed(0);
}

function tooltipMoney(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const tickStyle = { fill: "#64748b", fontSize: 11 };
const gridStroke = "#94a3b8";

const tooltipContentStyle: CSSProperties = {
  borderRadius: "8px",
  border: "1px solid var(--lv-border)",
  background: "var(--lv-glass-strong)",
  color: "var(--lv-heading)",
};

export type SalesVsExpensesDatum = {
  label: string;
  sales: number;
  expenses: number;
};

export type ProfitTrendDatum = {
  label: string;
  profit: number;
};

type Props = {
  salesVsExpenses: SalesVsExpensesDatum[];
  profitTrend: ProfitTrendDatum[];
};

function ChartViewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 min-h-[240px] w-full min-w-0 overflow-x-auto sm:min-h-[280px]">
      <div className="h-[min(22rem,calc(100vw-3rem))] w-full min-h-[inherit] min-w-[260px] sm:min-w-[320px]">
        {children}
      </div>
    </div>
  );
}

export function ReportsPerformanceCharts({ salesVsExpenses, profitTrend }: Props) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <motion.article
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
        className="glass-panel rounded-2xl p-4 sm:p-5"
      >
        <h3 className="text-base font-semibold text-[var(--lv-heading)]">
          Sales vs expenses · last 30 days
        </h3>
        <p className="mt-1 text-xs text-[var(--lv-muted-strong)]">
          Grouped bars show total sales and combined expenses per day relative to your selected period.
        </p>
        <ChartViewport>
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <BarChart data={salesVsExpenses} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
              <XAxis
                dataKey="label"
                tick={tickStyle}
                interval="preserveStartEnd"
                tickMargin={8}
                height={36}
              />
              <YAxis tick={tickStyle} tickFormatter={formatCompactMoney} width={44} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={(value, name) => [
                  tooltipMoney(Number(value ?? 0)),
                  String(name ?? ""),
                ]}
              />
              <Legend
                wrapperStyle={{ color: "#64748b", fontSize: "12px", paddingTop: "8px" }}
                formatter={(value) =>
                  value === "sales"
                    ? "Total sales"
                    : value === "expenses"
                      ? "Total expenses"
                      : value
                }
              />
              <Bar dataKey="sales" name="sales" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expenses" name="expenses" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartViewport>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="glass-panel rounded-2xl p-4 sm:p-5"
      >
        <h3 className="text-base font-semibold text-[var(--lv-heading)]">Profit trend · selected month</h3>
        <p className="mt-1 text-xs text-[var(--lv-muted-strong)]">
          Net profit per day for the calendar month you pick above.
        </p>
        <ChartViewport>
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <LineChart data={profitTrend} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} strokeOpacity={0.35} />
              <XAxis
                dataKey="label"
                tick={tickStyle}
                interval="preserveStartEnd"
                tickMargin={8}
                height={36}
              />
              <YAxis tick={tickStyle} tickFormatter={formatCompactMoney} width={44} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={(value) => [tooltipMoney(Number(value ?? 0)), "Net profit"]}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartViewport>
      </motion.article>
    </div>
  );
}

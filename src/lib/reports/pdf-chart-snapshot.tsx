"use client";

import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
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

import type { ProfitTrendDatum, SalesVsExpensesDatum } from "@/components/dashboard/reports-performance-charts";

const PDF_BG = "#0f172a";
const TICK = "#94a3b8";
const GRID = "#334155";
const SALES_FILL = "#10b981";
const EXPENSES_FILL = "#6366f1";
const PROFIT_STROKE = "#34d399";

function formatCompactMoney(value: number) {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return value.toFixed(0);
}

function tooltipMoney(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const tickProps = { fill: TICK, fontSize: 11 };

function SalesVsExpensesPdfChart({ data }: { data: SalesVsExpensesDatum[] }) {
  return (
    <div
      data-pdf-chart="sales"
      style={{
        width: 900,
        height: 420,
        padding: "20px 24px 28px",
        backgroundColor: PDF_BG,
        boxSizing: "border-box",
        borderRadius: 12,
      }}
    >
      <p style={{ margin: "0 0 6px", color: "#e2e8f0", fontSize: 16, fontWeight: 700, fontFamily: "system-ui" }}>
        Daily sales vs expenses
      </p>
      <p style={{ margin: "0 0 12px", color: TICK, fontSize: 11, fontFamily: "system-ui" }}>
        Grouped bars — same logic as dashboard (selected window)
      </p>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} strokeOpacity={0.6} />
            <XAxis dataKey="label" tick={tickProps} interval="preserveStartEnd" tickMargin={8} height={36} />
            <YAxis tick={tickProps} tickFormatter={formatCompactMoney} width={48} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #1e293b",
                background: "#1e293b",
                color: "#f1f5f9",
              }}
              formatter={(value, name) => [tooltipMoney(Number(value ?? 0)), String(name ?? "")]}
            />
            <Legend
              wrapperStyle={{ color: TICK, fontSize: 12, paddingTop: 8 }}
              formatter={(value) =>
                value === "sales" ? "Total sales" : value === "expenses" ? "Total expenses" : String(value)
              }
            />
            <Bar dataKey="sales" name="sales" fill={SALES_FILL} radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="expenses" name="expenses" fill={EXPENSES_FILL} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProfitTrendPdfChart({ data }: { data: ProfitTrendDatum[] }) {
  return (
    <div
      data-pdf-chart="profit"
      style={{
        width: 900,
        height: 420,
        padding: "20px 24px 28px",
        backgroundColor: PDF_BG,
        boxSizing: "border-box",
        borderRadius: 12,
      }}
    >
      <p style={{ margin: "0 0 6px", color: "#e2e8f0", fontSize: 16, fontWeight: 700, fontFamily: "system-ui" }}>
        Net profit trend
      </p>
      <p style={{ margin: "0 0 12px", color: TICK, fontSize: 11, fontFamily: "system-ui" }}>
        Daily net profit for the reporting month
      </p>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} strokeOpacity={0.6} />
            <XAxis dataKey="label" tick={tickProps} interval="preserveStartEnd" tickMargin={8} height={36} />
            <YAxis tick={tickProps} tickFormatter={formatCompactMoney} width={48} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #1e293b",
                background: "#1e293b",
                color: "#f1f5f9",
              }}
              formatter={(value) => [tooltipMoney(Number(value ?? 0)), "Net profit"]}
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke={PROFIT_STROKE}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0, fill: PROFIT_STROKE }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PdfChartsHost({
  salesVsExpenses,
  profitTrend,
}: {
  salesVsExpenses: SalesVsExpensesDatum[];
  profitTrend: ProfitTrendDatum[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, background: PDF_BG }}>
      <SalesVsExpensesPdfChart data={salesVsExpenses} />
      <ProfitTrendPdfChart data={profitTrend} />
    </div>
  );
}

export type CaptureReportChartsInput = {
  salesVsExpenses: SalesVsExpensesDatum[];
  profitTrend: ProfitTrendDatum[];
};

export async function captureReportChartsForPdf(
  input: CaptureReportChartsInput,
): Promise<{ salesVsExpensesPng: string | null; profitTrendPng: string | null }> {
  if (typeof document === "undefined") {
    return { salesVsExpensesPng: null, profitTrendPng: null };
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-12000px;top:0;pointer-events:none;z-index:-1;width:920px;overflow:hidden;";
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(
    <PdfChartsHost salesVsExpenses={input.salesVsExpenses} profitTrend={input.profitTrend} />,
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((r) => setTimeout(r, 1400));

  const h2cOpts = {
    scale: 2,
    backgroundColor: PDF_BG,
    logging: false,
    useCORS: true,
  } as const;

  let salesVsExpensesPng: string | null = null;
  let profitTrendPng: string | null = null;

  try {
    const salesEl = host.querySelector('[data-pdf-chart="sales"]') as HTMLElement | null;
    const profitEl = host.querySelector('[data-pdf-chart="profit"]') as HTMLElement | null;

    if (salesEl && input.salesVsExpenses.length > 0) {
      const c = await html2canvas(salesEl, h2cOpts);
      salesVsExpensesPng = c.toDataURL("image/png");
    }
    if (profitEl && input.profitTrend.length > 0) {
      const c = await html2canvas(profitEl, h2cOpts);
      profitTrendPng = c.toDataURL("image/png");
    }
  } finally {
    root.unmount();
    document.body.removeChild(host);
  }

  return { salesVsExpensesPng, profitTrendPng };
}

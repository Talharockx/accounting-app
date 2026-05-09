"use client";

import { memo } from "react";
import { cn } from "@/lib/utils/cn";

export type TrafficTone = "positive" | "neutral" | "critical";

const strokeForTone: Record<TrafficTone, string> = {
  positive: "var(--lv-spark-positive)",
  neutral: "var(--lv-spark-neutral)",
  critical: "var(--lv-spark-critical)",
};

const fillForTone: Record<TrafficTone, string> = {
  positive: "rgba(16,185,129,0.12)",
  neutral: "rgba(245,158,11,0.1)",
  critical: "rgba(239,68,68,0.12)",
};

type SparklineProps = {
  values: number[];
  tone?: TrafficTone;
  className?: string;
  width?: number;
  height?: number;
};

/** Axis-free micro line chart for 7-day (or arbitrary) numeric series. */
function SparklineInner({ values, tone = "neutral", className, width = 132, height = 40 }: SparklineProps) {
  const clean = values.length ? values : [0];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min === 0 ? 1 : max - min;
  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = clean.length <= 1 ? 0 : innerW / (clean.length - 1);

  const points = clean.map((v, i) => {
    const x = pad + i * step;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const lineD = points.length >= 2 ? `M ${points.join(" L ")}` : "";
  const firstX = pad;
  const lastX = pad + innerW;
  const lastY =
    pad + innerH - ((clean[clean.length - 1]! - min) / range) * innerH;

  const areaD =
    lineD &&
    `${lineD} L ${lastX.toFixed(2)} ${(height - pad).toFixed(2)} L ${firstX.toFixed(
      2,
    )} ${(height - pad).toFixed(2)} Z`;

  const stroke = strokeForTone[tone];

  return (
    <svg
      className={cn("shrink-0 overflow-visible", className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      {areaD ? (
        <path d={areaD} fill={fillForTone[tone]} stroke="none" vectorEffect="non-scaling-stroke" />
      ) : null}
      {points.length >= 2 ? (
        <>
          <path
            d={lineD}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={lastX} cy={lastY} r={3} fill={stroke} />
        </>
      ) : (
        <line
          x1={pad}
          y1={height / 2}
          x2={width - pad}
          y2={height / 2}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.35}
        />
      )}
    </svg>
  );
}

export const Sparkline = memo(SparklineInner);

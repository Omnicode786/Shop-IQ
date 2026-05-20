"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ArrowUpRight, CircleDot } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { compactNumber, stackedSegments, type SegmentDatum, type TimelineDatum } from "@/lib/chart-helpers";
import { cn } from "@/lib/utils";

type ValueFormat = "compact" | "money" | "number";

const palette = [
  "hsl(var(--shopiq-chart-1))",
  "hsl(var(--shopiq-chart-2))",
  "hsl(var(--shopiq-chart-3))",
  "hsl(var(--shopiq-chart-4))",
  "hsl(var(--shopiq-chart-5))",
  "hsl(var(--shopiq-chart-6))"
];

function tooltipStyle() {
  return {
    border: "1px solid hsl(var(--border) / 0.72)",
    borderRadius: "18px",
    background: "hsl(var(--card) / 0.96)",
    boxShadow: "0 18px 42px hsl(var(--shopiq-ink) / 0.16)",
    color: "hsl(var(--foreground))"
  };
}

function formatValue(value: number, format: ValueFormat = "compact") {
  if (format === "money") return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
  if (format === "number") return Number(value || 0).toLocaleString();
  return compactNumber(Number(value || 0));
}

function formatAxisValue(value: number, format: ValueFormat = "compact") {
  if (format === "money") return compactNumber(Number(value || 0));
  return formatValue(value, format);
}

function formatPercentLabel(percentValue: number, rawValue: number) {
  if (!rawValue) return "0%";
  if (percentValue > 0 && percentValue < 1) return "<1%";
  return `${Math.round(percentValue)}%`;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeSegments(data: SegmentDatum[]) {
  return data
    .map((item) => ({ name: cleanText(item.name), value: Number(item.value || 0) }))
    .filter((item) => item.name && item.value > 0);
}

function normalizeTimeline(data: TimelineDatum[]) {
  return data
    .map((item) => ({
      label: cleanText(item.label) || "Item",
      value: Number(item.value || 0),
      secondary: item.secondary === undefined ? undefined : Number(item.secondary || 0)
    }))
    .filter((item) => item.value > 0 || Number(item.secondary || 0) > 0);
}

function EmptyChartState({ label = "No role-visible chart data yet" }: { label?: string }) {
  return (
    <div className="analytics-empty-state">
      <span>{label}</span>
    </div>
  );
}

function ChartHeader({
  title,
  description,
  badge
}: {
  title: string;
  description?: string;
  badge?: string;
}) {
  const cleanBadge = cleanText(badge);
  const cleanDescription = cleanText(description);

  return (
    <CardHeader className="analytics-card-header">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base tracking-normal" title={title}>{title}</CardTitle>
          {cleanDescription ? <CardDescription className="mt-1 text-xs leading-5">{cleanDescription}</CardDescription> : null}
        </div>
        {cleanBadge ? <span className="analytics-pill" title={cleanBadge}>{cleanBadge}</span> : null}
      </div>
    </CardHeader>
  );
}

export function TrendAreaCard({
  title,
  description,
  value,
  caption,
  data,
  badge = "Trend",
  format = "compact"
}: {
  title: string;
  description?: string;
  value: string;
  caption?: string;
  data: TimelineDatum[];
  badge?: string;
  format?: ValueFormat;
}) {
  const gradientId = useId().replace(/:/g, "");
  const chartData = normalizeTimeline(data);
  const cleanValue = cleanText(value);
  const cleanCaption = cleanText(caption);

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {cleanValue ? <p className="analytics-value" title={cleanValue}>{cleanValue}</p> : null}
            {cleanCaption ? <p className="mt-1 text-xs text-muted-foreground">{cleanCaption}</p> : null}
          </div>
          <span className="analytics-icon-disc">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
        <div className="analytics-chart-frame analytics-chart-frame-sm">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 6, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--shopiq-accent))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--shopiq-accent))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 7" vertical={false} opacity={0.42} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatAxisValue(Number(value), format)} width={38} />
                <Tooltip contentStyle={tooltipStyle()} formatter={(val: number) => [formatValue(Number(val), format), "Value"]} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--shopiq-accent))"
                  strokeWidth={3}
                  fill={`url(#${gradientId})`}
                  isAnimationActive
                  animationBegin={120}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ComparativeBarsCard({
  title,
  description,
  data,
  valueLabel = "Value",
  secondaryLabel = "Secondary",
  badge = "Compare",
  format = "compact"
}: {
  title: string;
  description?: string;
  data: TimelineDatum[];
  valueLabel?: string;
  secondaryLabel?: string;
  badge?: string;
  format?: ValueFormat;
}) {
  const chartData = normalizeTimeline(data);
  const cleanValueLabel = cleanText(valueLabel);
  const cleanSecondaryLabel = cleanText(secondaryLabel);
  const hasSecondary = chartData.some((item) => Number(item.secondary || 0) > 0);

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="analytics-chart-frame analytics-chart-frame-md">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="24%" margin={{ top: 16, right: 8, bottom: 6, left: -16 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 7" vertical={false} opacity={0.42} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatAxisValue(Number(value), format)} width={38} />
                <Tooltip contentStyle={tooltipStyle()} formatter={(val: number, name) => [formatValue(Number(val), format), name === "secondary" ? cleanSecondaryLabel : cleanValueLabel]} />
                <Bar dataKey="value" radius={[14, 14, 5, 5]} fill="hsl(var(--shopiq-accent))" isAnimationActive animationBegin={120} animationDuration={760} />
                {hasSecondary ? <Bar dataKey="secondary" radius={[14, 14, 5, 5]} fill="hsl(var(--shopiq-accent-3))" isAnimationActive animationBegin={220} animationDuration={760} /> : null}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {cleanValueLabel ? <span className="analytics-legend-dot" title={cleanValueLabel} style={{ ["--dot" as string]: "hsl(var(--shopiq-accent))" }}>{cleanValueLabel}</span> : null}
          {cleanSecondaryLabel && hasSecondary ? <span className="analytics-legend-dot" title={cleanSecondaryLabel} style={{ ["--dot" as string]: "hsl(var(--shopiq-accent-3))" }}>{cleanSecondaryLabel}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function DonutBreakdownCard({
  title,
  description,
  data,
  centerValue,
  centerLabel = "Total",
  badge = "Mix",
  format = "compact"
}: {
  title: string;
  description?: string;
  data: SegmentDatum[];
  centerValue: string;
  centerLabel?: string;
  badge?: string;
  format?: ValueFormat;
}) {
  const [activeName, setActiveName] = useState<string | null>(null);
  const baseData = normalizeSegments(data);
  const total = baseData.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const chartData = baseData.map((item, index) => ({
    ...item,
    fill: palette[index % palette.length],
    percentValue: (Number(item.value || 0) / Math.max(total, 1)) * 100
  }));
  const topSegment = [...chartData].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];
  const topPercent = topSegment ? (Number(topSegment.value || 0) / Math.max(total, 1)) * 100 : 0;
  const activeSegment = chartData.find((segment) => segment.name === activeName) || null;
  const cleanCenterLabel = cleanText(centerLabel) || "Total";
  const cleanCenterValue = cleanText(centerValue) || formatValue(total, format);
  const featuredName = activeSegment?.name || topSegment?.name || "";
  const featuredValue = activeSegment?.value ?? Number(topSegment?.value || 0);
  const featuredPercent = activeSegment?.percentValue ?? topPercent;

  return (
    <Card className="analytics-card analytics-donut-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="analytics-donut-shell">
          <div className="analytics-donut-visual">
            <div className="analytics-donut-chart" onMouseLeave={() => setActiveName(null)}>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={tooltipStyle()}
                      formatter={(val: number, name) => [formatValue(Number(val), format), String(name)]}
                    />
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={4}
                      cornerRadius={10}
                      stroke="hsl(var(--card))"
                      strokeWidth={4}
                      isAnimationActive
                      animationBegin={140}
                      animationDuration={920}
                      animationEasing="ease-out"
                      onMouseEnter={(_entry: unknown, index: number) => setActiveName(chartData[index]?.name ?? null)}
                      onMouseLeave={() => setActiveName(null)}
                    >
                      {chartData.map((segment) => (
                        <Cell
                          key={segment.name}
                          fill={segment.fill}
                          opacity={!activeName || activeName === segment.name ? 1 : 0.46}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>
            <div className="analytics-donut-center">
              <span title={activeSegment ? activeSegment.name : cleanCenterLabel}>{activeSegment ? activeSegment.name : cleanCenterLabel}</span>
              <strong title={activeSegment ? formatPercentLabel(activeSegment.percentValue, activeSegment.value) : cleanCenterValue}>{activeSegment ? formatPercentLabel(activeSegment.percentValue, activeSegment.value) : cleanCenterValue}</strong>
              {activeSegment ? <small>{formatValue(activeSegment.value, format)}</small> : null}
            </div>
            {featuredValue && featuredName ? (
              <div className="analytics-donut-chip" title={`${featuredName} ${formatPercentLabel(featuredPercent, featuredValue)}`}>
                {featuredName} {formatPercentLabel(featuredPercent, featuredValue)}
              </div>
            ) : null}
            {activeSegment ? (
              <div className="analytics-donut-hover-card">
                <span className="analytics-legend-dot" style={{ ["--dot" as string]: activeSegment.fill }}>{activeSegment.name}</span>
                <strong>{formatValue(activeSegment.value, format)}</strong>
                <em>{formatPercentLabel(activeSegment.percentValue, activeSegment.value)} of total</em>
              </div>
            ) : null}
          </div>
          <div className="analytics-donut-list">
            {chartData.length ? chartData.slice(0, 6).map((item, index) => {
              const value = Number(item.value || 0);
              const percent = (value / Math.max(total, 1)) * 100;
              const isActive = activeName === item.name;

              return (
                <div
                  key={item.name}
                  className="analytics-donut-row"
                  data-active={isActive || undefined}
                  tabIndex={0}
                  onMouseEnter={() => setActiveName(item.name)}
                  onFocus={() => setActiveName(item.name)}
                  onMouseLeave={() => setActiveName(null)}
                  onBlur={() => setActiveName(null)}
                >
                  <div className="min-w-0">
                    <span className="analytics-legend-dot" title={item.name} style={{ ["--dot" as string]: item.fill }}>{item.name}</span>
                    <div className="analytics-donut-track">
                      <i style={{ width: `${Math.max(percent, value ? 7 : 0)}%`, background: item.fill }} />
                    </div>
                  </div>
                  <div className="analytics-donut-percent">
                    <strong>{formatPercentLabel(percent, value)}</strong>
                    <span>{formatValue(value, format)}</span>
                  </div>
                </div>
              );
            }) : <EmptyChartState />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RingScoreCard({
  title,
  description,
  score,
  value,
  label,
  badge = "Score"
}: {
  title: string;
  description?: string;
  score: number;
  value: string;
  label: string;
  badge?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const cleanValue = cleanText(value) || `${clamped}%`;
  const cleanLabel = cleanText(label) || "Score";

  return (
    <Card className="analytics-card analytics-score-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="grid gap-5 p-5 pt-0 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="analytics-ring" style={{ ["--score" as string]: `${clamped}%` }}>
          <div>
            <strong title={cleanValue}>{cleanValue}</strong>
            <span title={cleanLabel}>{cleanLabel}</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {[clamped, Math.max(8, 100 - clamped), Math.max(12, Math.round(clamped * 0.62))].map((item, index) => (
            <div key={`${item}-${index}`} className="analytics-mini-rail">
              <span>{index === 0 ? "Healthy" : index === 1 ? "Attention" : "Velocity"}</span>
              <div><i style={{ width: `${Math.min(100, item)}%` }} /></div>
              <strong>{Math.min(100, item)}%</strong>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StackedSignalCard({
  title,
  description,
  data,
  totalLabel,
  badge = "Status"
}: {
  title: string;
  description?: string;
  data: SegmentDatum[];
  totalLabel: string;
  badge?: string;
}) {
  const segments = stackedSegments(data);
  const cleanTotalLabel = cleanText(totalLabel);

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        {cleanTotalLabel ? <p className="analytics-value" title={cleanTotalLabel}>{cleanTotalLabel}</p> : null}
        {segments.length ? (
          <>
            <div className="mt-5 flex h-5 overflow-hidden rounded-full bg-muted/55">
              {segments.map((segment, index) => (
                <span key={segment.name} style={{ width: `${Math.max(segment.percent, segment.value ? 4 : 0)}%`, background: palette[index % palette.length] }} />
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {segments.map((segment, index) => (
                <div key={segment.name} className="analytics-segment-line">
                  <span className="analytics-legend-dot" title={segment.name} style={{ ["--dot" as string]: palette[index % palette.length] }}>{segment.name}</span>
                  <strong>{segment.percent}%</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyChartState />
        )}
      </CardContent>
    </Card>
  );
}

export function RankedBarsCard({
  title,
  description,
  rows,
  badge = "Ranked",
  format = "compact"
}: {
  title: string;
  description?: string;
  rows: SegmentDatum[];
  badge?: string;
  format?: ValueFormat;
}) {
  const safeRows = normalizeSegments(rows);
  const max = Math.max(...safeRows.map((row) => row.value), 1);

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="flex flex-col gap-3 p-5 pt-0">
        {safeRows.length ? safeRows.map((row, index) => (
          <div key={row.name} className="ranked-row" title={`${row.name}: ${formatValue(row.value, format)}`}>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate" title={row.name}>{row.name}</span>
              <strong title={formatValue(row.value, format)}>{formatValue(row.value, format)}</strong>
            </div>
            <div className="ranked-track">
              <i style={{ width: `${Math.max(8, (row.value / max) * 100)}%`, background: palette[index % palette.length] }} />
            </div>
          </div>
        )) : <EmptyChartState />}
      </CardContent>
    </Card>
  );
}

export function BubbleInsightCard({
  title,
  description,
  bubbles,
  badge = "Board"
}: {
  title: string;
  description?: string;
  bubbles: Array<{ label: string; value: string | number; size?: "sm" | "md" | "lg" }>;
  badge?: string;
}) {
  const safeBubbles = bubbles
    .map((bubble) => ({ ...bubble, label: cleanText(bubble.label), value: cleanText(bubble.value) }))
    .filter((bubble) => bubble.label && bubble.value);

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="bubble-board">
          {safeBubbles.length ? safeBubbles.map((bubble, index) => (
            <div
              key={bubble.label}
              className={cn("analytics-bubble", bubble.size === "lg" && "is-lg", bubble.size === "sm" && "is-sm")}
              data-long={String(bubble.value).length > 13 ? "true" : undefined}
              style={{ ["--bubble" as string]: palette[index % palette.length] }}
              title={`${bubble.label}: ${bubble.value}`}
            >
              <strong>{bubble.value}</strong>
              <span>{bubble.label}</span>
            </div>
          )) : <EmptyChartState />}
        </div>
      </CardContent>
    </Card>
  );
}

export function CompactStatChart({
  title,
  value,
  detail,
  bars
}: {
  title: string;
  value: string;
  detail: string;
  bars: number[];
}) {
  const cleanTitle = cleanText(title);
  const cleanValue = cleanText(value);
  const cleanDetail = cleanText(detail);
  const safeBars = bars.filter((bar) => Number(bar) > 0);

  return (
    <Card className="analytics-card analytics-compact-card overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {cleanTitle ? <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground" title={cleanTitle}>{cleanTitle}</p> : null}
            {cleanValue ? <p className="mt-3 truncate text-3xl font-semibold tracking-normal" title={cleanValue}>{cleanValue}</p> : null}
            {cleanDetail ? <p className="mt-2 text-xs text-muted-foreground">{cleanDetail}</p> : null}
          </div>
          <span className="analytics-icon-disc">
            <CircleDot className="size-4" />
          </span>
        </div>
        <div className="analytics-spark-bars" aria-hidden="true">
          {safeBars.map((bar, index) => (
            <span key={`${bar}-${index}`} style={{ height: `${bar}%`, animationDelay: `${index * 32}ms` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

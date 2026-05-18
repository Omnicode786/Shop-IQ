"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

const DONUT_SIZE = 240;
const DONUT_CENTER = DONUT_SIZE / 2;
const DONUT_RADIUS = 82;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

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

function buildDonutSegments(data: SegmentDatum[], total: number) {
  const positive = data
    .map((item, index) => ({ ...item, value: Number(item.value || 0), sourceIndex: index }))
    .filter((item) => item.value > 0);
  const gap = positive.length > 1 ? 5 : 0;
  let offset = 0;

  return positive.map((item) => {
    const rawLength = (item.value / Math.max(total, 1)) * DONUT_CIRCUMFERENCE;
    const segment = {
      ...item,
      length: Math.max(rawLength - gap, 0),
      offset,
      percentValue: (item.value / Math.max(total, 1)) * 100
    };
    offset += rawLength;
    return segment;
  });
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
  return (
    <CardHeader className="analytics-card-header">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-base tracking-normal">{title}</CardTitle>
          {description ? <CardDescription className="mt-1 text-xs leading-5">{description}</CardDescription> : null}
        </div>
        {badge ? <span className="analytics-pill">{badge}</span> : null}
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

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="analytics-value">{value}</p>
            {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}
          </div>
          <span className="analytics-icon-disc">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 6, bottom: 0, left: -16 }}>
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
              <Area type="monotone" dataKey="value" stroke="hsl(var(--shopiq-accent))" strokeWidth={3} fill={`url(#${gradientId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
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
  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="24%" margin={{ top: 16, right: 8, bottom: 6, left: -16 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 7" vertical={false} opacity={0.42} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatAxisValue(Number(value), format)} width={38} />
              <Tooltip contentStyle={tooltipStyle()} formatter={(val: number, name) => [formatValue(Number(val), format), name === "secondary" ? secondaryLabel : valueLabel]} />
              <Bar dataKey="value" radius={[14, 14, 5, 5]} fill="hsl(var(--shopiq-accent))" isAnimationActive={false} />
              <Bar dataKey="secondary" radius={[14, 14, 5, 5]} fill="hsl(var(--shopiq-accent-3))" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="analytics-legend-dot" style={{ ["--dot" as string]: "hsl(var(--shopiq-accent))" }}>{valueLabel}</span>
          <span className="analytics-legend-dot" style={{ ["--dot" as string]: "hsl(var(--shopiq-accent-3))" }}>{secondaryLabel}</span>
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
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const segments = buildDonutSegments(data, total);
  const topSegment = [...data].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];
  const topPercent = topSegment ? (Number(topSegment.value || 0) / Math.max(total, 1)) * 100 : 0;
  const activeSegment = segments.find((segment) => segment.name === activeName) || null;
  const featuredName = activeSegment?.name || topSegment?.name || "No data";
  const featuredValue = activeSegment?.value ?? Number(topSegment?.value || 0);
  const featuredPercent = activeSegment?.percentValue ?? topPercent;

  return (
    <Card className="analytics-card analytics-donut-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="analytics-donut-shell">
          <div className="analytics-donut-visual">
            <svg className="analytics-donut-svg" viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} role="img" aria-label={`${title}: ${centerValue}`} onMouseLeave={() => setActiveName(null)}>
              <title>{`${title}: ${centerValue}`}</title>
              <circle
                className="analytics-donut-base"
                cx={DONUT_CENTER}
                cy={DONUT_CENTER}
                r={DONUT_RADIUS}
              />
              {segments.map((segment) => (
                <circle
                  key={segment.name}
                  className="analytics-donut-slice"
                  cx={DONUT_CENTER}
                  cy={DONUT_CENTER}
                  r={DONUT_RADIUS}
                  tabIndex={0}
                  aria-label={`${segment.name}: ${formatValue(segment.value, format)}, ${formatPercentLabel(segment.percentValue, segment.value)}`}
                  data-active={activeName === segment.name || undefined}
                  strokeDasharray={`${segment.length} ${Math.max(DONUT_CIRCUMFERENCE - segment.length, 0)}`}
                  strokeDashoffset={-segment.offset}
                  onMouseEnter={() => setActiveName(segment.name)}
                  onFocus={() => setActiveName(segment.name)}
                  onBlur={() => setActiveName(null)}
                  style={{
                    ["--slice-color" as string]: palette[segment.sourceIndex % palette.length],
                    animationDelay: `${segment.sourceIndex * 70}ms`
                  }}
                >
                  <title>{`${segment.name}: ${formatValue(segment.value, format)} (${formatPercentLabel(segment.percentValue, segment.value)})`}</title>
                </circle>
              ))}
            </svg>
            <div className="analytics-donut-center">
              <span>{activeSegment ? activeSegment.name : centerLabel}</span>
              <strong>{activeSegment ? formatPercentLabel(activeSegment.percentValue, activeSegment.value) : centerValue}</strong>
              {activeSegment ? <small>{formatValue(activeSegment.value, format)}</small> : null}
            </div>
            <div className="analytics-donut-chip">
              {featuredValue ? `${featuredName} ${formatPercentLabel(featuredPercent, featuredValue)}` : "No data"}
            </div>
            {activeSegment ? (
              <div className="analytics-donut-hover-card">
                <span className="analytics-legend-dot" style={{ ["--dot" as string]: palette[activeSegment.sourceIndex % palette.length] }}>{activeSegment.name}</span>
                <strong>{formatValue(activeSegment.value, format)}</strong>
                <em>{formatPercentLabel(activeSegment.percentValue, activeSegment.value)} of total</em>
              </div>
            ) : null}
          </div>
          <div className="analytics-donut-list">
            {data.slice(0, 6).map((item, index) => {
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
                    <span className="analytics-legend-dot" style={{ ["--dot" as string]: palette[index % palette.length] }}>{item.name}</span>
                    <div className="analytics-donut-track">
                      <i style={{ width: `${Math.max(percent, value ? 7 : 0)}%`, background: palette[index % palette.length] }} />
                    </div>
                  </div>
                  <div className="analytics-donut-percent">
                    <strong>{formatPercentLabel(percent, value)}</strong>
                    <span>{formatValue(value, format)}</span>
                  </div>
                </div>
              );
            })}
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

  return (
    <Card className="analytics-card analytics-score-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="grid gap-5 p-5 pt-0 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="analytics-ring" style={{ ["--score" as string]: `${clamped}%` }}>
          <div>
            <strong>{value}</strong>
            <span>{label}</span>
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

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <p className="analytics-value">{totalLabel}</p>
        <div className="mt-5 flex h-5 overflow-hidden rounded-full bg-muted/55">
          {segments.map((segment, index) => (
            <span key={segment.name} style={{ width: `${Math.max(segment.percent, segment.value ? 4 : 0)}%`, background: palette[index % palette.length] }} />
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {segments.map((segment, index) => (
            <div key={segment.name} className="analytics-segment-line">
              <span className="analytics-legend-dot" style={{ ["--dot" as string]: palette[index % palette.length] }}>{segment.name}</span>
              <strong>{segment.percent}%</strong>
            </div>
          ))}
        </div>
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
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="flex flex-col gap-3 p-5 pt-0">
        {rows.map((row, index) => (
          <div key={row.name} className="ranked-row">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate">{row.name}</span>
              <strong>{formatValue(row.value, format)}</strong>
            </div>
            <div className="ranked-track">
              <i style={{ width: `${Math.max(8, (row.value / max) * 100)}%`, background: palette[index % palette.length] }} />
            </div>
          </div>
        ))}
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
  return (
    <Card className="analytics-card overflow-hidden">
      <ChartHeader title={title} description={description} badge={badge} />
      <CardContent className="p-5 pt-0">
        <div className="bubble-board">
          {bubbles.map((bubble, index) => (
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
          ))}
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
  return (
    <Card className="analytics-card analytics-compact-card overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
            <p className="mt-3 text-3xl font-semibold tracking-normal">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
          </div>
          <span className="analytics-icon-disc">
            <CircleDot className="size-4" />
          </span>
        </div>
        <div className="analytics-spark-bars" aria-hidden="true">
          {bars.map((bar, index) => (
            <span key={`${bar}-${index}`} style={{ height: `${bar}%`, animationDelay: `${index * 32}ms` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

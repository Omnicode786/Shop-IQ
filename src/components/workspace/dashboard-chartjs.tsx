"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import type { Chart, Plugin } from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RevealChart = Chart & {
  $shopiqCurveRevealProgress?: number;
  $shopiqCurveRevealClipped?: boolean;
  $shopiqEntryAnimationDone?: boolean;
};

function revealEnabled(options: unknown) {
  return Boolean((options as { enabled?: boolean } | undefined)?.enabled);
}

const curveRevealPlugin: Plugin = {
  id: "shopiqCurveReveal",
  beforeInit(chart, _args, options) {
    if (!revealEnabled(options)) return;
    (chart as RevealChart).$shopiqCurveRevealProgress = 0;
  },
  beforeDatasetsDraw(chart, _args, options) {
    if (!revealEnabled(options)) return;
    const revealChart = chart as RevealChart;
    const progress = Math.max(0, Math.min(1, revealChart.$shopiqCurveRevealProgress ?? 0));
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      chartArea.left,
      chartArea.top - 12,
      (chartArea.right - chartArea.left) * progress,
      chartArea.bottom - chartArea.top + 24
    );
    ctx.clip();
    revealChart.$shopiqCurveRevealClipped = true;
  },
  afterDatasetsDraw(chart, _args, options) {
    if (!revealEnabled(options)) return;
    const revealChart = chart as RevealChart;
    if (!revealChart.$shopiqCurveRevealClipped) return;
    chart.ctx.restore();
    revealChart.$shopiqCurveRevealClipped = false;
  }
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler, curveRevealPlugin);

type TimelineDatum = {
  label: string;
  value: number;
  secondary?: number;
};

type SegmentDatum = {
  name: string;
  value: number;
};

type Palette = {
  key: string;
  text: string;
  muted: string;
  grid: string;
  card: string;
  tooltip: string;
  colors: string[];
};

function hslVar(name: string, fallback: string, alpha?: number) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) return fallback;
  return alpha === undefined ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
}

function readPalette(): Palette {
  const colors = Array.from({ length: 6 }, (_, index) => hslVar(`--shopiq-chart-${index + 1}`, `hsl(${220 + index * 24} 80% 56%)`));
  const text = hslVar("--foreground", "hsl(222 20% 12%)");
  const muted = hslVar("--muted-foreground", "hsl(222 12% 45%)");
  const grid = hslVar("--border", "hsl(222 12% 84%)", 0.55);
  const card = hslVar("--card", "hsl(0 0% 100%)", 0.98);
  const tooltip = hslVar("--foreground", "hsl(222 20% 12%)", 0.92);

  return {
    key: [text, muted, grid, card, tooltip, ...colors].join("|"),
    text,
    muted,
    grid,
    card,
    tooltip,
    colors
  };
}

function useChartPalette() {
  const [palette, setPalette] = useState<Palette>(() => ({
    key: "initial",
    text: "hsl(222 20% 12%)",
    muted: "hsl(222 12% 45%)",
    grid: "hsl(222 12% 84% / 0.55)",
    card: "hsl(0 0% 100% / 0.98)",
    tooltip: "hsl(222 20% 12% / 0.92)",
    colors: ["#111827", "#ef4444", "#6366f1", "#f59e0b", "#14b8a6", "#a78bfa"]
  }));

  useEffect(() => {
    const update = () => setPalette(readPalette());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-ui-mode", "data-shadcn-theme"]
    });

    return () => observer.disconnect();
  }, []);

  return palette;
}

function useInViewOnce() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.52, rootMargin: "0px 0px -25% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible };
}

function staggerByDataIndex(context: any, step = 58) {
  if (context.type !== "data") return 0;
  if ((context.chart as RevealChart).$shopiqEntryAnimationDone) return 0;
  return context.dataIndex * step;
}

function completeEntryAnimation(event: any) {
  const chart = event.chart as RevealChart;
  chart.$shopiqEntryAnimationDone = true;
  chart.options.animation = false;
}

function money(value: number) {
  return `PKR ${Math.round(Number(value || 0)).toLocaleString()}`;
}

function compactMoney(value: number) {
  return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
}

function compactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function cleanSegments(data: SegmentDatum[], limit = 7) {
  return [...(data || [])]
    .map((item) => ({ name: String(item.name || "Untitled"), value: Number(item.value || 0) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function cleanTimeline(data: TimelineDatum[]) {
  return (data || [])
    .map((item) => ({ label: String(item.label || ""), value: Number(item.value || 0), secondary: Number(item.secondary || 0) }))
    .filter((item) => item.label && (item.value > 0 || item.secondary > 0));
}

function EmptyChartState({ message = "No chart data for this period yet." }: { message?: string }) {
  return (
    <div className="dashboard-chart-empty">
      <span />
      <p>{message}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  value,
  meta,
  children,
  className,
  compact = false
}: {
  title: string;
  description?: string;
  value?: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const { ref, visible } = useInViewOnce();

  return (
    <div ref={ref} className={cn("dashboard-chart-observer", className)}>
      <Card className="dashboard-chart-card" data-compact={compact || undefined}>
        <CardContent className="dashboard-chart-card-inner">
          <div className="dashboard-chart-heading">
            <div className="min-w-0">
              <p className="dashboard-chart-kicker">{meta || "Live data"}</p>
              <h3>{title}</h3>
              {description ? <p>{description}</p> : null}
            </div>
            {value ? <strong>{value}</strong> : null}
          </div>
          {visible ? children : <div className="dashboard-chart-wait" aria-label="Chart will animate when visible" />}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardRevenueChart({ data, total, label }: { data: TimelineDatum[]; total: number; label: string }) {
  const palette = useChartPalette();
  const points = useMemo(() => cleanTimeline(data), [data]);
  const height = points.length <= 3 ? 192 : 246;

  const chartData = useMemo(
    () => ({
      labels: points.map((item) => item.label),
      datasets: [
        {
          label: "Revenue",
          data: points.map((item) => item.value),
          borderColor: palette.colors[1],
          backgroundColor: hslVar("--primary", "hsl(10 100% 53%)", 0.14),
          pointBackgroundColor: palette.colors[1],
          pointBorderWidth: 0,
          pointRadius: points.length <= 2 ? 4 : 3,
          pointHoverRadius: 5,
          borderWidth: 3,
          fill: true,
          tension: 0.38
        }
      ]
    }),
    [palette, points]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1100,
        easing: "easeOutQuart" as const,
        onProgress: (event: any) => {
          const chart = event.chart as RevealChart;
          chart.$shopiqCurveRevealProgress = event.currentStep / Math.max(event.numSteps, 1);
        },
        onComplete: (event: any) => {
          const chart = event.chart as RevealChart;
          chart.$shopiqCurveRevealProgress = 1;
          completeEntryAnimation(event);
        }
      },
      animations: {
        tension: {
          from: 0.08,
          to: 0.38,
          duration: 1000,
          easing: "easeOutQuart" as const
        }
      },
      interaction: { intersect: false, mode: "index" as const },
      plugins: {
        shopiqCurveReveal: { enabled: true },
        legend: { display: false },
        tooltip: {
          backgroundColor: palette.tooltip,
          titleColor: palette.card,
          bodyColor: palette.card,
          displayColors: false,
          callbacks: {
            label: (context: any) => money(context.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: palette.muted, maxRotation: 0, autoSkip: true }
        },
        y: {
          beginAtZero: true,
          grid: { color: palette.grid, drawBorder: false },
          border: { display: false },
          ticks: {
            color: palette.muted,
            callback: (value: string | number) => compactMoney(Number(value))
          }
        }
      }
    }),
    [palette]
  );

  return (
    <ChartCard title="Revenue trend" description={label} value={money(total)} meta={`${points.length} active day${points.length === 1 ? "" : "s"}`} className="dashboard-chart-card-wide">
      {points.length ? (
        <div className="dashboard-chart-canvas" style={{ height }}>
          <Line key={palette.key} data={chartData} options={options} />
        </div>
      ) : (
        <EmptyChartState message="No revenue has been recorded in the active dashboard window." />
      )}
    </ChartCard>
  );
}

export function DashboardCategoryPie({ data, total }: { data: SegmentDatum[]; total: number }) {
  const palette = useChartPalette();
  const segments = useMemo(() => cleanSegments(data, 6), [data]);
  const visibleTotal = segments.reduce((sum, item) => sum + item.value, 0);
  const height = segments.length <= 3 ? 210 : 248;

  const chartData = useMemo(
    () => ({
      labels: segments.map((item) => item.name),
      datasets: [
        {
          data: segments.map((item) => item.value),
          backgroundColor: segments.map((_, index) => palette.colors[index % palette.colors.length]),
          borderWidth: 0,
          hoverBorderWidth: 0
        }
      ]
    }),
    [palette, segments]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      rotation: -90,
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1050,
        easing: "easeOutQuart" as const,
        delay: (context: any) => staggerByDataIndex(context, 70),
        onComplete: completeEntryAnimation
      },
      animations: {
        circumference: {
          from: 0,
          duration: 1050,
          easing: "easeOutQuart" as const
        },
        rotation: {
          from: -210,
          duration: 1050,
          easing: "easeOutQuart" as const
        },
        outerRadius: {
          duration: 900,
          easing: "easeOutBack" as const
        }
      },
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: palette.text,
            padding: 14,
            usePointStyle: true,
            pointStyle: "circle" as const
          }
        },
        tooltip: {
          backgroundColor: palette.tooltip,
          titleColor: palette.card,
          bodyColor: palette.card,
          callbacks: {
            label: (context: any) => {
              const value = Number(context.parsed || 0);
              const percent = visibleTotal ? Math.round((value / visibleTotal) * 100) : 0;
              return `${context.label}: ${money(value)} (${percent}%)`;
            }
          }
        }
      }
    }),
    [palette, visibleTotal]
  );

  return (
    <ChartCard title="Inventory by category" description="Only categories with actual inventory value are shown." value={compactMoney(total)} meta={`${segments.length} group${segments.length === 1 ? "" : "s"}`} compact>
      {segments.length ? (
        <div className="dashboard-chart-canvas dashboard-pie-canvas" style={{ height }}>
          <Pie key={palette.key} data={chartData} options={options} />
        </div>
      ) : (
        <EmptyChartState message="No inventory value is available for category analysis yet." />
      )}
    </ChartCard>
  );
}

export function DashboardPaymentMixChart({ data }: { data: SegmentDatum[] }) {
  const palette = useChartPalette();
  const rows = useMemo(() => cleanSegments(data, 6), [data]);
  const height = rows.length <= 3 ? 178 : 228;

  const chartData = useMemo(
    () => ({
      labels: rows.map((item) => item.name),
      datasets: [
        {
          label: "Collected",
          data: rows.map((item) => item.value),
          backgroundColor: rows.map((_, index) => palette.colors[(index + 1) % palette.colors.length]),
          borderRadius: 10,
          borderSkipped: false
        }
      ]
    }),
    [palette, rows]
  );

  const options = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 760,
        easing: "easeOutQuart" as const,
        delay: (context: any) => staggerByDataIndex(context, 75),
        onComplete: completeEntryAnimation
      },
      animations: {
        x: {
          from: 0,
          duration: 840,
          easing: "easeOutQuart" as const
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: palette.tooltip,
          titleColor: palette.card,
          bodyColor: palette.card,
          displayColors: false,
          callbacks: {
            label: (context: any) => money(context.parsed.x)
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: palette.grid, drawBorder: false },
          border: { display: false },
          ticks: {
            color: palette.muted,
            callback: (value: string | number) => compactNumber(Number(value))
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: palette.text }
        }
      }
    }),
    [palette]
  );

  return (
    <ChartCard title="Payment mix" description="Collection channels ranked by actual received amount." meta={`${rows.length} method${rows.length === 1 ? "" : "s"}`} compact>
      {rows.length ? (
        <div className="dashboard-chart-canvas" style={{ height }}>
          <Bar key={palette.key} data={chartData} options={options} />
        </div>
      ) : (
        <EmptyChartState message="No payments have been received in this dashboard window." />
      )}
    </ChartCard>
  );
}

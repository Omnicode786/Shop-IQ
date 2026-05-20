import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Stat = {
  label: string;
  value: string | number;
};

type Insight = {
  label: string;
  value: string | number;
};

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function ModuleHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  stats = [],
  badge = "Live module"
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  stats?: Stat[];
  badge?: string;
}) {
  const cleanEyebrow = cleanText(eyebrow);
  const cleanBadge = cleanText(badge);
  const visibleStats = stats
    .map((stat) => ({ label: cleanText(stat.label), value: cleanText(stat.value) }))
    .filter((stat) => stat.label && stat.value);

  return (
    <Card className="module-hero overflow-hidden">
      <CardContent className="relative p-4 md:p-5">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {cleanEyebrow ? <Badge variant="outline" className="hero-badge">{cleanEyebrow}</Badge> : null}
              {cleanBadge ? <Badge variant="secondary">{cleanBadge}</Badge> : null}
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-normal text-white md:text-3xl">{title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/64">{description}</p>
              </div>
            </div>
          </div>
          <div className="hero-value-panel">
            <p className="text-xs uppercase tracking-[0.14em] text-white/54">Workspace</p>
            <p className="mt-1.5 text-xl font-semibold text-white">ShopIQ</p>
            <p className="mt-1 text-xs text-white/58">Role-aware operations</p>
          </div>
        </div>
        {visibleStats.length ? (
          <div className="relative z-10 mt-4 grid gap-2.5 md:grid-cols-3">
            {visibleStats.slice(0, 3).map((stat) => (
              <div key={stat.label} className="module-stat">
                <ArrowUpRight className="size-4" />
                <div className="min-w-0">
                  <p title={stat.label}>{stat.label}</p>
                  <strong title={stat.value}>{stat.value}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ModuleInsightPanel({
  title,
  description,
  icon: Icon,
  insights
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  insights: Insight[];
}) {
  const visibleInsights = insights
    .map((insight) => ({ label: cleanText(insight.label), value: cleanText(insight.value) }))
    .filter((insight) => insight.label && insight.value);

  return (
    <Card className="module-side-panel overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Module signals</p>
            <h3 className="mt-1.5 text-lg font-semibold tracking-normal">{title}</h3>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon className="size-4" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          {visibleInsights.map((insight) => (
            <div key={insight.label} className="module-line">
              <span title={insight.label}>{insight.label}</span>
              <strong title={insight.value}>{insight.value}</strong>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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

const bars = [48, 64, 52, 76, 58, 88, 68, 82, 56, 72, 61, 91];

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
  return (
    <Card className="module-hero overflow-hidden">
      <CardContent className="relative p-6">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="hero-badge">{eyebrow}</Badge>
              <Badge variant="secondary">{badge}</Badge>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Icon className="size-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-3xl font-semibold tracking-normal text-white md:text-4xl">{title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/64">{description}</p>
              </div>
            </div>
          </div>
          <div className="hero-value-panel">
            <p className="text-xs uppercase tracking-[0.16em] text-white/54">Workspace</p>
            <p className="mt-2 text-2xl font-semibold text-white">ShopIQ</p>
            <p className="mt-2 text-xs text-white/58">Role-aware operations</p>
          </div>
        </div>
        {stats.length ? (
          <div className="relative z-10 mt-6 grid gap-3 md:grid-cols-3">
            {stats.slice(0, 3).map((stat) => (
              <div key={stat.label} className="module-stat">
                <ArrowUpRight className="size-4" />
                <div>
                  <p>{stat.label}</p>
                  <strong>{stat.value}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="module-meter relative z-10" aria-hidden="true">
          {bars.map((height, index) => (
            <span key={`${height}-${index}`} style={{ height: `${height}%`, animationDelay: `${index * 30}ms` }} />
          ))}
        </div>
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
  return (
    <Card className="module-side-panel overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Module signals</p>
            <h3 className="mt-2 text-xl font-semibold tracking-normal">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {insights.map((insight) => (
            <div key={insight.label} className="module-line">
              <span>{insight.label}</span>
              <strong>{insight.value}</strong>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const bars = [38, 62, 46, 72, 54, 88, 64, 78, 52];

type MetricTone = "primary" | "emerald" | "amber" | "violet" | "rose";

export function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "primary"
}: {
  title: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  tone?: MetricTone;
}) {
  return (
    <Card className="metric-card soft-hover" data-tone={tone}>
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="metric-muted text-xs font-semibold uppercase tracking-[0.14em]">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
            {helper ? <p className="metric-muted mt-2 text-xs leading-5">{helper}</p> : null}
          </div>
          <div className="metric-icon flex size-12 shrink-0 items-center justify-center rounded-2xl">
            <Icon className="size-5" />
          </div>
        </div>
        <div className="metric-spark" aria-hidden="true">
          {bars.map((height, index) => (
            <span
              key={`${height}-${index}`}
              style={{ height: `${height}%`, animationDelay: `${index * 28}ms` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

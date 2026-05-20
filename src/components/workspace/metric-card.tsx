import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
      <CardContent className="relative p-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="metric-muted text-[0.64rem] font-semibold uppercase tracking-[0.1em]">{title}</p>
            <p className="mt-1.5 text-xl font-semibold tracking-normal">{value}</p>
            {helper ? <p className="metric-muted mt-1 text-[0.7rem] leading-4">{helper}</p> : null}
          </div>
          <div className="metric-icon flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

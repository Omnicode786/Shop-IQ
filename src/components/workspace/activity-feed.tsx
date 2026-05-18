import { Activity } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function ActivityFeed({ items }: { items: any[] }) {
  if (!items?.length) {
    return <div className="empty-state">No recent activity yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="activity-row">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.details}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{formatDate(item.createdAt, "dd MMM, p")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

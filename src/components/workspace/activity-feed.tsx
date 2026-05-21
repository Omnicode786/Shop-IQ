import { Activity, FileDown } from "lucide-react";
import { formatDate } from "@/lib/utils";

function reportDownloadUrl(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).reportDownloadUrl;
  return typeof value === "string" && value.startsWith("/api/reports/export") ? value : null;
}

export function ActivityFeed({ items }: { items: any[] }) {
  if (!items?.length) {
    return <div className="empty-state">No recent activity yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const downloadUrl = reportDownloadUrl(item.metadata);
        return (
          <div key={item.id} className="activity-row">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.details}</p>
              {downloadUrl ? (
                <a href={downloadUrl} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-4">
                  <FileDown className="size-3.5" />
                  Download PDF
                </a>
              ) : null}
              <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{formatDate(item.createdAt, "dd MMM, p")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone?: "blue" | "emerald" | "violet" | "amber" | "rose";
};

export function QuickActions({ title = "Quick actions", actions }: { title?: string; actions: QuickAction[] }) {
  return (
    <section className="quick-actions" aria-labelledby="quick-actions-title">
      <div className="quick-actions-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shortcuts</p>
          <h2 id="quick-actions-title" className="mt-1 text-base font-semibold tracking-normal">{title}</h2>
        </div>
      </div>
      <div className="quick-actions-grid">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={`${action.href}-${action.label}`} href={action.href} className={cn("quick-action-card", action.tone && `tone-${action.tone}`)}>
              <span className="quick-action-icon">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </span>
              <ArrowRight className="quick-action-arrow size-4" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}


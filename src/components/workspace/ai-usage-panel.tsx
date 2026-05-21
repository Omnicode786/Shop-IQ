"use client";

import { useEffect, useState } from "react";
import { Activity, DatabaseZap, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type UsageSnapshot = {
  configured: boolean;
  queue: { pending: number; active: number; concurrency: number };
  totals: { requests: number; successfulRequests: number; failedRequests: number; quotaFailures: number; cachedResponsesUsed: number };
  models: { light: string; standard: string; heavy: string };
  keys: Array<{ id: string; status: "available" | "cooling_down"; requests: number; quotaFailures: number; cooldownUntil: string | null; lastError?: string }>;
  lastQuotaError: string | null;
};

function numberLabel(value: unknown) {
  return Number(value || 0).toLocaleString();
}

export function AiUsagePanel() {
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch("/api/ai/usage", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (alive && response.ok) setUsage(data);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(load, 20_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading && !usage) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading AI usage controls...
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const availableKeys = usage.keys.filter((key) => key.status === "available").length;

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_1.2fr]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Activity className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">AI request control</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {numberLabel(usage.totals.requests)} total requests, {numberLabel(usage.totals.failedRequests)} failed, queue {usage.queue.active}/{usage.queue.concurrency}.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <DatabaseZap className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Cache savings</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {numberLabel(usage.totals.cachedResponsesUsed)} cached response{usage.totals.cachedResponsesUsed === 1 ? "" : "s"} reused.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Badge variant={usage.configured ? "success" : "destructive"}>
            <KeyRound className="mr-1 size-3" />
            {availableKeys}/{usage.keys.length} keys available
          </Badge>
          <Badge variant="outline">Light: {usage.models.light}</Badge>
          {usage.lastQuotaError ? (
            <Badge variant="warning" title={usage.lastQuotaError}>
              <ShieldAlert className="mr-1 size-3" />
              Quota cooldown active
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

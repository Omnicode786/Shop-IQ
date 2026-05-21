import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

function SkeletonBlock({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("shopiq-skeleton", className)} style={style} />;
}

function SectionHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <SkeletonBlock className="h-3 w-28 rounded-full" />
        <SkeletonBlock className="mt-3 h-8 w-[min(520px,78vw)]" />
        <SkeletonBlock className="mt-3 h-4 w-[min(760px,84vw)]" />
      </div>
      {action ? <SkeletonBlock className="h-9 w-32 rounded-full" /> : null}
    </div>
  );
}

function ModuleHeroSkeleton() {
  return (
    <div className="module-command-grid">
      <div className="skeleton-card min-h-[174px]">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="mt-4 h-7 w-[min(24rem,82%)]" />
        <SkeletonBlock className="mt-4 h-4 w-full max-w-2xl" />
        <SkeletonBlock className="mt-3 h-4 w-4/5 max-w-xl" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-14 rounded-2xl" />
          <SkeletonBlock className="h-14 rounded-2xl" />
          <SkeletonBlock className="h-14 rounded-2xl" />
        </div>
      </div>
      <div className="skeleton-card min-h-[174px]">
        <div className="flex items-center justify-between gap-4">
          <SkeletonBlock className="h-10 w-10 rounded-2xl" />
          <SkeletonBlock className="h-8 w-20 rounded-full" />
        </div>
        <SkeletonBlock className="mt-5 h-5 w-44" />
        <SkeletonBlock className="mt-4 h-4 w-full" />
        <SkeletonBlock className="mt-3 h-4 w-4/5" />
        <SkeletonBlock className="mt-6 h-11 rounded-2xl" />
      </div>
    </div>
  );
}

function MetricSkeletonGrid({ count = 3 }: { count?: number }) {
  const gridClass = count === 1 ? "grid gap-3 md:grid-cols-1" : count === 2 ? "grid gap-3 md:grid-cols-2" : count === 4 ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-3 md:grid-cols-3";
  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card min-h-[112px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="mt-3 h-7 w-32" />
              <SkeletonBlock className="mt-3 h-3 w-36" />
            </div>
            <SkeletonBlock className="h-10 w-10 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickActionsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <section className="quick-actions quick-actions-skeleton" aria-hidden="true">
      <div className="quick-actions-header">
        <div>
          <SkeletonBlock className="h-3 w-20 rounded-full" />
          <SkeletonBlock className="mt-2 h-5 w-36" />
        </div>
      </div>
      <div className="quick-actions-grid">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="quick-action-card quick-action-card-skeleton">
            <SkeletonBlock className="quick-action-icon" />
            <span className="min-w-0">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="mt-2 h-3 w-32 max-w-full" />
            </span>
            <SkeletonBlock className="quick-action-arrow h-4 w-4 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardHeroSkeleton({ staff = false }: { staff?: boolean }) {
  return (
    <div className={cn("dashboard-v2-hero overflow-hidden", staff && "dashboard-v2-hero-staff")}>
      <div className="dashboard-v2-hero-inner">
        <div className="min-w-0">
          <div className="dashboard-v2-badge-row">
            <SkeletonBlock className="h-7 w-32 rounded-full" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
          </div>
          <SkeletonBlock className="mt-4 h-8 w-[min(28rem,82%)]" />
          <SkeletonBlock className="mt-3 h-4 w-[min(38rem,92%)]" />
          <SkeletonBlock className="mt-2 h-4 w-[min(30rem,84%)]" />
        </div>
        {staff ? (
          <div className="dashboard-v2-health dashboard-v2-health-simple">
            <SkeletonBlock className="h-10 w-14 rounded-xl" />
            <SkeletonBlock className="h-3 w-24 rounded-full" />
          </div>
        ) : (
          <div className="dashboard-v2-health">
            <SkeletonBlock className="h-20 w-20 rounded-full" />
            <div>
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="mt-2 h-3 w-32" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendChartSkeleton({ compact = false, wide = false }: { compact?: boolean; wide?: boolean }) {
  return (
    <div className={cn("skeleton-card dashboard-chart-card", wide && "dashboard-chart-card-wide")} data-compact={compact || undefined}>
      <div className="dashboard-chart-card-inner">
      <div className="dashboard-chart-heading">
        <div>
          <SkeletonBlock className="h-3 w-24 rounded-full" />
          <SkeletonBlock className="mt-2 h-5 w-40" />
        </div>
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>
      <SkeletonBlock className="mt-4 h-7 w-36" />
      <div className={cn("mt-5 overflow-hidden rounded-2xl border border-border/45 bg-muted/10 p-4", compact ? "h-36" : "h-48")}>
        <div className="flex h-full items-end gap-2">
          {[42, 56, 48, 72, 54, 88, 68, 76, 58, 82, 64, 74].map((height, index) => (
            <SkeletonBlock key={index} className="w-full rounded-t-xl" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

function PaymentMixSkeleton() {
  return (
    <div className="skeleton-card dashboard-chart-card" data-compact>
      <div className="dashboard-chart-card-inner">
        <div className="dashboard-chart-heading">
          <div>
            <SkeletonBlock className="h-3 w-24 rounded-full" />
            <SkeletonBlock className="mt-2 h-5 w-36" />
          </div>
          <SkeletonBlock className="h-8 w-20 rounded-full" />
        </div>
        <div className="mt-5 space-y-3">
          {[88, 72, 58, 44].map((width, index) => (
            <div key={index} className="flex items-center gap-3">
              <SkeletonBlock className="h-8 w-8 shrink-0 rounded-xl" />
              <SkeletonBlock className="h-4 flex-1 rounded-full" style={{ width: `${width}%` }} />
              <SkeletonBlock className="h-4 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DonutSkeleton() {
  return (
    <div className="skeleton-card dashboard-chart-card">
      <div className="dashboard-chart-card-inner">
      <div className="dashboard-chart-heading">
        <div>
          <SkeletonBlock className="h-3 w-24 rounded-full" />
          <SkeletonBlock className="mt-2 h-5 w-40" />
        </div>
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>
      <div className="mt-7 flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative h-40 w-40 shrink-0 rounded-full border-[18px] border-muted/70">
          <SkeletonBlock className="absolute inset-5 rounded-full" />
        </div>
        <div className="flex-1 space-y-3">
          <SkeletonBlock className="h-4 w-full rounded-full" />
          <SkeletonBlock className="h-4 w-5/6 rounded-full" />
          <SkeletonBlock className="h-4 w-2/3 rounded-full" />
          <SkeletonBlock className="h-4 w-3/4 rounded-full" />
        </div>
      </div>
      </div>
    </div>
  );
}

function DataTableSkeleton({ rows = 6, columns = 4, minHeight }: { rows?: number; columns?: number; minHeight?: string }) {
  return (
    <div className="skeleton-table-card overflow-hidden" style={minHeight ? { minHeight } : undefined}>
      <div className="border-b border-border/60 p-4">
        <SkeletonBlock className="h-5 w-44" />
        <SkeletonBlock className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="divide-y divide-border/55 px-4 pb-4">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="grid gap-4 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, column) => (
              <SkeletonBlock key={column} className={cn("h-4", column === columns - 1 && "ml-auto w-3/4")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CrudTableSkeleton() {
  return (
    <div className="skeleton-table-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 p-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-2 h-3 w-80 max-w-full" />
        </div>
        <SkeletonBlock className="h-10 w-36 rounded-xl" />
      </div>
      <div className="skeleton-toolbar">
        <SkeletonBlock className="h-10 min-w-[240px] flex-1 rounded-xl" />
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
        <SkeletonBlock className="h-10 w-24 rounded-xl" />
      </div>
      <div className="divide-y divide-border/55 px-4 pb-4">
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="grid grid-cols-[1.2fr_0.7fr_0.9fr_0.7fr_0.7fr_0.6fr] gap-4 py-4">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-4/5" />
            <SkeletonBlock className="h-4 w-3/5" />
            <SkeletonBlock className="h-4 w-4/5" />
            <SkeletonBlock className="ml-auto h-8 w-24 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 p-4">
        <SkeletonBlock className="h-3 w-48" />
        <SkeletonBlock className="h-9 w-64 rounded-xl" />
      </div>
    </div>
  );
}

function ActivityCardSkeleton() {
  return (
    <div className="skeleton-card dashboard-v2-activity">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <SkeletonBlock className="h-3 w-24 rounded-full" />
          <SkeletonBlock className="mt-2 h-5 w-36" />
        </div>
        <SkeletonBlock className="h-9 w-9 rounded-2xl" />
      </div>
      <div className="mt-5 space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-4/5" />
              <SkeletonBlock className="mt-2 h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CrudPageSkeleton({ metricCount = 3 }: { metricCount?: number }) {
  return (
    <>
      <SectionHeaderSkeleton />
      <ModuleHeroSkeleton />
      <div className="mt-6">
        <MetricSkeletonGrid count={metricCount} />
      </div>
      <div className="mt-6">
        <CrudTableSkeleton />
      </div>
    </>
  );
}

export function SettingsPageSkeleton() {
  return <CrudPageSkeleton metricCount={1} />;
}

export function DashboardSkeleton() {
  return (
    <>
      <SectionHeaderSkeleton />
      <div className="dashboard-v2-stack">
        <DashboardHeroSkeleton />
        <QuickActionsSkeleton count={5} />
        <MetricSkeletonGrid count={4} />
        <div className="dashboard-v2-chart-grid">
          <TrendChartSkeleton wide />
          <DonutSkeleton />
        </div>
        <div className="dashboard-v2-lower-grid">
          <div className="dashboard-v2-main-column">
            <DataTableSkeleton rows={6} columns={4} />
            <DataTableSkeleton rows={5} columns={4} />
          </div>
          <div className="dashboard-v2-side-column">
            <PaymentMixSkeleton />
            <ActivityCardSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}

export function StaffDashboardSkeleton() {
  return (
    <>
      <SectionHeaderSkeleton />
      <div className="dashboard-v2-stack">
        <DashboardHeroSkeleton staff />
        <MetricSkeletonGrid count={4} />
        <QuickActionsSkeleton count={4} />
        <TrendChartSkeleton wide />
        <div className="dashboard-v2-lower-grid">
          <DataTableSkeleton rows={7} columns={3} />
          <ActivityCardSkeleton />
        </div>
      </div>
    </>
  );
}

export function ReportsPageSkeleton() {
  return (
    <>
      <SectionHeaderSkeleton />
      <ModuleHeroSkeleton />
      <div className="mt-6">
        <MetricSkeletonGrid count={3} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DataTableSkeleton rows={6} columns={2} />
        <DataTableSkeleton rows={6} columns={2} />
        <DataTableSkeleton rows={6} columns={2} />
        <DataTableSkeleton rows={6} columns={2} />
      </div>
    </>
  );
}

export function AssistantPageSkeleton() {
  return (
    <>
      <SectionHeaderSkeleton />
      <div className="mt-6 grid min-h-[68vh] overflow-hidden rounded-[1.25rem] border border-border/60 bg-card/70 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden min-h-0 flex-col border-r border-border/60 bg-muted/20 p-4 xl:flex">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SkeletonBlock className="h-3 w-16 rounded-full" />
              <SkeletonBlock className="mt-2 h-5 w-32 rounded-full" />
            </div>
            <SkeletonBlock className="h-9 w-16 rounded-2xl" />
          </div>
          <SkeletonBlock className="mt-4 h-10 rounded-2xl" />
          <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-hidden">
            <div className="assistant-thread-loading-note">
              <span className="assistant-loading-dot" />
              Loading conversations
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="assistant-thread-skeleton">
                <span className="assistant-thread-skeleton-icon" />
                <span className="assistant-thread-skeleton-copy">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-[68vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border/60 p-4">
            <div className="flex items-start gap-3">
              <SkeletonBlock className="h-11 w-11 rounded-2xl" />
              <div>
                <SkeletonBlock className="h-5 w-48 rounded-full" />
                <SkeletonBlock className="mt-3 h-3 w-[min(34rem,68vw)] rounded-full" />
              </div>
            </div>
            <SkeletonBlock className="h-8 w-24 rounded-full" />
          </div>
          <div className="flex gap-2 overflow-hidden border-b border-border/60 p-4">
            <SkeletonBlock className="h-9 w-44 shrink-0 rounded-full" />
            <SkeletonBlock className="h-9 w-52 shrink-0 rounded-full" />
            <SkeletonBlock className="h-9 w-40 shrink-0 rounded-full" />
          </div>
          <div className="assistant-skeleton-message-area flex flex-1 flex-col gap-5 bg-muted/10 p-4">
            <div className="assistant-message-loading-note">
              <span className="assistant-loading-dot" />
              Loading saved chat
            </div>
            <div className="assistant-message-skeleton-bubble is-ai h-20 w-2/3 rounded-[1.5rem]" />
            <div className="assistant-message-skeleton-bubble is-user ml-auto h-16 w-1/2 rounded-[1.5rem]" />
            <div className="assistant-message-skeleton-bubble is-ai h-28 w-3/4 rounded-[1.5rem]" />
            <div className="assistant-message-skeleton-bubble is-user ml-auto h-14 w-[45%] rounded-[1.5rem]" />
          </div>
          <div className="border-t border-border/60 p-4">
            <SkeletonBlock className="h-16 rounded-3xl" />
          </div>
        </div>
      </div>
    </>
  );
}

export function WorkspaceLoadingShell({ dashboard = false }: { dashboard?: boolean }) {
  return dashboard ? <DashboardSkeleton /> : <CrudPageSkeleton />;
}

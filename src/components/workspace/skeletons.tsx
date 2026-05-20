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
  const gridClass = count === 1 ? "grid gap-3 md:grid-cols-1" : count === 2 ? "grid gap-4 md:grid-cols-2" : "grid gap-4 md:grid-cols-3";
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

function QuickActionsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-2 h-3 w-56" />
        </div>
        <SkeletonBlock className="h-8 w-20 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/55 p-4">
            <SkeletonBlock className="h-9 w-9 rounded-2xl" />
            <SkeletonBlock className="mt-4 h-4 w-32" />
            <SkeletonBlock className="mt-2 h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChartSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("skeleton-card", compact ? "min-h-[230px]" : "min-h-[284px]")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-2 h-3 w-64 max-w-full" />
        </div>
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>
      <SkeletonBlock className="mt-5 h-7 w-36" />
      <div className={cn("mt-7 flex items-end gap-3", compact ? "h-28" : "h-36")}>
        {[62, 88, 44, 72, 54, 96, 70, 48, 78].map((height, index) => (
          <SkeletonBlock key={index} className="w-full rounded-t-2xl" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

function DonutSkeleton() {
  return (
    <div className="skeleton-card min-h-[284px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-2 h-3 w-56 max-w-full" />
        </div>
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>
      <div className="mt-8 flex items-center gap-6">
        <SkeletonBlock className="h-36 w-36 shrink-0 rounded-full" />
        <div className="flex-1 space-y-3">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-4 w-3/4" />
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
    <div className="skeleton-card">
      <SkeletonBlock className="h-3 w-24 rounded-full" />
      <SkeletonBlock className="mt-2 h-5 w-36" />
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
      <div>
        <div className="skeleton-card min-h-[180px] dashboard-hero-compact">
          <SkeletonBlock className="h-7 w-52 rounded-full" />
          <SkeletonBlock className="mt-5 h-9 w-[min(30rem,82%)]" />
          <SkeletonBlock className="mt-4 h-4 w-[min(40rem,90%)]" />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SkeletonBlock className="h-20 w-20 rounded-full" />
            <div className="min-w-52 flex-1">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="mt-3 h-7 w-48" />
              <SkeletonBlock className="mt-2 h-3 w-64 max-w-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <QuickActionsSkeleton count={6} />
      </div>
      <div className="mt-4">
        <MetricSkeletonGrid count={3} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <TrendChartSkeleton />
        <DonutSkeleton />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <DataTableSkeleton rows={8} columns={4} minHeight="330px" />
        <div className="flex flex-col gap-6">
          <DataTableSkeleton rows={6} columns={2} />
          <ActivityCardSkeleton />
        </div>
      </div>
    </>
  );
}

export function StaffDashboardSkeleton() {
  return (
    <>
      <SectionHeaderSkeleton />
      <MetricSkeletonGrid count={3} />
      <div className="mt-6">
        <QuickActionsSkeleton count={4} />
      </div>
      <div className="mt-5">
        <TrendChartSkeleton compact />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DataTableSkeleton rows={8} columns={2} />
        <div className="flex flex-col gap-6">
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
      <div className="mt-6 grid min-h-[68vh] gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="skeleton-card hidden xl:block">
          <SkeletonBlock className="h-10 rounded-2xl" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-14 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="skeleton-card flex min-h-[68vh] flex-col">
          <SkeletonBlock className="h-11 w-56 rounded-2xl" />
          <div className="mt-8 flex-1 space-y-5">
            <SkeletonBlock className="h-16 w-2/3 rounded-3xl" />
            <SkeletonBlock className="ml-auto h-14 w-1/2 rounded-3xl" />
            <SkeletonBlock className="h-24 w-3/4 rounded-3xl" />
            <SkeletonBlock className="ml-auto h-12 w-[45%] rounded-3xl" />
          </div>
          <SkeletonBlock className="mt-6 h-16 rounded-3xl" />
        </div>
      </div>
    </>
  );
}

export function WorkspaceLoadingShell({ dashboard = false }: { dashboard?: boolean }) {
  return dashboard ? <DashboardSkeleton /> : <CrudPageSkeleton />;
}

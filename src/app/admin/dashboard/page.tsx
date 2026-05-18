import { format } from "date-fns";
import { AlertTriangle, ArrowUpRight, DollarSign, Package, ReceiptText, Sparkles, TrendingUp, Truck, Users } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import {
  BubbleInsightCard,
  ComparativeBarsCard,
  DonutBreakdownCard,
  RankedBarsCard,
  RingScoreCard,
  StackedSignalCard,
  TrendAreaCard
} from "@/components/workspace/analytics-cards";
import { DataTable } from "@/components/workspace/data-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { SectionHeader } from "@/components/workspace/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import type { TimelineDatum } from "@/lib/chart-helpers";
import { getDashboardSnapshot } from "@/lib/data";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

function money(value: number) {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

function compactMoney(value: number) {
  return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
}

function riskTone(score: number) {
  if (score >= 45) return "High attention";
  if (score >= 18) return "Watch closely";
  return "Stable";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type HeroBarDatum = {
  label: string;
  value: number;
  height: number;
};

function buildHeroBars(data: TimelineDatum[] = []): HeroBarDatum[] {
  const points = data.slice(-12);
  const maxValue = Math.max(...points.map((item) => Number(item.value || 0)), 0);

  return points.map((item) => {
    const value = Number(item.value || 0);
    return {
      label: item.label,
      value,
      height: maxValue ? Math.max(12, Math.round((value / maxValue) * 100)) : 8
    };
  });
}

function HeroBar({ datum, index }: { datum: HeroBarDatum; index: number }) {
  return <span title={`${datum.label}: ${money(datum.value)}`} style={{ height: `${datum.height}%`, animationDelay: `${index * 34}ms` }} />;
}

function RetailPulseHero({ name, metrics, revenueTimeline }: { name?: string; metrics: any; revenueTimeline: TimelineDatum[] }) {
  const bars = buildHeroBars(revenueTimeline);
  const today = format(new Date(), "EEEE, dd MMM");
  const healthScore = Math.max(0, 100 - metrics.stockRiskScore);

  return (
    <Card className="dashboard-hero overflow-hidden">
      <CardContent className="relative p-5 md:p-6">
        <div className="hero-orbit" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="hero-badge">
                <Sparkles className="size-3.5" />
                Live store pulse
              </Badge>
              <Badge variant="secondary">{riskTone(metrics.stockRiskScore)}</Badge>
            </div>
            <p className="text-sm text-white/62">{today}</p>
            <h2 className="mt-2 break-normal text-2xl font-semibold tracking-normal text-white md:text-3xl 2xl:text-4xl">
              {greeting()}, {name || "ShopIQ operator"}.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/64">
              A compact live read on revenue, stock exposure, dues and customer activity for the next operating move.
            </p>
          </div>
          <div className="hero-value-panel hero-command-panel">
            <div className="hero-score-ring" style={{ ["--score" as string]: `${healthScore}%` }}>
              <span>{healthScore}%</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-white/54">Inventory health</p>
              <p className="mt-2 text-3xl font-semibold text-white">{money(metrics.monthlyRevenue)}</p>
              <p className="mt-2 text-xs text-white/58">{metrics.revenueWindowLabel}</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-5 grid gap-3 md:grid-cols-3">
          <div className="hero-stat">
            <DollarSign className="size-4" />
            <div>
              <p>{metrics.salesWindowLabel}</p>
              <strong>{money(metrics.todaySales)}</strong>
            </div>
          </div>
          <div className="hero-stat">
            <AlertTriangle className="size-4" />
            <div>
              <p>Stock risk</p>
              <strong>{metrics.stockRiskScore}%</strong>
            </div>
          </div>
          <div className="hero-stat">
            <Users className="size-4" />
            <div>
              <p>Customer dues</p>
              <strong>{money(metrics.customerDues)}</strong>
            </div>
          </div>
        </div>
        <div className="hero-micro-chart relative z-10" aria-hidden="true">
          {bars.map((datum, index) => <HeroBar key={`${datum.label}-${index}`} datum={datum} index={index} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskPanel({ lowStock, supplierDues }: { lowStock: any[]; supplierDues: number }) {
  return (
    <Card className="risk-panel overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Operational focus</p>
            <h3 className="mt-2 text-xl font-semibold tracking-normal">Stock and dues</h3>
          </div>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ArrowUpRight className="size-5" />
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          <div className="risk-line">
            <span>Low stock SKUs</span>
            <strong>{lowStock.length}</strong>
          </div>
          <div className="risk-line">
            <span>Supplier dues</span>
            <strong>{money(supplierDues)}</strong>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {lowStock.slice(0, 4).map((product) => (
            <div key={product.id} className="inventory-chip">
              <span className="truncate">{product.name}</span>
              <strong>{product.stockQty} left</strong>
            </div>
          ))}
          {!lowStock.length ? <div className="empty-state">Inventory is above reorder levels.</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "dashboard")} user={user}>
      <SectionHeader
        eyebrow="Command center"
        title="Overview"
        description="A live retail inventory workspace for sales, stock risk, invoices, dues and operational activity."
        action={<Badge variant="secondary">Role: {user?.role.toLowerCase()}</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.42fr)_minmax(340px,0.58fr)]">
        <RetailPulseHero name={user?.name} metrics={snapshot.metrics} revenueTimeline={snapshot.charts.revenueTimeline} />
        <RiskPanel lowStock={snapshot.lowStock} supplierDues={snapshot.metrics.supplierDues} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={DollarSign} title="Sales pulse" value={money(snapshot.metrics.todaySales)} helper={snapshot.metrics.salesWindowLabel} tone="emerald" />
        <MetricCard icon={TrendingUp} title="Revenue window" value={money(snapshot.metrics.monthlyRevenue)} helper={snapshot.metrics.revenueWindowLabel} />
        <MetricCard icon={Package} title="Inventory value" value={money(snapshot.metrics.inventoryValue)} helper={`${snapshot.metrics.productCount} active SKUs`} tone="violet" />
        <MetricCard icon={ReceiptText} title="Stock risk" value={`${snapshot.metrics.stockRiskScore}%`} helper={`${snapshot.metrics.lowStockCount} products below threshold`} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr_0.9fr]">
        <RingScoreCard
          title="Inventory confidence"
          description="Combines stock risk and active SKU coverage into a quick operating score."
          score={Math.max(0, 100 - snapshot.metrics.stockRiskScore)}
          value={`${Math.max(0, 100 - snapshot.metrics.stockRiskScore)}%`}
          label="Healthy"
        />
        <TrendAreaCard
          title="Revenue rhythm"
          description="Daily gross sales over the active trading window."
          value={money(snapshot.metrics.monthlyRevenue)}
          caption={snapshot.metrics.revenueWindowLabel}
          data={snapshot.charts.revenueTimeline}
          badge="14 days"
          format="money"
        />
        <StackedSignalCard
          title="Invoice state"
          description="How recent invoices are distributed by settlement status."
          data={snapshot.charts.invoiceStatus}
          totalLabel={`${snapshot.invoices.length} latest invoices`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <ComparativeBarsCard
          title="Cashflow pressure"
          description="Customer receipts against supplier payouts, shown day by day."
          data={snapshot.charts.cashflowTimeline}
          valueLabel="Receipts"
          secondaryLabel="Payouts"
          badge="Cash"
          format="money"
        />
        <DonutBreakdownCard
          title="Inventory value orbit"
          description="Category concentration with the large center value kept scannable."
          data={snapshot.charts.categoryValue}
          centerValue={compactMoney(snapshot.metrics.inventoryValue)}
          centerLabel="Inventory"
          badge="Categories"
          format="money"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <BubbleInsightCard
          title="Operating bubbles"
          description="A quick board for the four numbers that usually drive the next move."
          bubbles={[
            { label: "Sales pulse", value: compactMoney(snapshot.metrics.todaySales), size: "lg" },
            { label: "Customer dues", value: compactMoney(snapshot.metrics.customerDues), size: "md" },
            { label: "Supplier dues", value: compactMoney(snapshot.metrics.supplierDues), size: "sm" },
            { label: "Low stock", value: snapshot.metrics.lowStockCount, size: "sm" }
          ]}
          badge="Live"
        />
        <RankedBarsCard
          title="Receivable leaders"
          description="Customers with the highest outstanding balances."
          rows={snapshot.charts.customerDueRank}
          format="money"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DataTable title="Low stock watchlist" description="Items at or below reorder level, sorted by operational urgency.">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className="px-5 py-4 text-left">Product</th>
                <th className="px-5 py-4 text-left">Stock</th>
                <th className="px-5 py-4 text-left">Reorder</th>
                <th className="px-5 py-4 text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.lowStock.map((product: any) => (
                <tr key={product.id} className="border-t border-border/60">
                  <td className="px-5 py-4 font-medium">{product.name}</td>
                  <td className="px-5 py-4">{product.stockQty}</td>
                  <td className="px-5 py-4">{product.reorderQuantity}</td>
                  <td className="px-5 py-4">{money(Number(product.costPrice) * product.stockQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

        <div className="flex flex-col gap-6">
          <DataTable title="Recent invoices" description="Latest invoice activity for the current month.">
            <table className="w-full text-sm">
              <tbody>
                {snapshot.invoices.slice(0, 6).map((invoice: any) => (
                  <tr key={invoice.id} className="border-b border-border/60">
                    <td className="px-5 py-4">
                      <p className="font-medium">{invoice.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground">{invoice.customer?.name || "Walk-in"}</p>
                    </td>
                    <td className="px-5 py-4 text-right">{money(Number(invoice.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Activity</p>
                  <h3 className="mt-1 text-base font-semibold tracking-normal">Store stream</h3>
                </div>
                <Truck className="size-5 text-primary" />
              </div>
              <ActivityFeed items={snapshot.activities} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

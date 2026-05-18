import { DollarSign, Package, ReceiptText, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { BubbleInsightCard, RankedBarsCard, RingScoreCard, TrendAreaCard } from "@/components/workspace/analytics-cards";
import { DataTable } from "@/components/workspace/data-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { SectionHeader } from "@/components/workspace/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { STAFF_NAV } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data";

function money(value: number) {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

function compactMoney(value: number) {
  return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
}

export default async function StaffDashboard() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);

  return (
    <AppShell nav={STAFF_NAV} heading="Staff Workspace" currentPath="/staff/dashboard" user={user}>
      <SectionHeader
        eyebrow="Staff dashboard"
        title="Sales, stock and customer operations"
        description="A focused workspace for billing, inventory lookup, payments and customer service."
        action={<Badge variant="secondary">Front counter mode</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={DollarSign} title="Sales pulse" value={money(snapshot.metrics.todaySales)} helper={snapshot.metrics.salesWindowLabel} tone="emerald" />
        <MetricCard icon={TrendingUp} title="Revenue window" value={money(snapshot.metrics.monthlyRevenue)} helper={snapshot.metrics.revenueWindowLabel} />
        <MetricCard icon={Package} title="Low stock" value={snapshot.metrics.lowStockCount} helper="Needs manager attention" tone="amber" />
        <MetricCard icon={ReceiptText} title="Open dues" value={money(snapshot.metrics.customerDues)} helper="Customer receivables" tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <TrendAreaCard
          title="Counter sales rhythm"
          description="Daily gross sales so staff can feel the pace of the shop."
          value={money(snapshot.metrics.monthlyRevenue)}
          caption={snapshot.metrics.revenueWindowLabel}
          data={snapshot.charts.revenueTimeline}
          badge="Sales"
          format="money"
        />
        <Card className="dashboard-hero overflow-hidden">
          <CardContent className="p-6">
            <Badge variant="outline" className="hero-badge">Today focus</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-normal text-white">Serve faster, check stock smarter.</h2>
            <p className="mt-3 text-sm leading-7 text-white/64">
              Use billing, products, customers and payments from the side navigation. Low-stock priorities and activity are shown below.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <RingScoreCard
          title="Service readiness"
          description="Stock pressure converted into a front-counter readiness score."
          score={Math.max(0, 100 - snapshot.metrics.stockRiskScore)}
          value={`${Math.max(0, 100 - snapshot.metrics.stockRiskScore)}%`}
          label="Ready"
          badge="Stock"
        />
        <BubbleInsightCard
          title="Counter board"
          description="Numbers staff need before billing, lookup or customer follow-up."
          bubbles={[
            { label: "Sales", value: compactMoney(snapshot.metrics.todaySales), size: "lg" },
            { label: "Low stock", value: snapshot.metrics.lowStockCount, size: "md" },
            { label: "Customers", value: snapshot.customers.length, size: "sm" },
            { label: "Open dues", value: compactMoney(snapshot.metrics.customerDues), size: "sm" }
          ]}
          badge="Live"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DataTable title="Low stock priorities" description="Products that need reorder attention before sales are blocked.">
          <table className="w-full min-w-[520px] text-sm">
            <tbody>
              {snapshot.lowStock.slice(0, 10).map((product: any) => (
                <tr key={product.id} className="border-b border-border/60">
                  <td className="px-5 py-4 font-medium">{product.name}</td>
                  <td className="px-5 py-4">{product.stockQty} left</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <div className="flex flex-col gap-6">
          <RankedBarsCard
            title="Fast movers"
            description="Products staff are most likely to be asked for."
            rows={snapshot.fastMoving.map((item: any) => ({ name: item.name, value: item.qty }))}
            badge="Velocity"
          />
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Activity</p>
                <h3 className="mt-1 text-base font-semibold tracking-normal">Store stream</h3>
              </div>
              <ActivityFeed items={snapshot.activities} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

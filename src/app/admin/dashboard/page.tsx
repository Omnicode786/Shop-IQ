import { BarChart3, DollarSign, Package, ReceiptText, TrendingUp, Truck, Users, WalletCards } from "lucide-react";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import {
  DonutBreakdownCard,
  TrendAreaCard
} from "@/components/workspace/analytics-cards";
import { DataTable } from "@/components/workspace/data-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { QuickActions } from "@/components/workspace/quick-actions";
import { SectionHeader } from "@/components/workspace/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data";
import { workspacePath } from "@/lib/workspace";

function money(value: number) {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

function compactMoney(value: number) {
  return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function RetailPulseHero({ name, metrics }: { name?: string; metrics: any }) {
  const healthScore = Math.max(0, 100 - metrics.stockRiskScore);

  return (
    <Card className="dashboard-hero dashboard-hero-compact overflow-hidden">
      <CardContent className="relative p-4 md:p-5">
        <div className="hero-orbit" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="hero-badge">
                Store command
              </Badge>
              <Badge variant="secondary">{metrics.productCount.toLocaleString()} SKUs</Badge>
            </div>
            <h2 className="break-normal text-2xl font-semibold tracking-normal text-white md:text-3xl">
              {greeting()}, {name || "ShopIQ operator"}.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/66">
              Your most important operating signals are ready below: sell, restock, collect and report without hunting through menus.
            </p>
          </div>
          <div className="hero-value-panel hero-command-panel">
            <div className="hero-score-ring" style={{ ["--score" as string]: `${healthScore}%` }}>
              <span>{healthScore}%</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.14em] text-white/54">Inventory health</p>
              <p className="mt-1 text-xl font-semibold text-white">{metrics.lowStockCount} low stock</p>
              <p className="mt-1 text-xs text-white/58">Keep shelves ready before checkout slows down.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);

  return (
    <>
      <SectionHeader
        eyebrow="Command center"
        title="Overview"
        description="A live retail inventory workspace for sales, stock risk, invoices, dues and operational activity."
        action={<Badge variant="secondary">Role: {user?.role.toLowerCase()}</Badge>}
      />

      <div>
        <RetailPulseHero name={user?.name} metrics={snapshot.metrics} />
      </div>

      <div className="mt-4">
        <QuickActions
          title="Move straight to work"
          actions={[
            { href: workspacePath(user?.role, "billing"), label: "Create invoice", description: "Open the guided billing flow", icon: ReceiptText, tone: "blue" },
            { href: workspacePath(user?.role, "customers"), label: "Add customer", description: "Create or update ledger accounts", icon: Users, tone: "emerald" },
            { href: workspacePath(user?.role, "payments"), label: "Record payment", description: "Settle customer or supplier balances", icon: WalletCards, tone: "violet" },
            { href: workspacePath(user?.role, "products"), label: "Add product", description: "Create inventory and stock rules", icon: Package, tone: "amber" },
            { href: workspacePath(user?.role, "products"), label: "Manage stock", description: "Review low stock and locations", icon: Truck, tone: "rose" },
            ...(user?.role === "STAFF" ? [] : [{ href: workspacePath(user?.role, "reports"), label: "View reports", description: "Export the general PDF report", icon: BarChart3, tone: "blue" as const }])
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard icon={DollarSign} title="Sales pulse" value={money(snapshot.metrics.todaySales)} helper={snapshot.metrics.salesWindowLabel} tone="emerald" />
        <MetricCard icon={Package} title="Inventory value" value={money(snapshot.metrics.inventoryValue)} helper={`${snapshot.metrics.productCount} active SKUs`} tone="violet" />
        <MetricCard icon={TrendingUp} title="Low stock" value={snapshot.metrics.lowStockCount} helper="Needs reorder review" tone="amber" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <TrendAreaCard
          title="Revenue rhythm"
          description="Daily gross sales over the active window."
          value={money(snapshot.metrics.monthlyRevenue)}
          caption={snapshot.metrics.revenueWindowLabel}
          data={snapshot.charts.revenueTimeline}
          badge="14 days"
          format="money"
        />
        <DonutBreakdownCard
          title="Inventory value orbit"
          description="Category concentration by stock value."
          data={snapshot.charts.categoryValue}
          centerValue={compactMoney(snapshot.metrics.inventoryValue)}
          centerLabel="Inventory"
          badge="Categories"
          format="money"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
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
    </>
  );
}

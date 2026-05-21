import { BarChart3, DollarSign, Package, ReceiptText, TrendingUp, Truck, Users, WalletCards } from "lucide-react";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { DashboardCategoryPie, DashboardPaymentMixChart, DashboardRevenueChart } from "@/components/workspace/dashboard-chartjs";
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
  return `PKR ${Math.round(Number(value || 0)).toLocaleString()}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardHero({ name, metrics }: { name?: string | null; metrics: any }) {
  const stockHealth = Math.max(0, 100 - Number(metrics.stockRiskScore || 0));
  const healthLabel = stockHealth >= 80 ? "Healthy" : stockHealth >= 55 ? "Watch" : "Critical";

  return (
    <Card className="dashboard-v2-hero overflow-hidden">
      <CardContent className="dashboard-v2-hero-inner">
        <div className="min-w-0">
          <div className="dashboard-v2-badge-row">
            <Badge variant="outline">Command center</Badge>
            <Badge variant="secondary">{Number(metrics.productCount || 0).toLocaleString()} SKUs</Badge>
          </div>
          <h2>{greeting()}, {name || "ShopIQ operator"}</h2>
          <p>Review the few numbers that decide the next move: sell, restock, collect, and report.</p>
        </div>
        <div className="dashboard-v2-health">
          <span style={{ ["--score" as string]: `${stockHealth * 3.6}deg` }}>
            <strong>{stockHealth}%</strong>
          </span>
          <div>
            <p>{healthLabel}</p>
            <small>{Number(metrics.lowStockCount || 0)} low-stock item{Number(metrics.lowStockCount || 0) === 1 ? "" : "s"}</small>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyRows({ label }: { label: string }) {
  return (
    <tr>
      <td className="px-5 py-8 text-sm text-muted-foreground" colSpan={4}>{label}</td>
    </tr>
  );
}

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);

  return (
    <>
      <SectionHeader
        eyebrow="Dashboard"
        title="Business overview"
        description="A clean operating snapshot using live sales, stock, invoice, payment and activity data."
        action={<Badge variant="secondary">Role: {user?.role.toLowerCase()}</Badge>}
      />

      <div className="dashboard-v2-stack">
        <DashboardHero name={user?.name} metrics={snapshot.metrics} />

        <QuickActions
          title="Start a workflow"
          actions={[
            { href: workspacePath(user?.role, "billing"), label: "Create invoice", description: "Open billing flow", icon: ReceiptText, tone: "blue" },
            { href: workspacePath(user?.role, "customers"), label: "Add customer", description: "Create ledger account", icon: Users, tone: "emerald" },
            { href: workspacePath(user?.role, "payments"), label: "Record payment", description: "Settle balances", icon: WalletCards, tone: "violet" },
            { href: workspacePath(user?.role, "products"), label: "Manage stock", description: "Products and reorder levels", icon: Package, tone: "amber" },
            { href: workspacePath(user?.role, "reports"), label: "Export report", description: "Generate PDF summary", icon: BarChart3, tone: "rose" }
          ]}
        />

        <div className="dashboard-v2-metrics">
          <MetricCard icon={DollarSign} title="Sales pulse" value={money(snapshot.metrics.todaySales)} helper={snapshot.metrics.salesWindowLabel} tone="emerald" />
          <MetricCard icon={TrendingUp} title="Revenue" value={money(snapshot.metrics.monthlyRevenue)} helper={snapshot.metrics.revenueWindowLabel} tone="primary" />
          <MetricCard icon={Package} title="Inventory value" value={money(snapshot.metrics.inventoryValue)} helper={`${snapshot.metrics.productCount} active SKUs`} tone="violet" />
          <MetricCard icon={WalletCards} title="Customer dues" value={money(snapshot.metrics.customerDues)} helper="Receivables to collect" tone="amber" />
        </div>

        <div className="dashboard-v2-chart-grid">
          <DashboardRevenueChart data={snapshot.charts.revenueTimeline} total={snapshot.metrics.monthlyRevenue} label={snapshot.metrics.revenueWindowLabel} />
          <DashboardCategoryPie data={snapshot.charts.categoryValue} total={snapshot.metrics.inventoryValue} />
        </div>

        <div className="dashboard-v2-lower-grid">
          <div className="dashboard-v2-main-column">
            <DataTable title="Low stock watchlist" description="Items already at or below reorder level.">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">Product</th>
                    <th className="px-5 py-3 text-right">Stock</th>
                    <th className="px-5 py-3 text-right">Reorder</th>
                    <th className="px-5 py-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.lowStock.length ? snapshot.lowStock.map((product: any) => (
                    <tr key={product.id} className="border-t border-border/60">
                      <td className="px-5 py-3 font-medium">{product.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{product.stockQty}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{product.reorderQuantity}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{money(Number(product.costPrice) * product.stockQty)}</td>
                    </tr>
                  )) : <EmptyRows label="No low stock items right now." />}
                </tbody>
              </table>
            </DataTable>

            <DataTable title="Recent invoices" description="Latest billing activity from real invoices.">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">Invoice</th>
                    <th className="px-5 py-3 text-left">Customer</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.invoices.length ? snapshot.invoices.slice(0, 6).map((invoice: any) => (
                    <tr key={invoice.id} className="border-t border-border/60">
                      <td className="px-5 py-3 font-medium">{invoice.invoiceNo}</td>
                      <td className="px-5 py-3 text-muted-foreground">{invoice.customer?.name || "Walk-in"}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{money(Number(invoice.total))}</td>
                      <td className="px-5 py-3 text-right">{String(invoice.status || "").replace(/_/g, " ")}</td>
                    </tr>
                  )) : <EmptyRows label="No invoices have been created yet." />}
                </tbody>
              </table>
            </DataTable>
          </div>

          <div className="dashboard-v2-side-column">
            <DashboardPaymentMixChart data={snapshot.charts.paymentMethodMix} />
            <Card className="dashboard-v2-activity overflow-hidden">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="dashboard-chart-kicker">Activity</p>
                    <h3 className="text-base font-semibold tracking-normal">Store stream</h3>
                  </div>
                  <Truck className="size-5 text-primary" />
                </div>
                <ActivityFeed items={snapshot.activities} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

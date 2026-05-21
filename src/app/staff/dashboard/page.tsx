import { DollarSign, Package, ReceiptText, Users, WalletCards } from "lucide-react";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { DashboardRevenueChart } from "@/components/workspace/dashboard-chartjs";
import { DataTable } from "@/components/workspace/data-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { QuickActions } from "@/components/workspace/quick-actions";
import { SectionHeader } from "@/components/workspace/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data";

function money(value: number) {
  return `PKR ${Math.round(Number(value || 0)).toLocaleString()}`;
}

function EmptyRows({ label }: { label: string }) {
  return (
    <tr>
      <td className="px-5 py-8 text-sm text-muted-foreground" colSpan={3}>{label}</td>
    </tr>
  );
}

export default async function StaffDashboard() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);

  return (
    <>
      <SectionHeader
        eyebrow="Dashboard"
        title="Counter overview"
        description="A focused view for billing, customer service, payments and stock checks."
        action={<Badge variant="secondary">Front counter</Badge>}
      />

      <div className="dashboard-v2-stack">
        <Card className="dashboard-v2-hero dashboard-v2-hero-staff overflow-hidden">
          <CardContent className="dashboard-v2-hero-inner">
            <div className="min-w-0">
              <div className="dashboard-v2-badge-row">
                <Badge variant="outline">Staff workspace</Badge>
                <Badge variant="secondary">{snapshot.metrics.salesWindowLabel}</Badge>
              </div>
              <h2>Ready for the next sale</h2>
              <p>Create invoices, check inventory, add customers and record payments without leaving the counter flow.</p>
            </div>
            <div className="dashboard-v2-health dashboard-v2-health-simple">
              <strong>{snapshot.metrics.lowStockCount}</strong>
              <span>low-stock items</span>
            </div>
          </CardContent>
        </Card>

        <div className="dashboard-v2-metrics">
          <MetricCard icon={DollarSign} title="Sales pulse" value={money(snapshot.metrics.todaySales)} helper={snapshot.metrics.salesWindowLabel} tone="emerald" />
          <MetricCard icon={ReceiptText} title="Revenue" value={money(snapshot.metrics.monthlyRevenue)} helper={snapshot.metrics.revenueWindowLabel} tone="primary" />
          <MetricCard icon={Package} title="Low stock" value={snapshot.metrics.lowStockCount} helper="Needs manager attention" tone="amber" />
          <MetricCard icon={WalletCards} title="Open dues" value={money(snapshot.metrics.customerDues)} helper="Customer receivables" tone="violet" />
        </div>

        <QuickActions
          title="Counter shortcuts"
          actions={[
            { href: "/staff/billing", label: "Create invoice", description: "Open guided billing", icon: ReceiptText, tone: "blue" },
            { href: "/staff/products", label: "Check stock", description: "Find inventory quickly", icon: Package, tone: "amber" },
            { href: "/staff/customers", label: "Add customer", description: "Update customer ledger", icon: Users, tone: "emerald" },
            { href: "/staff/payments", label: "Record payment", description: "Capture customer receipts", icon: DollarSign, tone: "violet" }
          ]}
        />

        <DashboardRevenueChart data={snapshot.charts.revenueTimeline} total={snapshot.metrics.monthlyRevenue} label={snapshot.metrics.revenueWindowLabel} />

        <div className="dashboard-v2-lower-grid">
          <DataTable title="Low stock priorities" description="Products that may slow billing if shelves are not refilled.">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-right">Stock</th>
                  <th className="px-5 py-3 text-right">Reorder</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.lowStock.length ? snapshot.lowStock.slice(0, 8).map((product: any) => (
                  <tr key={product.id} className="border-t border-border/60">
                    <td className="px-5 py-3 font-medium">{product.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{product.stockQty}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{product.reorderQuantity}</td>
                  </tr>
                )) : <EmptyRows label="No low stock items right now." />}
              </tbody>
            </table>
          </DataTable>

          <Card className="dashboard-v2-activity overflow-hidden">
            <CardContent className="p-5">
              <div className="mb-4">
                <p className="dashboard-chart-kicker">Activity</p>
                <h3 className="text-base font-semibold tracking-normal">Store stream</h3>
              </div>
              <ActivityFeed items={snapshot.activities} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

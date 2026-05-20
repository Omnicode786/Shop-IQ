import { DollarSign, Package, ReceiptText, Users } from "lucide-react";
import { ActivityFeed } from "@/components/workspace/activity-feed";
import { TrendAreaCard } from "@/components/workspace/analytics-cards";
import { DataTable } from "@/components/workspace/data-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { QuickActions } from "@/components/workspace/quick-actions";
import { SectionHeader } from "@/components/workspace/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data";

function money(value: number) {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

export default async function StaffDashboard() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);

  return (
    <>
      <SectionHeader
        eyebrow="Staff dashboard"
        title="Sales, stock and customer operations"
        description="A focused workspace for billing, inventory lookup, payments and customer service."
        action={<Badge variant="secondary">Front counter mode</Badge>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={DollarSign} title="Sales pulse" value={money(snapshot.metrics.todaySales)} helper={snapshot.metrics.salesWindowLabel} tone="emerald" />
        <MetricCard icon={Package} title="Low stock" value={snapshot.metrics.lowStockCount} helper="Needs manager attention" tone="amber" />
        <MetricCard icon={ReceiptText} title="Open dues" value={money(snapshot.metrics.customerDues)} helper="Customer receivables" tone="violet" />
      </div>

      <div className="mt-6">
        <QuickActions
          title="Counter shortcuts"
          actions={[
            { href: "/staff/billing", label: "Create invoice", description: "Open guided billing", icon: ReceiptText, tone: "blue" },
            { href: "/staff/products", label: "Check stock", description: "Find inventory quickly", icon: Package, tone: "amber" },
            { href: "/staff/customers", label: "Add customer", description: "Update customer ledger", icon: Users, tone: "emerald" },
            { href: "/staff/payments", label: "Record payment", description: "Capture customer receipts", icon: DollarSign, tone: "violet" }
          ]}
        />
      </div>

      <div className="mt-5">
        <TrendAreaCard
          title="Counter sales rhythm"
          description="Daily gross sales for the active window."
          value={money(snapshot.metrics.monthlyRevenue)}
          caption={snapshot.metrics.revenueWindowLabel}
          data={snapshot.charts.revenueTimeline}
          badge="Sales"
          format="money"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
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
    </>
  );
}

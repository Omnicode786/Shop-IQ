import { BarChart3, Package, WalletCards } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import {
  ComparativeBarsCard,
  DonutBreakdownCard,
  RankedBarsCard,
  TrendAreaCard
} from "@/components/workspace/analytics-cards";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

function money(value: number) {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

function compactMoney(value: number) {
  return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
}

export default async function Reports() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);
  const netDues = snapshot.metrics.customerDues - snapshot.metrics.supplierDues;

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "reports")} user={user}>
      <SectionHeader
        eyebrow="Reports"
        title="Business intelligence reports"
        description="Charts for product velocity, inventory value, stock risk, customer dues and supplier pressure."
      />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Reports"
          title="Analytics operating board"
          description="A visual reporting room for velocity, inventory concentration, slow movers and ledger pressure."
          icon={BarChart3}
          badge="BI view"
          stats={[
            { label: "Revenue", value: money(snapshot.metrics.monthlyRevenue) },
            { label: "Inventory", value: money(snapshot.metrics.inventoryValue) },
            { label: "Net dues", value: money(netDues) }
          ]}
        />
        <ModuleInsightPanel
          title="Report signals"
          description="Charts use the same adaptive palette as the rest of ShopIQ, including dark, classic, glass and tweakcn modes."
          icon={WalletCards}
          insights={[
            { label: "Fast movers", value: snapshot.fastMoving.length },
            { label: "Slow movers", value: snapshot.slowMoving.length },
            { label: "Categories", value: snapshot.charts.categoryValue.length }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={BarChart3} title="Revenue" value={money(snapshot.metrics.monthlyRevenue)} helper={snapshot.metrics.revenueWindowLabel} tone="emerald" />
        <MetricCard icon={Package} title="Inventory" value={money(snapshot.metrics.inventoryValue)} tone="violet" />
        <MetricCard icon={WalletCards} title="Net dues" value={money(netDues)} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <TrendAreaCard
          title="Revenue trend"
          description="Daily gross sales for the current operating window."
          value={money(snapshot.metrics.monthlyRevenue)}
          caption={snapshot.metrics.revenueWindowLabel}
          data={snapshot.charts.revenueTimeline}
          badge="Revenue"
          format="money"
        />
        <DonutBreakdownCard
          title="Category value"
          description="Inventory concentration by product category."
          data={snapshot.charts.categoryValue}
          centerValue={compactMoney(snapshot.metrics.inventoryValue)}
          centerLabel="Inventory"
          format="money"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ComparativeBarsCard
          title="Cashflow comparison"
          description="Receipts and supplier payouts in the same reporting lane."
          data={snapshot.charts.cashflowTimeline}
          valueLabel="Receipts"
          secondaryLabel="Payouts"
          badge="Cash"
          format="money"
        />
        <RankedBarsCard
          title="Fast moving products"
          description="Products with the strongest live sale movement."
          rows={snapshot.fastMoving.map((item: any) => ({ name: item.name, value: item.qty }))}
          badge="Velocity"
        />
        <RankedBarsCard
          title="Customer dues"
          description="Largest receivable balances by customer."
          rows={snapshot.charts.customerDueRank}
          format="money"
          badge="Dues"
        />
      </div>
    </AppShell>
  );
}

import { BarChart3, Package, WalletCards } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import {
  BubbleInsightCard,
  ComparativeBarsCard,
  DonutBreakdownCard,
  RankedBarsCard,
  RingScoreCard,
  StackedSignalCard,
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
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr_0.9fr]">
        <RingScoreCard
          title="Business control score"
          description="Stock health expressed as one fast confidence reading."
          score={Math.max(0, 100 - snapshot.metrics.stockRiskScore)}
          value={`${Math.max(0, 100 - snapshot.metrics.stockRiskScore)}%`}
          label="Control"
          badge="Score"
        />
        <TrendAreaCard
          title="Revenue trend"
          description="Daily gross sales for the current operating window."
          value={money(snapshot.metrics.monthlyRevenue)}
          caption={snapshot.metrics.revenueWindowLabel}
          data={snapshot.charts.revenueTimeline}
          badge="Revenue"
          format="money"
        />
        <StackedSignalCard
          title="Invoice status"
          description="Settlement state across recent invoices."
          data={snapshot.charts.invoiceStatus}
          totalLabel={`${snapshot.invoices.length} recent invoices`}
          badge="Billing"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ComparativeBarsCard
          title="Cashflow comparison"
          description="Receipts and supplier payouts in the same reporting lane."
          data={snapshot.charts.cashflowTimeline}
          valueLabel="Receipts"
          secondaryLabel="Payouts"
          badge="Cash"
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
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <BubbleInsightCard
          title="Executive summary bubbles"
          description="Large readings for the decisions that usually matter first."
          bubbles={[
            { label: "Revenue", value: compactMoney(snapshot.metrics.monthlyRevenue), size: "lg" },
            { label: "Inventory", value: compactMoney(snapshot.metrics.inventoryValue), size: "md" },
            { label: "Net dues", value: compactMoney(netDues), size: "sm" },
            { label: "Low stock", value: snapshot.metrics.lowStockCount, size: "sm" }
          ]}
          badge="Board"
        />
        <RankedBarsCard
          title="Margin leaders"
          description="Stock with the highest potential gross margin still on hand."
          rows={snapshot.charts.marginLeaders}
          format="money"
          badge="Margin"
        />
      </div>
    </AppShell>
  );
}

import { BarChart3, Package, WalletCards } from "lucide-react";
import { DataTable } from "@/components/workspace/data-table";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { ReportExportButton } from "@/components/workspace/report-export-button";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/data";

function money(value: number) {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

export default async function Reports() {
  const user = await getCurrentUser();
  const snapshot = await getDashboardSnapshot(user!.shopId, user?.role);
  const netDues = snapshot.metrics.customerDues - snapshot.metrics.supplierDues;

  return (
    <>
      <SectionHeader
        eyebrow="Reports"
        title="Business intelligence reports"
        description="Charts for product velocity, inventory value, stock risk, customer dues and supplier pressure."
        action={<ReportExportButton />}
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
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DataTable title="Fast moving products" description="Products with the strongest recent sale movement.">
          <table className="w-full text-sm">
            <tbody>
              {snapshot.fastMoving.slice(0, 8).map((item: any, index: number) => (
                <tr key={`${item.name}-${index}`} className="border-b border-border/60">
                  <td className="px-5 py-4 font-medium">{item.name}</td>
                  <td className="px-5 py-4 text-right">{item.qty} sold</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <DataTable title="Low stock watchlist" description="Products at or below reorder level.">
          <table className="w-full text-sm">
            <tbody>
              {snapshot.lowStock.slice(0, 8).map((product: any) => (
                <tr key={product.id} className="border-b border-border/60">
                  <td className="px-5 py-4 font-medium">{product.name}</td>
                  <td className="px-5 py-4 text-right">{product.stockQty} left</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <DataTable title="Customer dues" description="Largest receivable balances requiring follow-up.">
          <table className="w-full text-sm">
            <tbody>
              {snapshot.customers.slice(0, 8).map((customer: any) => (
                <tr key={customer.id} className="border-b border-border/60">
                  <td className="px-5 py-4 font-medium">{customer.name}</td>
                  <td className="px-5 py-4 text-right">{money(Number(customer.balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <DataTable title="Supplier payables" description="Outstanding balances owed to suppliers.">
          <table className="w-full text-sm">
            <tbody>
              {snapshot.suppliers.slice(0, 8).map((supplier: any) => (
                <tr key={supplier.id} className="border-b border-border/60">
                  <td className="px-5 py-4 font-medium">{supplier.name}</td>
                  <td className="px-5 py-4 text-right">{money(Number(supplier.balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </div>
    </>
  );
}

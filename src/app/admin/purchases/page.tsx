import { Truck } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { DonutBreakdownCard, TrendAreaCard } from "@/components/workspace/analytics-cards";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildDailySeries, statusSegments } from "@/lib/chart-helpers";
import { prisma } from "@/lib/prisma";
import { formatDate, toPlain } from "@/lib/utils";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function compactMoney(value: number) {
  return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
}

export default async function Purchases() {
  const user = await getCurrentUser();
  const [purchasesRaw, suppliersRaw, productsRaw] = await Promise.all([
    prisma.purchase.findMany({ where: { shopId: user!.shopId }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { purchaseDate: "desc" }, take: 150 }),
    prisma.supplier.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } })
  ]);
  const purchases = toPlain(purchasesRaw).map((purchase: any) => ({
    ...purchase,
    supplierName: purchase.supplier?.name || "General",
    purchaseDateDisplay: formatDate(purchase.purchaseDate),
    totalDisplay: money(purchase.total),
    dueDisplay: money(purchase.dueAmount),
    itemCount: purchase.items.length
  }));
  const suppliers = toPlain(suppliersRaw);
  const products = toPlain(productsRaw);
  const total = purchases.reduce((sum: number, purchase: any) => sum + Number(purchase.total), 0);
  const due = purchases.reduce((sum: number, purchase: any) => sum + Number(purchase.dueAmount || 0), 0);
  const purchaseTrend = buildDailySeries(purchases, (purchase: any) => purchase.purchaseDate, (purchase: any) => Number(purchase.total), 14);
  const statusRows = statusSegments(purchases, (purchase: any) => purchase.status);

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "purchases")} user={user}>
      <SectionHeader eyebrow="Purchases" title="Supplier purchase and stock intake" description="Track purchase orders, receiving status, payables and stock intake with protected reversals." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Purchases"
          title="Stock intake control"
          description="Create purchase records, receive product quantities and keep supplier payables tied to real inventory movement."
          icon={Truck}
          badge="Receiving desk"
          stats={[
            { label: "Purchases", value: purchases.length },
            { label: "Purchased value", value: money(total) },
            { label: "Suppliers", value: suppliers.length }
          ]}
        />
        <ModuleInsightPanel
          title="Receiving signals"
          description="Purchases remain searchable by supplier, status, due amount and stock intake record."
          icon={Truck}
          insights={[
            { label: "Purchase records", value: purchases.length },
            { label: "Open due", value: money(purchases.reduce((sum: number, purchase: any) => sum + Number(purchase.dueAmount || 0), 0)) },
            { label: "Products available", value: products.length }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={Truck} title="Purchases" value={purchases.length} />
        <MetricCard icon={Truck} title="Purchased value" value={money(total)} tone="violet" />
        <MetricCard icon={Truck} title="Open payable" value={money(due)} tone="rose" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TrendAreaCard
          title="Purchase rhythm"
          description="Stock intake value across the latest purchasing window."
          value={compactMoney(total)}
          caption={`${purchases.length} recent purchase records`}
          data={purchaseTrend}
          badge="Intake"
          format="money"
        />
        <DonutBreakdownCard
          title="Receiving status"
          description="Purchase records grouped by operational receiving state."
          data={statusRows}
          centerValue={`${purchases.length}`}
          centerLabel="Purchases"
          badge="Status"
        />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Purchase records"
          description="Create one-line stock intakes, update payable state and cancel received purchases with stock reversal."
          endpoint="/api/purchases"
          rows={purchases}
          submitShape="purchase"
          fields={[
            { key: "purchaseNo", label: "Purchase number" },
            { key: "supplierId", label: "Supplier", type: "select", options: suppliers.map((supplier: any) => ({ label: supplier.name, value: supplier.id })) },
            { key: "productId", label: "Product", type: "select", required: true, hideOnEdit: true, options: products.map((product: any) => ({ label: product.name, value: product.id })) },
            { key: "quantity", label: "Quantity", type: "number", required: true, hideOnEdit: true },
            { key: "unitCost", label: "Unit cost", type: "number", required: true, hideOnEdit: true },
            { key: "paidAmount", label: "Paid amount", type: "number" },
            { key: "total", label: "Total", type: "number", hideOnCreate: true },
            { key: "status", label: "Status", type: "select", hideOnCreate: true, options: [{ label: "Ordered", value: "ORDERED" }, { label: "Received", value: "RECEIVED" }, { label: "Partial", value: "PARTIAL" }, { label: "Cancelled", value: "CANCELLED" }] },
            { key: "notes", label: "Notes", type: "textarea", span: "full" }
          ]}
          columns={[
            { key: "purchaseNo", label: "Purchase" },
            { key: "supplierName", label: "Supplier" },
            { key: "purchaseDateDisplay", label: "Date" },
            { key: "itemCount", label: "Items" },
            { key: "totalDisplay", label: "Total" },
            { key: "dueDisplay", label: "Due" },
            { key: "status", label: "Status" }
          ]}
          canCreate={can(user?.role, "purchases", "create")}
          canUpdate={can(user?.role, "purchases", "update")}
          canDelete={can(user?.role, "purchases", "delete")}
          createLabel="Create purchase"
          deleteLabel="Cancel"
          deleteVerb="Cancel"
        />
      </div>
    </AppShell>
  );
}

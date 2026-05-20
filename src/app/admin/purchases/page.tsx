import { Truck } from "lucide-react";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { PurchaseFlow } from "@/components/workspace/purchase-flow";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { contains, dateRange, paginationMeta, readTableState, type TableSearchParams } from "@/lib/table-pagination";
import { formatDate, toPlain } from "@/lib/utils";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default async function Purchases({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const table = readTableState(searchParams);
  const purchaseFilters: any[] = [];
  if (table.query) {
    purchaseFilters.push({
      OR: [
        { purchaseNo: contains(table.query) },
        { notes: contains(table.query) },
        { supplier: { is: { name: contains(table.query) } } }
      ]
    });
  }
  if (table.status) purchaseFilters.push({ status: table.status });
  if (table.facet) purchaseFilters.push({ supplier: { is: { name: table.facet } } });
  const purchaseDateRange = dateRange("purchaseDate", table.dateFrom, table.dateTo);
  if (purchaseDateRange) purchaseFilters.push(purchaseDateRange);
  const purchaseWhere = { shopId: user!.shopId, ...(purchaseFilters.length ? { AND: purchaseFilters } : {}) };
  const [purchasesRaw, purchasesTotal, purchaseMetrics, suppliersRaw, productsRaw] = await Promise.all([
    prisma.purchase.findMany({ where: purchaseWhere, include: { supplier: true, _count: { select: { items: true } } }, orderBy: { purchaseDate: "desc" }, skip: table.skip, take: table.take }),
    prisma.purchase.count({ where: purchaseWhere }),
    prisma.purchase.aggregate({ where: { shopId: user!.shopId }, _sum: { total: true, dueAmount: true }, _count: true }),
    prisma.supplier.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } })
  ]);
  const purchases = toPlain(purchasesRaw).map((purchase: any) => ({
    ...purchase,
    supplierName: purchase.supplier?.name || "General",
    purchaseDateDisplay: formatDate(purchase.purchaseDate),
    totalDisplay: money(purchase.total),
    dueDisplay: money(purchase.dueAmount),
    itemCount: purchase._count?.items || 0
  }));
  const suppliers = toPlain(suppliersRaw);
  const products = toPlain(productsRaw);
  const total = Number(purchaseMetrics._sum.total || 0);
  const due = Number(purchaseMetrics._sum.dueAmount || 0);
  const purchaseCount = purchaseMetrics._count;
  const canCreatePurchase = can(user?.role, "purchases", "create");

  return (
    <>
      <SectionHeader eyebrow="Purchases" title="Supplier purchase and stock intake" description="Track purchase orders, receiving status, payables and stock intake with protected reversals." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Purchases"
          title="Stock intake control"
          description="Create purchase records, receive product quantities and keep supplier payables tied to real inventory movement."
          icon={Truck}
          badge="Receiving desk"
          stats={[
            { label: "Purchases", value: purchaseCount },
            { label: "Purchased value", value: money(total) },
            { label: "Suppliers", value: suppliers.length }
          ]}
        />
        <ModuleInsightPanel
          title="Receiving signals"
          description="Purchases remain searchable by supplier, status, due amount and stock intake record."
          icon={Truck}
          insights={[
            { label: "Purchase records", value: purchaseCount },
            { label: "Open due", value: money(due) },
            { label: "Products available", value: products.length }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={Truck} title="Purchases" value={purchaseCount} />
        <MetricCard icon={Truck} title="Purchased value" value={money(total)} tone="violet" />
        <MetricCard icon={Truck} title="Open payable" value={money(due)} tone="rose" />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Purchase records"
          description="Create one-line stock intakes, update payable state and cancel received purchases with stock reversal."
          endpoint="/api/purchases"
          rows={purchases}
          pagination={paginationMeta(table, purchasesTotal)}
          filterConfig={{
            statusKey: "status",
            statusOptions: ["ORDERED", "RECEIVED", "PARTIAL", "CANCELLED"],
            facetKey: "supplierName",
            facetLabel: "Supplier",
            facetOptions: suppliers.map((supplier: any) => supplier.name),
            dateKey: "purchaseDate",
            dateLabel: "Purchase date"
          }}
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
          canCreate={canCreatePurchase}
          createAction={<PurchaseFlow suppliers={suppliers} products={products} canCreate={canCreatePurchase} />}
          canUpdate={can(user?.role, "purchases", "update")}
          canDelete={can(user?.role, "purchases", "delete")}
          createLabel="Create purchase"
          deleteLabel="Cancel"
          deleteVerb="Cancel"
        />
      </div>
    </>
  );
}

import { AlertTriangle, Boxes, Package } from "lucide-react";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { contains, dateRange, paginationMeta, readTableState, type TableSearchParams } from "@/lib/table-pagination";
import { toPlain } from "@/lib/utils";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default async function ProductsPage({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const table = readTableState(searchParams);
  const productFilters: any[] = [];
  if (table.query) {
    productFilters.push({
      OR: [
        { name: contains(table.query) },
        { sku: contains(table.query) },
        { barcode: contains(table.query) },
        { brand: contains(table.query) },
        { location: contains(table.query) },
        { aisle: contains(table.query) },
        { shelf: contains(table.query) },
        { productType: contains(table.query) },
        { category: { is: { name: contains(table.query) } } },
        { supplier: { is: { name: contains(table.query) } } }
      ]
    });
  }
  if (table.status) productFilters.push({ status: table.status });
  if (table.facet) productFilters.push({ category: { is: { name: table.facet } } });
  const productDateRange = dateRange("updatedAt", table.dateFrom, table.dateTo);
  if (productDateRange) productFilters.push(productDateRange);
  const productWhere = { shopId: user!.shopId, ...(productFilters.length ? { AND: productFilters } : {}) };
  const [productsRaw, productsTotal, categoriesRaw, suppliersRaw, metricProducts] = await Promise.all([
    prisma.product.findMany({ where: productWhere, include: { category: true, supplier: true }, orderBy: { updatedAt: "desc" }, skip: table.skip, take: table.take }),
    prisma.product.count({ where: productWhere }),
    prisma.category.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { shopId: user!.shopId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { shopId: user!.shopId, status: "ACTIVE" }, select: { stockQty: true, costPrice: true, reorderLevel: true } })
  ]);
  const products = toPlain(productsRaw).map((product: any) => ({
    ...product,
    categoryName: product.category?.name || "Uncategorized",
    supplierName: product.supplier?.name || "-",
    retailLocation: [product.aisle, product.shelf].filter(Boolean).join(" / ") || product.location || "-",
    productTypeDisplay: product.productType || (product.isPerishable ? "Perishable" : "General"),
    stockDisplay: `${product.stockQty} ${product.unit}`,
    costDisplay: money(product.costPrice),
    saleDisplay: money(product.salePrice)
  }));
  const categories = toPlain(categoriesRaw);
  const suppliers = toPlain(suppliersRaw);
  const activeProducts = metricProducts;
  const value = activeProducts.reduce((sum: number, product: any) => sum + product.stockQty * Number(product.costPrice), 0);
  const low = activeProducts.filter((product: any) => product.stockQty <= product.reorderLevel);
  return (
    <>
      <SectionHeader eyebrow="Inventory" title="Product and stock intelligence" description="Manage SKUs, pricing, stock risk, reorder levels and inventory value from one role-aware workspace." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Inventory"
          title="Stock intelligence deck"
          description="A structured inventory cockpit for creating SKUs, reviewing pricing, locating stock and acting before reorder levels are crossed."
          icon={Package}
          badge="SKU operations"
          stats={[
            { label: "Active SKUs", value: activeProducts.length },
            { label: "Inventory value", value: money(value) },
            { label: "Low stock", value: low.length }
          ]}
        />
        <ModuleInsightPanel
          title="Reorder signals"
          description="The table below is searchable and role-aware, with archive protection and stock adjustment tracking."
          icon={AlertTriangle}
          insights={[
            { label: "Tracked categories", value: categories.length },
            { label: "Items at risk", value: low.length },
            { label: "Stock value", value: money(value) }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={Package} title="Active SKUs" value={activeProducts.length} />
        <MetricCard icon={Boxes} title="Inventory value" value={money(value)} tone="violet" />
        <MetricCard icon={AlertTriangle} title="Low stock" value={low.length} tone="amber" />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Inventory master"
          description="Create, edit, archive and review product records. Stock edits create adjustment movements automatically."
          endpoint="/api/products"
          rows={products}
          pagination={paginationMeta(table, productsTotal)}
          filterConfig={{
            statusKey: "status",
            statusOptions: ["ACTIVE", "ARCHIVED"],
            facetKey: "categoryName",
            facetLabel: "Category",
            facetOptions: categories.map((category: any) => category.name),
            dateKey: "updatedAt",
            dateLabel: "Updated"
          }}
          fields={[
            { key: "name", label: "Product name", required: true },
            { key: "sku", label: "SKU" },
            { key: "barcode", label: "Barcode" },
            { key: "brand", label: "Brand" },
            { key: "categoryId", label: "Category", type: "select", options: categories.map((category: any) => ({ label: category.name, value: category.id })) },
            { key: "supplierId", label: "Primary supplier", type: "select", options: suppliers.map((supplier: any) => ({ label: supplier.name, value: supplier.id })) },
            { key: "unit", label: "Base unit (e.g. pcs, kg)" },
            { key: "packUnit", label: "Pack unit (e.g. Box, Carton)" },
            { key: "packSize", label: "Pack size (e.g. 12)", type: "number" },
            { key: "costPrice", label: "Average cost price (per base unit)", type: "number", required: true },
            { key: "latestPurchaseCost", label: "Latest purchase cost", type: "number", hideOnCreate: true, readOnly: true },
            { key: "salePrice", label: "Sale price", type: "number", required: true },
            { key: "taxRate", label: "Tax rate %", type: "number" },
            { key: "discountRate", label: "Discount rate %", type: "number" },
            { key: "stockQty", label: "System stock quantity", type: "number", required: true },
            { key: "physicalCount", label: "Cycle Count (Physical count on shelf)", type: "number", hideOnCreate: true },
            { key: "stockAdjustmentReason", label: "Stock adjustment reason", type: "select", hideOnCreate: true, options: [{ label: "Damage", value: "Damage" }, { label: "Count correction", value: "Count correction" }, { label: "Expired item", value: "Expired item" }, { label: "Theft/loss", value: "Theft/loss" }, { label: "Supplier return", value: "Supplier return" }, { label: "Manual correction", value: "Manual correction" }, { label: "Other", value: "Other" }] },
            { key: "stockAdjustmentNote", label: "Adjustment note (if Other)", type: "text", hideOnCreate: true, span: "full" },
            { key: "reorderLevel", label: "Low stock level", type: "number" },
            { key: "reorderQuantity", label: "Reorder quantity", type: "number" },
            { key: "location", label: "Location" },
            { key: "aisle", label: "Aisle/counter" },
            { key: "shelf", label: "Shelf" },
            { key: "productType", label: "Product type" },
            { key: "isPerishable", label: "Is Perishable/Batch Tracked?", type: "checkbox", span: "full" },
            { key: "batchNo", label: "Batch number", showWhen: { key: "isPerishable", truthy: true } },
            { key: "manufactureDate", label: "Manufacture date", type: "date" as any, showWhen: { key: "isPerishable", truthy: true } },
            { key: "expiryDate", label: "Expiry date", type: "date" as any, showWhen: { key: "isPerishable", truthy: true } },
            { key: "description", label: "Description", type: "textarea", span: "full" },
            { key: "status", label: "Status", type: "select", hideOnCreate: true, options: [{ label: "Active", value: "ACTIVE" }, { label: "Archived", value: "ARCHIVED" }] }
          ]}
          columns={[
            { key: "name", label: "Product" },
            { key: "sku", label: "SKU" },
            { key: "categoryName", label: "Category" },
            { key: "supplierName", label: "Supplier" },
            { key: "retailLocation", label: "Location" },
            { key: "stockDisplay", label: "Stock" },
            { key: "costDisplay", label: "Cost" },
            { key: "saleDisplay", label: "Sale" },
            { key: "status", label: "Status" }
          ]}
          canCreate={can(user?.role, "products", "create")}
          canUpdate={can(user?.role, "products", "update")}
          canDelete={can(user?.role, "products", "delete")}
          createLabel="Add product"
          deleteLabel="Archive"
          deleteVerb="Archive"
        />
      </div>
    </>
  );
}

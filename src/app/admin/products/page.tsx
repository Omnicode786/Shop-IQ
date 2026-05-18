import { AlertTriangle, Boxes, Package } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { DonutBreakdownCard, RankedBarsCard, RingScoreCard, StackedSignalCard } from "@/components/workspace/analytics-cards";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { statusSegments, sumByGroup, topRows } from "@/lib/chart-helpers";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toPlain } from "@/lib/utils";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function compactMoney(value: number) {
  return `PKR ${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0))}`;
}

export default async function ProductsPage() {
  const user = await getCurrentUser();
  const [productsRaw, categoriesRaw, suppliersRaw] = await Promise.all([
    prisma.product.findMany({ where: { shopId: user!.shopId }, include: { category: true, supplier: true }, orderBy: { updatedAt: "desc" } }),
    prisma.category.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } })
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
  const activeProducts = products.filter((product: any) => product.status === "ACTIVE");
  const value = activeProducts.reduce((sum: number, product: any) => sum + product.stockQty * Number(product.costPrice), 0);
  const low = activeProducts.filter((product: any) => product.stockQty <= product.reorderLevel);
  const healthScore = Math.max(0, 100 - Math.round((low.length / Math.max(activeProducts.length, 1)) * 100));
  const categoryValue = sumByGroup(activeProducts, (product: any) => product.categoryName, (product: any) => product.stockQty * Number(product.costPrice), 8);
  const marginRows = topRows(activeProducts, (product: any) => product.name, (product: any) => Math.max(0, Number(product.salePrice) - Number(product.costPrice)) * product.stockQty, 6);
  const statusRows = statusSegments(products, (product: any) => product.status);
  const nav = workspaceNav(user?.role);
  const currentPath = workspacePath(user?.role, "products");

  return (
    <AppShell nav={nav} heading={workspaceHeading(user?.role)} currentPath={currentPath} user={user}>
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
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.05fr_1fr]">
        <RingScoreCard
          title="Stock health"
          description="A single read on reorder pressure across active inventory."
          score={healthScore}
          value={`${healthScore}%`}
          label="Ready"
          badge="Health"
        />
        <DonutBreakdownCard
          title="Category value mix"
          description="Where inventory capital is concentrated across the catalog."
          data={categoryValue}
          centerValue={compactMoney(value)}
          centerLabel="Stock value"
          format="money"
        />
        <StackedSignalCard
          title="Catalog status"
          description="Active and archived records in the inventory master."
          data={statusRows}
          totalLabel={`${products.length} product records`}
          badge="Catalog"
        />
      </div>
      <div className="mt-6">
        <RankedBarsCard
          title="Margin inventory leaders"
          description="Products with the largest potential gross margin currently sitting in stock."
          rows={marginRows}
          format="money"
          badge="Margin"
        />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Inventory master"
          description="Create, edit, archive and review product records. Stock edits create adjustment movements automatically."
          endpoint="/api/products"
          rows={products}
          fields={[
            { key: "name", label: "Product name", required: true },
            { key: "sku", label: "SKU" },
            { key: "barcode", label: "Barcode" },
            { key: "brand", label: "Brand" },
            { key: "categoryId", label: "Category", type: "select", options: categories.map((category: any) => ({ label: category.name, value: category.id })) },
            { key: "supplierId", label: "Primary supplier", type: "select", options: suppliers.map((supplier: any) => ({ label: supplier.name, value: supplier.id })) },
            { key: "unit", label: "Unit", placeholder: "pcs" },
            { key: "costPrice", label: "Cost price", type: "number", required: true },
            { key: "salePrice", label: "Sale price", type: "number", required: true },
            { key: "taxRate", label: "Tax rate %", type: "number" },
            { key: "discountRate", label: "Discount rate %", type: "number" },
            { key: "stockQty", label: "Stock quantity", type: "number", required: true },
            { key: "reorderLevel", label: "Low stock level", type: "number" },
            { key: "reorderQuantity", label: "Reorder quantity", type: "number" },
            { key: "location", label: "Location" },
            { key: "aisle", label: "Aisle/counter" },
            { key: "shelf", label: "Shelf" },
            { key: "productType", label: "Product type" },
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
    </AppShell>
  );
}

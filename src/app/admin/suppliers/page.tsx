import { Truck, WalletCards } from "lucide-react";
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

export default async function Suppliers({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const table = readTableState(searchParams);
  const supplierFilters: any[] = [];
  if (table.query) {
    supplierFilters.push({
      OR: [
        { name: contains(table.query) },
        { phone: contains(table.query) },
        { email: contains(table.query) },
        { address: contains(table.query) },
        { contactPerson: contains(table.query) },
        { supplierType: contains(table.query) },
        { paymentTerms: contains(table.query) },
        { ntn: contains(table.query) },
        { gstNumber: contains(table.query) },
        { notes: contains(table.query) }
      ]
    });
  }
  if (table.facet) supplierFilters.push({ supplierType: table.facet });
  const supplierDateRange = dateRange("updatedAt", table.dateFrom, table.dateTo);
  if (supplierDateRange) supplierFilters.push(supplierDateRange);
  const supplierWhere = { shopId: user!.shopId, ...(supplierFilters.length ? { AND: supplierFilters } : {}) };
  const [suppliersRaw, suppliersTotal, supplierCount, supplierBalance, supplierTypesRaw] = await Promise.all([
    prisma.supplier.findMany({ where: supplierWhere, include: { _count: { select: { purchases: true } } }, orderBy: { balance: "desc" }, skip: table.skip, take: table.take }),
    prisma.supplier.count({ where: supplierWhere }),
    prisma.supplier.count({ where: { shopId: user!.shopId } }),
    prisma.supplier.aggregate({ where: { shopId: user!.shopId }, _sum: { balance: true }, _avg: { reliabilityScore: true } }),
    prisma.supplier.findMany({ where: { shopId: user!.shopId, supplierType: { not: null } }, select: { supplierType: true }, distinct: ["supplierType"], orderBy: { supplierType: "asc" } })
  ]);
  const suppliers = toPlain(suppliersRaw).map((supplier: any) => ({
    ...supplier,
    purchaseCount: supplier._count?.purchases || 0,
    supplierTypeDisplay: supplier.supplierType || "General",
    leadTimeDisplay: supplier.leadTimeDays === null || supplier.leadTimeDays === undefined ? "-" : `${supplier.leadTimeDays} days`,
    reliabilityDisplay: `${supplier.reliabilityScore}%`,
    balanceDisplay: money(supplier.balance),
    statusDisplay: supplier.status || "ACTIVE"
  }));
  const dues = Math.max(Number(supplierBalance._sum.balance || 0), 0);
  const supplierTypeOptions = toPlain(supplierTypesRaw).map((supplier: any) => supplier.supplierType).filter(Boolean);

  return (
    <>
      <SectionHeader eyebrow="Suppliers" title="Supplier payable and reliability cockpit" description="Monitor supplier balances, purchases, payables and reliability signals." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Suppliers"
          title="Supplier reliability desk"
          description="A supplier control surface for payables, contact data, purchase relationships and reliability scoring."
          icon={Truck}
          badge="Payable view"
          stats={[
            { label: "Suppliers", value: supplierCount },
            { label: "Payables", value: money(dues) },
            { label: "Avg reliability", value: `${Math.round(Number(supplierBalance._avg.reliabilityScore || 0))}%` }
          ]}
        />
        <ModuleInsightPanel
          title="Purchase readiness"
          description="Keep supplier records complete before purchasing so stock intake and payables stay clean."
          icon={WalletCards}
          insights={[
            { label: "Supplier accounts", value: supplierCount },
            { label: "Outstanding payable", value: money(dues) },
            { label: "Purchase-linked", value: suppliers.filter((supplier: any) => supplier.purchaseCount > 0).length }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricCard icon={Truck} title="Suppliers" value={supplierCount} />
        <MetricCard icon={WalletCards} title="Payables" value={money(dues)} tone="rose" />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Supplier ledger"
          description="Admins and managers can create, edit and remove unused supplier records. Staff keep read-only visibility."
          endpoint="/api/suppliers"
          rows={suppliers}
          pagination={paginationMeta(table, suppliersTotal)}
          filterConfig={{
            facetKey: "supplierTypeDisplay",
            facetLabel: "Type",
            facetOptions: supplierTypeOptions,
            dateKey: "updatedAt",
            dateLabel: "Updated"
          }}
          fields={[
            { key: "name", label: "Supplier name", required: true },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email", type: "email" },
            { key: "address", label: "Address", span: "half" },
            { key: "contactPerson", label: "Contact person" },
            { key: "supplierType", label: "Supplier type" },
            { key: "paymentTerms", label: "Payment terms" },
            { key: "leadTimeDays", label: "Lead time days", type: "number" },
            { key: "ntn", label: "NTN" },
            { key: "gstNumber", label: "GST number" },
            { key: "balance", label: "Current payable", type: "number", readOnly: true },
            { key: "openingBalance", label: "Opening payable", type: "number", hideOnEdit: true },
            { key: "balanceAdjustment", label: "Adjust balance (+/-)", type: "number", hideOnCreate: true },
            { key: "balanceAdjustmentReason", label: "Adjustment reason", type: "select", hideOnCreate: true, options: [{ label: "Opening balance correction", value: "Opening balance correction" }, { label: "Supplier discount/waiver", value: "Supplier discount/waiver" }, { label: "Refund adjustment", value: "Refund adjustment" }, { label: "Other", value: "Other" }] },
            { key: "balanceAdjustmentNote", label: "Adjustment note", type: "text", hideOnCreate: true, span: "full" },
            { key: "reliabilityScore", label: "Reliability score", type: "number" },
            { key: "status", label: "Status", type: "select", options: [{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }] },
            { key: "notes", label: "Notes", type: "textarea", span: "full" }
          ]}
          columns={[
            { key: "name", label: "Supplier" },
            { key: "contactPerson", label: "Contact" },
            { key: "supplierTypeDisplay", label: "Type" },
            { key: "leadTimeDisplay", label: "Lead time" },
            { key: "purchaseCount", label: "Purchases" },
            { key: "reliabilityDisplay", label: "Reliability" },
            { key: "balanceDisplay", label: "Balance" },
            { key: "statusDisplay", label: "Status" }
          ]}
          canCreate={can(user?.role, "suppliers", "create")}
          canUpdate={can(user?.role, "suppliers", "update")}
          canDelete={can(user?.role, "suppliers", "delete")}
          createLabel="Add supplier"
        />
      </div>
    </>
  );
}

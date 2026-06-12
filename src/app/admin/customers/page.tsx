import { Users, WalletCards } from "lucide-react";
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

export default async function Customers({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const table = readTableState(searchParams);
  const customerFilters: any[] = [];
  if (table.query) {
    customerFilters.push({
      OR: [
        { name: contains(table.query) },
        { phone: contains(table.query) },
        { whatsapp: contains(table.query) },
        { email: contains(table.query) },
        { address: contains(table.query) },
        { area: contains(table.query) },
        { city: contains(table.query) },
        { customerType: contains(table.query) },
        { loyaltyCardNo: contains(table.query) },
        { notes: contains(table.query) }
      ]
    });
  }
  if (table.facet) customerFilters.push({ customerType: table.facet });
  const customerDateRange = dateRange("updatedAt", table.dateFrom, table.dateTo);
  if (customerDateRange) customerFilters.push(customerDateRange);
  const customerWhere = { shopId: user!.shopId, ...(customerFilters.length ? { AND: customerFilters } : {}) };
  const [customersRaw, customersTotal, customerCount, customerBalance] = await Promise.all([
    prisma.customer.findMany({ where: customerWhere, include: { _count: { select: { invoices: true } } }, orderBy: { balance: "desc" }, skip: table.skip, take: table.take }),
    prisma.customer.count({ where: customerWhere }),
    prisma.customer.count({ where: { shopId: user!.shopId } }),
    prisma.customer.aggregate({ where: { shopId: user!.shopId }, _sum: { balance: true } })
  ]);
  const customers = toPlain(customersRaw).map((customer: any) => ({
    ...customer,
    invoiceCount: customer._count?.invoices || 0,
    loyaltyDisplay: customer.loyaltyCardNo ? `${customer.loyaltyCardNo} / ${Number(customer.loyaltyPoints || 0).toLocaleString()} pts` : "-",
    areaDisplay: [customer.area, customer.city].filter(Boolean).join(", ") || customer.address || "-",
    customerTypeDisplay: customer.customerType || "Retail",
    balanceDisplay: money(customer.balance),
    creditLimitDisplay: money(customer.creditLimit)
  }));
  const dues = Math.max(Number(customerBalance._sum.balance || 0), 0);

  return (
    <>
      <SectionHeader eyebrow="Customers" title="Customer ledger and loyalty workspace" description="Track balances, contact details, credit limits and payment behavior with role-based actions." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Customers"
          title="Customer ledger cockpit"
          description="A searchable customer workspace for balances, contacts, credit limits and service history, tuned for counter staff and managers."
          icon={Users}
          badge="Ledger view"
          stats={[
            { label: "Customers", value: customerCount },
            { label: "Outstanding", value: money(dues) },
            { label: "Showing", value: customers.length }
          ]}
        />
        <ModuleInsightPanel
          title="Receivable pressure"
          description="Use this module to spot high-balance customers and keep contact data clean for reminders."
          icon={WalletCards}
          insights={[
            { label: "Total accounts", value: customerCount },
            { label: "Receivables", value: money(dues) },
            { label: "Average balance", value: money(customerCount ? dues / customerCount : 0) }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricCard icon={Users} title="Customers" value={customerCount} />
        <MetricCard icon={WalletCards} title="Outstanding receivables" value={money(dues)} tone="amber" />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Customer accounts"
          description="Staff can create and update customer accounts; admins and managers can remove unused records."
          endpoint="/api/customers"
          rows={customers}
          pagination={paginationMeta(table, customersTotal)}
          filterConfig={{
            facetKey: "customerTypeDisplay",
            facetLabel: "Type",
            facetOptions: ["WALK_IN_LOYALTY", "FAMILY_MONTHLY", "OFFICE_PANTRY", "BULK_BUYER"],
            dateKey: "updatedAt",
            dateLabel: "Updated"
          }}
          fields={[
            { key: "name", label: "Customer name", required: true },
            { key: "phone", label: "Phone" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "email", label: "Email", type: "email" },
            { key: "address", label: "Address", span: "half" },
            { key: "area", label: "Area" },
            { key: "city", label: "City" },
            { key: "customerType", label: "Customer type", type: "select", options: [{ label: "Walk-in loyalty", value: "WALK_IN_LOYALTY" }, { label: "Family monthly", value: "FAMILY_MONTHLY" }, { label: "Office pantry", value: "OFFICE_PANTRY" }, { label: "Bulk buyer", value: "BULK_BUYER" }] },
            { key: "loyaltyCardNo", label: "Loyalty card no" },
            { key: "loyaltyPoints", label: "Loyalty points", type: "number" },
            { key: "preferredPaymentMethod", label: "Preferred payment", type: "select", options: [{ label: "Cash", value: "CASH" }, { label: "Card", value: "CARD" }, { label: "Bank transfer", value: "BANK_TRANSFER" }, { label: "JazzCash", value: "JAZZCASH" }, { label: "EasyPaisa", value: "EASYPAISA" }, { label: "Cheque", value: "CHEQUE" }, { label: "Other", value: "OTHER" }] },
            { key: "creditLimit", label: "Credit limit", type: "number" },
            { key: "balance", label: "Current balance", type: "number", readOnly: true },
            { key: "openingBalance", label: "Opening balance", type: "number", hideOnEdit: true },
            { key: "balanceAdjustment", label: "Adjust balance (+/-)", type: "number", hideOnCreate: true },
            { key: "balanceAdjustmentReason", label: "Adjustment reason", type: "select", hideOnCreate: true, options: [{ label: "Opening balance correction", value: "Opening balance correction" }, { label: "Discount/Write-off", value: "Discount/Write-off" }, { label: "Refund adjustment", value: "Refund adjustment" }, { label: "Other", value: "Other" }] },
            { key: "balanceAdjustmentNote", label: "Adjustment note", type: "text", hideOnCreate: true, span: "full" },
            { key: "status", label: "Status", type: "select", hideOnCreate: true, options: [{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }] },
            { key: "notes", label: "Notes", type: "textarea", span: "full" }
          ]}
          columns={[
            { key: "name", label: "Customer" },
            { key: "phone", label: "Phone" },
            { key: "areaDisplay", label: "Area" },
            { key: "customerTypeDisplay", label: "Type" },
            { key: "loyaltyDisplay", label: "Loyalty" },
            { key: "invoiceCount", label: "Invoices" },
            { key: "creditLimitDisplay", label: "Credit limit" },
            { key: "balanceDisplay", label: "Balance" },
            { key: "status", label: "Status" }
          ]}
          canCreate={can(user?.role, "customers", "create")}
          canUpdate={can(user?.role, "customers", "update")}
          canDelete={can(user?.role, "customers", "delete")}
          createLabel="Add customer"
        />
      </div>
    </>
  );
}

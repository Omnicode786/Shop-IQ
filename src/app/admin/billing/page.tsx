import { ReceiptText } from "lucide-react";
import { BillingFlow } from "@/components/workspace/billing-flow";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { contains, dateRange, paginationMeta, readTableState, type TableSearchParams } from "@/lib/table-pagination";
import { formatDate, toPlain } from "@/lib/utils";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default async function Billing({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const table = readTableState(searchParams);
  const invoiceFilters: any[] = [];
  if (table.query) {
    invoiceFilters.push({
      OR: [
        { invoiceNo: contains(table.query) },
        { receiptNo: contains(table.query) },
        { channel: contains(table.query) },
        { promoCode: contains(table.query) },
        { notes: contains(table.query) },
        { customer: { is: { name: contains(table.query) } } }
      ]
    });
  }
  if (table.status) invoiceFilters.push({ status: table.status });
  if (table.facet) invoiceFilters.push({ channel: table.facet });
  const invoiceDateRange = dateRange("invoiceDate", table.dateFrom, table.dateTo);
  if (invoiceDateRange) invoiceFilters.push(invoiceDateRange);
  const invoiceWhere = { shopId: user!.shopId, ...(invoiceFilters.length ? { AND: invoiceFilters } : {}) };
  const [invoicesRaw, invoicesTotal, invoiceMetrics, customersRaw, productsRaw] = await Promise.all([
    prisma.invoice.findMany({ where: invoiceWhere, include: { customer: true, _count: { select: { items: true } } }, orderBy: { invoiceDate: "desc" }, skip: table.skip, take: table.take }),
    prisma.invoice.count({ where: invoiceWhere }),
    prisma.invoice.aggregate({ where: { shopId: user!.shopId }, _sum: { total: true, dueAmount: true }, _count: true }),
    prisma.customer.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { shopId: user!.shopId, status: "ACTIVE" }, orderBy: { name: "asc" } })
  ]);
  const invoices = toPlain(invoicesRaw).map((invoice: any) => ({
    ...invoice,
    customerName: invoice.customer?.name || "Walk-in",
    channelDisplay: invoice.channel || "POS",
    receiptDisplay: invoice.receiptNo || invoice.invoiceNo,
    invoiceDateDisplay: formatDate(invoice.invoiceDate),
    totalDisplay: money(invoice.total),
    dueDisplay: money(invoice.dueAmount),
    itemCount: invoice._count?.items || 0
  }));
  const customers = toPlain(customersRaw);
  const products = toPlain(productsRaw);
  const total = Number(invoiceMetrics._sum.total || 0);
  const due = Number(invoiceMetrics._sum.dueAmount || 0);
  const invoiceCount = invoiceMetrics._count;
  const canCreateInvoice = can(user?.role, "invoices", "create");

  return (
    <>
      <SectionHeader
        eyebrow="Billing"
        title="Invoice and sales workspace"
        description="Create sales invoices, attach customers, settle payment states and cancel records with stock reversal when authorized."
      />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Billing"
          title="Invoice command lane"
          description="Create invoices from live inventory, settle paid amounts and keep stock movement consistent when records change."
          icon={ReceiptText}
          badge="Sales desk"
          stats={[
            { label: "Invoices", value: invoiceCount },
            { label: "Gross billed", value: money(total) },
            { label: "Sellable SKUs", value: products.length }
          ]}
        />
        <ModuleInsightPanel
          title="Payment state"
          description="Invoice status, due amount and customer context stay searchable in the operating table below."
          icon={ReceiptText}
          insights={[
            { label: "Customers", value: customers.length },
            { label: "Invoice rows", value: invoiceCount },
            { label: "Open due", value: money(due) }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={ReceiptText} title="Invoices" value={invoiceCount} />
        <MetricCard icon={ReceiptText} title="Gross billed" value={money(total)} tone="emerald" />
        <MetricCard icon={ReceiptText} title="Open due" value={money(due)} tone="amber" />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Sales invoices"
          description="Create invoices from one product line, then update payment/status details. Cancelling an invoice reverses stock and open dues."
          endpoint="/api/invoices"
          rows={invoices}
          pagination={paginationMeta(table, invoicesTotal)}
          filterConfig={{
            statusKey: "status",
            statusOptions: ["DRAFT", "PAID", "PARTIAL", "UNPAID", "CANCELLED"],
            facetKey: "channelDisplay",
            facetLabel: "Channel",
            facetOptions: ["POS", "LOYALTY", "B2B"],
            dateKey: "invoiceDate",
            dateLabel: "Invoice date"
          }}
          submitShape="invoice"
          fields={[
            { key: "invoiceNo", label: "Invoice number" },
            { key: "customerId", label: "Customer", type: "select", options: customers.map((customer: any) => ({ label: customer.name, value: customer.id })) },
            { key: "productId", label: "Product", type: "select", required: true, hideOnEdit: true, options: products.map((product: any) => ({ label: `${product.name} (${product.stockQty} ${product.unit})`, value: product.id })) },
            { key: "quantity", label: "Quantity", type: "number", required: true, hideOnEdit: true },
            { key: "unitPrice", label: "Unit price override", type: "number", hideOnEdit: true },
            { key: "discount", label: "Discount", type: "number" },
            { key: "loyaltyDiscount", label: "Loyalty discount", type: "number" },
            { key: "tax", label: "Tax", type: "number" },
            { key: "paidAmount", label: "Paid amount", type: "number" },
            { key: "cashierCounter", label: "Cashier counter" },
            { key: "channel", label: "Channel", type: "select", options: [{ label: "POS", value: "POS" }, { label: "Loyalty counter", value: "LOYALTY" }, { label: "B2B / bulk", value: "B2B" }] },
            { key: "promoCode", label: "Promo code" },
            { key: "receiptNo", label: "Receipt no" },
            { key: "total", label: "Total", type: "number", hideOnCreate: true },
            { key: "status", label: "Status", type: "select", hideOnCreate: true, options: [{ label: "Draft", value: "DRAFT" }, { label: "Paid", value: "PAID" }, { label: "Partial", value: "PARTIAL" }, { label: "Unpaid", value: "UNPAID" }, { label: "Cancelled", value: "CANCELLED" }] },
            { key: "notes", label: "Notes", type: "textarea", span: "full" }
          ]}
          columns={[
            { key: "invoiceNo", label: "Invoice" },
            { key: "customerName", label: "Customer" },
            { key: "channelDisplay", label: "Channel" },
            { key: "receiptDisplay", label: "Receipt" },
            { key: "invoiceDateDisplay", label: "Date" },
            { key: "itemCount", label: "Items" },
            { key: "totalDisplay", label: "Total" },
            { key: "dueDisplay", label: "Due" },
            { key: "status", label: "Status" }
          ]}
          canCreate={canCreateInvoice}
          createAction={<BillingFlow customers={customers} products={products} canCreate={canCreateInvoice} />}
          canUpdate={can(user?.role, "invoices", "update")}
          canDelete={can(user?.role, "invoices", "delete")}
          createLabel="Create invoice"
          deleteLabel="Cancel"
          deleteVerb="Cancel"
        />
      </div>
    </>
  );
}

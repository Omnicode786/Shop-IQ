import { ReceiptText } from "lucide-react";
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

export default async function Billing() {
  const user = await getCurrentUser();
  const [invoicesRaw, customersRaw, productsRaw] = await Promise.all([
    prisma.invoice.findMany({ where: { shopId: user!.shopId }, include: { customer: true, items: { include: { product: true } } }, orderBy: { invoiceDate: "desc" }, take: 150 }),
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
    itemCount: invoice.items.length
  }));
  const customers = toPlain(customersRaw);
  const products = toPlain(productsRaw);
  const total = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.total), 0);
  const due = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.dueAmount || 0), 0);
  const invoiceTrend = buildDailySeries(invoices, (invoice: any) => invoice.invoiceDate, (invoice: any) => Number(invoice.total), 14);
  const statusRows = statusSegments(invoices, (invoice: any) => invoice.status);

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "billing")} user={user}>
      <SectionHeader eyebrow="Billing" title="Invoice and sales workspace" description="Create sales invoices, settle payment states and cancel records with stock reversal when authorized." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Billing"
          title="Invoice command lane"
          description="Create invoices from live inventory, settle paid amounts and keep stock movement consistent when records change."
          icon={ReceiptText}
          badge="Sales desk"
          stats={[
            { label: "Invoices", value: invoices.length },
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
            { label: "Invoice rows", value: invoices.length },
            { label: "Open due", value: money(invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.dueAmount || 0), 0)) }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={ReceiptText} title="Invoices" value={invoices.length} />
        <MetricCard icon={ReceiptText} title="Gross billed" value={money(total)} tone="emerald" />
        <MetricCard icon={ReceiptText} title="Open due" value={money(due)} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TrendAreaCard
          title="Billing rhythm"
          description="Gross invoice value across the latest sales window."
          value={compactMoney(total)}
          caption={`${invoices.length} recent invoices`}
          data={invoiceTrend}
          badge="Sales"
          format="money"
        />
        <DonutBreakdownCard
          title="Invoice status orbit"
          description="A settlement mix that makes unpaid and partial invoices visible."
          data={statusRows}
          centerValue={`${invoices.length}`}
          centerLabel="Invoices"
          badge="Status"
        />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Sales invoices"
          description="Create invoices from one product line, then update payment/status details. Cancelling an invoice reverses stock and open dues."
          endpoint="/api/invoices"
          rows={invoices}
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
          canCreate={can(user?.role, "invoices", "create")}
          canUpdate={can(user?.role, "invoices", "update")}
          canDelete={can(user?.role, "invoices", "delete")}
          createLabel="Create invoice"
          deleteLabel="Cancel"
          deleteVerb="Cancel"
        />
      </div>
    </AppShell>
  );
}

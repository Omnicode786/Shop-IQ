import { CreditCard } from "lucide-react";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can, canUsePaymentDirection } from "@/lib/permissions";
import { invoiceItemsSummary, isAutomaticInvoicePayment } from "@/lib/payment-workflow";
import { prisma } from "@/lib/prisma";
import { isAutomaticPurchasePayment, purchaseItemsSummary } from "@/lib/supplier-payment-workflow";
import { contains, dateRange, paginationMeta, readTableState, type TableSearchParams } from "@/lib/table-pagination";
import { formatDate, toPlain } from "@/lib/utils";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default async function Payments({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const table = readTableState(searchParams);
  const paymentFilters: any[] = [];
  
  if (table.query) {
    paymentFilters.push({
      OR: [
        { reference: contains(table.query) },
        { notes: contains(table.query) },
        { customer: { is: { name: contains(table.query) } } },
        { invoice: { is: { invoiceNo: contains(table.query) } } },
        { supplier: { is: { name: contains(table.query) } } },
        { purchase: { is: { purchaseNo: contains(table.query) } } }
      ]
    });
  }
  if (table.facet) paymentFilters.push({ method: table.facet });
  const paymentDateRange = dateRange("paidAt", table.dateFrom, table.dateTo);
  if (paymentDateRange) paymentFilters.push(paymentDateRange);
  const paymentWhere = { shopId: user!.shopId, ...(paymentFilters.length ? { AND: paymentFilters } : {}) };
  
  const canSupplierPayout = canUsePaymentDirection(user?.role, "SUPPLIER_OUT");
  const [paymentsRaw, paymentsTotal, incomingAgg, outgoingAgg, customersRaw, invoicesRaw, suppliersRaw, purchasesRaw] = await Promise.all([
    prisma.payment.findMany({ where: paymentWhere, include: { customer: true, invoice: { include: { customer: true } }, supplier: true, purchase: { include: { supplier: true } } }, orderBy: { paidAt: "desc" }, skip: table.skip, take: table.take }),
    prisma.payment.count({ where: paymentWhere }),
    prisma.payment.aggregate({ where: { shopId: user!.shopId, direction: "CUSTOMER_IN", status: "ACTIVE" }, _sum: { amount: true } }),
    canSupplierPayout ? prisma.payment.aggregate({ where: { shopId: user!.shopId, direction: "SUPPLIER_OUT", status: "ACTIVE" }, _sum: { amount: true } }) : Promise.resolve({ _sum: { amount: 0 } }),
    prisma.customer.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      where: { shopId: user!.shopId, status: { not: "CANCELLED" } },
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { invoiceDate: "desc" },
      take: 150
    }),
    canSupplierPayout ? prisma.supplier.findMany({ where: { shopId: user!.shopId, status: "ACTIVE" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canSupplierPayout
      ? prisma.purchase.findMany({
          where: { shopId: user!.shopId, status: { notIn: ["CANCELLED", "PAYMENT_OUT", "REFUND_IN"] }, dueAmount: { gt: 0 }, supplierId: { not: null } },
          include: { supplier: true, items: { include: { product: true } } },
          orderBy: { purchaseDate: "desc" },
          take: 150
        })
      : Promise.resolve([])
  ]);

  const payments = toPlain(paymentsRaw).map((payment: any) => ({
    ...payment,
    isAutomaticInvoicePayment: isAutomaticInvoicePayment(payment, payment.invoice?.invoiceNo),
    isAutomaticPurchasePayment: isAutomaticPurchasePayment(payment, payment.purchase?.purchaseNo),
    canManagePaymentRecord: payment.status !== "VOIDED" && !isAutomaticInvoicePayment(payment, payment.invoice?.invoiceNo) && !isAutomaticPurchasePayment(payment, payment.purchase?.purchaseNo),
    directionDisplay: payment.direction === "SUPPLIER_OUT" ? "Supplier payout" : "Customer receipt",
    statusDisplay: payment.status === "VOIDED" ? "Voided" : "Active",
    partyName: payment.customer?.name || payment.invoice?.customer?.name || payment.supplier?.name || payment.purchase?.supplier?.name || "Walk-in",
    referenceLabel: payment.invoice?.invoiceNo || payment.purchase?.purchaseNo || payment.reference || "-",
    amountDisplay: money(payment.amount),
    paidAtDisplay: formatDate(payment.paidAt)
  }));
  
  const customers = toPlain(customersRaw);
  const invoices = toPlain(invoicesRaw);
  const suppliers = toPlain(suppliersRaw);
  const purchases = toPlain(purchasesRaw);
  const incoming = Number(incomingAgg._sum.amount || 0);
  const outgoing = Number(outgoingAgg._sum.amount || 0);
  const netCash = incoming - outgoing;
  const directionOptions = [{ label: "Customer receipt", value: "CUSTOMER_IN" }];
  if (canSupplierPayout) directionOptions.push({ label: "Supplier payout", value: "SUPPLIER_OUT" });

  const paymentFields = [
    { key: "direction", label: "Direction", type: "select" as const, required: true, defaultValue: "CUSTOMER_IN", options: directionOptions, hideOnCreate: directionOptions.length === 1, hideOnEdit: directionOptions.length === 1 },
    { key: "method", label: "Method", type: "select" as const, required: true, defaultValue: "CASH", options: [{ label: "Cash", value: "CASH" }, { label: "Bank transfer", value: "BANK_TRANSFER" }, { label: "Card", value: "CARD" }, { label: "JazzCash", value: "JAZZCASH" }, { label: "EasyPaisa", value: "EASYPAISA" }, { label: "Cheque", value: "CHEQUE" }, { label: "Other", value: "OTHER" }] },
    { key: "amount", label: "Amount", type: "number" as const, required: true },
    { key: "customerId", label: "Customer", type: "select" as const, options: customers.map((customer: any) => ({ label: customer.name, value: customer.id })) },
    {
      key: "invoiceId",
      label: "Invoice",
      type: "select" as const,
      options: invoices.map((invoice: any) => ({
        label: `${invoice.invoiceNo} - ${invoice.customer?.name || "Walk-in"} - due ${money(invoice.dueAmount)}`,
        value: invoice.id,
        meta: {
          invoiceNo: invoice.invoiceNo,
          customerId: invoice.customerId,
          customerName: invoice.customer?.name || "Walk-in",
          total: Number(invoice.total || 0),
          paidAmount: Number(invoice.paidAmount || 0),
          remainingBalance: Number(invoice.dueAmount || 0),
          status: invoice.status,
          itemsSummary: invoiceItemsSummary(invoice.items || [])
        }
      }))
    },
    { key: "supplierId", label: "Supplier", type: "select" as const, hideOnCreate: !canSupplierPayout, hideOnEdit: !canSupplierPayout, options: suppliers.map((supplier: any) => ({ label: supplier.name, value: supplier.id })) },
    {
      key: "purchaseId",
      label: "Purchase",
      type: "select" as const,
      hideOnCreate: !canSupplierPayout,
      hideOnEdit: !canSupplierPayout,
      options: purchases.map((purchase: any) => ({
        label: `${purchase.purchaseNo} - ${purchase.supplier?.name || "Supplier"} - due ${money(purchase.dueAmount)}`,
        value: purchase.id,
        meta: {
          purchaseNo: purchase.purchaseNo,
          supplierId: purchase.supplierId,
          supplierName: purchase.supplier?.name || "Supplier",
          total: Number(purchase.total || 0),
          paidAmount: Number(purchase.paidAmount || 0),
          remainingBalance: Number(purchase.dueAmount || 0),
          status: purchase.status,
          itemsSummary: purchaseItemsSummary(purchase.items || [])
        }
      }))
    },
    { key: "reference", label: "Reference" },
    { key: "notes", label: "Notes", type: "textarea" as const, span: "full" as const }
  ];

  return (
    <>
      <SectionHeader eyebrow="Payments" title="Payment movement timeline" description="Track customer receipts, supplier payouts, payment modes and references with balance-safe edits." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Payments"
          title="Cash movement rail"
          description="Record customer receipts and supplier payouts with invoice and purchase links that keep ledgers accurate."
          icon={CreditCard}
          badge="Cash movement"
          stats={[
            { label: "Incoming", value: money(incoming) },
            ...(canSupplierPayout ? [{ label: "Outgoing", value: money(outgoing) }] : []),
            { label: "Records", value: paymentsTotal }
          ]}
        />
        <ModuleInsightPanel
          title="Settlement checks"
          description="Search by party, method, reference or amount to audit cash movement without leaving the module."
          icon={CreditCard}
          insights={[
            { label: "Customer receipts", value: money(incoming) },
            ...(canSupplierPayout ? [{ label: "Supplier payouts", value: money(outgoing) }, { label: "Net movement", value: money(netCash) }] : [])
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={CreditCard} title="Incoming" value={money(incoming)} tone="emerald" />
        {canSupplierPayout ? <MetricCard icon={CreditCard} title="Outgoing" value={money(outgoing)} tone="rose" /> : null}
        <MetricCard icon={CreditCard} title="Total Records" value={paymentsTotal} tone="violet" />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Payment records"
          description="Record customer receipts and supplier payouts with invoice or purchase links."
          endpoint="/api/payments"
          rows={payments}
          pagination={paginationMeta(table, paymentsTotal)}
          filterConfig={{
            facetKey: "method",
            facetLabel: "Method",
            facetOptions: ["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"],
            dateKey: "paidAt",
            dateLabel: "Paid date"
          }}
          fields={paymentFields}
          columns={[
            { key: "directionDisplay", label: "Type" },
            { key: "statusDisplay", label: "Status" },
            { key: "partyName", label: "Party" },
            { key: "method", label: "Method" },
            { key: "referenceLabel", label: "Reference" },
            { key: "amountDisplay", label: "Amount" },
            { key: "paidAtDisplay", label: "Date" }
          ]}
          canCreate={can(user?.role, "payments", "create")}
          canUpdate={can(user?.role, "payments", "update")}
          canDelete={can(user?.role, "payments", "delete")}
          canUpdateRowKey="canManagePaymentRecord"
          canDeleteRowKey="canManagePaymentRecord"
          createLabel="Record payment"
          deleteLabel="Void"
          deleteVerb="Void"
        />
      </div>
    </>
  );
}

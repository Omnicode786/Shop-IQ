import { CreditCard } from "lucide-react";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can, canReadSupplierCashflow, canUsePaymentDirection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { contains, dateRange, paginationMeta, readTableState, type TableSearchParams } from "@/lib/table-pagination";
import { formatDate, toPlain } from "@/lib/utils";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default async function Payments({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const canSeeSupplierSide = canReadSupplierCashflow(user?.role);
  const table = readTableState(searchParams);
  const paymentFilters: any[] = [];
  if (!canSeeSupplierSide) paymentFilters.push({ direction: "CUSTOMER_IN" as const });
  if (table.query) {
    paymentFilters.push({
      OR: [
        { reference: contains(table.query) },
        { notes: contains(table.query) },
        { customer: { is: { name: contains(table.query) } } },
        { supplier: { is: { name: contains(table.query) } } },
        { invoice: { is: { invoiceNo: contains(table.query) } } },
        { purchase: { is: { purchaseNo: contains(table.query) } } }
      ]
    });
  }
  if (table.facet) {
    if (["CUSTOMER_IN", "SUPPLIER_OUT"].includes(table.facet)) paymentFilters.push({ direction: table.facet });
    else paymentFilters.push({ method: table.facet });
  }
  const paymentDateRange = dateRange("paidAt", table.dateFrom, table.dateTo);
  if (paymentDateRange) paymentFilters.push(paymentDateRange);
  const paymentWhere = { shopId: user!.shopId, ...(paymentFilters.length ? { AND: paymentFilters } : {}) };
  const [paymentsRaw, paymentsTotal, incomingAgg, outgoingAgg, customersRaw, suppliersRaw, invoicesRaw, purchasesRaw] = await Promise.all([
    prisma.payment.findMany({ where: paymentWhere, include: { customer: true, supplier: true, invoice: true, purchase: true }, orderBy: { paidAt: "desc" }, skip: table.skip, take: table.take }),
    prisma.payment.count({ where: paymentWhere }),
    prisma.payment.aggregate({ where: { shopId: user!.shopId, direction: "CUSTOMER_IN" }, _sum: { amount: true } }),
    canSeeSupplierSide ? prisma.payment.aggregate({ where: { shopId: user!.shopId, direction: "SUPPLIER_OUT" }, _sum: { amount: true } }) : Promise.resolve({ _sum: { amount: 0 } }),
    prisma.customer.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }),
    canSeeSupplierSide ? prisma.supplier.findMany({ where: { shopId: user!.shopId }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.invoice.findMany({ where: { shopId: user!.shopId, status: { not: "CANCELLED" } }, orderBy: { invoiceDate: "desc" }, take: 150 }),
    canSeeSupplierSide ? prisma.purchase.findMany({ where: { shopId: user!.shopId, status: { not: "CANCELLED" } }, orderBy: { purchaseDate: "desc" }, take: 150 }) : Promise.resolve([])
  ]);
  const payments = toPlain(paymentsRaw).map((payment: any) => ({
    ...payment,
    partyName: payment.customer?.name || payment.supplier?.name || "General",
    referenceLabel: payment.invoice?.invoiceNo || payment.purchase?.purchaseNo || payment.reference || "-",
    amountDisplay: money(payment.amount),
    paidAtDisplay: formatDate(payment.paidAt)
  }));
  const customers = toPlain(customersRaw);
  const suppliers = toPlain(suppliersRaw);
  const invoices = toPlain(invoicesRaw);
  const purchases = toPlain(purchasesRaw);
  const incoming = Number(incomingAgg._sum.amount || 0);
  const outgoing = Number(outgoingAgg._sum.amount || 0);
  const directionOptions = [
    { label: "Customer in", value: "CUSTOMER_IN" },
    ...(canUsePaymentDirection(user?.role, "SUPPLIER_OUT") ? [{ label: "Supplier out", value: "SUPPLIER_OUT" }] : [])
  ];
  const paymentFields = [
    { key: "direction", label: "Direction", type: "select" as const, required: true, defaultValue: "CUSTOMER_IN", options: directionOptions },
    { key: "method", label: "Method", type: "select" as const, required: true, defaultValue: "CASH", options: [{ label: "Cash", value: "CASH" }, { label: "Bank transfer", value: "BANK_TRANSFER" }, { label: "Card", value: "CARD" }, { label: "JazzCash", value: "JAZZCASH" }, { label: "EasyPaisa", value: "EASYPAISA" }, { label: "Cheque", value: "CHEQUE" }, { label: "Other", value: "OTHER" }] },
    { key: "amount", label: "Amount", type: "number" as const, required: true },
    { key: "customerId", label: "Customer", type: "select" as const, options: customers.map((customer: any) => ({ label: customer.name, value: customer.id })) },
    ...(canSeeSupplierSide ? [{ key: "supplierId", label: "Supplier", type: "select" as const, options: suppliers.map((supplier: any) => ({ label: supplier.name, value: supplier.id })) }] : []),
    { key: "invoiceId", label: "Invoice", type: "select" as const, options: invoices.map((invoice: any) => ({ label: invoice.invoiceNo, value: invoice.id })) },
    ...(canSeeSupplierSide ? [{ key: "purchaseId", label: "Purchase", type: "select" as const, options: purchases.map((purchase: any) => ({ label: purchase.purchaseNo, value: purchase.id })) }] : []),
    { key: "reference", label: "Reference" },
    { key: "notes", label: "Notes", type: "textarea" as const, span: "full" as const }
  ];

  return (
    <>
      <SectionHeader eyebrow="Payments" title="Cashflow and settlement timeline" description="Track customer receipts, supplier payouts, payment modes and references with balance-safe edits." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Payments"
          title="Cashflow settlement rail"
          description="Record receipts and payouts with linked invoices, purchases, customers and suppliers, while protected balance reversals keep ledgers accurate."
          icon={CreditCard}
          badge="Cash movement"
          stats={[
            { label: "Incoming", value: money(incoming) },
            { label: canSeeSupplierSide ? "Outgoing" : "Receipt mode", value: canSeeSupplierSide ? money(outgoing) : "Customer only" },
            { label: "Records", value: paymentsTotal }
          ]}
        />
        <ModuleInsightPanel
          title="Settlement checks"
          description={canSeeSupplierSide ? "Search by party, method, reference or amount to audit cash movement without leaving the module." : "Staff see and record customer receipts here; supplier payouts stay protected for managers and admins."}
          icon={CreditCard}
          insights={[
            { label: "Customer receipts", value: money(incoming) },
            { label: canSeeSupplierSide ? "Supplier payouts" : "Protected payouts", value: canSeeSupplierSide ? money(outgoing) : "Manager/admin" },
            { label: "Net movement", value: money(incoming - outgoing) }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={CreditCard} title="Incoming" value={money(incoming)} tone="emerald" />
        <MetricCard icon={CreditCard} title={canSeeSupplierSide ? "Outgoing" : "Receipt-only mode"} value={canSeeSupplierSide ? money(outgoing) : "Customer in"} tone={canSeeSupplierSide ? "rose" : "violet"} />
        <MetricCard icon={CreditCard} title="Net movement" value={money(incoming - outgoing)} tone="amber" />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Payment records"
          description={canSeeSupplierSide ? "Record receipts and payouts. Updates and deletes automatically reverse and reapply invoice, purchase and ledger effects." : "Record customer receipts with invoice links. Supplier payout tools are reserved for managers and admins."}
          endpoint="/api/payments"
          rows={payments}
          pagination={paginationMeta(table, paymentsTotal)}
          filterConfig={{
            facetKey: "direction",
            facetLabel: "Direction",
            facetOptions: canSeeSupplierSide ? ["CUSTOMER_IN", "SUPPLIER_OUT"] : ["CUSTOMER_IN"],
            dateKey: "paidAt",
            dateLabel: "Paid date"
          }}
          fields={paymentFields}
          columns={[
            { key: "partyName", label: "Party" },
            { key: "direction", label: "Direction" },
            { key: "method", label: "Method" },
            { key: "referenceLabel", label: "Reference" },
            { key: "amountDisplay", label: "Amount" },
            { key: "paidAtDisplay", label: "Date" }
          ]}
          canCreate={can(user?.role, "payments", "create")}
          canUpdate={can(user?.role, "payments", "update")}
          canDelete={can(user?.role, "payments", "delete")}
          createLabel="Record payment"
        />
      </div>
    </>
  );
}

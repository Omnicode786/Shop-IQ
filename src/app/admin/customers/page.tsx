import { Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { BubbleInsightCard, RankedBarsCard, RingScoreCard, StackedSignalCard, TrendAreaCard } from "@/components/workspace/analytics-cards";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { buildDailySeries, topRows } from "@/lib/chart-helpers";
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

export default async function Customers() {
  const user = await getCurrentUser();
  const customersRaw = await prisma.customer.findMany({ where: { shopId: user!.shopId }, include: { invoices: true, payments: true }, orderBy: { balance: "desc" } });
  const customers = toPlain(customersRaw).map((customer: any) => ({
    ...customer,
    invoiceCount: customer.invoices.length,
    loyaltyDisplay: customer.loyaltyCardNo ? `${customer.loyaltyCardNo} / ${Number(customer.loyaltyPoints || 0).toLocaleString()} pts` : "-",
    areaDisplay: [customer.area, customer.city].filter(Boolean).join(", ") || customer.address || "-",
    customerTypeDisplay: customer.customerType || "Retail",
    balanceDisplay: money(customer.balance),
    creditLimitDisplay: money(customer.creditLimit)
  }));
  const dues = customers.reduce((sum: number, customer: any) => sum + Math.max(Number(customer.balance), 0), 0);
  const creditLimit = customers.reduce((sum: number, customer: any) => sum + Number(customer.creditLimit), 0);
  const allPayments = customers.flatMap((customer: any) => customer.payments || []);
  const paymentTrend = buildDailySeries(allPayments, (payment: any) => payment.paidAt, (payment: any) => Number(payment.amount), 14);
  const dueRank = topRows(customers, (customer: any) => customer.name, (customer: any) => Number(customer.balance), 6);
  const utilization = Math.min(100, Math.round((dues / Math.max(creditLimit, 1)) * 100));
  const receivableHealth = Math.max(0, 100 - utilization);

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "customers")} user={user}>
      <SectionHeader eyebrow="Customers" title="Customer ledger and loyalty workspace" description="Track balances, contact details, credit limits and payment behavior with role-based actions." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Customers"
          title="Customer ledger cockpit"
          description="A searchable customer workspace for balances, contacts, credit limits and service history, tuned for counter staff and managers."
          icon={Users}
          badge="Ledger view"
          stats={[
            { label: "Customers", value: customers.length },
            { label: "Outstanding", value: money(dues) },
            { label: "With invoices", value: customers.filter((customer: any) => customer.invoiceCount > 0).length }
          ]}
        />
        <ModuleInsightPanel
          title="Receivable pressure"
          description="Use this module to spot high-balance customers and keep contact data clean for reminders."
          icon={WalletCards}
          insights={[
            { label: "Total accounts", value: customers.length },
            { label: "Receivables", value: money(dues) },
            { label: "Average balance", value: money(customers.length ? dues / customers.length : 0) }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricCard icon={Users} title="Customers" value={customers.length} />
        <MetricCard icon={WalletCards} title="Outstanding receivables" value={money(dues)} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr_0.95fr]">
        <RingScoreCard
          title="Receivable health"
          description="Lower credit utilization keeps follow-ups calm and predictable."
          score={receivableHealth}
          value={`${receivableHealth}%`}
          label="Healthy"
          badge="Credit"
        />
        <TrendAreaCard
          title="Collection rhythm"
          description="Customer payments received across the latest activity window."
          value={compactMoney(allPayments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0))}
          caption="Recent customer receipts"
          data={paymentTrend}
          badge="Receipts"
          format="money"
        />
        <StackedSignalCard
          title="Credit utilization"
          description="Used receivable balance against configured customer limits."
          data={[
            { name: "Used", value: dues },
            { name: "Available", value: Math.max(0, creditLimit - dues) }
          ]}
          totalLabel={`${utilization}% used`}
          badge="Limit"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <BubbleInsightCard
          title="Customer board"
          description="Compact commercial context for account and collection decisions."
          bubbles={[
            { label: "Accounts", value: customers.length, size: "lg" },
            { label: "Receivable", value: compactMoney(dues), size: "md" },
            { label: "Avg balance", value: compactMoney(customers.length ? dues / customers.length : 0), size: "sm" },
            { label: "With invoices", value: customers.filter((customer: any) => customer.invoiceCount > 0).length, size: "sm" }
          ]}
          badge="Accounts"
        />
        <RankedBarsCard
          title="Top receivables"
          description="The accounts most responsible for outstanding customer balance."
          rows={dueRank}
          format="money"
        />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Customer accounts"
          description="Staff can create and update customer accounts; admins and managers can remove unused records."
          endpoint="/api/customers"
          rows={customers}
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
            { key: "balance", label: "Opening balance", type: "number" },
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
            { key: "balanceDisplay", label: "Balance" }
          ]}
          canCreate={can(user?.role, "customers", "create")}
          canUpdate={can(user?.role, "customers", "update")}
          canDelete={can(user?.role, "customers", "delete")}
          createLabel="Add customer"
        />
      </div>
    </AppShell>
  );
}

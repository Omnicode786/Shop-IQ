import { Truck, WalletCards } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { RankedBarsCard, RingScoreCard } from "@/components/workspace/analytics-cards";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { topRows } from "@/lib/chart-helpers";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toPlain } from "@/lib/utils";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

function money(value: any) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

export default async function Suppliers() {
  const user = await getCurrentUser();
  const suppliersRaw = await prisma.supplier.findMany({ where: { shopId: user!.shopId }, include: { purchases: true, payments: true }, orderBy: { balance: "desc" } });
  const suppliers = toPlain(suppliersRaw).map((supplier: any) => ({
    ...supplier,
    purchaseCount: supplier.purchases.length,
    supplierTypeDisplay: supplier.supplierType || "General",
    leadTimeDisplay: supplier.leadTimeDays === null || supplier.leadTimeDays === undefined ? "-" : `${supplier.leadTimeDays} days`,
    reliabilityDisplay: `${supplier.reliabilityScore}%`,
    balanceDisplay: money(supplier.balance)
  }));
  const dues = suppliers.reduce((sum: number, supplier: any) => sum + Math.max(Number(supplier.balance), 0), 0);
  const avgReliability = Math.round(suppliers.reduce((sum: number, supplier: any) => sum + Number(supplier.reliabilityScore || 0), 0) / Math.max(suppliers.length, 1));
  const payableRank = topRows(suppliers, (supplier: any) => supplier.name, (supplier: any) => Number(supplier.balance), 6);

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "suppliers")} user={user}>
      <SectionHeader eyebrow="Suppliers" title="Supplier payable and reliability cockpit" description="Monitor supplier balances, purchases, payables and reliability signals." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Suppliers"
          title="Supplier reliability desk"
          description="A supplier control surface for payables, contact data, purchase relationships and reliability scoring."
          icon={Truck}
          badge="Payable view"
          stats={[
            { label: "Suppliers", value: suppliers.length },
            { label: "Payables", value: money(dues) },
            { label: "Avg reliability", value: `${Math.round(suppliers.reduce((sum: number, supplier: any) => sum + Number(supplier.reliabilityScore || 0), 0) / Math.max(suppliers.length, 1))}%` }
          ]}
        />
        <ModuleInsightPanel
          title="Purchase readiness"
          description="Keep supplier records complete before purchasing so stock intake and payables stay clean."
          icon={WalletCards}
          insights={[
            { label: "Supplier accounts", value: suppliers.length },
            { label: "Outstanding payable", value: money(dues) },
            { label: "Purchase-linked", value: suppliers.filter((supplier: any) => supplier.purchaseCount > 0).length }
          ]}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricCard icon={Truck} title="Suppliers" value={suppliers.length} />
        <MetricCard icon={WalletCards} title="Payables" value={money(dues)} tone="rose" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <RingScoreCard
          title="Reliability pulse"
          description="Average supplier reliability across active vendor accounts."
          score={avgReliability}
          value={`${avgReliability}%`}
          label="Reliable"
          badge="Supply"
        />
        <RankedBarsCard
          title="Top payables"
          description="Supplier balances ordered by cash pressure."
          rows={payableRank}
          format="money"
        />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Supplier ledger"
          description="Admins and managers can create, edit and remove unused supplier records. Staff keep read-only visibility."
          endpoint="/api/suppliers"
          rows={suppliers}
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
            { key: "balance", label: "Opening payable", type: "number" },
            { key: "reliabilityScore", label: "Reliability score", type: "number" },
            { key: "notes", label: "Notes", type: "textarea", span: "full" }
          ]}
          columns={[
            { key: "name", label: "Supplier" },
            { key: "contactPerson", label: "Contact" },
            { key: "supplierTypeDisplay", label: "Type" },
            { key: "leadTimeDisplay", label: "Lead time" },
            { key: "purchaseCount", label: "Purchases" },
            { key: "reliabilityDisplay", label: "Reliability" },
            { key: "balanceDisplay", label: "Balance" }
          ]}
          canCreate={can(user?.role, "suppliers", "create")}
          canUpdate={can(user?.role, "suppliers", "update")}
          canDelete={can(user?.role, "suppliers", "delete")}
          createLabel="Add supplier"
        />
      </div>
    </AppShell>
  );
}

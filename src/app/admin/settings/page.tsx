import { Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { RingScoreCard } from "@/components/workspace/analytics-cards";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toPlain } from "@/lib/utils";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

export default async function Settings() {
  const user = await getCurrentUser();
  const shop = toPlain(user!.shop);
  const profileFields = [
    { label: "Shop name", value: shop.name ? 1 : 0 },
    { label: "City", value: shop.city ? 1 : 0 },
    { label: "Address", value: shop.address ? 1 : 0 },
    { label: "Phone", value: shop.phone ? 1 : 0 },
    { label: "Currency", value: shop.currency ? 1 : 0 }
  ];
  const completeFields = profileFields.reduce((sum, field) => sum + field.value, 0);
  const completeness = Math.round((completeFields / profileFields.length) * 100);

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "settings")} user={user}>
      <SectionHeader eyebrow="Settings" title="Shop configuration" description="Manage workspace identity, location, contact details and currency." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Settings"
          title="Workspace identity"
          description="Control the shop profile that appears across invoices, reports, AI context and the operational shell."
          icon={SettingsIcon}
          badge="Configuration"
          stats={[
            { label: "Shop", value: shop.name },
            { label: "City", value: shop.city },
            { label: "Currency", value: shop.currency }
          ]}
        />
        <ModuleInsightPanel
          title="Profile signals"
          description="Keep contact and currency details accurate so every generated document and report stays consistent."
          icon={SettingsIcon}
          insights={[
            { label: "Phone", value: shop.phone || "Not set" },
            { label: "City", value: shop.city },
            { label: "Currency", value: shop.currency }
          ]}
        />
      </div>
      <div className="mt-6">
        <MetricCard icon={SettingsIcon} title="Workspace" value={shop.name} helper={`${shop.city} - ${shop.currency}`} />
      </div>
      <div className="mt-6">
        <RingScoreCard
          title="Profile readiness"
          description="Completeness of the shop information used by invoices and reports."
          score={completeness}
          value={`${completeness}%`}
          label="Ready"
          badge="Config"
        />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Shop profile"
          description="Admins and managers can update the operational shop profile used across invoices, reports and workspace context."
          endpoint="/api/shops"
          rows={[shop]}
          fields={[
            { key: "name", label: "Shop name", required: true },
            { key: "city", label: "City", required: true },
            { key: "address", label: "Address", span: "half" },
            { key: "phone", label: "Phone" },
            { key: "currency", label: "Currency", required: true }
          ]}
          columns={[
            { key: "name", label: "Shop" },
            { key: "city", label: "City" },
            { key: "address", label: "Address" },
            { key: "phone", label: "Phone" },
            { key: "currency", label: "Currency" }
          ]}
          canCreate={false}
          canUpdate={can(user?.role, "settings", "update")}
          canDelete={false}
          emptyState="No shop profile found."
        />
      </div>
    </AppShell>
  );
}

import { UserCog } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { DonutBreakdownCard, RingScoreCard, StackedSignalCard, TrendAreaCard } from "@/components/workspace/analytics-cards";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can, canCreateStaffRole, canManageStaffMember } from "@/lib/permissions";
import { buildDailySeries, statusSegments } from "@/lib/chart-helpers";
import { prisma } from "@/lib/prisma";
import { formatDate, toPlain } from "@/lib/utils";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

export default async function StaffPage() {
  const user = await getCurrentUser();
  const staffRaw = await prisma.user.findMany({ where: { shopId: user!.shopId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, status: true, designation: true, phone: true, cnic: true, shift: true, branchArea: true, joiningDate: true, createdAt: true } });
  const staff = toPlain(staffRaw).map((member: any) => ({ ...member, joinedDisplay: formatDate(member.joiningDate || member.createdAt), password: "", canManage: canManageStaffMember(user?.role, member.role, member.id, user?.id) }));
  const roleOptions = (["ADMIN", "MANAGER", "STAFF"] as const)
    .filter((role) => canCreateStaffRole(user?.role, role))
    .map((role) => ({ label: role === "ADMIN" ? "Admin" : role === "MANAGER" ? "Manager" : "Staff", value: role }));
  const activeCount = staff.filter((member: any) => member.status === "ACTIVE").length;
  const activeScore = Math.round((activeCount / Math.max(staff.length, 1)) * 100);
  const roleRows = statusSegments(staff, (member: any) => member.role);
  const statusRows = statusSegments(staff, (member: any) => member.status);
  const joinedTrend = buildDailySeries(staff, (member: any) => member.createdAt, () => 1, 14);

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "staff")} user={user}>
      <SectionHeader eyebrow="Team" title="Staff and shop access" description="Add team members, assign roles, reset access and suspend accounts without exposing password hashes." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Team"
          title="Access control studio"
          description="Invite staff, assign roles, maintain contact information and suspend access with manager/admin guardrails."
          icon={UserCog}
          badge="Role based"
          stats={[
            { label: "Members", value: staff.length },
            { label: "Active", value: staff.filter((member: any) => member.status === "ACTIVE").length },
            { label: "Managers", value: staff.filter((member: any) => member.role === "MANAGER").length }
          ]}
        />
        <ModuleInsightPanel
          title="Role coverage"
          description="Admins can manage all roles; managers can add and maintain staff accounts without elevating privileges."
          icon={UserCog}
          insights={[
            { label: "Admins", value: staff.filter((member: any) => member.role === "ADMIN").length },
            { label: "Managers", value: staff.filter((member: any) => member.role === "MANAGER").length },
            { label: "Staff", value: staff.filter((member: any) => member.role === "STAFF").length }
          ]}
        />
      </div>
      <div className="mt-6">
        <MetricCard icon={UserCog} title="Team members" value={staff.length} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_0.9fr_1.1fr]">
        <RingScoreCard
          title="Access health"
          description="Active accounts compared with total staff records."
          score={activeScore}
          value={`${activeScore}%`}
          label="Active"
          badge="Access"
        />
        <DonutBreakdownCard
          title="Role mix"
          description="Admin, manager and staff coverage in this workspace."
          data={roleRows}
          centerValue={`${staff.length}`}
          centerLabel="Members"
          badge="Roles"
        />
        <TrendAreaCard
          title="Join rhythm"
          description="Recent team additions over the latest window."
          value={`${staff.length} members`}
          caption={`${activeCount} active accounts`}
          data={joinedTrend}
          badge="Team"
          format="number"
        />
      </div>
      <div className="mt-6">
        <StackedSignalCard
          title="Account status"
          description="Active, invited and suspended accounts at a glance."
          data={statusRows}
          totalLabel={`${staff.length} accounts`}
          badge="Status"
        />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Team access"
          description="Admins can manage all roles. Managers can add and maintain staff accounts."
          endpoint="/api/staff"
          rows={staff}
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "email", label: "Email", type: "email", required: true },
            { key: "password", label: "Temporary password", type: "password", placeholder: "demo12345" },
            { key: "role", label: "Role", type: "select", required: true, defaultValue: roleOptions[0]?.value || "STAFF", options: roleOptions },
            { key: "status", label: "Status", type: "select", defaultValue: "ACTIVE", options: [{ label: "Active", value: "ACTIVE" }, { label: "Invited", value: "INVITED" }, { label: "Suspended", value: "SUSPENDED" }] },
            { key: "designation", label: "Designation" },
            { key: "phone", label: "Phone" },
            { key: "cnic", label: "CNIC" },
            { key: "shift", label: "Shift", type: "select", options: [{ label: "Morning", value: "Morning" }, { label: "Evening", value: "Evening" }, { label: "Closing", value: "Closing" }, { label: "Flexible", value: "Flexible" }] },
            { key: "branchArea", label: "Branch area" }
          ]}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "status", label: "Status" },
            { key: "designation", label: "Designation" },
            { key: "shift", label: "Shift" },
            { key: "branchArea", label: "Branch area" },
            { key: "joinedDisplay", label: "Joined" }
          ]}
          canCreate={can(user?.role, "staff", "create")}
          canUpdate={can(user?.role, "staff", "update")}
          canDelete={can(user?.role, "staff", "delete")}
          canUpdateRowKey="canManage"
          canDeleteRowKey="canManage"
          createLabel="Add member"
          deleteLabel="Suspend"
          deleteVerb="Suspend"
        />
      </div>
    </AppShell>
  );
}

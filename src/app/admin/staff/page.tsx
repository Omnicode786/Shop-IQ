import { UserCog } from "lucide-react";
import { CrudManager } from "@/components/workspace/crud-manager";
import { MetricCard } from "@/components/workspace/metric-card";
import { ModuleHero, ModuleInsightPanel } from "@/components/workspace/module-hero";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";
import { can, canCreateStaffRole, canManageStaffMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { contains, dateRange, paginationMeta, readTableState, type TableSearchParams } from "@/lib/table-pagination";
import { formatDate, toPlain } from "@/lib/utils";

export default async function StaffPage({ searchParams }: { searchParams?: TableSearchParams }) {
  const user = await getCurrentUser();
  const table = readTableState(searchParams);
  const staffFilters: any[] = [];
  if (table.query) {
    staffFilters.push({
      OR: [
        { name: contains(table.query) },
        { email: contains(table.query) },
        { phone: contains(table.query) },
        { designation: contains(table.query) },
        { cnic: contains(table.query) },
        { shift: contains(table.query) },
        { branchArea: contains(table.query) }
      ]
    });
  }
  if (table.status) staffFilters.push({ status: table.status });
  if (table.facet) staffFilters.push({ role: table.facet });
  const staffDateRange = dateRange("createdAt", table.dateFrom, table.dateTo);
  if (staffDateRange) staffFilters.push(staffDateRange);
  const staffWhere = { shopId: user!.shopId, ...(staffFilters.length ? { AND: staffFilters } : {}) };
  const staffSelect = { id: true, name: true, email: true, role: true, status: true, designation: true, phone: true, cnic: true, shift: true, branchArea: true, joiningDate: true, createdAt: true };
  const [staffRaw, staffTotal, totalMembers, activeMembers, managerMembers, adminMembers, staffMembers] = await Promise.all([
    prisma.user.findMany({ where: staffWhere, orderBy: { createdAt: "desc" }, skip: table.skip, take: table.take, select: staffSelect }),
    prisma.user.count({ where: staffWhere }),
    prisma.user.count({ where: { shopId: user!.shopId } }),
    prisma.user.count({ where: { shopId: user!.shopId, status: "ACTIVE" } }),
    prisma.user.count({ where: { shopId: user!.shopId, role: "MANAGER" } }),
    prisma.user.count({ where: { shopId: user!.shopId, role: "ADMIN" } }),
    prisma.user.count({ where: { shopId: user!.shopId, role: "STAFF" } })
  ]);
  const staff = toPlain(staffRaw).map((member: any) => ({ ...member, joinedDisplay: formatDate(member.joiningDate || member.createdAt), password: "", canManage: canManageStaffMember(user?.role, member.role, member.id, user?.id) }));
  const roleOptions = (["ADMIN", "MANAGER", "STAFF"] as const)
    .filter((role) => canCreateStaffRole(user?.role, role))
    .map((role) => ({ label: role === "ADMIN" ? "Admin" : role === "MANAGER" ? "Manager" : "Staff", value: role }));

  return (
    <>
      <SectionHeader eyebrow="Team" title="Staff and shop access" description="Add team members, assign roles, reset access and suspend accounts without exposing password hashes." />
      <div className="module-command-grid">
        <ModuleHero
          eyebrow="Team"
          title="Access control studio"
          description="Invite staff, assign roles, maintain contact information and suspend access with manager/admin guardrails."
          icon={UserCog}
          badge="Role based"
          stats={[
            { label: "Members", value: totalMembers },
            { label: "Active", value: activeMembers },
            { label: "Managers", value: managerMembers }
          ]}
        />
        <ModuleInsightPanel
          title="Role coverage"
          description="Admins can manage all roles; managers can add and maintain staff accounts without elevating privileges."
          icon={UserCog}
          insights={[
            { label: "Admins", value: adminMembers },
            { label: "Managers", value: managerMembers },
            { label: "Staff", value: staffMembers }
          ]}
        />
      </div>
      <div className="mt-6">
        <MetricCard icon={UserCog} title="Team members" value={totalMembers} />
      </div>
      <div className="mt-6">
        <CrudManager
          title="Team access"
          description="Admins can manage all roles. Managers can add and maintain staff accounts."
          endpoint="/api/staff"
          rows={staff}
          pagination={paginationMeta(table, staffTotal)}
          filterConfig={{
            statusKey: "status",
            statusOptions: ["ACTIVE", "INVITED", "SUSPENDED"],
            facetKey: "role",
            facetLabel: "Role",
            facetOptions: ["ADMIN", "MANAGER", "STAFF"],
            dateKey: "createdAt",
            dateLabel: "Created"
          }}
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
    </>
  );
}

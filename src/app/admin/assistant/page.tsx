import { ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/workspace/app-shell";
import { AssistantConsole } from "@/components/workspace/assistant-console";
import { SectionHeader } from "@/components/workspace/section-header";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { workspaceHeading, workspaceNav, workspacePath } from "@/lib/workspace";

export default async function AssistantPage() {
  const user = await getCurrentUser();

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} currentPath={workspacePath(user?.role, "assistant")} user={user}>
      <SectionHeader
        eyebrow="Gemini AI Agent"
        title="ShopIQ Assistant"
        description="A focused assistant workspace for live business questions, role-aware record search, operating jobs, and confirmation-gated database actions."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">
              <Sparkles className="mr-1 size-3" />
              Live Gemini
            </Badge>
            <Badge variant="outline">
              <ShieldCheck className="mr-1 size-3" />
              Role guarded
            </Badge>
          </div>
        }
      />

      <div className="mt-6">
        <AssistantConsole />
      </div>
    </AppShell>
  );
}

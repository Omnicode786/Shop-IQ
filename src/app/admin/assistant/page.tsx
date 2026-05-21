import { ShieldCheck, Sparkles } from "lucide-react";
import { AssistantConsole } from "@/components/workspace/assistant-console";
import { SectionHeader } from "@/components/workspace/section-header";
import { Badge } from "@/components/ui/badge";

export default async function AssistantPage() {
  return (
    <>
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

      <div className="mt-6 grid gap-4">
        <AssistantConsole />
      </div>
    </>
  );
}

import { Palette, Settings as SettingsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AppearanceSettingsPanel } from "@/components/workspace/settings-tabs";
import { SectionHeader } from "@/components/workspace/section-header";
import { getCurrentUser } from "@/lib/auth";

export default async function StaffSettings() {
  const user = await getCurrentUser();

  return (
    <>
      <SectionHeader
        eyebrow="Settings"
        title="Appearance"
        description="Choose the workspace theme, UI mode and ShopIQ palette for this device."
        action={<Badge variant="secondary">Personal</Badge>}
      />

      <div className="module-command-grid">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Palette className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Theme preferences</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Saved locally for {user?.name || "your workspace"} without changing shop records.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <SettingsIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Same controls, new location</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Light, dark, liquid glass, classic and TweakCN themes work exactly as before.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <AppearanceSettingsPanel />
      </div>
    </>
  );
}

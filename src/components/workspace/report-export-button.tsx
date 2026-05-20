"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function ReportExportButton() {
  const [loading, setLoading] = useState(false);

  async function exportReport() {
    setLoading(true);
    try {
      const response = await fetch("/api/reports/export", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to export report.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "shopiq-general-report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("General PDF report exported successfully.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to export report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" className="w-full" onClick={exportReport} disabled={loading}>
      <Download className="size-4" />
      {loading ? "Exporting..." : "Export general PDF"}
    </Button>
  );
}

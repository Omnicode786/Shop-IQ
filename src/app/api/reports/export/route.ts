import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { getDashboardSnapshot } from "@/lib/data";
import { can } from "@/lib/permissions";
import { buildGeneralReportPdf } from "@/lib/report-pdf";

export const dynamic = "force-dynamic";

function fileSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "shopiq";
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "reports", "read")) return forbidden();

    const snapshot = await getDashboardSnapshot(user.shopId, user.role);
    const pdfBytes = await buildGeneralReportPdf({
      shop: user.shop,
      user: { name: user.name, email: user.email, role: user.role },
      snapshot
    });

    const filename = `${fileSafe(user.shop.name)}-general-report.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return apiError(error, "Unable to export report PDF right now.");
  }
}


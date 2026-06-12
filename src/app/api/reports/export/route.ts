import { NextResponse } from "next/server";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { getDashboardSnapshot } from "@/lib/data";
import { can } from "@/lib/permissions";
import { buildGeneralReportPdf } from "@/lib/report-pdf";
import { buildReportDownloadUrl, normalizeReportType, reportFileSlug, reportLabel, reportRangeLabel } from "@/lib/report-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function fileSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "shopiq";
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function salesSummaryForPdf(shopId: string, startDate: Date | null, endDate: Date | null) {
  const end = endOfDay(endDate || new Date());
  const start = startOfDay(startDate || subDays(end, 29));
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { shopId, status: { not: "CANCELLED" }, invoiceDate: { gte: start, lte: end } },
      include: { items: true },
      orderBy: { invoiceDate: "asc" }
    }),
    prisma.payment.findMany({
      where: { shopId, direction: "CUSTOMER_IN", status: "ACTIVE", paidAt: { gte: start, lte: end } },
      orderBy: { paidAt: "asc" }
    })
  ]);
  const grossSales = invoices.reduce((sum, invoice) => sum + n(invoice.total), 0);
  const grossProfit = invoices.reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + (n(item.unitPrice) - n(item.costPrice)) * item.quantity, 0), 0);
  return {
    ok: true,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    invoiceCount: invoices.length,
    grossSales,
    grossProfit,
    cashReceived: payments.reduce((sum, payment) => sum + n(payment.amount), 0),
    itemsSold: invoices.reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)
  };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "reports", "read")) return forbidden();

    const url = new URL(request.url);
    const reportType = normalizeReportType(url.searchParams.get("reportType"));
    const startDate = parseDate(url.searchParams.get("startDate"));
    const endDate = parseDate(url.searchParams.get("endDate"));
    const source = url.searchParams.get("source") || "reports";
    const generatedAt = new Date();
    const snapshot = await getDashboardSnapshot(user.shopId, user.role);
    const businessReport = { sales: await salesSummaryForPdf(user.shopId, startDate, endDate) };
    const pdfBytes = await buildGeneralReportPdf({
      shop: user.shop,
      user: { name: user.name, email: user.email, role: user.role },
      snapshot,
      generatedAt,
      reportType,
      startDate,
      endDate,
      businessReport
    });

    const downloadUrl = buildReportDownloadUrl({ reportType, startDate, endDate, source });
    const context = reportRangeLabel(startDate, endDate);
    await prisma.activityLog.create({
      data: {
        shopId: user.shopId,
        userId: user.id,
        type: "PDF_REPORT_GENERATED",
        title: `${reportLabel(reportType)} PDF report generated`,
        details: `${reportLabel(reportType)} report generated for ${context} at ${format(generatedAt, "dd MMM yyyy, hh:mm a")}.`,
        metadata: { reportType, reportDownloadUrl: downloadUrl, source, startDate: startDate?.toISOString() || null, endDate: endDate?.toISOString() || null }
      }
    });

    const filename = `${fileSafe(user.shop.name)}-${reportFileSlug(reportType)}-report.pdf`;
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

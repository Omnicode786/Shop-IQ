import { format } from "date-fns";

export const REPORT_TYPE_VALUES = [
  "general",
  "daily_summary",
  "sales_report",
  "inventory_report",
  "customer_report",
  "dues_report",
  "supplier_report",
  "profit_loss_report",
  "stock_movement_report",
  "business_insight_report",
  "full_business_review"
] as const;

export type ReportType = (typeof REPORT_TYPE_VALUES)[number];

const REPORT_LABELS: Record<ReportType, string> = {
  general: "General Business",
  daily_summary: "Daily Operations",
  sales_report: "Sales",
  inventory_report: "Inventory",
  customer_report: "Customer",
  dues_report: "Customer Dues",
  supplier_report: "Supplier",
  profit_loss_report: "Profit And Loss",
  stock_movement_report: "Stock Movement",
  business_insight_report: "Business Insight",
  full_business_review: "Full Business Review"
};

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  general: "A complete ShopIQ operating report using live sales, inventory, ledger, payment and activity data.",
  daily_summary: "A concise operating summary for the selected day using live sales, stock, dues and activity records.",
  sales_report: "A sales-focused PDF report with invoices, revenue, payments, top products and customer context.",
  inventory_report: "An inventory-focused PDF report with stock value, category concentration, low stock and movement signals.",
  customer_report: "A customer-focused PDF report with receivables, balances, recent invoices and collection priorities.",
  dues_report: "A dues-focused PDF report for customer balances, overdue pressure and collection planning.",
  supplier_report: "A supplier-focused PDF report with payables, purchase status and supplier balance context.",
  profit_loss_report: "A profit and loss PDF report using invoice item margins, revenue, payments and purchase context.",
  stock_movement_report: "A stock movement PDF report with recent inventory flow, sales movements and adjustment context.",
  business_insight_report: "A business insight PDF report that highlights the most important operating risks and recommendations.",
  full_business_review: "A full ShopIQ business review covering sales, inventory, customers, suppliers, activity and recommendations."
};

const REPORT_ALIASES: Record<string, ReportType> = {
  business_report: "full_business_review",
  full_report: "full_business_review",
  general_report: "general",
  customer_dues_report: "dues_report",
  credit_report: "dues_report",
  collections_report: "dues_report",
  profit_report: "profit_loss_report",
  loss_report: "profit_loss_report",
  pnl_report: "profit_loss_report",
  p_l_report: "profit_loss_report",
  stock_report: "stock_movement_report",
  stock_movements_report: "stock_movement_report",
  movement_report: "stock_movement_report",
  insight_report: "business_insight_report",
  insights_report: "business_insight_report"
};

export function normalizeReportType(value: unknown): ReportType {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (REPORT_TYPE_VALUES.includes(clean as ReportType)) return clean as ReportType;
  return REPORT_ALIASES[clean] || "general";
}

export function reportLabel(type: ReportType) {
  return REPORT_LABELS[type] || REPORT_LABELS.general;
}

export function reportDescription(type: ReportType) {
  return REPORT_DESCRIPTIONS[type] || REPORT_DESCRIPTIONS.general;
}

export function reportFileSlug(type: ReportType) {
  return reportLabel(type)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function reportRangeLabel(startDate?: Date | string | null, endDate?: Date | string | null) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  if (validStart && validEnd) {
    if (format(validStart, "yyyy-MM-dd") === format(validEnd, "yyyy-MM-dd")) return format(validStart, "dd MMM yyyy");
    return `${format(validStart, "dd MMM yyyy")} - ${format(validEnd, "dd MMM yyyy")}`;
  }
  if (validStart) return format(validStart, "dd MMM yyyy");
  if (validEnd) return format(validEnd, "dd MMM yyyy");
  return "Current reporting window";
}

export function buildReportDownloadUrl(input: {
  reportType?: ReportType | string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  limit?: number | string | null;
  source?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("reportType", normalizeReportType(input.reportType));
  if (input.startDate) params.set("startDate", typeof input.startDate === "string" ? input.startDate : input.startDate.toISOString());
  if (input.endDate) params.set("endDate", typeof input.endDate === "string" ? input.endDate : input.endDate.toISOString());
  if (input.limit) params.set("limit", String(input.limit));
  if (input.source) params.set("source", input.source);
  return `/api/reports/export?${params.toString()}`;
}

import { format } from "date-fns";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeReportType, reportDescription, reportLabel, reportRangeLabel, type ReportType } from "@/lib/report-config";

type ShopInfo = {
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  currency?: string | null;
};

type ReportUser = {
  name: string;
  email?: string | null;
  role: string;
};

type ReportPdfInput = {
  shop: ShopInfo;
  user: ReportUser;
  snapshot: any;
  generatedAt?: Date;
  reportType?: ReportType | string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  businessReport?: any;
};

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
};

type PdfContext = {
  pdf: PDFDocument;
  page: PDFPage;
  fonts: Fonts;
  pageNo: number;
  logo?: PDFImage;
};

type TableColumn<T> = {
  header: string;
  width: number;
  get: (row: T, index: number) => string | number;
  align?: "left" | "right";
};

const PAGE = {
  width: 842,
  height: 595,
  margin: 38
};

const COLORS = {
  paper: rgb(0.965, 0.972, 0.985),
  card: rgb(1, 1, 1),
  ink: rgb(0.06, 0.08, 0.13),
  muted: rgb(0.39, 0.43, 0.5),
  faint: rgb(0.86, 0.88, 0.92),
  navy: rgb(0.035, 0.055, 0.11),
  blue: rgb(0.13, 0.43, 0.96),
  cyan: rgb(0.04, 0.66, 0.84),
  violet: rgb(0.48, 0.32, 0.96),
  emerald: rgb(0.09, 0.64, 0.4),
  amber: rgb(0.95, 0.57, 0.14),
  rose: rgb(0.92, 0.18, 0.32),
  lime: rgb(0.7, 0.9, 0.2),
  white: rgb(1, 1, 1)
};

const ACCENTS = [COLORS.blue, COLORS.violet, COLORS.emerald, COLORS.amber, COLORS.cyan, COLORS.rose, COLORS.lime];

function num(value: unknown) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function money(value: unknown, compact = false) {
  const amount = num(value);
  const formatted = Intl.NumberFormat("en", compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(Math.round(amount));
  return `PKR ${formatted}`;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: unknown, max = 42) {
  const clean = cleanText(text);
  return clean.length > max ? `${clean.slice(0, Math.max(0, max - 3))}...` : clean;
}

function drawText(page: PDFPage, text: unknown, x: number, y: number, size: number, font: PDFFont, color: RGB = COLORS.ink, maxWidth?: number) {
  let value = cleanText(text);
  if (maxWidth) {
    while (value.length > 3 && font.widthOfTextAtSize(value, size) > maxWidth) value = `${value.slice(0, -4)}...`;
  }
  page.drawText(value || " ", { x, y, size, font, color });
}

function drawWrappedText(page: PDFPage, text: unknown, x: number, y: number, width: number, size: number, font: PDFFont, color: RGB, maxLines = 3) {
  const words = cleanText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= width) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
    }
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  lines.forEach((line, index) => drawText(page, line, x, y - index * (size + 4), size, font, color, width));
  return Math.max(lines.length, 1) * (size + 4);
}

async function loadLogo(pdf: PDFDocument) {
  const candidates = ["logo-cropped.png", "logo.png", "favicon.png"];
  for (const file of candidates) {
    try {
      const bytes = await readFile(join(process.cwd(), "public", file));
      return await pdf.embedPng(bytes);
    } catch {
      // Try the next bundled brand asset.
    }
  }
  return undefined;
}

function addPage(ctx: PdfContext) {
  if (ctx.pageNo > 0) drawFooter(ctx);
  ctx.page = ctx.pdf.addPage([PAGE.width, PAGE.height]);
  ctx.pageNo += 1;
  ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: COLORS.paper });
  return ctx.page;
}

function drawFooter(ctx: PdfContext) {
  const { page, fonts } = ctx;
  page.drawLine({
    start: { x: PAGE.margin, y: 28 },
    end: { x: PAGE.width - PAGE.margin, y: 28 },
    thickness: 0.6,
    color: COLORS.faint
  });
  drawText(page, "ShopIQ generated report", PAGE.margin, 14, 8, fonts.regular, COLORS.muted);
  drawText(page, `Page ${ctx.pageNo}`, PAGE.width - PAGE.margin - 45, 14, 8, fonts.regular, COLORS.muted);
}

function drawReportHeader(ctx: PdfContext, title: string, subtitle: string) {
  const { page, fonts } = ctx;
  page.drawRectangle({ x: 0, y: PAGE.height - 92, width: PAGE.width, height: 92, color: COLORS.navy });
  page.drawCircle({ x: PAGE.width - 42, y: PAGE.height - 22, size: 78, color: COLORS.blue, opacity: 0.14 });
  page.drawCircle({ x: PAGE.width - 130, y: PAGE.height - 84, size: 52, color: COLORS.violet, opacity: 0.18 });
  page.drawRectangle({ x: PAGE.margin, y: PAGE.height - 74, width: 5, height: 39, color: COLORS.lime });
  drawText(page, title, PAGE.margin + 16, PAGE.height - 49, 22, fonts.bold, COLORS.white, 440);
  drawText(page, subtitle, PAGE.margin + 16, PAGE.height - 68, 9, fonts.regular, rgb(0.78, 0.83, 0.92), 540);
}

function drawCard(page: PDFPage, x: number, y: number, width: number, height: number, color = COLORS.card) {
  page.drawRectangle({ x: x + 3, y: y - 3, width, height, color: rgb(0.79, 0.83, 0.9), opacity: 0.26 });
  page.drawRectangle({ x, y, width, height, color, borderColor: rgb(0.88, 0.9, 0.94), borderWidth: 0.7 });
}

function drawMetricCard(ctx: PdfContext, x: number, y: number, width: number, label: string, value: string, helper: string, accent: RGB) {
  const { page, fonts } = ctx;
  drawCard(page, x, y, width, 82);
  page.drawRectangle({ x, y: y + 76, width, height: 6, color: accent });
  drawText(page, label.toUpperCase(), x + 14, y + 55, 7.5, fonts.bold, COLORS.muted, width - 28);
  drawText(page, value, x + 14, y + 31, 17, fonts.bold, COLORS.ink, width - 28);
  drawText(page, helper, x + 14, y + 15, 8, fonts.regular, COLORS.muted, width - 28);
}

function drawSectionTitle(ctx: PdfContext, title: string, subtitle: string, y: number) {
  const { page, fonts } = ctx;
  page.drawRectangle({ x: PAGE.margin, y: y + 3, width: 4, height: 28, color: COLORS.blue });
  drawText(page, title, PAGE.margin + 14, y + 19, 15, fonts.bold, COLORS.ink, 360);
  drawText(page, subtitle, PAGE.margin + 14, y + 4, 8.5, fonts.regular, COLORS.muted, 560);
}

function drawHorizontalBars(ctx: PdfContext, title: string, rows: Array<{ name: string; value: number }>, x: number, y: number, width: number, height: number, formatValue: (value: number) => string) {
  const { page, fonts } = ctx;
  drawCard(page, x, y, width, height);
  drawText(page, title, x + 14, y + height - 23, 12, fonts.bold, COLORS.ink, width - 28);
  const max = Math.max(...rows.map((row) => row.value), 1);
  const rowHeight = Math.min(22, (height - 48) / Math.max(rows.length, 1));
  rows.slice(0, 8).forEach((row, index) => {
    const top = y + height - 48 - index * rowHeight;
    const barWidth = Math.max(5, ((width - 138) * row.value) / max);
    drawText(page, truncate(row.name, 22), x + 14, top + 2, 8, fonts.regular, COLORS.muted, 105);
    page.drawRectangle({ x: x + 124, y: top + 3, width: width - 152, height: 8, color: rgb(0.9, 0.92, 0.96) });
    page.drawRectangle({ x: x + 124, y: top + 3, width: barWidth, height: 8, color: ACCENTS[index % ACCENTS.length] });
    drawText(page, formatValue(row.value), x + width - 72, top + 1, 8, fonts.bold, COLORS.ink, 58);
  });
}

function drawTimelineBars(ctx: PdfContext, title: string, rows: Array<{ name: string; value: number; secondaryValue?: number }>, x: number, y: number, width: number, height: number) {
  const { page, fonts } = ctx;
  drawCard(page, x, y, width, height);
  drawText(page, title, x + 14, y + height - 23, 12, fonts.bold, COLORS.ink, width - 28);
  const chartX = x + 22;
  const chartY = y + 28;
  const chartW = width - 44;
  const chartH = height - 64;
  const max = Math.max(...rows.map((row) => Math.max(row.value, row.secondaryValue ?? 0)), 1);
  const gap = 5;
  const barW = Math.max(5, (chartW - gap * Math.max(rows.length - 1, 0)) / Math.max(rows.length, 1));

  page.drawLine({ start: { x: chartX, y: chartY }, end: { x: chartX + chartW, y: chartY }, thickness: 0.6, color: COLORS.faint });
  rows.slice(-14).forEach((row, index) => {
    const baseX = chartX + index * (barW + gap);
    const primaryH = Math.max(2, (chartH * row.value) / max);
    page.drawRectangle({ x: baseX, y: chartY, width: barW, height: primaryH, color: ACCENTS[index % ACCENTS.length], opacity: 0.9 });
    if (row.secondaryValue !== undefined) {
      const secondaryH = Math.max(1, (chartH * row.secondaryValue) / max);
      page.drawRectangle({ x: baseX + barW * 0.58, y: chartY, width: Math.max(2, barW * 0.4), height: secondaryH, color: COLORS.ink, opacity: 0.82 });
    }
    if (index % 2 === 0) drawText(page, truncate(row.name, 5), baseX - 1, y + 12, 6.5, fonts.regular, COLORS.muted, barW + 8);
  });
}

function drawTable<T>(ctx: PdfContext, title: string, rows: T[], columns: TableColumn<T>[], x: number, y: number, width: number, rowLimit = 8) {
  const { page, fonts } = ctx;
  const rowHeight = 22;
  const titleHeight = 34;
  const height = titleHeight + rowHeight * (Math.min(rows.length, rowLimit) + 1) + 10;
  drawCard(page, x, y, width, height);
  drawText(page, title, x + 14, y + height - 22, 12, fonts.bold, COLORS.ink, width - 28);

  let cursorX = x + 14;
  const headerY = y + height - titleHeight - 14;
  page.drawRectangle({ x: x + 10, y: headerY - 4, width: width - 20, height: 18, color: rgb(0.92, 0.94, 0.98) });
  columns.forEach((column) => {
    drawText(page, column.header.toUpperCase(), cursorX, headerY, 6.8, fonts.bold, COLORS.muted, column.width - 4);
    cursorX += column.width;
  });

  rows.slice(0, rowLimit).forEach((row, index) => {
    const rowY = headerY - 21 - index * rowHeight;
    if (index % 2 === 1) page.drawRectangle({ x: x + 10, y: rowY - 5, width: width - 20, height: 18, color: rgb(0.975, 0.98, 0.99) });
    let cellX = x + 14;
    columns.forEach((column) => {
      const value = cleanText(column.get(row, index));
      const textWidth = column.width - 4;
      const textSize = column.align === "right" ? 7.7 : 7.8;
      if (column.align === "right") {
        const trimmed = truncate(value, 18);
        const offset = Math.max(0, textWidth - fonts.regular.widthOfTextAtSize(trimmed, textSize));
        drawText(page, trimmed, cellX + offset, rowY, textSize, fonts.regular, COLORS.ink, textWidth);
      } else {
        drawText(page, truncate(value, column.width > 140 ? 30 : 18), cellX, rowY, textSize, fonts.regular, COLORS.ink, textWidth);
      }
      cellX += column.width;
    });
  });

  return height;
}

function invoiceRows(snapshot: any) {
  return (snapshot.invoices ?? []).map((invoice: any) => ({
    invoiceNo: invoice.invoiceNo,
    customer: invoice.customer?.name || "Walk-in",
    status: invoice.status,
    total: money(invoice.total),
    due: money(invoice.dueAmount),
    date: invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd MMM") : "-"
  }));
}

function movementRows(snapshot: any) {
  return (snapshot.movements ?? []).map((movement: any) => ({
    product: movement.product?.name || "-",
    type: movement.type,
    quantity: movement.quantity,
    afterQty: movement.afterQty,
    date: movement.movedAt ? format(new Date(movement.movedAt), "dd MMM") : "-"
  }));
}

function activityRows(snapshot: any) {
  return (snapshot.activities ?? []).map((activity: any) => ({
    type: activity.type,
    title: activity.title,
    date: activity.createdAt ? format(new Date(activity.createdAt), "dd MMM") : "-"
  }));
}

function buildSummaryText(snapshot: any, reportType: ReportType = "general", businessReport?: any) {
  const sales = businessReport?.sales;
  if (reportType === "sales_report" && sales?.ok !== false) {
    return `This sales report is based on ${num(sales?.invoiceCount)} invoice records, ${money(sales?.grossSales)} gross sales, ${money(sales?.cashReceived)} cash received and ${num(sales?.itemsSold)} items sold in the selected period. Follow the highest selling products and unpaid invoices before planning the next purchase cycle.`;
  }
  if (reportType === "profit_loss_report" && sales?.ok !== false) {
    return `This profit and loss view shows ${money(sales?.grossSales)} gross sales and ${money(sales?.grossProfit)} estimated gross profit from invoice item margins in the selected period. Watch discounting, unpaid invoice value and low-margin fast movers before increasing stock exposure.`;
  }
  if (reportType === "inventory_report" || reportType === "stock_movement_report") {
    return `This inventory report uses current stock, low-stock thresholds, category value and recent movement records. Prioritize products below reorder level, then compare sales movement against stock on hand before purchasing.`;
  }
  if (reportType === "customer_report" || reportType === "dues_report") {
    return `This customer report focuses on receivables and ledger pressure. The highest balances should be reviewed first, especially customers with repeated partial or unpaid invoices.`;
  }
  if (reportType === "supplier_report") {
    return `This supplier report focuses on payables, supplier balances and purchase pressure visible to the current role. Time supplier payouts against customer collections and current sales velocity.`;
  }
  const stockRisk = num(snapshot.metrics?.stockRiskScore);
  const dueGap = num(snapshot.metrics?.customerDues) - num(snapshot.metrics?.supplierDues);
  const riskCopy = stockRisk > 35 ? "Stock risk needs attention because a meaningful part of the catalog is near reorder level." : "Stock control is stable, with only a limited set of products near reorder level.";
  const duesCopy = dueGap >= 0 ? "Customer receivables are higher than supplier payables, so collection discipline should stay visible." : "Supplier payables are currently heavier than customer receivables, so outgoing cash needs careful timing.";
  return `${riskCopy} ${duesCopy} Fast movers and category concentration should guide the next purchase cycle.`;
}

export async function buildGeneralReportPdf({ shop, user, snapshot, generatedAt = new Date(), reportType: rawReportType = "general", startDate, endDate, businessReport }: ReportPdfInput) {
  const reportType = normalizeReportType(rawReportType);
  const title = `${reportLabel(reportType)} PDF Report`;
  const description = reportDescription(reportType);
  const rangeLabel = reportRangeLabel(startDate, endDate);
  const sales = businessReport?.sales;
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique)
  };

  const ctx: PdfContext = {
    pdf,
    page: pdf.addPage([PAGE.width, PAGE.height]),
    fonts,
    pageNo: 1,
    logo: await loadLogo(pdf)
  };

  const page = ctx.page;
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: COLORS.paper });
  page.drawRectangle({ x: 0, y: PAGE.height - 220, width: PAGE.width, height: 220, color: COLORS.navy });
  page.drawCircle({ x: PAGE.width - 80, y: PAGE.height - 45, size: 120, color: COLORS.blue, opacity: 0.16 });
  page.drawCircle({ x: PAGE.width - 190, y: PAGE.height - 202, size: 72, color: COLORS.violet, opacity: 0.2 });
  page.drawRectangle({ x: PAGE.margin, y: PAGE.height - 160, width: 6, height: 88, color: COLORS.lime });

  if (ctx.logo) {
    const natural = ctx.logo.scale(1);
    const scale = Math.min(116 / natural.width, 38 / natural.height);
    const dims = ctx.logo.scale(scale);
    page.drawImage(ctx.logo, { x: PAGE.margin, y: PAGE.height - 62, width: dims.width, height: dims.height });
  } else {
    drawText(page, "ShopIQ", PAGE.margin, PAGE.height - 54, 18, fonts.bold, COLORS.white);
  }

  drawText(page, title, PAGE.margin + 18, PAGE.height - 112, 28, fonts.bold, COLORS.white, 420);
  drawWrappedText(page, `${shop.name} - ${shop.city || "Business workspace"} - ${rangeLabel} - generated ${format(generatedAt, "dd MMM yyyy, hh:mm a")}`, PAGE.margin + 18, PAGE.height - 138, 520, 10, fonts.regular, rgb(0.78, 0.83, 0.92), 2);
  drawText(page, `Prepared for ${user.name} (${user.role})`, PAGE.margin + 18, PAGE.height - 172, 10, fonts.regular, rgb(0.78, 0.83, 0.92), 420);

  drawCard(page, PAGE.width - 278, PAGE.height - 178, 218, 92, rgb(0.1, 0.13, 0.22));
  drawText(page, "REPORT WINDOW", PAGE.width - 258, PAGE.height - 114, 7.5, fonts.bold, rgb(0.78, 0.83, 0.92));
  drawText(page, rangeLabel || snapshot.metrics?.revenueWindowLabel || "Current reporting period", PAGE.width - 258, PAGE.height - 135, 13, fonts.bold, COLORS.white, 176);
  drawText(page, `${sales?.invoiceCount ?? snapshot.invoices?.length ?? 0} invoice records analyzed`, PAGE.width - 258, PAGE.height - 154, 8.5, fonts.regular, rgb(0.78, 0.83, 0.92), 176);

  const metricsY = PAGE.height - 326;
  const cardW = 238;
  drawMetricCard(ctx, PAGE.margin, metricsY, cardW, "Revenue", money(sales?.grossSales ?? snapshot.metrics?.monthlyRevenue), sales ? "Selected report period" : snapshot.metrics?.revenueWindowLabel || "Reporting revenue", COLORS.blue);
  drawMetricCard(ctx, PAGE.margin + cardW + 18, metricsY, cardW, "Inventory value", money(snapshot.metrics?.inventoryValue), `${snapshot.metrics?.productCount || 0} active products`, COLORS.violet);
  drawMetricCard(ctx, PAGE.margin + (cardW + 18) * 2, metricsY, cardW, "Stock risk", `${Math.round(num(snapshot.metrics?.stockRiskScore))}%`, `${snapshot.metrics?.lowStockCount || 0} low stock products`, COLORS.amber);

  drawMetricCard(ctx, PAGE.margin, metricsY - 104, cardW, "Customer dues", money(snapshot.metrics?.customerDues), "Receivable balance", COLORS.emerald);
  drawMetricCard(ctx, PAGE.margin + cardW + 18, metricsY - 104, cardW, reportType === "profit_loss_report" ? "Gross profit" : "Supplier payables", money(reportType === "profit_loss_report" ? sales?.grossProfit : snapshot.metrics?.supplierDues), reportType === "profit_loss_report" ? "Estimated item margin" : "Outstanding supplier balance", COLORS.rose);
  drawMetricCard(ctx, PAGE.margin + (cardW + 18) * 2, metricsY - 104, cardW, sales ? "Cash received" : "Today sales", money(sales?.cashReceived ?? snapshot.metrics?.todaySales), sales ? "Customer receipts in range" : snapshot.metrics?.salesWindowLabel || "Today", COLORS.cyan);

  drawCard(page, PAGE.margin, 58, PAGE.width - PAGE.margin * 2, 82);
  drawText(page, "Executive reading", PAGE.margin + 18, 112, 14, fonts.bold, COLORS.ink);
  drawWrappedText(page, `${description} ${buildSummaryText(snapshot, reportType, businessReport)}`, PAGE.margin + 18, 93, PAGE.width - PAGE.margin * 2 - 36, 9.2, fonts.regular, COLORS.muted, 3);

  addPage(ctx);
  drawReportHeader(ctx, "Charts And Operating Signals", "Live report charts transformed into a compact PDF command board.");
  drawSectionTitle(ctx, "Financial movement", "Revenue, cashflow, inventory concentration and invoice settlement state.", PAGE.height - 132);

  drawTimelineBars(ctx, "Revenue trend", snapshot.charts?.revenueTimeline ?? [], PAGE.margin, 314, 362, 150);
  drawTimelineBars(ctx, "Receipts vs payouts", snapshot.charts?.cashflowTimeline ?? [], PAGE.margin + 390, 314, 376, 150);
  drawHorizontalBars(ctx, "Category inventory value", snapshot.charts?.categoryValue ?? [], PAGE.margin, 104, 362, 170, (value) => money(value, true));
  drawHorizontalBars(ctx, "Payment method mix", snapshot.charts?.paymentMethodMix ?? [], PAGE.margin + 390, 104, 376, 170, (value) => money(value, true));

  addPage(ctx);
  drawReportHeader(ctx, reportType === "customer_report" || reportType === "dues_report" ? "Customer Dues And Ledger Pressure" : "Products, Stock And Dues", "Operational lists used for purchase planning, credit control and daily follow-up.");
  drawTable(
    ctx,
    "Fast moving products",
    snapshot.fastMoving ?? [],
    [
      { header: "#", width: 28, get: (_row, index) => index + 1 },
      { header: "Product", width: 196, get: (row: any) => row.name },
      { header: "Qty sold", width: 72, get: (row: any) => row.qty, align: "right" }
    ],
    PAGE.margin,
    335,
    338
  );
  drawTable(
    ctx,
    "Low stock watchlist",
    snapshot.lowStock ?? [],
    [
      { header: "SKU", width: 72, get: (row: any) => row.sku },
      { header: "Product", width: 170, get: (row: any) => row.name },
      { header: "Stock", width: 54, get: (row: any) => `${row.stockQty}/${row.reorderLevel}`, align: "right" }
    ],
    PAGE.margin + 366,
    335,
    400,
    8
  );
  drawTable(
    ctx,
    "Customer dues",
    snapshot.customers ?? [],
    [
      { header: "Customer", width: 174, get: (row: any) => row.name },
      { header: "Phone", width: 92, get: (row: any) => row.phone || "-" },
      { header: "Balance", width: 82, get: (row: any) => money(row.balance), align: "right" }
    ],
    PAGE.margin,
    92,
    386,
    8
  );
  drawTable(
    ctx,
    "Supplier payables",
    snapshot.suppliers ?? [],
    [
      { header: "Supplier", width: 180, get: (row: any) => row.name },
      { header: "Score", width: 52, get: (row: any) => row.reliabilityScore ?? "-", align: "right" },
      { header: "Balance", width: 92, get: (row: any) => money(row.balance), align: "right" }
    ],
    PAGE.margin + 414,
    92,
    352,
    8
  );

  addPage(ctx);
  drawReportHeader(ctx, reportType === "stock_movement_report" ? "Recent Stock Movement Records" : "Recent Records", "The latest transactional rows included in the reporting snapshot.");
  drawTable(
    ctx,
    "Recent invoices",
    invoiceRows(snapshot),
    [
      { header: "Invoice", width: 98, get: (row: any) => row.invoiceNo },
      { header: "Customer", width: 150, get: (row: any) => row.customer },
      { header: "Status", width: 66, get: (row: any) => row.status },
      { header: "Total", width: 82, get: (row: any) => row.total, align: "right" },
      { header: "Due", width: 82, get: (row: any) => row.due, align: "right" },
      { header: "Date", width: 54, get: (row: any) => row.date }
    ],
    PAGE.margin,
    330,
    PAGE.width - PAGE.margin * 2,
    8
  );
  drawTable(
    ctx,
    "Recent stock movements",
    movementRows(snapshot),
    [
      { header: "Product", width: 200, get: (row: any) => row.product },
      { header: "Type", width: 82, get: (row: any) => row.type },
      { header: "Qty", width: 52, get: (row: any) => row.quantity, align: "right" },
      { header: "After", width: 58, get: (row: any) => row.afterQty, align: "right" },
      { header: "Date", width: 54, get: (row: any) => row.date }
    ],
    PAGE.margin,
    144,
    506,
    7
  );
  drawTable(
    ctx,
    "Activity log",
    activityRows(snapshot),
    [
      { header: "Type", width: 92, get: (row: any) => row.type },
      { header: "Title", width: 166, get: (row: any) => row.title },
      { header: "Date", width: 48, get: (row: any) => row.date }
    ],
    PAGE.margin + 532,
    144,
    234,
    7
  );

  drawFooter(ctx);
  pdf.setTitle(`${shop.name} ${reportLabel(reportType)} Report`);
  pdf.setAuthor("ShopIQ");
  pdf.setSubject(description);
  pdf.setCreator("ShopIQ Reports");
  pdf.setProducer("ShopIQ Reports");
  pdf.setCreationDate(generatedAt);

  return pdf.save();
}

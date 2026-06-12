import { format, isSameDay, subDays, startOfMonth, startOfDay } from "date-fns";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildDailySeries, statusSegments, sumByGroup, topRows } from "@/lib/chart-helpers";
import { canReadSupplierCashflow } from "@/lib/permissions";

function n(value: any) { return Number(value || 0); }

export async function getDashboardSnapshot(shopId: string, role?: UserRole | string | null) {
  const today = startOfDay(new Date());
  const month = startOfMonth(new Date());
  const includeSupplierSide = role === undefined ? true : canReadSupplierCashflow(role);
  const [products, customers, suppliers, invoices, payments, purchases, movements, activities] = await Promise.all([
    prisma.product.findMany({ where: { shopId, status: "ACTIVE" }, include: { category: true }, orderBy: { updatedAt: "desc" } }),
    prisma.customer.findMany({ where: { shopId }, orderBy: { balance: "desc" } }),
    includeSupplierSide ? prisma.supplier.findMany({ where: { shopId }, orderBy: { balance: "desc" } }) : Promise.resolve([]),
    prisma.invoice.findMany({ where: { shopId, status: { not: "CANCELLED" } }, include: { items: { include: { product: true } }, customer: true }, orderBy: { invoiceDate: "desc" }, take: 300 }),
    prisma.payment.findMany({ where: { shopId, status: "ACTIVE" }, orderBy: { paidAt: "desc" }, take: 150 }),
    includeSupplierSide ? prisma.purchase.findMany({ where: { shopId }, orderBy: { purchaseDate: "desc" }, take: 150 }) : Promise.resolve([]),
    prisma.stockMovement.findMany({ where: { shopId }, include: { product: true }, orderBy: { movedAt: "desc" }, take: 300 }),
    prisma.activityLog.findMany({ where: { shopId }, orderBy: { createdAt: "desc" }, take: 12 })
  ]);

  const latestInvoiceDate = invoices[0]?.invoiceDate;
  const literalTodaySales = invoices.filter(i => i.invoiceDate >= today).reduce((s, i) => s + n(i.total), 0);
  const latestActiveDaySales = latestInvoiceDate ? invoices.filter(i => isSameDay(i.invoiceDate, latestInvoiceDate)).reduce((s, i) => s + n(i.total), 0) : 0;
  const todaySales = literalTodaySales > 0 ? literalTodaySales : latestActiveDaySales;
  const currentMonthInvoices = invoices.filter(i => i.invoiceDate >= month);
  const rollingStart = latestInvoiceDate ? subDays(latestInvoiceDate, 29) : subDays(new Date(), 29);
  const activeRevenueInvoices = currentMonthInvoices.length ? currentMonthInvoices : invoices.filter(i => i.invoiceDate >= rollingStart);
  const monthlyRevenue = activeRevenueInvoices.reduce((s, i) => s + n(i.total), 0);
  const salesWindowLabel = literalTodaySales > 0 ? "Today" : latestInvoiceDate ? `Latest active day, ${format(latestInvoiceDate, "dd MMM")}` : "No sales yet";
  const revenueWindowLabel = currentMonthInvoices.length ? "Current month gross sales" : "Latest active 30 days";
  const inventoryValue = products.reduce((s, p) => s + p.stockQty * n(p.costPrice), 0);
  const lowStock = products.filter(p => p.stockQty <= p.reorderLevel);
  const customerDues = customers.reduce((s, c) => s + Math.max(n(c.balance), 0), 0);
  const supplierDues = suppliers.reduce((s, c) => s + Math.max(n(c.balance), 0), 0);
  const saleMovements = movements.filter(m => m.type === "SALE");
  const productVelocity = new Map<string, { name: string; qty: number }>();
  for (const m of saleMovements) {
    const prev = productVelocity.get(m.productId) || { name: m.product.name, qty: 0 };
    prev.qty += Math.abs(m.quantity);
    productVelocity.set(m.productId, prev);
  }
  const fastMoving = [...productVelocity.values()].sort((a,b)=>b.qty-a.qty).slice(0,6);
  const slowMoving = products.filter(p => !productVelocity.has(p.id)).slice(0,6).map(p => ({ name: p.name, qty: 0 }));
  const stockRiskScore = Math.min(100, Math.round((lowStock.length / Math.max(products.length, 1)) * 100));
  const categoryValue = products.reduce((acc: any[], p) => {
    const name = p.category?.name || "Uncategorized";
    const row = acc.find(x => x.name === name) || (acc.push({ name, value: 0 }), acc[acc.length-1]);
    row.value += p.stockQty * n(p.costPrice);
    return acc;
  }, []);
  const revenueTimeline = buildDailySeries(invoices, (invoice) => invoice.invoiceDate, (invoice) => n(invoice.total), 14);
  const customerPayments = payments.filter(p => p.direction === "CUSTOMER_IN");
  const supplierPayments = payments.filter(p => p.direction === "SUPPLIER_OUT");
  const operationalPurchases = purchases.filter(p => p.status !== "PAYMENT_OUT" && p.status !== "REFUND_IN");
  const cashflowItems = [
    ...customerPayments.map(p => ({ date: p.paidAt, in: n(p.amount), out: 0 })),
    ...supplierPayments.map(p => ({ date: p.paidAt, in: 0, out: n(p.amount) })),
    ...purchases.filter(p => p.status === "PAYMENT_OUT" || p.status === "REFUND_IN").map(p => ({
      date: p.purchaseDate || p.createdAt,
      in: p.status === "REFUND_IN" ? n(p.paidAmount) : 0,
      out: p.status === "PAYMENT_OUT" ? n(p.paidAmount) : 0
    }))
  ];
  const cashflowTimeline = buildDailySeries(
    cashflowItems,
    (item) => item.date,
    (item) => item.in,
    14,
    (item) => item.out
  );
  const invoiceStatus = statusSegments(invoices, (invoice) => invoice.status);
  const purchaseStatus = statusSegments(operationalPurchases, (purchase) => purchase.status);
  const paymentMethodMix = sumByGroup(customerPayments, (payment) => payment.method?.replace(/_/g, " "), (payment) => n(payment.amount), 7);
  const customerDueRank = topRows(customers, (customer) => customer.name, (customer) => n(customer.balance), 6);
  const supplierDueRank = topRows(suppliers, (supplier) => supplier.name, (supplier) => n(supplier.balance), 6);
  const marginLeaders = topRows(
    products,
    (product) => product.name,
    (product) => Math.max(0, n(product.salePrice) - n(product.costPrice)) * product.stockQty,
    6
  );

  return {
    metrics: { todaySales, monthlyRevenue, inventoryValue, lowStockCount: lowStock.length, customerDues, supplierDues, stockRiskScore, productCount: products.length, literalTodaySales, latestActiveDaySales, latestInvoiceDate, salesWindowLabel, revenueWindowLabel },
    products: products.slice(0, 8),
    lowStock: lowStock.slice(0, 10),
    customers: customers.slice(0, 8),
    suppliers: suppliers.slice(0, 8),
    invoices: invoices.slice(0, 8),
    payments,
    purchases: operationalPurchases,
    movements: movements.slice(0, 12),
    activities,
    fastMoving,
    slowMoving,
    charts: { categoryValue, fastMoving, revenueTimeline, cashflowTimeline, invoiceStatus, purchaseStatus, paymentMethodMix, customerDueRank, supplierDueRank, marginLeaders }
  };
}

export async function getBusinessContext(shopId: string, role?: UserRole | string | null) {
  const snapshot = await getDashboardSnapshot(shopId, role);
  const supplierContext = canReadSupplierCashflow(role) ? `\nSupplier dues: ${snapshot.suppliers.map(s => `${s.name}: PKR ${s.balance}`).join(", ")}` : "";
  return `ShopIQ live business context:\nMetrics: ${JSON.stringify(snapshot.metrics)}\nLow stock: ${snapshot.lowStock.map(p => `${p.name} (${p.stockQty}/${p.reorderLevel})`).join(", ")}\nTop customers by dues: ${snapshot.customers.map(c => `${c.name}: PKR ${c.balance}`).join(", ")}${supplierContext}\nFast movers: ${snapshot.fastMoving.map(p => `${p.name}: ${p.qty}`).join(", ")}`;
}

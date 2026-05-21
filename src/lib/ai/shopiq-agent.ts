import bcrypt from "bcryptjs";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { z } from "zod";
import type { Content, FunctionCall, FunctionDeclaration } from "@google/genai";
import type { UserRole } from "@prisma/client";
import { runGeminiToolTurn } from "@/lib/ai";
import { getDashboardSnapshot } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { buildReportDownloadUrl, normalizeReportType, reportFileSlug, reportLabel, reportRangeLabel, REPORT_TYPE_VALUES } from "@/lib/report-config";
import {
  can,
  canCreateStaffRole,
  canManageStaffMember,
  canReadSupplierCashflow,
  canUsePaymentDirection,
  type CrudAction,
  type PermissionResource
} from "@/lib/permissions";
import {
  clamp,
  intQty,
  money,
  nullableEmail,
  nullableId,
  nullableText,
  optionalEmail,
  optionalId,
  optionalText,
  positiveIntQty,
  positiveMoney,
  requiredText
} from "@/lib/validation";
import { workspacePath } from "@/lib/workspace";

type AgentUser = {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: UserRole;
  shop?: { name: string; currency: string } | null;
};

export type AiActionType =
  | "create_category"
  | "update_category"
  | "create_product"
  | "update_product"
  | "create_customer"
  | "update_customer"
  | "create_supplier"
  | "update_supplier"
  | "create_payment"
  | "create_invoice"
  | "create_purchase"
  | "create_stock_adjustment"
  | "create_staff"
  | "update_staff";

export type PendingAiActionMetadata = {
  pendingAction?: AiActionType;
  status?: "pending" | "executed" | "cancelled";
  payload?: Record<string, any>;
  previewId?: string;
  reason?: string;
  provider?: string;
  model?: string;
  toolResults?: unknown[];
  action?: { label: string; href: string };
};

export type PreparedAiAction = {
  type: AiActionType;
  label: string;
  payload: Record<string, any>;
  previewId: string;
  reason?: string;
};

type BusinessEntity = "products" | "customers" | "suppliers" | "invoices" | "purchases" | "payments" | "staff";
type OperatingJob = "reorder_plan" | "collections_plan" | "cashflow_risk" | "sales_quality_review" | "stock_audit";

const categoryCreateSchema = z.object({
  name: requiredText("Category name"),
  color: optionalText(40)
});

const categoryUpdateSchema = z.object({
  id: z.string().min(1, "Category id is required."),
  changes: z.object({
    name: requiredText("Category name").optional(),
    color: nullableText(40)
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Add at least one category field to update.")
});

const CONFIRM_RE = /^(yes|yep|yeah|ok|okay|confirm|confirmed|create it|save it|add it|record it|update it|proceed|do it|approve|approved|go ahead|yes add|yes create|yes save|yes update|yes record)/i;
const CANCEL_RE = /^(no|nope|cancel|cancel it|do not|don't|dont|not now|stop|reject|discard)/i;

const optionalPassword = z.preprocess(
  (value) => (String(value || "").trim() ? value : undefined),
  z.string().min(8, "Password must be at least 8 characters.").optional()
);

const productCreateSchema = z.object({
  name: requiredText("Product name"),
  sku: optionalText(80),
  barcode: optionalText(80),
  brand: optionalText(120),
  unit: optionalText(40).default("pcs"),
  costPrice: money,
  salePrice: money,
  stockQty: intQty,
  reorderLevel: intQty.default(5),
  reorderQuantity: intQty.default(10),
  location: optionalText(120),
  categoryId: optionalId,
  categoryName: optionalText(80)
});

const productUpdateSchema = z.object({
  id: z.string().min(1, "Product id is required."),
  changes: z.object({
    name: requiredText("Product name").optional(),
    sku: optionalText(80),
    barcode: nullableText(80),
    brand: nullableText(120),
    unit: optionalText(40),
    costPrice: money.optional(),
    salePrice: money.optional(),
    stockQty: intQty.optional(),
    reorderLevel: intQty.optional(),
    reorderQuantity: intQty.optional(),
    location: nullableText(120),
    categoryId: nullableId,
    categoryName: nullableText(80)
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Add at least one product field to update.")
});

const customerCreateSchema = z.object({
  name: requiredText("Customer name"),
  phone: optionalText(40),
  email: optionalEmail,
  address: optionalText(220),
  creditLimit: money,
  balance: money.optional(),
  notes: optionalText(600)
});

const customerUpdateSchema = z.object({
  id: z.string().min(1, "Customer id is required."),
  changes: z.object({
    name: requiredText("Customer name").optional(),
    phone: nullableText(40),
    email: nullableEmail,
    address: nullableText(220),
    creditLimit: money.optional(),
    balance: money.optional(),
    notes: nullableText(600)
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Add at least one customer field to update.")
});

const supplierCreateSchema = z.object({
  name: requiredText("Supplier name"),
  phone: optionalText(40),
  email: optionalEmail,
  address: optionalText(220),
  balance: money.optional(),
  reliabilityScore: z.coerce.number().int().min(0).max(100).default(80),
  notes: optionalText(600)
});

const supplierUpdateSchema = z.object({
  id: z.string().min(1, "Supplier id is required."),
  changes: z.object({
    name: requiredText("Supplier name").optional(),
    phone: nullableText(40),
    email: nullableEmail,
    address: nullableText(220),
    balance: money.optional(),
    reliabilityScore: z.coerce.number().int().min(0).max(100).optional(),
    notes: nullableText(600)
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Add at least one supplier field to update.")
});

const paymentCreateSchema = z.object({
  direction: z.enum(["CUSTOMER_IN", "SUPPLIER_OUT"]).default("CUSTOMER_IN"),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"]).default("CASH"),
  amount: positiveMoney,
  customerId: optionalId,
  customerName: optionalText(160),
  supplierId: optionalId,
  supplierName: optionalText(160),
  invoiceId: optionalId,
  invoiceNo: optionalText(80),
  purchaseId: optionalId,
  purchaseNo: optionalText(80),
  paidAt: z.coerce.date().optional(),
  reference: optionalText(120),
  notes: optionalText(600)
});

const invoiceItemSchema = z.object({
  productId: optionalId,
  productSku: optionalText(80),
  productName: optionalText(160),
  quantity: positiveIntQty,
  unitPrice: money.optional()
}).refine((value) => value.productId || value.productSku || value.productName, "Each invoice item needs a productId, productSku, or productName.");

const invoiceCreateSchema = z.object({
  customerId: optionalId,
  customerName: optionalText(160),
  invoiceNo: optionalText(80),
  discount: money,
  tax: money,
  paidAmount: money,
  dueDate: z.coerce.date().optional(),
  notes: optionalText(600),
  items: z.array(invoiceItemSchema).min(1, "Add at least one invoice item.")
});

const purchaseItemSchema = z.object({
  productId: optionalId,
  productSku: optionalText(80),
  productName: optionalText(160),
  quantity: positiveIntQty,
  unitCost: positiveMoney
}).refine((value) => value.productId || value.productSku || value.productName, "Each purchase item needs a productId, productSku, or productName.");

const purchaseCreateSchema = z.object({
  supplierId: optionalId,
  supplierName: optionalText(160),
  purchaseNo: optionalText(80),
  paidAmount: money,
  purchaseDate: z.coerce.date().optional(),
  notes: optionalText(600),
  items: z.array(purchaseItemSchema).min(1, "Add at least one purchase item.")
});

const stockAdjustmentSchema = z.object({
  productId: optionalId,
  productSku: optionalText(80),
  productName: optionalText(160),
  movementType: z.enum(["ADJUSTMENT", "DAMAGE", "RETURN_IN", "RETURN_OUT"]).default("ADJUSTMENT"),
  mode: z.enum(["SET", "INCREMENT", "DECREMENT"]).optional(),
  targetStock: intQty.optional(),
  quantity: positiveIntQty.optional(),
  reference: optionalText(120),
  notes: optionalText(600)
}).refine((value) => value.productId || value.productSku || value.productName, "A product reference is required.")
  .refine((value) => value.targetStock !== undefined || value.quantity !== undefined, "Provide targetStock or quantity.");

const staffCreateSchema = z.object({
  name: requiredText("Name"),
  email: z.string().trim().email().toLowerCase(),
  password: optionalPassword,
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]).default("STAFF"),
  status: z.enum(["ACTIVE", "INVITED"]).default("ACTIVE"),
  designation: optionalText(120),
  phone: optionalText(40)
});

const staffUpdateSchema = z.object({
  id: z.string().min(1, "Staff id is required."),
  changes: z.object({
    name: requiredText("Name").optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    password: optionalPassword,
    role: z.enum(["ADMIN", "MANAGER", "STAFF"]).optional(),
    designation: nullableText(120),
    phone: nullableText(40)
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Add at least one staff field to update.")
});

const salesSummarySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  customerId: optionalId,
  customerName: optionalText(160)
});

const customerBalanceSummarySchema = z.object({
  customerId: optionalId,
  customerName: optionalText(160)
}).refine((value) => value.customerId || value.customerName, "Provide a customerId or customerName.");

const productPerformanceSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  productId: optionalId,
  productSku: optionalText(80),
  productName: optionalText(160),
  limit: z.coerce.number().optional()
});

const customerCreditRiskSchema = z.object({
  limit: z.coerce.number().optional(),
  minimumBalance: money.optional()
});

const businessReportSchema = z.object({
  reportType: z.enum(REPORT_TYPE_VALUES).default("full_business_review"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().optional()
});

const entityResource: Record<BusinessEntity, PermissionResource> = {
  products: "products",
  customers: "customers",
  suppliers: "suppliers",
  invoices: "invoices",
  purchases: "purchases",
  payments: "payments",
  staff: "staff"
};

const actionResource: Record<AiActionType, { resource: PermissionResource; action: CrudAction }> = {
  create_category: { resource: "products", action: "create" },
  update_category: { resource: "products", action: "update" },
  create_product: { resource: "products", action: "create" },
  update_product: { resource: "products", action: "update" },
  create_customer: { resource: "customers", action: "create" },
  update_customer: { resource: "customers", action: "update" },
  create_supplier: { resource: "suppliers", action: "create" },
  update_supplier: { resource: "suppliers", action: "update" },
  create_payment: { resource: "payments", action: "create" },
  create_invoice: { resource: "invoices", action: "create" },
  create_purchase: { resource: "purchases", action: "create" },
  create_stock_adjustment: { resource: "products", action: "update" },
  create_staff: { resource: "staff", action: "create" },
  update_staff: { resource: "staff", action: "update" }
};

const selectStaff = { id: true, name: true, email: true, role: true, status: true, designation: true, phone: true, createdAt: true } as const;

function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)));
}

function n(value: unknown) {
  return Number(value || 0);
}

function moneyLabel(value: unknown) {
  return `PKR ${n(value).toLocaleString()}`;
}

function buildDateRange(startDate: Date, endDate?: Date) {
  const start = startOfDay(startDate);
  const end = endOfDay(endDate || startDate);
  if (end < start) throw new Error("endDate must be on or after startDate.");
  return { start, end };
}

function safeLimit(value: unknown, fallback = 10, max = 30) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function stringArg(value: unknown) {
  return String(value || "").trim();
}

function contains(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

function emptyToUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function validationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  return error instanceof Error ? error.message : "Invalid action payload.";
}

function isConfirm(text: string) {
  return CONFIRM_RE.test(text.trim());
}

function isCancel(text: string) {
  return CANCEL_RE.test(text.trim());
}

function actionLabel(action: AiActionType) {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function previewMarkdown(action: AiActionType, payload: Record<string, unknown>, reason?: string) {
  const title = actionLabel(action);
  const lines = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 14)
    .map(([key, value]) => `- **${key}:** ${typeof value === "object" ? `\`${JSON.stringify(value)}\`` : String(value)}`);

  return `## ${title} Preview

${reason ? `${reason}\n\n` : ""}I can run this database action after your confirmation.

${lines.join("\n") || "- No preview fields available."}

Reply **Yes, proceed** to apply this in ShopIQ, or **Cancel** to discard it.`;
}

function parseActionPayload(action: AiActionType, payload: unknown) {
  switch (action) {
    case "create_category":
      return categoryCreateSchema.parse(payload);
    case "update_category":
      return categoryUpdateSchema.parse(payload);
    case "create_product":
      return productCreateSchema.parse(payload);
    case "update_product":
      return productUpdateSchema.parse(payload);
    case "create_customer":
      return customerCreateSchema.parse(payload);
    case "update_customer":
      return customerUpdateSchema.parse(payload);
    case "create_supplier":
      return supplierCreateSchema.parse(payload);
    case "update_supplier":
      return supplierUpdateSchema.parse(payload);
    case "create_payment":
      return paymentCreateSchema.parse(payload);
    case "create_invoice":
      return invoiceCreateSchema.parse(payload);
    case "create_purchase":
      return purchaseCreateSchema.parse(payload);
    case "create_stock_adjustment":
      return stockAdjustmentSchema.parse(payload);
    case "create_staff":
      return staffCreateSchema.parse(payload);
    case "update_staff":
      return staffUpdateSchema.parse(payload);
    default:
      throw new Error("Unsupported action.");
  }
}

function actionHref(role: UserRole, action: AiActionType) {
  if (action.includes("category")) return workspacePath(role, "products");
  if (action.includes("product")) return workspacePath(role, "products");
  if (action.includes("customer")) return workspacePath(role, "customers");
  if (action.includes("supplier")) return workspacePath(role, "suppliers");
  if (action.includes("payment")) return workspacePath(role, "payments");
  if (action.includes("invoice")) return workspacePath(role, "billing");
  if (action.includes("purchase")) return workspacePath(role, "purchases");
  if (action.includes("stock")) return workspacePath(role, "products");
  if (action.includes("staff")) return workspacePath(role, "staff");
  return workspacePath(role, "dashboard");
}

async function resolveCategoryId(user: AgentUser, categoryId?: string | null, categoryName?: string | null) {
  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, shopId: user.shopId }, select: { id: true } });
    if (!category) throw new Error("Selected category was not found.");
    return category.id;
  }
  if (!categoryName) return undefined;
  const category = await prisma.category.upsert({
    where: { shopId_name: { shopId: user.shopId, name: categoryName } },
    update: {},
    create: { shopId: user.shopId, name: categoryName, color: "emerald" }
  });
  return category.id;
}

async function resolveCustomerId(shopId: string, customerId?: string | null, customerName?: string | null) {
  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, shopId }, select: { id: true, name: true } });
    if (!customer) throw new Error("Customer not found.");
    return customer.id;
  }
  if (!customerName) return null;
  const customer = await prisma.customer.findFirst({ where: { shopId, name: contains(customerName) }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });
  if (!customer) throw new Error(`Customer "${customerName}" was not found. Search customers first or provide customerId.`);
  return customer.id;
}

async function resolveSupplierId(shopId: string, supplierId?: string | null, supplierName?: string | null) {
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, shopId }, select: { id: true, name: true } });
    if (!supplier) throw new Error("Supplier not found.");
    return supplier.id;
  }
  if (!supplierName) return null;
  const supplier = await prisma.supplier.findFirst({ where: { shopId, name: contains(supplierName) }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });
  if (!supplier) throw new Error(`Supplier "${supplierName}" was not found. Search suppliers first or provide supplierId.`);
  return supplier.id;
}

async function resolveProduct(shopId: string, item: { productId?: string; productSku?: string; productName?: string }) {
  if (item.productId) {
    const product = await prisma.product.findFirst({ where: { id: item.productId, shopId }, include: { category: true } });
    if (!product) throw new Error("Product not found.");
    return product;
  }
  if (item.productSku) {
    const product = await prisma.product.findFirst({ where: { shopId, sku: item.productSku }, include: { category: true } });
    if (!product) throw new Error(`Product SKU "${item.productSku}" was not found.`);
    return product;
  }
  if (item.productName) {
    const product = await prisma.product.findFirst({ where: { shopId, name: contains(item.productName) }, orderBy: { updatedAt: "desc" }, include: { category: true } });
    if (!product) throw new Error(`Product "${item.productName}" was not found.`);
    return product;
  }
  throw new Error("A product reference is required.");
}

function invoiceStatus(total: number, paid: number) {
  return paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
}

async function resolveStockAdjustment(user: AgentUser, data: z.infer<typeof stockAdjustmentSchema>) {
  const product = await resolveProduct(user.shopId, data);
  let afterQty: number;
  if (data.targetStock !== undefined) {
    afterQty = data.targetStock;
  } else {
    const quantity = Number(data.quantity || 0);
    const mode = data.mode || (data.movementType === "RETURN_IN" ? "INCREMENT" : "DECREMENT");
    afterQty = mode === "INCREMENT" ? product.stockQty + quantity : product.stockQty - quantity;
  }
  if (afterQty < 0) throw new Error(`${product.name} cannot be adjusted below zero stock.`);
  const movementQuantity = afterQty - product.stockQty;
  if (movementQuantity === 0) throw new Error(`${product.name} already has stock quantity ${afterQty}.`);
  return { product, beforeQty: product.stockQty, afterQty, movementQuantity };
}

async function resolvePaymentLinks(shopId: string, payment: z.infer<typeof paymentCreateSchema>) {
  const next = {
    ...payment,
    customerId: payment.customerId || null,
    supplierId: payment.supplierId || null,
    invoiceId: payment.invoiceId || null,
    purchaseId: payment.purchaseId || null
  };

  if (!next.invoiceId && next.invoiceNo) {
    const invoice = await prisma.invoice.findFirst({ where: { shopId, invoiceNo: next.invoiceNo }, select: { id: true, customerId: true } });
    if (!invoice) throw new Error("Invoice not found.");
    next.invoiceId = invoice.id;
    next.customerId = next.customerId || invoice.customerId || null;
  }
  if (!next.purchaseId && next.purchaseNo) {
    const purchase = await prisma.purchase.findFirst({ where: { shopId, purchaseNo: next.purchaseNo }, select: { id: true, supplierId: true } });
    if (!purchase) throw new Error("Purchase not found.");
    next.purchaseId = purchase.id;
    next.supplierId = next.supplierId || purchase.supplierId || null;
  }
  if (next.invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: next.invoiceId, shopId }, select: { id: true, customerId: true } });
    if (!invoice) throw new Error("Invoice not found.");
    next.customerId = next.customerId || invoice.customerId || null;
  }
  if (next.purchaseId) {
    const purchase = await prisma.purchase.findFirst({ where: { id: next.purchaseId, shopId }, select: { id: true, supplierId: true } });
    if (!purchase) throw new Error("Purchase not found.");
    next.supplierId = next.supplierId || purchase.supplierId || null;
  }
  if (!next.customerId && next.customerName) next.customerId = await resolveCustomerId(shopId, undefined, next.customerName);
  if (!next.supplierId && next.supplierName) next.supplierId = await resolveSupplierId(shopId, undefined, next.supplierName);
  if (next.direction === "CUSTOMER_IN" && !next.customerId && !next.invoiceId) throw new Error("Customer payments need a customer or invoice.");
  if (next.direction === "SUPPLIER_OUT" && !next.supplierId && !next.purchaseId) throw new Error("Supplier payouts need a supplier or purchase.");
  return next;
}

async function applyPaymentEffect(
  tx: any,
  shopId: string,
  payment: { direction: string; amount: unknown; customerId?: string | null; supplierId?: string | null; invoiceId?: string | null; purchaseId?: string | null },
  sign: 1 | -1
) {
  const amount = Number(payment.amount);
  if (payment.direction === "CUSTOMER_IN") {
    let customerId = payment.customerId || null;
    if (payment.invoiceId) {
      const invoice = await tx.invoice.findFirst({ where: { id: payment.invoiceId, shopId } });
      if (invoice) {
        customerId = customerId || invoice.customerId;
        const paidAmount = Math.max(Number(invoice.paidAmount) + sign * amount, 0);
        const dueAmount = Math.max(Number(invoice.total) - paidAmount, 0);
        await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount, dueAmount, status: invoiceStatus(Number(invoice.total), paidAmount) } });
      }
    }
    if (customerId) await tx.customer.update({ where: { id: customerId }, data: { balance: sign === 1 ? { decrement: amount } : { increment: amount } } });
  }
  if (payment.direction === "SUPPLIER_OUT") {
    let supplierId = payment.supplierId || null;
    if (payment.purchaseId) {
      const purchase = await tx.purchase.findFirst({ where: { id: payment.purchaseId, shopId } });
      if (purchase) {
        supplierId = supplierId || purchase.supplierId;
        const paidAmount = Math.max(Number(purchase.paidAmount) + sign * amount, 0);
        const dueAmount = Math.max(Number(purchase.total) - paidAmount, 0);
        await tx.purchase.update({ where: { id: purchase.id }, data: { paidAmount, dueAmount } });
      }
    }
    if (supplierId) await tx.supplier.update({ where: { id: supplierId }, data: { balance: sign === 1 ? { decrement: amount } : { increment: amount } } });
  }
}

async function validateActionForPreview(user: AgentUser, action: AiActionType, parsed: any) {
  const permission = actionResource[action];
  if (!can(user.role, permission.resource, permission.action)) {
    return `Your ${user.role.toLowerCase()} role cannot ${permission.action} ${permission.resource}.`;
  }
  if (action === "create_category") {
    const existing = await prisma.category.findFirst({ where: { shopId: user.shopId, name: parsed.name }, select: { id: true } });
    if (existing) return `Category "${parsed.name}" already exists.`;
  }
  if (action === "update_category") {
    const existing = await prisma.category.findFirst({ where: { id: parsed.id, shopId: user.shopId }, select: { id: true } });
    if (!existing) return "Category not found.";
    if (parsed.changes.name) {
      const duplicate = await prisma.category.findFirst({ where: { shopId: user.shopId, name: parsed.changes.name, NOT: { id: parsed.id } }, select: { id: true } });
      if (duplicate) return `Category "${parsed.changes.name}" already exists.`;
    }
  }
  if (action === "create_product") {
    const sku = parsed.sku ? String(parsed.sku) : null;
    if (sku) {
      const existing = await prisma.product.findFirst({ where: { shopId: user.shopId, sku }, select: { id: true } });
      if (existing) return `SKU "${sku}" already exists.`;
    }
    if (parsed.categoryId) await resolveCategoryId(user, parsed.categoryId, null);
  }
  if (action === "update_product") {
    const existing = await prisma.product.findFirst({ where: { id: parsed.id, shopId: user.shopId }, select: { id: true, stockQty: true } });
    if (!existing) return "Product not found.";
    if (parsed.changes.categoryId) await resolveCategoryId(user, parsed.changes.categoryId, null);
  }
  if (action === "update_customer") {
    const existing = await prisma.customer.findFirst({ where: { id: parsed.id, shopId: user.shopId }, select: { id: true } });
    if (!existing) return "Customer not found.";
  }
  if (action === "update_supplier") {
    const existing = await prisma.supplier.findFirst({ where: { id: parsed.id, shopId: user.shopId }, select: { id: true } });
    if (!existing) return "Supplier not found.";
  }
  if (action === "create_payment" && !canUsePaymentDirection(user.role, parsed.direction)) {
    return "Your role can record customer receipts only. Supplier payouts are admin/manager actions.";
  }
  if (action === "create_staff" && !canCreateStaffRole(user.role, parsed.role)) {
    return "You cannot create a staff member with that role.";
  }
  if (action === "create_staff") {
    const existing = await prisma.user.findUnique({ where: { email: parsed.email }, select: { id: true } });
    if (existing) return "A user with that email already exists.";
  }
  if (action === "update_staff") {
    const target = await prisma.user.findFirst({ where: { id: parsed.id, shopId: user.shopId }, select: { id: true, role: true } });
    if (!target) return "Team member not found.";
    if (!canManageStaffMember(user.role, target.role, target.id, user.id)) return "You cannot manage this team member.";
    if (parsed.changes.role !== undefined && !canCreateStaffRole(user.role, parsed.changes.role)) return "You cannot assign that role.";
  }
  if (action === "create_payment") {
    await resolvePaymentLinks(user.shopId, parsed);
  }
  if (action === "create_invoice") {
    await resolveCustomerId(user.shopId, parsed.customerId, parsed.customerName);
    const resolvedItems = await Promise.all(parsed.items.map((item: any) => resolveProduct(user.shopId, item)));
    const demand = new Map<string, number>();
    for (const [index, product] of resolvedItems.entries()) demand.set(product.id, (demand.get(product.id) || 0) + parsed.items[index].quantity);
    for (const [productId, quantity] of demand) {
      const product = resolvedItems.find((item) => item.id === productId)!;
      if (product.stockQty < quantity) return `${product.name} has only ${product.stockQty} in stock.`;
    }
  }
  if (action === "create_purchase") {
    await resolveSupplierId(user.shopId, parsed.supplierId, parsed.supplierName);
    await Promise.all(parsed.items.map((item: any) => resolveProduct(user.shopId, item)));
  }
  if (action === "create_stock_adjustment") {
    await resolveStockAdjustment(user, parsed);
  }
  return null;
}

async function prepareBusinessAction(user: AgentUser, args: Record<string, unknown>) {
  const action = z.enum([
    "create_category",
    "update_category",
    "create_product",
    "update_product",
    "create_customer",
    "update_customer",
    "create_supplier",
    "update_supplier",
    "create_payment",
    "create_invoice",
    "create_purchase",
    "create_stock_adjustment",
    "create_staff",
    "update_staff"
  ]).parse(args.action);
  try {
    const payload = serializable(parseActionPayload(action, args.payload || {})) as Record<string, unknown>;
    const blockedReason = await validateActionForPreview(user, action, payload);
    if (blockedReason) return { ok: false, blocked: true, reason: blockedReason };
    const previewId = `${action}-${Date.now()}`;
    const reason = stringArg(args.reason);
    const pendingAction = { type: action, label: actionLabel(action), payload, previewId, reason };
    return {
      ok: true,
      requiresConfirmation: true,
      pendingAction,
      previewMarkdown: previewMarkdown(action, payload, reason)
    };
  } catch (error) {
    return {
      ok: false,
      requiresConfirmation: false,
      validationError: validationError(error),
      guidance: "Ask the user for the missing or invalid fields, or call a search/detail tool to resolve record ids before preparing the action."
    };
  }
}

async function searchBusinessRecords(user: AgentUser, args: Record<string, unknown>) {
  const entity = z.enum(["products", "customers", "suppliers", "invoices", "purchases", "payments", "staff"]).parse(args.entity);
  const query = stringArg(args.query);
  const limit = safeLimit(args.limit);
  const resource = entityResource[entity];
  if (!can(user.role, resource, "read")) return { ok: false, error: `Your role cannot read ${entity}.` };
  const search = query ? query : undefined;

  if (entity === "products") {
    const records = await prisma.product.findMany({
      where: {
        shopId: user.shopId,
        ...(search ? { OR: [{ name: contains(search) }, { sku: contains(search) }, { brand: contains(search) }] } : {})
      },
      include: { category: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: limit
    });
    return { ok: true, entity, records: serializable(records) };
  }

  if (entity === "customers") {
    const records = await prisma.customer.findMany({
      where: { shopId: user.shopId, ...(search ? { OR: [{ name: contains(search) }, { phone: contains(search) }, { email: contains(search) }] } : {}) },
      orderBy: [{ balance: "desc" }, { updatedAt: "desc" }],
      take: limit
    });
    return { ok: true, entity, records: serializable(records) };
  }

  if (entity === "suppliers") {
    const records = await prisma.supplier.findMany({
      where: { shopId: user.shopId, ...(search ? { OR: [{ name: contains(search) }, { phone: contains(search) }, { email: contains(search) }] } : {}) },
      orderBy: [{ balance: "desc" }, { updatedAt: "desc" }],
      take: limit
    });
    return { ok: true, entity, records: serializable(records) };
  }

  if (entity === "invoices") {
    const records = await prisma.invoice.findMany({
      where: { shopId: user.shopId, ...(search ? { OR: [{ invoiceNo: contains(search) }, { customer: { name: contains(search) } }] } : {}) },
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { invoiceDate: "desc" },
      take: limit
    });
    return { ok: true, entity, records: serializable(records) };
  }

  if (entity === "purchases") {
    const records = await prisma.purchase.findMany({
      where: { shopId: user.shopId, ...(search ? { OR: [{ purchaseNo: contains(search) }, { supplier: { name: contains(search) } }] } : {}) },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { purchaseDate: "desc" },
      take: limit
    });
    return { ok: true, entity, records: serializable(records) };
  }

  if (entity === "payments") {
    const records = await prisma.payment.findMany({
      where: {
        shopId: user.shopId,
        ...(canUsePaymentDirection(user.role, "SUPPLIER_OUT") ? {} : { direction: "CUSTOMER_IN" as const }),
        ...(search ? { OR: [{ reference: contains(search) }, { customer: { name: contains(search) } }, { supplier: { name: contains(search) } }] } : {})
      },
      include: { customer: true, supplier: true, invoice: true, purchase: true },
      orderBy: { paidAt: "desc" },
      take: limit
    });
    return { ok: true, entity, records: serializable(records) };
  }

  const records = await prisma.user.findMany({
    where: { shopId: user.shopId, ...(search ? { OR: [{ name: contains(search) }, { email: contains(search) }, { designation: contains(search) }] } : {}) },
    orderBy: { createdAt: "desc" },
    select: selectStaff,
    take: limit
  });
  return { ok: true, entity, records: serializable(records) };
}

async function getRecordDetails(user: AgentUser, args: Record<string, unknown>) {
  const entity = z.enum(["products", "customers", "suppliers", "invoices", "purchases", "payments", "staff"]).parse(args.entity);
  const id = z.string().min(1).parse(args.id);
  const resource = entityResource[entity];
  if (!can(user.role, resource, "read")) return { ok: false, error: `Your role cannot read ${entity}.` };

  if (entity === "products") {
    const record = await prisma.product.findFirst({ where: { id, shopId: user.shopId }, include: { category: true, movements: { orderBy: { movedAt: "desc" }, take: 12 } } });
    return { ok: Boolean(record), entity, record: serializable(record) };
  }
  if (entity === "customers") {
    const record = await prisma.customer.findFirst({ where: { id, shopId: user.shopId }, include: { invoices: { orderBy: { invoiceDate: "desc" }, take: 12 }, payments: { orderBy: { paidAt: "desc" }, take: 12 } } });
    return { ok: Boolean(record), entity, record: serializable(record) };
  }
  if (entity === "suppliers") {
    const record = await prisma.supplier.findFirst({ where: { id, shopId: user.shopId }, include: { purchases: { orderBy: { purchaseDate: "desc" }, take: 12 }, payments: { orderBy: { paidAt: "desc" }, take: 12 } } });
    return { ok: Boolean(record), entity, record: serializable(record) };
  }
  if (entity === "invoices") {
    const record = await prisma.invoice.findFirst({ where: { id, shopId: user.shopId }, include: { customer: true, items: { include: { product: true } }, payments: { orderBy: { paidAt: "desc" } } } });
    return { ok: Boolean(record), entity, record: serializable(record) };
  }
  if (entity === "purchases") {
    const record = await prisma.purchase.findFirst({ where: { id, shopId: user.shopId }, include: { supplier: true, items: { include: { product: true } }, payments: { orderBy: { paidAt: "desc" } } } });
    return { ok: Boolean(record), entity, record: serializable(record) };
  }
  if (entity === "payments") {
    const record = await prisma.payment.findFirst({
      where: { id, shopId: user.shopId, ...(canUsePaymentDirection(user.role, "SUPPLIER_OUT") ? {} : { direction: "CUSTOMER_IN" as const }) },
      include: { customer: true, supplier: true, invoice: true, purchase: true, createdBy: { select: selectStaff } }
    });
    return { ok: Boolean(record), entity, record: serializable(record) };
  }
  const record = await prisma.user.findFirst({ where: { id, shopId: user.shopId }, select: selectStaff });
  return { ok: Boolean(record), entity, record: serializable(record) };
}

async function getLiveSnapshot(user: AgentUser) {
  const snapshot = await getDashboardSnapshot(user.shopId, user.role);
  return {
    ok: true,
    shop: user.shop?.name,
    currency: user.shop?.currency || "PKR",
    role: user.role,
    metrics: snapshot.metrics,
    lowStock: snapshot.lowStock.map((product) => ({ id: product.id, name: product.name, sku: product.sku, stockQty: product.stockQty, reorderLevel: product.reorderLevel, reorderQuantity: product.reorderQuantity })),
    topCustomerDues: snapshot.customers.map((customer) => ({ id: customer.id, name: customer.name, balance: customer.balance })),
    topSupplierDues: canReadSupplierCashflow(user.role) ? snapshot.suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, balance: supplier.balance, reliabilityScore: supplier.reliabilityScore })) : [],
    charts: snapshot.charts
  };
}

async function getSalesSummary(user: AgentUser, args: Record<string, unknown>) {
  if (!can(user.role, "invoices", "read")) return { ok: false, error: "Your role cannot read invoices." };
  const data = salesSummarySchema.parse(args);
  const { start, end } = buildDateRange(data.startDate, data.endDate);
  const customerId = await resolveCustomerId(user.shopId, data.customerId, data.customerName);
  const where = {
    shopId: user.shopId,
    invoiceDate: { gte: start, lte: end },
    ...(customerId ? { customerId } : {})
  };

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { invoiceDate: "asc" }
    }),
    prisma.payment.findMany({
      where: {
        shopId: user.shopId,
        direction: "CUSTOMER_IN",
        paidAt: { gte: start, lte: end },
        ...(customerId ? { customerId } : {})
      },
      include: { customer: true, invoice: true },
      orderBy: { paidAt: "asc" }
    })
  ]);

  const grossSales = invoices.reduce((sum, invoice) => sum + n(invoice.total), 0);
  const discounts = invoices.reduce((sum, invoice) => sum + n(invoice.discount), 0);
  const taxes = invoices.reduce((sum, invoice) => sum + n(invoice.tax), 0);
  const invoicePaidAmount = invoices.reduce((sum, invoice) => sum + n(invoice.paidAmount), 0);
  const invoiceDueAmount = invoices.reduce((sum, invoice) => sum + n(invoice.dueAmount), 0);
  const cashReceived = payments.reduce((sum, payment) => sum + n(payment.amount), 0);
  const grossProfit = invoices.reduce(
    (sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + (n(item.unitPrice) - n(item.costPrice)) * item.quantity, 0),
    0
  );
  const itemsSold = invoices.reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const topProducts = new Map<string, { id: string; sku: string; name: string; quantity: number; sales: number; grossProfit: number }>();
  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const current = topProducts.get(item.productId) || {
        id: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        quantity: 0,
        sales: 0,
        grossProfit: 0
      };
      current.quantity += item.quantity;
      current.sales += n(item.total);
      current.grossProfit += (n(item.unitPrice) - n(item.costPrice)) * item.quantity;
      topProducts.set(item.productId, current);
    }
  }

  return {
    ok: true,
    scope: customerId ? "customer" : "shop",
    customerId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    invoiceCount: invoices.length,
    paymentCount: payments.length,
    grossSales,
    grossProfit,
    discounts,
    taxes,
    invoicePaidAmount,
    invoiceDueAmount,
    cashReceived,
    itemsSold,
    averageInvoiceValue: invoices.length ? grossSales / invoices.length : 0,
    topProducts: [...topProducts.values()].sort((a, b) => b.sales - a.sales).slice(0, 8),
    invoices: invoices.slice(0, 12).map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      customer: invoice.customer?.name,
      status: invoice.status,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      dueAmount: invoice.dueAmount,
      invoiceDate: invoice.invoiceDate
    }))
  };
}

async function getCustomerBalanceSummary(user: AgentUser, args: Record<string, unknown>) {
  if (!can(user.role, "customers", "read")) return { ok: false, error: "Your role cannot read customers." };
  const data = customerBalanceSummarySchema.parse(args);
  const customerId = await resolveCustomerId(user.shopId, data.customerId, data.customerName);
  if (!customerId) return { ok: false, error: "Customer not found." };
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, shopId: user.shopId },
    include: {
      invoices: { orderBy: { invoiceDate: "desc" }, take: 30 },
      payments: { orderBy: { paidAt: "desc" }, take: 30 }
    }
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  const outstandingInvoices = customer.invoices.filter((invoice) => n(invoice.dueAmount) > 0);
  const totalInvoiced = customer.invoices.reduce((sum, invoice) => sum + n(invoice.total), 0);
  const totalInvoicePaid = customer.invoices.reduce((sum, invoice) => sum + n(invoice.paidAmount), 0);
  const recentPaymentTotal = customer.payments.reduce((sum, payment) => sum + n(payment.amount), 0);

  return {
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      creditLimit: customer.creditLimit,
      currentPendingBalance: customer.balance,
      availableCredit: Math.max(n(customer.creditLimit) - Math.max(n(customer.balance), 0), 0)
    },
    totalsFromRecentLedger: {
      totalInvoiced,
      totalInvoicePaid,
      recentPaymentTotal,
      outstandingInvoiceCount: outstandingInvoices.length,
      outstandingInvoiceAmount: outstandingInvoices.reduce((sum, invoice) => sum + n(invoice.dueAmount), 0)
    },
    outstandingInvoices: outstandingInvoices.slice(0, 12).map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      status: invoice.status,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      dueAmount: invoice.dueAmount,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate
    })),
    recentPayments: customer.payments.slice(0, 10).map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: payment.amount,
      paidAt: payment.paidAt,
      reference: payment.reference
    }))
  };
}

async function runOperatingJob(user: AgentUser, args: Record<string, unknown>) {
  const job = z.enum(["reorder_plan", "collections_plan", "cashflow_risk", "sales_quality_review", "stock_audit"]).parse(args.job) as OperatingJob;
  const limit = safeLimit(args.limit, 8, 20);
  const snapshot = await getDashboardSnapshot(user.shopId, user.role);

  if (job === "reorder_plan") {
    const lowStock = snapshot.lowStock.slice(0, limit).map((product) => {
      const velocity = snapshot.fastMoving.find((item) => item.name === product.name)?.qty || 0;
      const suggestedQty = Math.max(product.reorderQuantity, product.reorderLevel * 3, velocity ? Math.ceil(velocity * 1.5) : 0);
      return { id: product.id, sku: product.sku, name: product.name, stockQty: product.stockQty, reorderLevel: product.reorderLevel, reorderQuantity: product.reorderQuantity, suggestedQty, salePrice: product.salePrice, costPrice: product.costPrice };
    });
    return { ok: true, job, generatedAt: new Date().toISOString(), records: serializable(lowStock) };
  }

  if (job === "collections_plan") {
    const customers = await prisma.customer.findMany({
      where: { shopId: user.shopId, balance: { gt: 0 } },
      include: { invoices: { where: { dueAmount: { gt: 0 } }, orderBy: { dueAmount: "desc" }, take: 5 } },
      orderBy: { balance: "desc" },
      take: limit
    });
    return { ok: true, job, generatedAt: new Date().toISOString(), records: serializable(customers) };
  }

  if (job === "cashflow_risk") {
    const response = {
      receivables: snapshot.metrics.customerDues,
      supplierPayables: canReadSupplierCashflow(user.role) ? snapshot.metrics.supplierDues : null,
      todaySales: snapshot.metrics.todaySales,
      monthlyRevenue: snapshot.metrics.monthlyRevenue,
      recentCashflow: snapshot.charts.cashflowTimeline,
      visibleScope: canReadSupplierCashflow(user.role) ? "customer and supplier cashflow" : "customer cashflow only"
    };
    return { ok: true, job, generatedAt: new Date().toISOString(), records: serializable(response) };
  }

  if (job === "sales_quality_review") {
    const invoices = await prisma.invoice.findMany({
      where: { shopId: user.shopId },
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { invoiceDate: "desc" },
      take: limit
    });
    const records = invoices.map((invoice) => {
      const grossMargin = invoice.items.reduce((sum, item) => sum + (Number(item.unitPrice) - Number(item.costPrice)) * item.quantity, 0);
      return { id: invoice.id, invoiceNo: invoice.invoiceNo, customer: invoice.customer?.name, total: invoice.total, dueAmount: invoice.dueAmount, grossMargin, status: invoice.status, invoiceDate: invoice.invoiceDate };
    });
    return { ok: true, job, generatedAt: new Date().toISOString(), records: serializable(records) };
  }

  const products = await prisma.product.findMany({
    where: { shopId: user.shopId, status: "ACTIVE" },
    include: { category: true, movements: { orderBy: { movedAt: "desc" }, take: 3 } },
    orderBy: [{ stockQty: "asc" }, { updatedAt: "desc" }],
    take: limit
  });
  return { ok: true, job, generatedAt: new Date().toISOString(), records: serializable(products) };
}

async function getProductPerformance(user: AgentUser, args: Record<string, unknown>) {
  if (!can(user.role, "products", "read") || !can(user.role, "invoices", "read")) return { ok: false, error: "Your role cannot read product performance." };
  const data = productPerformanceSchema.parse(args);
  const end = endOfDay(data.endDate || new Date());
  const start = startOfDay(data.startDate || subDays(end, 29));
  const limit = safeLimit(data.limit, 8, 20);
  const productFilter = data.productId
    ? { id: data.productId }
    : data.productSku
      ? { sku: data.productSku }
      : data.productName
        ? { name: contains(data.productName) }
        : {};

  const items = await prisma.invoiceItem.findMany({
    where: {
      invoice: { shopId: user.shopId, invoiceDate: { gte: start, lte: end }, status: { not: "CANCELLED" } },
      product: { shopId: user.shopId, ...productFilter }
    },
    include: { product: { include: { category: true } }, invoice: { select: { id: true, invoiceNo: true, invoiceDate: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 600
  });

  const products = new Map<string, {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    quantitySold: number;
    revenue: number;
    grossProfit: number;
    invoiceCount: Set<string>;
    currentStock: number;
    reorderLevel: number;
    reorderQuantity: number;
    stockoutRisk: string;
  }>();

  for (const item of items) {
    const current = products.get(item.productId) || {
      id: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      category: item.product.category?.name || null,
      quantitySold: 0,
      revenue: 0,
      grossProfit: 0,
      invoiceCount: new Set<string>(),
      currentStock: item.product.stockQty,
      reorderLevel: item.product.reorderLevel,
      reorderQuantity: item.product.reorderQuantity,
      stockoutRisk: item.product.stockQty <= item.product.reorderLevel ? "HIGH" : item.product.stockQty <= item.product.reorderLevel * 2 ? "MEDIUM" : "LOW"
    };
    current.quantitySold += item.quantity;
    current.revenue += n(item.total);
    current.grossProfit += (n(item.unitPrice) - n(item.costPrice)) * item.quantity;
    current.invoiceCount.add(item.invoiceId);
    products.set(item.productId, current);
  }

  const rows = [...products.values()]
    .map((product) => ({
      ...product,
      invoiceCount: product.invoiceCount.size,
      averageSellingPrice: product.quantitySold ? product.revenue / product.quantitySold : 0,
      grossMarginPercent: product.revenue ? Math.round((product.grossProfit / product.revenue) * 10000) / 100 : 0,
      suggestedReorderQty: product.stockoutRisk === "HIGH" ? Math.max(product.reorderQuantity, product.quantitySold) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return {
    ok: true,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    productScope: data.productId || data.productSku || data.productName || "all products",
    totals: {
      productCount: rows.length,
      quantitySold: rows.reduce((sum, row) => sum + row.quantitySold, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      grossProfit: rows.reduce((sum, row) => sum + row.grossProfit, 0)
    },
    records: serializable(rows)
  };
}

async function getCustomerCreditRisk(user: AgentUser, args: Record<string, unknown>) {
  if (!can(user.role, "customers", "read") || !can(user.role, "invoices", "read")) return { ok: false, error: "Your role cannot read customer credit risk." };
  const data = customerCreditRiskSchema.parse(args);
  const limit = safeLimit(data.limit, 10, 30);
  const minimumBalance = n(data.minimumBalance);
  const now = new Date();
  const customers = await prisma.customer.findMany({
    where: { shopId: user.shopId, balance: { gt: minimumBalance } },
    include: {
      invoices: { where: { dueAmount: { gt: 0 } }, orderBy: [{ dueDate: "asc" }, { invoiceDate: "asc" }], take: 10 },
      payments: { orderBy: { paidAt: "desc" }, take: 1 }
    },
    orderBy: { balance: "desc" },
    take: limit
  });

  const records = customers.map((customer) => {
    const overdueInvoices = customer.invoices.filter((invoice) => invoice.dueDate && invoice.dueDate < now);
    const oldestDueDate = customer.invoices.map((invoice) => invoice.dueDate || invoice.invoiceDate).sort((a, b) => a.getTime() - b.getTime())[0] || null;
    const daysOld = oldestDueDate ? Math.max(0, Math.floor((now.getTime() - oldestDueDate.getTime()) / 86_400_000)) : 0;
    const creditUsePercent = n(customer.creditLimit) > 0 ? Math.round((n(customer.balance) / n(customer.creditLimit)) * 100) : null;
    const riskScore = Math.min(100, Math.round((n(customer.balance) / Math.max(n(customer.creditLimit), n(customer.balance), 1)) * 55 + Math.min(daysOld, 60) * 0.55 + overdueInvoices.length * 7));
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      balance: customer.balance,
      creditLimit: customer.creditLimit,
      creditUsePercent,
      riskScore,
      riskLevel: riskScore >= 75 ? "HIGH" : riskScore >= 45 ? "MEDIUM" : "LOW",
      overdueInvoiceCount: overdueInvoices.length,
      outstandingInvoiceCount: customer.invoices.length,
      oldestDueDate,
      lastPaymentAt: customer.payments[0]?.paidAt || null,
      recommendedAction: riskScore >= 75 ? "Call before next credit sale and collect partial payment." : riskScore >= 45 ? "Send reminder and monitor next purchase." : "Normal follow-up."
    };
  });

  return { ok: true, generatedAt: now.toISOString(), records: serializable(records.sort((a, b) => b.riskScore - a.riskScore)) };
}

async function buildBusinessReport(user: AgentUser, args: Record<string, unknown>) {
  if (!can(user.role, "reports", "read")) return { ok: false, error: "Your role cannot generate PDF reports." };
  const data = businessReportSchema.parse(args);
  const reportType = normalizeReportType(data.reportType);
  const limit = safeLimit(data.limit, 8, 20);
  const end = endOfDay(data.endDate || new Date());
  const start = startOfDay(data.startDate || (reportType === "daily_summary" ? end : subDays(end, 29)));
  const [snapshot, salesSummary, creditRisk, productPerformance] = await Promise.all([
    getDashboardSnapshot(user.shopId, user.role),
    getSalesSummary(user, { startDate: start, endDate: end }),
    getCustomerCreditRisk(user, { limit }),
    getProductPerformance(user, { startDate: start, endDate: end, limit })
  ]);
  const downloadUrl = buildReportDownloadUrl({ reportType, startDate: start, endDate: end, limit, source: "ai" });
  const filename = `${reportFileSlug(reportType)}-report.pdf`;

  const report: Record<string, unknown> = {
    reportType,
    generatedAt: new Date().toISOString(),
    range: { startDate: start.toISOString(), endDate: end.toISOString() },
    shop: user.shop?.name,
    currency: user.shop?.currency || "PKR",
    metrics: snapshot.metrics,
    sales: salesSummary,
    customerCreditRisk: creditRisk,
    productPerformance
  };

  if (["inventory_report", "stock_movement_report", "business_insight_report", "full_business_review", "daily_summary", "general"].includes(reportType)) {
    report.inventory = {
      lowStock: snapshot.lowStock.slice(0, limit).map((product) => ({ id: product.id, sku: product.sku, name: product.name, stockQty: product.stockQty, reorderLevel: product.reorderLevel, reorderQuantity: product.reorderQuantity })),
      fastMoving: snapshot.fastMoving.slice(0, limit),
      slowMoving: snapshot.slowMoving.slice(0, limit),
      categoryValue: snapshot.charts.categoryValue,
      recentMovements: snapshot.movements.slice(0, limit)
    };
  }

  if (["customer_report", "dues_report", "business_insight_report", "full_business_review", "daily_summary", "general"].includes(reportType)) {
    report.dues = {
      customerDues: snapshot.metrics.customerDues,
      topCustomers: snapshot.customers.slice(0, limit).map((customer) => ({ id: customer.id, name: customer.name, balance: customer.balance, phone: customer.phone }))
    };
  }

  if (reportType === "supplier_report" || reportType === "full_business_review" || reportType === "general") {
    report.suppliers = canReadSupplierCashflow(user.role)
      ? {
          supplierDues: snapshot.metrics.supplierDues,
          topSuppliers: snapshot.suppliers.slice(0, limit).map((supplier) => ({ id: supplier.id, name: supplier.name, balance: supplier.balance, reliabilityScore: supplier.reliabilityScore })),
          purchaseStatus: snapshot.charts.purchaseStatus
        }
      : { hidden: true, reason: "Your role cannot read supplier cashflow." };
  }

  await prisma.activityLog.create({
    data: {
      shopId: user.shopId,
      userId: user.id,
      type: "AI_PDF_REPORT_GENERATED",
      title: `${reportLabel(reportType)} PDF report generated`,
      details: `${reportLabel(reportType)} report prepared by ShopIQ Copilot for ${reportRangeLabel(start, end)}.`,
      metadata: { reportType, reportDownloadUrl: downloadUrl, source: "ai", startDate: start.toISOString(), endDate: end.toISOString(), filename }
    }
  });

  return {
    ok: true,
    report: serializable(report),
    pdf: {
      url: downloadUrl,
      filename,
      label: `${reportLabel(reportType)} PDF`,
      reportType,
      range: reportRangeLabel(start, end)
    }
  };
}

async function executeCreateCategory(user: AgentUser, payload: unknown) {
  const data = categoryCreateSchema.parse(payload);
  const existing = await prisma.category.findFirst({ where: { shopId: user.shopId, name: data.name }, select: { id: true } });
  if (existing) throw new Error(`Category "${data.name}" already exists.`);
  const category = await prisma.category.create({ data: { shopId: user.shopId, name: data.name, color: data.color || "emerald" } });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_CATEGORY_CREATED", title: `AI created category: ${category.name}` } });
  return { answer: `## Category Created\n\n**${category.name}** has been added to your product categories.`, action: { label: "Open Inventory", href: workspacePath(user.role, "products") } };
}

async function executeUpdateCategory(user: AgentUser, payload: unknown) {
  const data = categoryUpdateSchema.parse(payload);
  const category = await prisma.category.update({ where: { id: data.id }, data: emptyToUndefined(data.changes) });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_CATEGORY_UPDATED", title: `AI updated category: ${category.name}` } });
  return { answer: `## Category Updated\n\n**${category.name}** has been updated.`, action: { label: "Open Inventory", href: workspacePath(user.role, "products") } };
}

async function executeCreateProduct(user: AgentUser, payload: unknown) {
  const data = productCreateSchema.parse(payload);
  const categoryId = await resolveCategoryId(user, data.categoryId, data.categoryName);
  const sku = data.sku || `SKU-${Date.now()}`;
  const existing = await prisma.product.findFirst({ where: { shopId: user.shopId, sku }, select: { id: true } });
  if (existing) throw new Error(`SKU "${sku}" already exists.`);
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        shopId: user.shopId,
        sku,
        barcode: data.barcode,
        name: data.name,
        brand: data.brand,
        unit: data.unit || "pcs",
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        stockQty: data.stockQty,
        reorderLevel: data.reorderLevel,
        reorderQuantity: data.reorderQuantity || Math.max(data.reorderLevel * 3, 10),
        location: data.location,
        categoryId
      },
      include: { category: true }
    });
    if (created.stockQty > 0) {
      await tx.stockMovement.create({ data: { shopId: user.shopId, productId: created.id, userId: user.id, type: "OPENING", quantity: created.stockQty, beforeQty: 0, afterQty: created.stockQty, reference: "AI_OPENING", notes: "Opening stock entered by ShopIQ AI after user confirmation." } });
    }
    await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_PRODUCT_CREATED", title: `AI created product: ${created.name}`, details: `${created.stockQty} ${created.unit} in stock` } });
    return created;
  });
  return {
    answer: `## Product Created\n\n**${product.name}** is now in inventory.\n\n- SKU: ${product.sku}\n- Stock: ${product.stockQty}\n- Sale price: ${moneyLabel(product.salePrice)}`,
    action: { label: "Open Inventory", href: workspacePath(user.role, "products") }
  };
}

async function executeUpdateProduct(user: AgentUser, payload: unknown) {
  const data = productUpdateSchema.parse(payload);
  const existing = await prisma.product.findFirst({ where: { id: data.id, shopId: user.shopId } });
  if (!existing) throw new Error("Product not found.");
  const updateData: Record<string, unknown> = emptyToUndefined({ ...data.changes });
  const categoryName = typeof updateData.categoryName === "string" ? updateData.categoryName : null;
  delete updateData.categoryName;
  if (categoryName || updateData.categoryId) updateData.categoryId = await resolveCategoryId(user, updateData.categoryId as string | undefined, categoryName);
  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id: existing.id }, data: updateData, include: { category: true } });
    if (data.changes.stockQty !== undefined && data.changes.stockQty !== existing.stockQty) {
      const delta = data.changes.stockQty - existing.stockQty;
      await tx.stockMovement.create({ data: { shopId: user.shopId, productId: existing.id, userId: user.id, type: "ADJUSTMENT", quantity: delta, beforeQty: existing.stockQty, afterQty: data.changes.stockQty, reference: "AI_PRODUCT_EDIT", notes: "Stock adjusted by ShopIQ AI after user confirmation." } });
    }
    await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_PRODUCT_UPDATED", title: `AI updated product: ${updated.name}` } });
    return updated;
  });
  return { answer: `## Product Updated\n\n**${product.name}** has been updated.`, action: { label: "Open Inventory", href: workspacePath(user.role, "products") } };
}

async function executeCreateCustomer(user: AgentUser, payload: unknown) {
  const data = customerCreateSchema.parse(payload);
  const customer = await prisma.customer.create({ data: { shopId: user.shopId, ...data } });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_CUSTOMER_CREATED", title: `AI created customer: ${customer.name}` } });
  return { answer: `## Customer Created\n\n**${customer.name}** has been added to your customer list.`, action: { label: "Open Customers", href: workspacePath(user.role, "customers") } };
}

async function executeUpdateCustomer(user: AgentUser, payload: unknown) {
  const data = customerUpdateSchema.parse(payload);
  const result = await prisma.customer.updateMany({ where: { id: data.id, shopId: user.shopId }, data: emptyToUndefined(data.changes) });
  if (!result.count) throw new Error("Customer not found.");
  const customer = await prisma.customer.findFirst({ where: { id: data.id, shopId: user.shopId } });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_CUSTOMER_UPDATED", title: `AI updated customer: ${customer?.name || data.id}` } });
  return { answer: `## Customer Updated\n\n**${customer?.name || "Customer"}** has been updated.`, action: { label: "Open Customers", href: workspacePath(user.role, "customers") } };
}

async function executeCreateSupplier(user: AgentUser, payload: unknown) {
  const data = supplierCreateSchema.parse(payload);
  const supplier = await prisma.supplier.create({ data: { shopId: user.shopId, ...data, reliabilityScore: clamp(data.reliabilityScore, 0, 100) } });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_SUPPLIER_CREATED", title: `AI created supplier: ${supplier.name}` } });
  return { answer: `## Supplier Created\n\n**${supplier.name}** has been added to your supplier list.`, action: { label: "Open Suppliers", href: workspacePath(user.role, "suppliers") } };
}

async function executeUpdateSupplier(user: AgentUser, payload: unknown) {
  const data = supplierUpdateSchema.parse(payload);
  const changes = emptyToUndefined({ ...data.changes, reliabilityScore: data.changes.reliabilityScore === undefined ? undefined : clamp(data.changes.reliabilityScore, 0, 100) });
  const result = await prisma.supplier.updateMany({ where: { id: data.id, shopId: user.shopId }, data: changes });
  if (!result.count) throw new Error("Supplier not found.");
  const supplier = await prisma.supplier.findFirst({ where: { id: data.id, shopId: user.shopId } });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_SUPPLIER_UPDATED", title: `AI updated supplier: ${supplier?.name || data.id}` } });
  return { answer: `## Supplier Updated\n\n**${supplier?.name || "Supplier"}** has been updated.`, action: { label: "Open Suppliers", href: workspacePath(user.role, "suppliers") } };
}

async function executeCreatePayment(user: AgentUser, payload: unknown) {
  const data = paymentCreateSchema.parse(payload);
  const resolved = await resolvePaymentLinks(user.shopId, data);
  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        shopId: user.shopId,
        createdById: user.id,
        direction: resolved.direction,
        method: resolved.method,
        amount: resolved.amount,
        customerId: resolved.customerId,
        supplierId: resolved.supplierId,
        invoiceId: resolved.invoiceId,
        purchaseId: resolved.purchaseId,
        paidAt: resolved.paidAt,
        reference: resolved.reference,
        notes: resolved.notes
      },
      include: { customer: true, supplier: true, invoice: true, purchase: true }
    });
    await applyPaymentEffect(tx, user.shopId, created, 1);
    await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_PAYMENT_RECORDED", title: "AI recorded payment", details: `${moneyLabel(created.amount)} via ${created.method}` } });
    return created;
  });
  return { answer: `## Payment Recorded\n\n${moneyLabel(payment.amount)} was recorded via **${payment.method.replace(/_/g, " ")}**.`, action: { label: "Open Payments", href: workspacePath(user.role, "payments") } };
}

async function executeCreateInvoice(user: AgentUser, payload: unknown) {
  const data = invoiceCreateSchema.parse(payload);
  const customerId = await resolveCustomerId(user.shopId, data.customerId, data.customerName);
  const resolvedItems = await Promise.all(data.items.map(async (item) => ({ ...item, product: await resolveProduct(user.shopId, item) })));
  const demand = new Map<string, number>();
  for (const item of resolvedItems) demand.set(item.product.id, (demand.get(item.product.id) || 0) + item.quantity);
  for (const [productId, quantity] of demand) {
    const product = resolvedItems.find((item) => item.product.id === productId)!.product;
    if (product.stockQty < quantity) throw new Error(`${product.name} has only ${product.stockQty} in stock.`);
  }
  const subtotal = resolvedItems.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice ?? item.product.salePrice), 0);
  const total = Math.max(subtotal - data.discount + data.tax, 0);
  const paid = Math.min(data.paidAmount, total);
  const due = Math.max(total - paid, 0);
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        shopId: user.shopId,
        customerId,
        createdById: user.id,
        invoiceNo: data.invoiceNo || `INV-${Date.now()}`,
        subtotal,
        discount: data.discount,
        tax: data.tax,
        total,
        paidAmount: paid,
        dueAmount: due,
        status: invoiceStatus(total, paid),
        dueDate: data.dueDate,
        notes: data.notes,
        items: {
          create: resolvedItems.map((item) => {
            const unitPrice = Number(item.unitPrice ?? item.product.salePrice);
            return { productId: item.product.id, quantity: item.quantity, unitPrice, costPrice: item.product.costPrice, total: item.quantity * unitPrice };
          })
        }
      },
      include: { customer: true, items: { include: { product: true } } }
    });
    const runningStock = new Map(resolvedItems.map((item) => [item.product.id, item.product.stockQty]));
    for (const item of resolvedItems) {
      const beforeQty = runningStock.get(item.product.id)!;
      const afterQty = beforeQty - item.quantity;
      runningStock.set(item.product.id, afterQty);
      await tx.product.update({ where: { id: item.product.id }, data: { stockQty: { decrement: item.quantity } } });
      await tx.stockMovement.create({ data: { shopId: user.shopId, productId: item.product.id, userId: user.id, type: "SALE", quantity: -item.quantity, beforeQty, afterQty, reference: inv.invoiceNo, notes: "Invoice sale created by ShopIQ AI after user confirmation." } });
    }
    if (customerId && due > 0) await tx.customer.update({ where: { id: customerId }, data: { balance: { increment: due } } });
    await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_INVOICE_CREATED", title: `AI created invoice ${inv.invoiceNo}`, details: moneyLabel(total) } });
    return inv;
  });
  return { answer: `## Invoice Created\n\nInvoice **${invoice.invoiceNo}** has been created for ${moneyLabel(invoice.total)}.`, action: { label: "Open Billing", href: workspacePath(user.role, "billing") } };
}

async function executeCreatePurchase(user: AgentUser, payload: unknown) {
  const data = purchaseCreateSchema.parse(payload);
  const supplierId = await resolveSupplierId(user.shopId, data.supplierId, data.supplierName);
  const resolvedItems = await Promise.all(data.items.map(async (item) => ({ ...item, product: await resolveProduct(user.shopId, item) })));
  const total = resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const paid = Math.min(data.paidAmount, total);
  const due = Math.max(total - paid, 0);
  const purchase = await prisma.$transaction(async (tx) => {
    const pur = await tx.purchase.create({
      data: {
        shopId: user.shopId,
        supplierId,
        createdById: user.id,
        purchaseNo: data.purchaseNo || `PUR-${Date.now()}`,
        subtotal: total,
        total,
        paidAmount: paid,
        dueAmount: due,
        status: "RECEIVED",
        purchaseDate: data.purchaseDate,
        notes: data.notes,
        items: { create: resolvedItems.map((item) => ({ productId: item.product.id, quantity: item.quantity, unitCost: item.unitCost, total: item.quantity * item.unitCost })) }
      },
      include: { supplier: true, items: { include: { product: true } } }
    });
    const runningStock = new Map(resolvedItems.map((item) => [item.product.id, item.product.stockQty]));
    for (const item of resolvedItems) {
      const beforeQty = runningStock.get(item.product.id)!;
      const afterQty = beforeQty + item.quantity;
      runningStock.set(item.product.id, afterQty);
      await tx.product.update({ where: { id: item.product.id }, data: { stockQty: { increment: item.quantity }, costPrice: item.unitCost } });
      await tx.stockMovement.create({ data: { shopId: user.shopId, productId: item.product.id, userId: user.id, type: "PURCHASE", quantity: item.quantity, beforeQty, afterQty, reference: pur.purchaseNo, notes: "Purchase received by ShopIQ AI after user confirmation." } });
    }
    if (supplierId && due > 0) await tx.supplier.update({ where: { id: supplierId }, data: { balance: { increment: due } } });
    await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_PURCHASE_CREATED", title: `AI created purchase ${pur.purchaseNo}`, details: moneyLabel(total) } });
    return pur;
  });
  return { answer: `## Purchase Created\n\nPurchase **${purchase.purchaseNo}** has been received for ${moneyLabel(purchase.total)}.`, action: { label: "Open Purchases", href: workspacePath(user.role, "purchases") } };
}

async function executeCreateStockAdjustment(user: AgentUser, payload: unknown) {
  const data = stockAdjustmentSchema.parse(payload);
  const resolved = await resolveStockAdjustment(user, data);
  const movement = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: resolved.product.id }, data: { stockQty: resolved.afterQty } });
    const created = await tx.stockMovement.create({
      data: {
        shopId: user.shopId,
        productId: resolved.product.id,
        userId: user.id,
        type: data.movementType,
        quantity: resolved.movementQuantity,
        beforeQty: resolved.beforeQty,
        afterQty: resolved.afterQty,
        reference: data.reference || `AI-ADJ-${Date.now()}`,
        notes: data.notes || "Stock adjusted by ShopIQ AI after user confirmation."
      }
    });
    await tx.activityLog.create({
      data: {
        shopId: user.shopId,
        userId: user.id,
        type: "AI_STOCK_ADJUSTMENT",
        title: `AI adjusted stock: ${resolved.product.name}`,
        details: `${resolved.beforeQty} -> ${resolved.afterQty}`
      }
    });
    return created;
  });
  return {
    answer: `## Stock Adjusted\n\n**${resolved.product.name}** stock changed from **${resolved.beforeQty}** to **${resolved.afterQty}**.\n\nMovement: **${movement.type}** (${resolved.movementQuantity > 0 ? "+" : ""}${resolved.movementQuantity}).`,
    action: { label: "Open Inventory", href: workspacePath(user.role, "products") }
  };
}

async function executeCreateStaff(user: AgentUser, payload: unknown) {
  const data = staffCreateSchema.parse(payload);
  if (!canCreateStaffRole(user.role, data.role)) throw new Error("You cannot create a member with that role.");
  const generatedPassword = data.password || `ShopIQ-${Math.random().toString(36).slice(2, 8)}!`;
  const passwordHash = await bcrypt.hash(generatedPassword, 12);
  const staff = await prisma.user.create({
    data: { shopId: user.shopId, name: data.name, email: data.email, passwordHash, role: data.role, status: data.status, designation: data.designation, phone: data.phone },
    select: selectStaff
  });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_STAFF_CREATED", title: `AI created team member: ${staff.name}`, details: `${staff.role} access created` } });
  return {
    answer: `## Staff Member Created\n\n**${staff.name}** has been added as **${staff.role}**.\n\nTemporary password: \`${generatedPassword}\`\n\nAsk them to change it after first login.`,
    action: { label: "Open Staff", href: workspacePath(user.role, "staff") }
  };
}

async function executeUpdateStaff(user: AgentUser, payload: unknown) {
  const data = staffUpdateSchema.parse(payload);
  const target = await prisma.user.findFirst({ where: { id: data.id, shopId: user.shopId }, select: { id: true, role: true } });
  if (!target) throw new Error("Team member not found.");
  if (!canManageStaffMember(user.role, target.role, target.id, user.id)) throw new Error("You cannot manage this team member.");
  if (data.changes.role !== undefined && !canCreateStaffRole(user.role, data.changes.role)) throw new Error("You cannot assign that role.");
  const updateData: Record<string, unknown> = emptyToUndefined({ ...data.changes });
  if (data.changes.password) updateData.passwordHash = await bcrypt.hash(data.changes.password, 12);
  delete updateData.password;
  const staff = await prisma.user.update({ where: { id: data.id }, data: updateData, select: selectStaff });
  await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "AI_STAFF_UPDATED", title: `AI updated team member: ${staff.name}` } });
  return { answer: `## Staff Member Updated\n\n**${staff.name}** has been updated.`, action: { label: "Open Staff", href: workspacePath(user.role, "staff") } };
}

export async function executePendingAiAction(user: AgentUser, action: AiActionType, payload: Record<string, unknown>) {
  const permission = actionResource[action];
  if (!can(user.role, permission.resource, permission.action)) {
    return { answer: `## Permission Needed\n\nYour role cannot ${permission.action} ${permission.resource}.`, action: null };
  }
  if (action === "create_payment") {
    const parsed = paymentCreateSchema.parse(payload);
    if (!canUsePaymentDirection(user.role, parsed.direction)) return { answer: "## Permission Needed\n\nYour role can record customer receipts only.", action: null };
  }

  switch (action) {
    case "create_category":
      return executeCreateCategory(user, payload);
    case "update_category":
      return executeUpdateCategory(user, payload);
    case "create_product":
      return executeCreateProduct(user, payload);
    case "update_product":
      return executeUpdateProduct(user, payload);
    case "create_customer":
      return executeCreateCustomer(user, payload);
    case "update_customer":
      return executeUpdateCustomer(user, payload);
    case "create_supplier":
      return executeCreateSupplier(user, payload);
    case "update_supplier":
      return executeUpdateSupplier(user, payload);
    case "create_payment":
      return executeCreatePayment(user, payload);
    case "create_invoice":
      return executeCreateInvoice(user, payload);
    case "create_purchase":
      return executeCreatePurchase(user, payload);
    case "create_stock_adjustment":
      return executeCreateStockAdjustment(user, payload);
    case "create_staff":
      return executeCreateStaff(user, payload);
    case "update_staff":
      return executeUpdateStaff(user, payload);
    default:
      return { answer: "## Unsupported Action\n\nThat AI action is not supported yet.", action: null };
  }
}

function buildToolDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: "get_dashboard_snapshot",
      description: "Read the current role-filtered ShopIQ dashboard snapshot, including metrics, low stock, dues, and chart-ready data."
    },
    {
      name: "search_business_records",
      description: "Search role-visible ShopIQ records. Use this before preparing actions when ids are needed.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["products", "customers", "suppliers", "invoices", "purchases", "payments", "staff"] },
          query: { type: "string" },
          limit: { type: "number" }
        },
        required: ["entity"]
      }
    },
    {
      name: "get_record_details",
      description: "Load full role-visible details for a single ShopIQ record by id.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["products", "customers", "suppliers", "invoices", "purchases", "payments", "staff"] },
          id: { type: "string" }
        },
        required: ["entity", "id"]
      }
    },
    {
      name: "run_operating_job",
      description: "Run a read-only operating job over live data, such as reorder planning, collections planning, stock audit, cashflow risk, or sales quality review.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          job: { type: "string", enum: ["reorder_plan", "collections_plan", "cashflow_risk", "sales_quality_review", "stock_audit"] },
          limit: { type: "number" }
        },
        required: ["job"]
      }
    },
    {
      name: "get_sales_summary",
      description: "Answer exact sales, revenue, earning, gross profit, cash received, items sold, and invoice totals for a date or date range. Use this for prompts like 'how much earning did we do on March 4' or 'sales between two dates'.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date in YYYY-MM-DD or ISO format." },
          endDate: { type: "string", description: "Optional end date in YYYY-MM-DD or ISO format. If omitted, the summary is for startDate only." },
          customerId: { type: "string" },
          customerName: { type: "string" }
        },
        required: ["startDate"]
      }
    },
    {
      name: "get_customer_balance_summary",
      description: "Answer exact pending money, balance, dues, outstanding invoices, and recent payments for one customer. Use this for prompts like 'how much money is pending of x customer'.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          customerName: { type: "string" }
        }
      }
    },
    {
      name: "get_product_performance",
      description: "Analyze product performance from real invoice items: quantity sold, revenue, gross profit, margin, stockout risk, and reorder suggestion for a date range.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Optional start date. Defaults to the latest 30 days." },
          endDate: { type: "string", description: "Optional end date." },
          productId: { type: "string" },
          productSku: { type: "string" },
          productName: { type: "string" },
          limit: { type: "number" }
        }
      }
    },
    {
      name: "get_customer_credit_risk",
      description: "Rank customers by credit risk using current balance, credit limit usage, overdue invoices, age of dues, and latest payment.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          limit: { type: "number" },
          minimumBalance: { type: "number" }
        }
      }
    },
    {
      name: "build_business_report",
      description: "Build a structured read-only business report from live ShopIQ data and prepare a downloadable PDF report. Use this for every AI report request.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          reportType: { type: "string", enum: [...REPORT_TYPE_VALUES] },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number" }
        }
      }
    },
    {
      name: "prepare_business_action",
      description: "Prepare, validate, and preview a database-changing ShopIQ action. This never writes data. Writes require explicit user confirmation after the preview.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "create_category",
              "update_category",
              "create_product",
              "update_product",
              "create_customer",
              "update_customer",
              "create_supplier",
              "update_supplier",
              "create_payment",
              "create_invoice",
              "create_purchase",
              "create_stock_adjustment",
              "create_staff",
              "update_staff"
            ]
          },
          payload: { type: "object" },
          reason: { type: "string" }
        },
        required: ["action", "payload"]
      }
    }
  ];
}

async function executeToolCall(user: AgentUser, call: FunctionCall) {
  const name = String(call.name || "");
  const args = (call.args || {}) as Record<string, unknown>;
  if (name === "get_dashboard_snapshot") return getLiveSnapshot(user);
  if (name === "search_business_records") return searchBusinessRecords(user, args);
  if (name === "get_record_details") return getRecordDetails(user, args);
  if (name === "run_operating_job") return runOperatingJob(user, args);
  if (name === "get_sales_summary") return getSalesSummary(user, args);
  if (name === "get_customer_balance_summary") return getCustomerBalanceSummary(user, args);
  if (name === "get_product_performance") return getProductPerformance(user, args);
  if (name === "get_customer_credit_risk") return getCustomerCreditRisk(user, args);
  if (name === "build_business_report") return buildBusinessReport(user, args);
  if (name === "prepare_business_action") return prepareBusinessAction(user, args);
  return { ok: false, error: `Unknown tool: ${name}` };
}

function buildSystemInstruction(user: AgentUser) {
  const supplierScope = canReadSupplierCashflow(user.role)
    ? "The user can see supplier, purchase, and supplier payout data."
    : "The user cannot see supplier, purchase, or supplier payout data. Never reveal or infer it.";

  return `You are the live ShopIQ Gemini AI Agent for ${user.shop?.name || "this shop"}.

Operating rules:
- Use only live facts returned by ShopIQ tools or context supplied in this request.
- The current user is ${user.name} (${user.role}). Respect this role on every answer and tool use.
- ${supplierScope}
- For exact date questions about sales, revenue, earning, profit, cash received, items sold, or invoice totals, call get_sales_summary with the user's date range.
- For exact customer pending-money, dues, balance, outstanding-invoice, or payment-history questions, call get_customer_balance_summary.
- For product ranking, weak products, margin questions, fast movers, stockout risk, or item performance, call get_product_performance.
- For credit risk, collection priority, or "who should I collect from first", call get_customer_credit_risk.
- For any requested AI report, PDF report, sales report, inventory report, customer report, profit/loss report, stock movement report, business insight report, summary, daily brief, or supplier report, call build_business_report. Do not provide chat-only reports; the user must receive a PDF download action plus a short summary.
- For any database-changing request, call prepare_business_action first. Never claim a write happened until the server confirms it after the user's later approval.
- Supported preview-gated record generation includes categories, products, customers, suppliers, payments, invoices/bills, purchases, stock adjustments, and staff records.
- Deletions, account suspension, bulk destructive edits, secret retrieval, and bypassing role permissions are not allowed through the AI agent.
- If a create/update/payment/invoice/purchase/category/stock/staff request is missing required fields, ask for the exact missing fields.
- Prefer concise operational answers with numbers, ids when relevant, risks, and the next practical step.
- When using search results to prepare an action, choose ids from tool results only. Never invent ids, SKUs, invoice numbers, or balances.
- Do not expose password hashes, JWT/session details, API keys, database connection strings, or hidden fields.
- Use Markdown headings and bullets. Keep the response useful for a shop operator, not a generic chatbot.`;
}

async function buildTaskContext(user: AgentUser, question: string) {
  const snapshot = await getDashboardSnapshot(user.shopId, user.role);
  const lower = question.toLowerCase();
  const context: Record<string, unknown> = {
    currentHour: new Date().toISOString().slice(0, 13),
    shop: user.shop?.name,
    currency: user.shop?.currency || "PKR",
    role: user.role,
    metrics: snapshot.metrics
  };
  if (/(stock|reorder|inventory|product|sku|item|purchase|buy)/.test(lower)) {
    context.lowStock = snapshot.lowStock.map((product) => ({ id: product.id, sku: product.sku, name: product.name, stockQty: product.stockQty, reorderLevel: product.reorderLevel, reorderQuantity: product.reorderQuantity }));
    context.fastMoving = snapshot.fastMoving;
    context.slowMoving = snapshot.slowMoving;
    context.productPerformanceHint = "For product ranking, margin, quantity sold, weak products, or stockout risk, call get_product_performance.";
  }
  if (/(customer|client|due|owe|pending|balance|collect|receivable|invoice|bill)/.test(lower)) {
    context.customerDues = snapshot.customers.map((customer) => ({ id: customer.id, name: customer.name, balance: customer.balance }));
    context.invoiceStatus = snapshot.charts.invoiceStatus;
    context.creditRiskHint = "For collection priority or credit risk ranking, call get_customer_credit_risk.";
  }
  if (/(earning|revenue|sales|profit|cash received|income|sold|date|today|yesterday|month)/.test(lower)) {
    context.salesHint = "For exact date/range answers, call get_sales_summary with startDate and optional endDate.";
    context.revenueTimeline = snapshot.charts.revenueTimeline;
  }
  if (canReadSupplierCashflow(user.role) && /(supplier|vendor|payable|purchase|payout|cashflow)/.test(lower)) {
    context.supplierDues = snapshot.suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, balance: supplier.balance, reliabilityScore: supplier.reliabilityScore }));
    context.purchaseStatus = snapshot.charts.purchaseStatus;
  }
  if (/(report|summary|brief|review|daily|weekly|monthly|insight)/.test(lower)) {
    context.reportHint = "For business-ready summaries and reports, call build_business_report so the final response includes a PDF download action.";
  }
  return JSON.stringify(serializable(context));
}

function historyToContents(messages: Array<{ role: string; content: string }>): Content[] {
  return messages.slice(-6).map((message) => ({
    role: message.role === "USER" ? "user" : "model",
    parts: [{ text: message.content.slice(0, 1200) }]
  }));
}

function isReportRequest(text: string) {
  return /\b(report|pdf|downloadable report|business insight|profit\/loss|profit and loss|stock movement report|sales report|inventory report|customer report|dues report|supplier report)\b/i.test(text);
}

function isWriteRequest(text: string) {
  return /\b(create|add|update|edit|record|generate record|make invoice|create invoice|create bill|purchase|adjust|delete|remove|staff member|new product|new customer|new supplier)\b/i.test(text);
}

function taskClassForQuestion(text: string): "light" | "standard" | "heavy" {
  if (isReportRequest(text) || isWriteRequest(text) || /\b(deep analysis|forecast|recommendation plan|cashflow risk)\b/i.test(text)) return "heavy";
  if (/\b(summary|summarize|suggest|find|search|low stock|unpaid|dues|today sales|monthly revenue|how much)\b/i.test(text)) return "light";
  return "standard";
}

function inferReportType(text: string) {
  const lower = text.toLowerCase();
  if (/profit\/loss|profit and loss|p&l|pnl/.test(lower)) return "profit_loss_report";
  if (/stock movement|movement report|stock report/.test(lower)) return "stock_movement_report";
  if (/inventory|stock|low stock/.test(lower)) return "inventory_report";
  if (/customer|dues|receivable|collection|pending/.test(lower)) return lower.includes("dues") || lower.includes("pending") ? "dues_report" : "customer_report";
  if (/supplier|purchase|payable/.test(lower)) return "supplier_report";
  if (/sales|revenue|earning|income/.test(lower)) return "sales_report";
  if (/insight|recommendation|risk/.test(lower)) return "business_insight_report";
  if (/daily|today/.test(lower)) return "daily_summary";
  return "full_business_review";
}

function reportReadyAnswer(response: any, fallbackText?: string) {
  const report = response?.report || {};
  const pdf = response?.pdf || {};
  const sales = report.sales || {};
  const lines = [
    `## ${pdf.label || "ShopIQ PDF Report"} Ready`,
    "",
    `I generated a professional PDF report for **${pdf.range || "the selected reporting window"}** using live ShopIQ database data.`,
    "",
    `- **Revenue:** ${moneyLabel(sales.grossSales ?? report.metrics?.monthlyRevenue ?? 0)}`,
    `- **Gross profit:** ${moneyLabel(sales.grossProfit ?? 0)}`,
    `- **Cash received:** ${moneyLabel(sales.cashReceived ?? 0)}`,
    `- **Invoices analyzed:** ${Number(sales.invoiceCount || 0).toLocaleString()}`
  ];
  if (fallbackText) {
    lines.push("", "### AI notes", fallbackText.split("\n").slice(0, 5).join("\n"));
  }
  lines.push("", "Use the download button below to open the PDF report.");
  return lines.join("\n");
}

async function databaseFirstResponse(user: AgentUser, question: string) {
  const lower = question.toLowerCase();

  if (isReportRequest(question)) {
    const reportResponse = await buildBusinessReport(user, { reportType: inferReportType(question) });
    if ((reportResponse as any).pdf) {
      return {
        answer: reportReadyAnswer(reportResponse),
        action: { label: `Download ${(reportResponse as any).pdf.label || "PDF report"}`, href: String((reportResponse as any).pdf.url) }
      };
    }
    if ((reportResponse as any).ok === false) {
      return { answer: `## Report Not Available\n\n${(reportResponse as any).error || "Your role cannot generate this PDF report."}` };
    }
    return null;
  }

  if (/\b(low stock|reorder level|items? running low|stock risk)\b/i.test(question)) {
    const snapshot = await getDashboardSnapshot(user.shopId, user.role);
    const rows = snapshot.lowStock.slice(0, 8);
    const answer = rows.length
      ? [
          "## Low Stock From Live Inventory",
          "",
          ...rows.map((product: any) => `- **${product.name}** (${product.sku}) has **${product.stockQty}** left. Reorder level: **${product.reorderLevel}**.`),
          "",
          `${rows.length} item${rows.length === 1 ? "" : "s"} need attention.`
        ].join("\n")
      : "## Low Stock From Live Inventory\n\nNo active products are currently at or below reorder level.";
    return { answer, action: { label: "Open Inventory", href: workspacePath(user.role, "products") } };
  }

  if (/\b(unpaid invoices?|partial invoices?|pending invoices?|invoice dues)\b/i.test(question)) {
    if (!can(user.role, "invoices", "read")) return null;
    const invoices = await prisma.invoice.findMany({
      where: { shopId: user.shopId, dueAmount: { gt: 0 }, status: { in: ["UNPAID", "PARTIAL"] } },
      include: { customer: true },
      orderBy: { dueAmount: "desc" },
      take: 8
    });
    const totalDue = invoices.reduce((sum, invoice) => sum + n(invoice.dueAmount), 0);
    const answer = invoices.length
      ? [
          "## Pending Invoices From Live Billing",
          "",
          `Top ${invoices.length} pending invoices total **${moneyLabel(totalDue)}**.`,
          "",
          ...invoices.map((invoice) => `- **${invoice.invoiceNo}** - ${invoice.customer?.name || "Walk-in"} - ${moneyLabel(invoice.dueAmount)} due (${invoice.status})`)
        ].join("\n")
      : "## Pending Invoices From Live Billing\n\nNo unpaid or partial invoices are currently visible for your role.";
    return { answer, action: { label: "Open Billing", href: workspacePath(user.role, "billing") } };
  }

  if (/\b(today sales|monthly revenue|inventory value|customer dues|supplier dues|dashboard totals|business totals)\b/i.test(lower)) {
    const snapshot = await getDashboardSnapshot(user.shopId, user.role);
    const lines = [
      "## Live ShopIQ Totals",
      "",
      `- **Today sales:** ${moneyLabel(snapshot.metrics.todaySales)} (${snapshot.metrics.salesWindowLabel})`,
      `- **Revenue:** ${moneyLabel(snapshot.metrics.monthlyRevenue)} (${snapshot.metrics.revenueWindowLabel})`,
      `- **Inventory value:** ${moneyLabel(snapshot.metrics.inventoryValue)}`,
      `- **Customer dues:** ${moneyLabel(snapshot.metrics.customerDues)}`,
      canReadSupplierCashflow(user.role) ? `- **Supplier payables:** ${moneyLabel(snapshot.metrics.supplierDues)}` : null,
      `- **Low stock:** ${Number(snapshot.metrics.lowStockCount || 0).toLocaleString()} product${Number(snapshot.metrics.lowStockCount || 0) === 1 ? "" : "s"}`
    ].filter(Boolean);
    return { answer: lines.join("\n"), action: { label: "Open Dashboard", href: workspacePath(user.role, "dashboard") } };
  }

  return null;
}

export async function runShopIqAgentTurn(input: {
  user: AgentUser;
  question: string;
  recentMessages: Array<{ role: string; content: string }>;
}) {
  const direct = await databaseFirstResponse(input.user, input.question);
  if (direct) {
    return {
      answer: direct.answer,
      provider: "database",
      model: "database-first",
      confidence: 0.98,
      toolResults: [],
      pendingAction: null,
      action: direct.action
    };
  }

  const taskContext = await buildTaskContext(input.user, input.question);
  const taskClass = taskClassForQuestion(input.question);
  const cacheable = !isWriteRequest(input.question);
  const result = await runGeminiToolTurn({
    systemInstruction: buildSystemInstruction(input.user),
    userPrompt: `Current ShopIQ task context:\n${taskContext}\n\nUser request:\n${input.question}`,
    history: historyToContents(input.recentMessages),
    tools: buildToolDeclarations(),
    executeToolCall: (call) => executeToolCall(input.user, call),
    taskClass,
    cacheable,
    cacheKey: `shop:${input.user.shopId}:role:${input.user.role}:task:${taskClass}:q:${input.question.trim().toLowerCase().slice(0, 260)}`
  });
  const pendingResponse = result.toolResults.find((tool) => tool.name === "prepare_business_action" && (tool.response as any).pendingAction)?.response as { pendingAction?: PreparedAiAction; previewMarkdown?: string } | undefined;
  let reportResponse = result.toolResults.find((tool) => tool.name === "build_business_report" && (tool.response as any).pdf)?.response as any;
  if (!reportResponse && isReportRequest(input.question)) {
    reportResponse = await buildBusinessReport(input.user, { reportType: inferReportType(input.question) });
  }
  const hasReportPdf = Boolean(reportResponse?.pdf?.url);
  const reportAction = hasReportPdf
    ? { label: `Download ${reportResponse.pdf.label || "PDF report"}`, href: String(reportResponse.pdf.url) }
    : null;
  return {
    answer: pendingResponse?.previewMarkdown || (hasReportPdf ? reportReadyAnswer(reportResponse, result.text) : result.text),
    provider: result.provider,
    model: result.model,
    confidence: result.confidence,
    toolResults: result.toolResults,
    pendingAction: pendingResponse?.pendingAction || null,
    action: reportAction
  };
}

export async function findLatestPendingAiAction(threadId: string) {
  const messages = await prisma.assistantMessage.findMany({ where: { threadId }, orderBy: { createdAt: "desc" }, take: 16 });
  return messages.find((message) => {
    const metadata = message.metadata as PendingAiActionMetadata | null;
    return metadata?.pendingAction && metadata.status === "pending" && metadata.payload;
  });
}

export function isAiConfirm(text: string) {
  return isConfirm(text);
}

export function isAiCancel(text: string) {
  return isCancel(text);
}

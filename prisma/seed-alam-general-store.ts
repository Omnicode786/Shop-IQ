import bcrypt from "bcryptjs";
import {
  Prisma,
  PrismaClient,
  type InvoiceStatus,
  type PaymentMethod,
  type PurchaseStatus,
  type StockMovementType
} from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const SEED_MARKER = "SEED_ALAM_GENERAL_STORE_V1_COMPLETED";
const PASSWORD = "demo12345";
const MONEY_LIMIT = 1_000_000;
const OPENING_REF = "ALM-OPENING-2026";
const SHOP = {
  name: "Alam General Store",
  city: "Karachi",
  address: "Shop 4, Street 2, Block 6, Gulshan-e-Iqbal, Karachi",
  phone: "03402211076",
  currency: "PKR"
};

let seed = 2026051901;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function money(n: number) {
  return new Prisma.Decimal((Math.round(n * 100) / 100).toFixed(2));
}

function num(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function randInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick<T>(array: readonly T[]) {
  return array[randInt(0, array.length - 1)];
}

function weightedPick<T>(options: ReadonlyArray<{ item: T; weight: number }>) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = random() * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.item;
  }
  return options[options.length - 1].item;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function makeSku(index: number) {
  return `ALM-KHI-${String(index).padStart(4, "0")}`;
}

function makeBarcode(index: number) {
  return String(8981000000000 + index);
}

function invoiceStatusPicker(): InvoiceStatus {
  const roll = random();
  if (roll < 0.86) return "PAID";
  if (roll < 0.94) return "PARTIAL";
  if (roll < 0.99) return "UNPAID";
  return "CANCELLED";
}

function purchaseStatusPicker(): PurchaseStatus {
  const roll = random();
  if (roll < 0.9) return "RECEIVED";
  if (roll < 0.98) return "PARTIAL";
  return "ORDERED";
}

function paymentMethodPicker(kind: "customer" | "supplier"): PaymentMethod {
  if (kind === "supplier") {
    return weightedPick<PaymentMethod>([
      { item: "CASH", weight: 68 },
      { item: "BANK_TRANSFER", weight: 17 },
      { item: "EASYPAISA", weight: 7 },
      { item: "JAZZCASH", weight: 5 },
      { item: "CHEQUE", weight: 3 }
    ]);
  }

  return weightedPick<PaymentMethod>([
    { item: "CASH", weight: 78 },
    { item: "JAZZCASH", weight: 8 },
    { item: "EASYPAISA", weight: 7 },
    { item: "BANK_TRANSFER", weight: 4 },
    { item: "CARD", weight: 2 },
    { item: "OTHER", weight: 1 }
  ]);
}

function paymentReference(method: PaymentMethod, index: number) {
  const prefix: Record<PaymentMethod, string> = {
    CASH: "CASH",
    JAZZCASH: "JC",
    EASYPAISA: "EP",
    BANK_TRANSFER: "BANK",
    CARD: "CARD",
    CHEQUE: "CHQ",
    OTHER: "OTHER"
  };
  return `${prefix[method]}-ALM-${String(index).padStart(4, "0")}`;
}

async function createManyInChunks<T>(
  delegate: { createMany(args: { data: T[]; skipDuplicates?: boolean }): Promise<unknown> },
  data: T[],
  size = 500
) {
  for (let index = 0; index < data.length; index += size) {
    const chunk = data.slice(index, index + size);
    if (chunk.length) await delegate.createMany({ data: chunk, skipDuplicates: true });
  }
}

const CATEGORY_NAMES = [
  "Daily Grocery",
  "Flour, Rice & Pulses",
  "Tea, Drinks & Snacks",
  "Dairy & Bread",
  "Cleaning & Household",
  "Personal Care & Misc"
] as const;

const SUPPLIERS = [
  ["Gulshan Wholesale Grocery", "Grocery Wholesale", "Gulshan Wholesale Market, Karachi"],
  ["Local Flour & Rice Dealer", "Rice, Flour & Pulses", "Water Pump Market, Karachi"],
  ["FMCG Small Distributor", "FMCG Distributor", "Saddar, Karachi"],
  ["Bread & Dairy Supplier", "Dairy & Bread", "Dhoraji, Karachi"],
  ["Cleaning Items Wholesaler", "Cleaning & Household", "Federal B Area, Karachi"],
  ["Drinks Crate Supplier", "Beverages", "Nipa Chowrangi, Karachi"]
] as const;

type Speed = "fast" | "medium" | "slow";
type ProductSeed = {
  name: string;
  brand: string;
  category: string;
  unit: string;
  price: number;
  margin: [number, number];
  speed: Speed;
  location: string;
  supplier: string;
  productType: string;
  perishable?: boolean;
};

function p(
  name: string,
  brand: string,
  category: string,
  unit: string,
  price: number,
  margin: [number, number],
  speed: Speed,
  location: string,
  supplier: string,
  productType: string,
  perishable = false
): ProductSeed {
  return { name, brand, category, unit, price, margin, speed, location, supplier, productType, perishable };
}

const PRODUCTS: ProductSeed[] = [
  p("Sugar 1kg", "Local Sugar", "Daily Grocery", "kg", 160, [0.05, 0.09], "fast", "Main Shelf", "Gulshan Wholesale Grocery", "Staple"),
  p("National Salt 800g", "National", "Daily Grocery", "pack", 55, [0.08, 0.14], "fast", "Front Counter", "FMCG Small Distributor", "Salt"),
  p("Mezan Cooking Oil 1L", "Mezan", "Daily Grocery", "bottle", 590, [0.05, 0.09], "fast", "Main Shelf", "FMCG Small Distributor", "Cooking Oil"),
  p("Mezan Banaspati Ghee 1kg", "Mezan", "Daily Grocery", "pouch", 555, [0.05, 0.09], "fast", "Main Shelf", "FMCG Small Distributor", "Ghee"),
  p("Shan Biryani Masala 65g", "Shan", "Daily Grocery", "box", 150, [0.1, 0.17], "fast", "Front Counter", "FMCG Small Distributor", "Masala"),
  p("National Karahi Masala 50g", "National", "Daily Grocery", "box", 145, [0.1, 0.17], "medium", "Front Counter", "FMCG Small Distributor", "Masala"),
  p("Chakki Atta 5kg", "Local Chakki", "Flour, Rice & Pulses", "bag", 760, [0.05, 0.09], "fast", "Flour Corner", "Local Flour & Rice Dealer", "Flour"),
  p("Chakki Atta 10kg", "Local Chakki", "Flour, Rice & Pulses", "bag", 1490, [0.05, 0.09], "medium", "Flour Corner", "Local Flour & Rice Dealer", "Flour"),
  p("Basmati Rice 1kg", "Local Premium", "Flour, Rice & Pulses", "kg", 380, [0.05, 0.1], "fast", "Rice Bags Corner", "Local Flour & Rice Dealer", "Rice"),
  p("Dal Chana 1kg", "Local", "Flour, Rice & Pulses", "kg", 390, [0.06, 0.11], "medium", "Main Shelf", "Gulshan Wholesale Grocery", "Pulses"),
  p("Dal Masoor 1kg", "Local", "Flour, Rice & Pulses", "kg", 430, [0.06, 0.11], "medium", "Main Shelf", "Gulshan Wholesale Grocery", "Pulses"),
  p("White Chana 1kg", "Local", "Flour, Rice & Pulses", "kg", 500, [0.06, 0.11], "slow", "Back Store", "Gulshan Wholesale Grocery", "Pulses"),
  p("Tapal Danedar 190g", "Tapal", "Tea, Drinks & Snacks", "pack", 380, [0.08, 0.14], "fast", "Front Counter", "FMCG Small Distributor", "Tea"),
  p("Lipton Yellow Label 190g", "Lipton", "Tea, Drinks & Snacks", "pack", 380, [0.08, 0.14], "medium", "Front Counter", "FMCG Small Distributor", "Tea"),
  p("Rooh Afza 800ml", "Hamdard", "Tea, Drinks & Snacks", "bottle", 520, [0.09, 0.16], "medium", "Main Shelf", "Drinks Crate Supplier", "Syrup"),
  p("Pepsi 1.5L", "Pepsi", "Tea, Drinks & Snacks", "bottle", 185, [0.08, 0.15], "fast", "Drinks Fridge", "Drinks Crate Supplier", "Soft Drink"),
  p("Coca-Cola 1.5L", "Coca-Cola", "Tea, Drinks & Snacks", "bottle", 185, [0.08, 0.15], "fast", "Drinks Fridge", "Drinks Crate Supplier", "Soft Drink"),
  p("Nestle Water 1.5L", "Nestle", "Tea, Drinks & Snacks", "bottle", 90, [0.08, 0.14], "fast", "Drinks Fridge", "Drinks Crate Supplier", "Water"),
  p("Peek Freans Sooper Small Pack", "Peek Freans", "Tea, Drinks & Snacks", "pack", 50, [0.12, 0.22], "fast", "Biscuit Rack", "FMCG Small Distributor", "Biscuits"),
  p("LU Prince Small Pack", "LU", "Tea, Drinks & Snacks", "pack", 50, [0.12, 0.22], "fast", "Biscuit Rack", "FMCG Small Distributor", "Biscuits"),
  p("Tuc Crackers Small Pack", "LU", "Tea, Drinks & Snacks", "pack", 60, [0.12, 0.22], "medium", "Biscuit Rack", "FMCG Small Distributor", "Biscuits"),
  p("Lays Small Pack", "Lays", "Tea, Drinks & Snacks", "pack", 50, [0.14, 0.24], "fast", "Front Counter", "FMCG Small Distributor", "Snacks"),
  p("Nimco Small Pack", "Kolson", "Tea, Drinks & Snacks", "pack", 70, [0.14, 0.24], "medium", "Front Counter", "FMCG Small Distributor", "Snacks"),
  p("Olpers Milk 1L", "Olpers", "Dairy & Bread", "pack", 352, [0.07, 0.12], "fast", "Dairy Fridge", "Bread & Dairy Supplier", "Milk", true),
  p("Milkpak 1L", "Milkpak", "Dairy & Bread", "pack", 360, [0.07, 0.12], "fast", "Dairy Fridge", "Bread & Dairy Supplier", "Milk", true),
  p("Yogurt 400g", "Local Dairy", "Dairy & Bread", "tub", 240, [0.08, 0.14], "medium", "Dairy Fridge", "Bread & Dairy Supplier", "Dairy", true),
  p("Eggs Dozen", "Farm Fresh", "Dairy & Bread", "dozen", 360, [0.07, 0.12], "fast", "Front Counter", "Bread & Dairy Supplier", "Eggs", true),
  p("Fresh Bread Small", "Local Bakery", "Dairy & Bread", "loaf", 120, [0.12, 0.2], "fast", "Front Counter", "Bread & Dairy Supplier", "Bread", true),
  p("Fresh Bread Large", "Local Bakery", "Dairy & Bread", "loaf", 180, [0.12, 0.2], "medium", "Front Counter", "Bread & Dairy Supplier", "Bread", true),
  p("Surf Excel 500g", "Surf Excel", "Cleaning & Household", "pack", 299, [0.1, 0.2], "fast", "Cleaning Shelf", "Cleaning Items Wholesaler", "Detergent"),
  p("Bonus Detergent 500g", "Bonus", "Cleaning & Household", "pack", 220, [0.1, 0.2], "medium", "Cleaning Shelf", "Cleaning Items Wholesaler", "Detergent"),
  p("Lemon Max Dishwash Bar", "Lemon Max", "Cleaning & Household", "bar", 95, [0.12, 0.22], "fast", "Cleaning Shelf", "Cleaning Items Wholesaler", "Dishwash"),
  p("Harpic 500ml", "Harpic", "Cleaning & Household", "bottle", 500, [0.12, 0.22], "slow", "Cleaning Shelf", "Cleaning Items Wholesaler", "Toilet Cleaner"),
  p("Tissue Roll", "Rose Petal", "Cleaning & Household", "roll", 120, [0.12, 0.22], "medium", "Front Counter", "Cleaning Items Wholesaler", "Paper Goods"),
  p("Lifebuoy Soap", "Lifebuoy", "Personal Care & Misc", "bar", 150, [0.12, 0.22], "fast", "Personal Care Shelf", "FMCG Small Distributor", "Soap"),
  p("Dettol Soap", "Dettol", "Personal Care & Misc", "bar", 220, [0.12, 0.22], "medium", "Personal Care Shelf", "FMCG Small Distributor", "Soap"),
  p("Colgate Small Toothpaste", "Colgate", "Personal Care & Misc", "tube", 190, [0.12, 0.22], "medium", "Personal Care Shelf", "FMCG Small Distributor", "Oral Care"),
  p("Sunsilk Shampoo Sachet", "Sunsilk", "Personal Care & Misc", "sachet", 20, [0.16, 0.26], "fast", "Front Counter", "FMCG Small Distributor", "Hair Care"),
  p("Head & Shoulders Sachet", "Head & Shoulders", "Personal Care & Misc", "sachet", 25, [0.16, 0.26], "fast", "Front Counter", "FMCG Small Distributor", "Hair Care"),
  p("Ball Pen", "Dollar", "Personal Care & Misc", "pcs", 35, [0.18, 0.32], "slow", "Front Counter", "Gulshan Wholesale Grocery", "Stationery")
];

const AREAS = ["Gulshan-e-Iqbal Block 6", "Gulshan-e-Iqbal Block 7", "Nipa", "Dhoraji", "University Road", "Johar Mor", "Federal B Area"];
const FIRST_NAMES = ["Ahmed", "Ali", "Bilal", "Danish", "Fahad", "Hassan", "Imran", "Kamran", "Owais", "Saad", "Usman", "Ayesha", "Fatima", "Hina", "Iqra", "Nida", "Sadia", "Zainab"];
const LAST_NAMES = ["Khan", "Ahmed", "Raza", "Malik", "Qureshi", "Farooqui", "Ali", "Hussain", "Sheikh", "Ansari", "Memon", "Alam", "Iqbal"];
const CUSTOMER_NOTES = [
  "Nearby regular customer",
  "Small credit customer",
  "Monthly ration customer",
  "Phone order customer",
  "Office tea/snacks customer",
  "Pays mostly by cash",
  "Pays weekly after salary",
  "Buys milk, bread and snacks regularly"
];

type ProductRuntime = Prisma.ProductGetPayload<{ include: { category: true; supplier: true } }> & {
  speed: Speed;
  saleWeight: number;
  categoryName: string;
};

async function findOrCreateShop() {
  const existing = await prisma.shop.findFirst({ where: { name: SHOP.name, city: SHOP.city } });
  if (existing) return prisma.shop.update({ where: { id: existing.id }, data: SHOP });
  return prisma.shop.create({ data: SHOP });
}

async function ensureUsers(shopId: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: "alam.admin@shopiq.local" },
    update: {
      shopId,
      name: "Muhammad Muzammil Alam",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Owner",
      phone: SHOP.phone,
      shift: "Open to close",
      branchArea: "Owner Counter",
      joiningDate: daysAgo(900),
      permissions: { workspace: "full", canApproveAiWrites: true, canManageStaff: true }
    },
    create: {
      shopId,
      name: "Muhammad Muzammil Alam",
      email: "alam.admin@shopiq.local",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Owner",
      phone: SHOP.phone,
      shift: "Open to close",
      branchArea: "Owner Counter",
      joiningDate: daysAgo(900),
      permissions: { workspace: "full", canApproveAiWrites: true, canManageStaff: true }
    }
  });

  const staff = await prisma.user.upsert({
    where: { email: "alam.helper@shopiq.local" },
    update: {
      shopId,
      name: "Sameer Alam",
      passwordHash,
      role: "STAFF",
      status: "ACTIVE",
      designation: "Shop Helper / Cash Counter",
      phone: "03463443417",
      shift: "Afternoon / Evening",
      branchArea: "Cash Counter",
      joiningDate: daysAgo(420),
      permissions: { canUsePOS: true, canReceiveStock: true, canViewReports: false }
    },
    create: {
      shopId,
      name: "Sameer Alam",
      email: "alam.helper@shopiq.local",
      passwordHash,
      role: "STAFF",
      status: "ACTIVE",
      designation: "Shop Helper / Cash Counter",
      phone: "03463443417",
      shift: "Afternoon / Evening",
      branchArea: "Cash Counter",
      joiningDate: daysAgo(420),
      permissions: { canUsePOS: true, canReceiveStock: true, canViewReports: false }
    }
  });

  return { admin, staff, users: [admin, staff] };
}

async function ensureCategories(shopId: string) {
  const colors = ["emerald", "amber", "cyan", "violet", "blue", "rose"];
  const rows = [];
  for (let index = 0; index < CATEGORY_NAMES.length; index += 1) {
    rows.push(await prisma.category.upsert({
      where: { shopId_name: { shopId, name: CATEGORY_NAMES[index] } },
      update: { color: colors[index] },
      create: { shopId, name: CATEGORY_NAMES[index], color: colors[index] }
    }));
  }
  return rows;
}

async function ensureSuppliers(shopId: string) {
  const rows = [];
  for (let index = 0; index < SUPPLIERS.length; index += 1) {
    const [name, supplierType, address] = SUPPLIERS[index];
    const id = `alam_supplier_${String(index + 1).padStart(3, "0")}`;
    const data = {
      shopId,
      name,
      phone: `0300-0003${String(index + 1).padStart(3, "0")}`,
      email: `supplier${String(index + 1).padStart(3, "0")}@alam-general.local`,
      address,
      contactPerson: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      paymentTerms: pick(["Cash on delivery", "Weekly settlement", "7 days credit"]),
      leadTimeDays: randInt(1, 4),
      supplierType,
      balance: money(0),
      reliabilityScore: randInt(76, 94),
      notes: "Small-shop supplier used for realistic neighborhood general store operations."
    };
    rows.push(await prisma.supplier.upsert({
      where: { id },
      update: data,
      create: { id, ...data }
    }));
  }
  return rows;
}

function productStockRange(speed: Speed) {
  if (speed === "fast") return { stock: randInt(18, 42), reorderLevel: randInt(7, 12), reorderQuantity: randInt(12, 28) };
  if (speed === "medium") return { stock: randInt(8, 24), reorderLevel: randInt(4, 8), reorderQuantity: randInt(8, 18) };
  return { stock: randInt(3, 10), reorderLevel: randInt(2, 4), reorderQuantity: randInt(4, 10) };
}

async function ensureProducts(
  shopId: string,
  categoryByName: Map<string, string>,
  supplierByName: Map<string, string>,
  stockUserId: string
) {
  const rows: ProductRuntime[] = [];
  for (let index = 0; index < PRODUCTS.length; index += 1) {
    const item = PRODUCTS[index];
    const sku = makeSku(index + 1);
    const margin = item.margin[0] + random() * (item.margin[1] - item.margin[0]);
    const costPrice = item.price / (1 + margin);
    const stockPlan = productStockRange(item.speed);
    const expiryDate = item.perishable ? addDays(new Date(), randInt(4, 40)) : undefined;
    const product = await prisma.product.upsert({
      where: { shopId_sku: { shopId, sku } },
      update: {
        categoryId: categoryByName.get(item.category),
        supplierId: supplierByName.get(item.supplier),
        barcode: makeBarcode(index + 1),
        name: item.name,
        brand: item.brand,
        description: `${item.name} priced for a tiny Karachi neighborhood general store retail dataset.`,
        unit: item.unit,
        costPrice: money(costPrice),
        salePrice: money(item.price),
        taxRate: money(0),
        discountRate: money(0),
        reorderLevel: stockPlan.reorderLevel,
        reorderQuantity: stockPlan.reorderQuantity,
        location: item.location,
        aisle: item.location,
        shelf: `${String.fromCharCode(65 + (index % 4))}-${randInt(1, 4)}`,
        productType: item.productType,
        isPerishable: Boolean(item.perishable),
        batchNo: `ALM-B${String(index + 1).padStart(3, "0")}-${randInt(10, 99)}`,
        manufactureDate: item.perishable ? daysAgo(randInt(1, 7)) : undefined,
        expiryDate,
        status: "ACTIVE"
      },
      create: {
        shopId,
        categoryId: categoryByName.get(item.category),
        supplierId: supplierByName.get(item.supplier),
        sku,
        barcode: makeBarcode(index + 1),
        name: item.name,
        brand: item.brand,
        description: `${item.name} priced for a tiny Karachi neighborhood general store retail dataset.`,
        unit: item.unit,
        costPrice: money(costPrice),
        salePrice: money(item.price),
        taxRate: money(0),
        discountRate: money(0),
        stockQty: stockPlan.stock,
        reorderLevel: stockPlan.reorderLevel,
        reorderQuantity: stockPlan.reorderQuantity,
        location: item.location,
        aisle: item.location,
        shelf: `${String.fromCharCode(65 + (index % 4))}-${randInt(1, 4)}`,
        productType: item.productType,
        isPerishable: Boolean(item.perishable),
        batchNo: `ALM-B${String(index + 1).padStart(3, "0")}-${randInt(10, 99)}`,
        manufactureDate: item.perishable ? daysAgo(randInt(1, 7)) : undefined,
        expiryDate,
        status: "ACTIVE"
      },
      include: { category: true, supplier: true }
    });

    const openingExists = await prisma.stockMovement.findFirst({
      where: { shopId, productId: product.id, type: "OPENING", reference: OPENING_REF },
      select: { id: true }
    });
    if (!openingExists && product.stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          id: `alam_opening_${String(index + 1).padStart(3, "0")}`,
          shopId,
          productId: product.id,
          userId: stockUserId,
          type: "OPENING",
          quantity: product.stockQty,
          beforeQty: 0,
          afterQty: product.stockQty,
          reference: OPENING_REF,
          notes: "Opening shelf stock for Alam General Store.",
          movedAt: daysAgo(62)
        }
      });
    }

    rows.push({
      ...product,
      speed: item.speed,
      saleWeight: item.speed === "fast" ? 9 : item.speed === "medium" ? 4 : 1,
      categoryName: item.category
    });
  }
  return rows;
}

async function ensureCustomers(shopId: string) {
  const rows = [];
  const segments = [
    { type: "NEARBY_REGULAR", weight: 38, credit: [0, 3000] },
    { type: "SMALL_CREDIT", weight: 25, credit: [1000, 7000] },
    { type: "MONTHLY_RATION", weight: 17, credit: [5000, 12000] },
    { type: "PHONE_ORDER", weight: 12, credit: [0, 5000] },
    { type: "OFFICE_TEA_SNACKS", weight: 8, credit: [8000, 18000] }
  ] as const;

  for (let index = 0; index < 20; index += 1) {
    const segment = weightedPick(segments.map((item) => ({ item, weight: item.weight })));
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const id = `alam_customer_${String(index + 1).padStart(3, "0")}`;
    const phone = `0300-0004${String(index + 1).padStart(3, "0")}`;
    const creditLimit = randInt(segment.credit[0], segment.credit[1]);
    const area = pick(AREAS);
    rows.push(await prisma.customer.upsert({
      where: { id },
      update: {
        shopId,
        name,
        phone,
        email: `customer${String(index + 1).padStart(3, "0")}@alam-general.local`,
        address: `${area}, Karachi`,
        customerType: segment.type,
        area,
        city: "Karachi",
        whatsapp: phone,
        loyaltyPoints: randInt(0, 95),
        lastVisitAt: daysAgo(randInt(0, 35)),
        preferredPaymentMethod: paymentMethodPicker("customer"),
        creditLimit: money(creditLimit),
        balance: money(0),
        notes: pick(CUSTOMER_NOTES)
      },
      create: {
        id,
        shopId,
        name,
        phone,
        email: `customer${String(index + 1).padStart(3, "0")}@alam-general.local`,
        address: `${area}, Karachi`,
        customerType: segment.type,
        area,
        city: "Karachi",
        whatsapp: phone,
        loyaltyPoints: randInt(0, 95),
        lastVisitAt: daysAgo(randInt(0, 35)),
        preferredPaymentMethod: paymentMethodPicker("customer"),
        creditLimit: money(creditLimit),
        balance: money(0),
        notes: pick(CUSTOMER_NOTES)
      }
    }));
  }
  return rows;
}

function productForBasket(products: ProductRuntime[], preferredCategories?: readonly string[]) {
  const pool = preferredCategories?.length
    ? products.filter((product) => preferredCategories.includes(product.categoryName))
    : products;
  return weightedPick((pool.length ? pool : products).map((product) => ({ item: product, weight: product.saleWeight })));
}

async function seedPurchases(
  shopId: string,
  products: ProductRuntime[],
  suppliers: Awaited<ReturnType<typeof ensureSuppliers>>,
  users: Awaited<ReturnType<typeof ensureUsers>>["users"],
  stockById: Map<string, number>
) {
  const existingIds = new Set((await prisma.purchase.findMany({
    where: { shopId, purchaseNo: { startsWith: "ALM-PO-2026-" } },
    select: { id: true }
  })).map((row) => row.id));
  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name, supplier]));
  const purchases: Prisma.PurchaseCreateManyInput[] = [];
  const items: Prisma.PurchaseItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];

  for (let index = 1; index <= 20; index += 1) {
    const purchaseId = `alam_purchase_${String(index).padStart(6, "0")}`;
    if (existingIds.has(purchaseId)) continue;
    const purchaseNo = `ALM-PO-2026-${String(index).padStart(6, "0")}`;
    const status = purchaseStatusPicker();
    const date = daysAgo(randInt(1, 60));
    const creator = pick(users);
    const lineCount = randInt(2, 5);
    const selected = new Set<string>();
    const purchaseItems: Array<{ id: string; product: ProductRuntime; quantity: number; receivedQty: number; unitCost: number; total: number }> = [];

    for (let line = 1; line <= lineCount; line += 1) {
      const product = productForBasket(products);
      if (selected.has(product.id)) continue;
      selected.add(product.id);
      const quantity = product.speed === "fast" ? randInt(8, 24) : product.speed === "medium" ? randInt(4, 14) : randInt(2, 7);
      const receivedQty = status === "ORDERED" ? 0 : status === "PARTIAL" ? Math.max(1, Math.floor(quantity * (randInt(40, 70) / 100))) : quantity;
      const unitCost = Math.max(1, num(product.costPrice) * (0.97 + random() * 0.06));
      purchaseItems.push({
        id: `alam_purchase_item_${String(index).padStart(6, "0")}_${String(line).padStart(2, "0")}`,
        product,
        quantity,
        receivedQty,
        unitCost,
        total: quantity * unitCost
      });
    }
    if (!purchaseItems.length) continue;

    const supplier = supplierByName.get(pick(purchaseItems).product.supplier?.name || "") || pick(suppliers);
    const subtotal = purchaseItems.reduce((sum, item) => sum + item.total, 0);
    const paidBehavior = weightedPick([
      { item: "FULL", weight: 70 },
      { item: "PARTIAL", weight: 20 },
      { item: "UNPAID", weight: 10 }
    ] as const);
    const paidAmount = status === "ORDERED" ? 0 : paidBehavior === "FULL" ? subtotal : paidBehavior === "PARTIAL" ? subtotal * (randInt(40, 75) / 100) : 0;
    const dueAmount = Math.max(subtotal - paidAmount, 0);

    purchases.push({
      id: purchaseId,
      shopId,
      supplierId: supplier.id,
      createdById: creator.id,
      purchaseNo,
      status,
      subtotal: money(subtotal),
      total: money(subtotal),
      paidAmount: money(paidAmount),
      dueAmount: money(dueAmount),
      purchaseDate: date,
      notes: `${supplier.name} small wholesale replenishment for Alam General Store.`
    });

    for (const item of purchaseItems) {
      items.push({
        id: item.id,
        purchaseId,
        productId: item.product.id,
        quantity: item.quantity,
        unitCost: money(item.unitCost),
        total: money(item.total)
      });
      if (item.receivedQty > 0) {
        const beforeQty = stockById.get(item.product.id) || 0;
        const afterQty = beforeQty + item.receivedQty;
        stockById.set(item.product.id, afterQty);
        movements.push({
          id: `alam_purchase_move_${String(index).padStart(6, "0")}_${item.id.slice(-2)}`,
          shopId,
          productId: item.product.id,
          userId: creator.id,
          type: "PURCHASE",
          quantity: item.receivedQty,
          beforeQty,
          afterQty,
          reference: purchaseNo,
          notes: status === "PARTIAL" ? "Partial stock received from local supplier." : "Small supplier purchase received.",
          movedAt: date
        });
      }
    }

    if (paidAmount > 0) {
      const method = paymentMethodPicker("supplier");
      payments.push({
        id: `alam_supplier_payment_${String(index).padStart(6, "0")}`,
        shopId,
        supplierId: supplier.id,
        purchaseId,
        createdById: creator.id,
        direction: "SUPPLIER_OUT",
        method,
        amount: money(paidAmount),
        paidAt: date,
        reference: paymentReference(method, index),
        notes: `Supplier payment for ${purchaseNo}.`
      });
    }
  }

  await createManyInChunks(prisma.purchase, purchases);
  await createManyInChunks(prisma.purchaseItem, items);
  await createManyInChunks(prisma.payment, payments);
  await createManyInChunks(prisma.stockMovement, movements);
}

async function seedInvoices(
  shopId: string,
  products: ProductRuntime[],
  customers: Awaited<ReturnType<typeof ensureCustomers>>,
  users: Awaited<ReturnType<typeof ensureUsers>>["users"],
  stockById: Map<string, number>
) {
  const existingIds = new Set((await prisma.invoice.findMany({
    where: { shopId, invoiceNo: { startsWith: "ALM-" } },
    select: { id: true }
  })).map((row) => row.id));
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const items: Prisma.InvoiceItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  let posSeq = 1;
  let creditSeq = 1;
  let phoneSeq = 1;

  for (let index = 1; index <= 90; index += 1) {
    const invoiceId = `alam_invoice_${String(index).padStart(6, "0")}`;
    if (existingIds.has(invoiceId)) continue;
    const channel = weightedPick([
      { item: "POS", weight: 78 },
      { item: "CREDIT", weight: 15 },
      { item: "PHONE_WHATSAPP", weight: 7 }
    ] as const);
    const invoiceNo = channel === "POS"
      ? `ALM-POS-2026-${String(posSeq++).padStart(6, "0")}`
      : channel === "CREDIT"
        ? `ALM-CREDIT-2026-${String(creditSeq++).padStart(6, "0")}`
        : `ALM-PHONE-2026-${String(phoneSeq++).padStart(6, "0")}`;
    const date = daysAgo(randInt(0, 45));
    const status = invoiceStatusPicker();
    const cashier = pick(users);
    const customerRequired = channel !== "POS" || status !== "PAID" || random() < 0.28;
    const customer = customerRequired ? pick(customers) : null;
    const rationBasket = customer?.customerType === "MONTHLY_RATION" && random() < 0.2;
    const itemCount = rationBasket ? randInt(5, 8) : randInt(1, 4);
    const preferredCategories = rationBasket
      ? ["Daily Grocery", "Flour, Rice & Pulses", "Cleaning & Household"]
      : channel === "PHONE_WHATSAPP"
        ? ["Daily Grocery", "Tea, Drinks & Snacks", "Dairy & Bread"]
        : undefined;
    const selected = new Set<string>();
    const saleItems: Array<{ id: string; product: ProductRuntime; quantity: number; unitPrice: number; costPrice: number; total: number }> = [];

    for (let line = 1; line <= itemCount; line += 1) {
      const product = productForBasket(products, preferredCategories);
      if (selected.has(product.id)) continue;
      const available = stockById.get(product.id) || 0;
      if (available <= 0) continue;
      selected.add(product.id);
      const maxAllowed = product.speed === "fast" ? (rationBasket ? 4 : 3) : (rationBasket ? 2 : 1);
      const quantity = randInt(1, Math.max(1, Math.min(available, maxAllowed)));
      saleItems.push({
        id: `alam_invoice_item_${String(index).padStart(6, "0")}_${String(line).padStart(2, "0")}`,
        product,
        quantity,
        unitPrice: num(product.salePrice),
        costPrice: num(product.costPrice),
        total: quantity * num(product.salePrice)
      });
    }
    if (!saleItems.length) continue;

    const subtotal = saleItems.reduce((sum, item) => sum + item.total, 0);
    const discountRate = rationBasket ? randInt(1, 3) / 100 : channel === "POS" ? 0 : randInt(0, 2) / 100;
    const discount = subtotal * discountRate;
    const total = Math.max(subtotal - discount, 0);
    const paidAmount = status === "CANCELLED" || status === "UNPAID"
      ? 0
      : status === "PAID"
        ? total
        : total * (randInt(35, 70) / 100);
    const dueAmount = status === "CANCELLED" ? 0 : Math.max(total - paidAmount, 0);
    const method = paidAmount > 0 ? paymentMethodPicker("customer") : undefined;
    const notes = channel === "PHONE_WHATSAPP" ? "Phone/WhatsApp order" : channel === "CREDIT" ? "Small customer credit sale" : "Counter cash sale";

    invoices.push({
      id: invoiceId,
      shopId,
      customerId: customer?.id || null,
      createdById: cashier.id,
      invoiceNo,
      status,
      subtotal: money(subtotal),
      discount: money(discount),
      tax: money(0),
      total: money(total),
      paidAmount: money(paidAmount),
      dueAmount: money(dueAmount),
      invoiceDate: date,
      dueDate: dueAmount > 0 ? addDays(date, randInt(3, 18)) : undefined,
      cashierCounter: "Main Counter",
      channel,
      loyaltyDiscount: money(0),
      promoCode: discount > 0 ? "NEIGHBOR" : undefined,
      receiptNo: invoiceNo.replace("ALM-", "RCPT-ALM-"),
      paymentBreakdown: method ? { [method]: Number(money(paidAmount)) } : Prisma.JsonNull,
      notes
    });

    for (const item of saleItems) {
      items.push({
        id: item.id,
        invoiceId,
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: money(item.unitPrice),
        costPrice: money(item.costPrice),
        total: money(item.total)
      });
      if (status !== "CANCELLED") {
        const beforeQty = stockById.get(item.product.id) || 0;
        const afterQty = beforeQty - item.quantity;
        stockById.set(item.product.id, afterQty);
        movements.push({
          id: `alam_sale_move_${String(index).padStart(6, "0")}_${item.id.slice(-2)}`,
          shopId,
          productId: item.product.id,
          userId: cashier.id,
          type: "SALE",
          quantity: -item.quantity,
          beforeQty,
          afterQty,
          reference: invoiceNo,
          notes,
          movedAt: date
        });
      }
    }

    if (paidAmount > 0 && method) {
      payments.push({
        id: `alam_customer_payment_${String(index).padStart(6, "0")}`,
        shopId,
        customerId: customer?.id || null,
        invoiceId,
        createdById: cashier.id,
        direction: "CUSTOMER_IN",
        method,
        amount: money(paidAmount),
        paidAt: date,
        reference: paymentReference(method, index),
        notes: `Customer receipt against ${invoiceNo}.`
      });
    }
  }

  await createManyInChunks(prisma.invoice, invoices);
  await createManyInChunks(prisma.invoiceItem, items);
  await createManyInChunks(prisma.payment, payments);
  await createManyInChunks(prisma.stockMovement, movements);
}

async function seedAdjustments(
  shopId: string,
  products: ProductRuntime[],
  users: Awaited<ReturnType<typeof ensureUsers>>["users"],
  stockById: Map<string, number>
) {
  const existingIds = new Set((await prisma.stockMovement.findMany({
    where: { shopId, id: { startsWith: "alam_adjustment_" } },
    select: { id: true }
  })).map((row) => row.id));
  const reasons = [
    ["DAMAGE", "Bread packet expired before closing"],
    ["DAMAGE", "Damaged biscuit pack removed from rack"],
    ["ADJUSTMENT", "Manual shelf count correction"],
    ["RETURN_IN", "Customer returned unopened wrong item"],
    ["DAMAGE", "Leaked milk pack discarded"],
    ["ADJUSTMENT", "Counter count corrected after rush hour"]
  ] as const;
  const movements: Prisma.StockMovementCreateManyInput[] = [];

  for (let index = 1; index <= 8; index += 1) {
    const id = `alam_adjustment_${String(index).padStart(3, "0")}`;
    if (existingIds.has(id)) continue;
    const [type, reason] = pick(reasons);
    const preferred = type === "DAMAGE"
      ? products.filter((product) => product.isPerishable || product.categoryName.includes("Snacks"))
      : products;
    const product = pick(preferred.length ? preferred : products);
    const beforeQty = stockById.get(product.id) || 0;
    const quantity = randInt(1, 2);
    let signedQuantity = quantity;
    if (type === "DAMAGE") signedQuantity = -Math.min(quantity, beforeQty);
    if (type === "ADJUSTMENT") signedQuantity = random() < 0.5 ? quantity : -Math.min(quantity, beforeQty);
    const afterQty = Math.max(0, beforeQty + signedQuantity);
    if (signedQuantity === 0) continue;
    stockById.set(product.id, afterQty);
    movements.push({
      id,
      shopId,
      productId: product.id,
      userId: pick(users).id,
      type: type as StockMovementType,
      quantity: signedQuantity,
      beforeQty,
      afterQty,
      reference: `ALM-ADJ-2026-${String(index).padStart(4, "0")}`,
      notes: reason,
      movedAt: daysAgo(randInt(1, 45))
    });
  }

  await createManyInChunks(prisma.stockMovement, movements);
}

async function flushStock(shopId: string, products: ProductRuntime[], stockById: Map<string, number>) {
  const rows = products
    .map((product) => ({ id: product.id, stockQty: Math.max(0, stockById.get(product.id) ?? product.stockQty) }))
    .filter((row) => Number.isFinite(row.stockQty));
  if (!rows.length) return;
  const values = Prisma.join(rows.map((row) => Prisma.sql`(${row.id}, ${row.stockQty})`));
  await prisma.$executeRaw`
    UPDATE "Product" AS p
    SET "stockQty" = v."stockQty"
    FROM (VALUES ${values}) AS v("id", "stockQty")
    WHERE p."id" = v."id" AND p."shopId" = ${shopId}
  `;
}

async function recalculateCustomerBalances(shopId: string) {
  await prisma.$executeRaw`
    UPDATE "Customer" AS c
    SET "balance" = ledger."due"
    FROM (
      SELECT c2."id", COALESCE(SUM(i."dueAmount"), 0) AS "due"
      FROM "Customer" c2
      LEFT JOIN "Invoice" i
        ON i."customerId" = c2."id"
        AND i."shopId" = ${shopId}
        AND i."status" <> 'CANCELLED'
      WHERE c2."shopId" = ${shopId}
      GROUP BY c2."id"
    ) AS ledger
    WHERE c."id" = ledger."id" AND c."shopId" = ${shopId}
  `;
}

async function recalculateSupplierBalances(shopId: string) {
  await prisma.$executeRaw`
    UPDATE "Supplier" AS s
    SET "balance" = ledger."due"
    FROM (
      SELECT s2."id", COALESCE(SUM(p."dueAmount"), 0) AS "due"
      FROM "Supplier" s2
      LEFT JOIN "Purchase" p
        ON p."supplierId" = s2."id"
        AND p."shopId" = ${shopId}
        AND p."status" <> 'CANCELLED'
      WHERE s2."shopId" = ${shopId}
      GROUP BY s2."id"
    ) AS ledger
    WHERE s."id" = ledger."id" AND s."shopId" = ${shopId}
  `;
}

async function shopStats(shopId: string) {
  const products = await prisma.product.findMany({ where: { shopId }, include: { category: true } });
  const invoices = await prisma.invoice.findMany({
    where: { shopId, status: { not: "CANCELLED" } },
    include: { items: { include: { product: { include: { category: true } } } } }
  });
  const invoiceAgg = await prisma.invoice.aggregate({
    where: { shopId, status: { not: "CANCELLED" } },
    _sum: { total: true, paidAmount: true, dueAmount: true }
  });
  const customerPaymentAgg = await prisma.payment.aggregate({
    where: { shopId, direction: "CUSTOMER_IN" },
    _sum: { amount: true }
  });
  const purchaseAgg = await prisma.purchase.aggregate({
    where: { shopId, status: { not: "CANCELLED" } },
    _sum: { total: true, paidAmount: true, dueAmount: true }
  });
  const customerAgg = await prisma.customer.aggregate({ where: { shopId }, _sum: { balance: true } });
  const supplierAgg = await prisma.supplier.aggregate({ where: { shopId }, _sum: { balance: true } });
  const inventoryValue = products.reduce((sum, product) => sum + product.stockQty * num(product.costPrice), 0);
  const lowStock = products.filter((product) => product.stockQty <= product.reorderLevel);
  const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
  const categorySales = new Map<string, number>();

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const productRow = productSales.get(item.productId) || { name: item.product.name, quantity: 0, revenue: 0 };
      productRow.quantity += item.quantity;
      productRow.revenue += num(item.total);
      productSales.set(item.productId, productRow);
      const categoryName = item.product.category?.name || "Uncategorized";
      categorySales.set(categoryName, (categorySales.get(categoryName) || 0) + num(item.total));
    }
  }

  return {
    totalInventoryValue: inventoryValue,
    totalSalesRevenue: num(invoiceAgg._sum.total),
    totalPaidAmount: num(customerPaymentAgg._sum.amount ?? invoiceAgg._sum.paidAmount),
    customerDues: num(customerAgg._sum.balance),
    supplierPayables: num(supplierAgg._sum.balance),
    totalPurchaseValue: num(purchaseAgg._sum.total),
    totalSupplierPaid: num(purchaseAgg._sum.paidAmount),
    lowStockCount: lowStock.length,
    lowStockNames: lowStock.slice(0, 6).map((product) => `${product.name} (${product.stockQty})`),
    topProducts: [...productSales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    topCategories: [...categorySales.entries()]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  };
}

async function seedAssistantThreads(shopId: string, adminId: string) {
  const stats = await shopStats(shopId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayInvoices = await prisma.invoice.aggregate({
    where: { shopId, status: { not: "CANCELLED" }, invoiceDate: { gte: todayStart } },
    _sum: { total: true, paidAmount: true, dueAmount: true },
    _count: { id: true }
  });
  const threadRows = [
    {
      id: "alam_assistant_thread_daily",
      title: "Daily Alam General Store Summary",
      user: "Summarize today's sales, cash received, customer credit and low stock items.",
      assistant: [
        `Today has ${todayInvoices._count.id} active bills with PKR ${Math.round(num(todayInvoices._sum.total)).toLocaleString()} in sales.`,
        `Collections recorded today: PKR ${Math.round(num(todayInvoices._sum.paidAmount)).toLocaleString()}. Today's open credit: PKR ${Math.round(num(todayInvoices._sum.dueAmount)).toLocaleString()}.`,
        stats.lowStockNames.length ? `Low stock watchlist: ${stats.lowStockNames.join(", ")}.` : "No urgent low-stock items are showing right now.",
        `Total customer dues are PKR ${Math.round(stats.customerDues).toLocaleString()}, which is still under the tiny-shop safety limit.`
      ].join("\n")
    },
    {
      id: "alam_assistant_thread_reorder",
      title: "Small Shop Reorder Suggestions",
      user: "What should I buy again from the wholesale market this week?",
      assistant: [
        "Keep the next purchase small and focused on daily cash movers: milk, bread, tea, biscuits, soft drinks and atta.",
        `Top sold products: ${stats.topProducts.map((item) => `${item.name} (${item.quantity})`).join(", ")}.`,
        stats.lowStockNames.length ? `Reorder soon: ${stats.lowStockNames.join(", ")}.` : "Reorder pressure is light right now.",
        `Supplier payables are PKR ${Math.round(stats.supplierPayables).toLocaleString()}, so cash purchases are still manageable.`
      ].join("\n")
    }
  ];

  for (const row of threadRows) {
    await prisma.assistantThread.upsert({
      where: { id: row.id },
      update: { shopId, createdById: adminId, title: row.title, mode: "OPERATIONS" },
      create: { id: row.id, shopId, createdById: adminId, title: row.title, mode: "OPERATIONS", createdAt: daysAgo(randInt(1, 8)) }
    });
    await prisma.assistantMessage.createMany({
      data: [
        { id: `${row.id}_user`, threadId: row.id, authorId: adminId, role: "user", content: row.user, metadata: { source: "Alam General Store operations" }, createdAt: daysAgo(randInt(1, 8)) },
        { id: `${row.id}_assistant`, threadId: row.id, role: "assistant", content: row.assistant, metadata: { source: "generated retail records" }, createdAt: daysAgo(randInt(1, 8)) }
      ],
      skipDuplicates: true
    });
  }
}

async function seedActivityLogs(shopId: string, users: Awaited<ReturnType<typeof ensureUsers>>["users"]) {
  const existingIds = new Set((await prisma.activityLog.findMany({
    where: { shopId, id: { startsWith: "alam_activity_" } },
    select: { id: true }
  })).map((row) => row.id));
  const templates = [
    ["SEED", "Small general store dataset prepared", "Generated retail records added for Alam General Store."],
    ["PRODUCT_CREATED", "Shelf product checked", "A daily-use SKU was reviewed for tiny-shop pricing and stock."],
    ["CUSTOMER_CREATED", "Nearby customer added", "A local customer account was prepared for small credit tracking."],
    ["SUPPLIER_CREATED", "Local supplier checked", "A nearby wholesale supplier was prepared for small purchase tracking."],
    ["INVOICE_CREATED", "Counter cash sale completed", "A simple daily cash sale was recorded."],
    ["CREDIT_SALE_CREATED", "Small credit sale recorded", "A regular customer bought household items on short credit."],
    ["PURCHASE_RECEIVED", "Small wholesale purchase received", "A small supplier purchase increased shelf stock."],
    ["PAYMENT_RECEIVED", "Customer payment received", "Customer collection was recorded against local shop sales."],
    ["SUPPLIER_PAYMENT", "Supplier payment made", "Cash or wallet payment was recorded for a supplier."],
    ["STOCK_ADJUSTMENT", "Shelf count adjusted", "Manual count corrected after small-shop shelf check."],
    ["LOW_STOCK_ALERT", "Low stock item flagged", "A fast-moving product reached reorder attention."],
    ["STAFF_LOGIN", "Helper opened workspace", "The helper checked the counter workspace."],
    ["ASSISTANT_SUMMARY", "Assistant summary generated", "AI assistant summarized sales, dues and reorder pressure."]
  ] as const;
  const logs: Prisma.ActivityLogCreateManyInput[] = [];

  for (let index = 1; index <= 28; index += 1) {
    const id = `alam_activity_${String(index).padStart(3, "0")}`;
    if (existingIds.has(id)) continue;
    const [type, title, details] = pick(templates);
    logs.push({
      id,
      shopId,
      userId: pick(users).id,
      type,
      title,
      details,
      metadata: { workspace: "tiny local general store", sequence: index },
      createdAt: daysAgo(randInt(0, 45))
    });
  }

  await createManyInChunks(prisma.activityLog, logs);
}

async function validateAlamSeed(shopId: string) {
  const [
    shop,
    usersCount,
    adminCount,
    staffCount,
    categoryCount,
    productCount,
    customerCount,
    supplierCount,
    invoiceCount,
    purchaseCount,
    paymentCount,
    stockMovementCount,
    activityLogCount,
    assistantThreadCount,
    assistantMessageCount
  ] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, name: true } }),
    prisma.user.count({ where: { shopId } }),
    prisma.user.count({ where: { shopId, role: "ADMIN" } }),
    prisma.user.count({ where: { shopId, role: "STAFF" } }),
    prisma.category.count({ where: { shopId } }),
    prisma.product.count({ where: { shopId } }),
    prisma.customer.count({ where: { shopId } }),
    prisma.supplier.count({ where: { shopId } }),
    prisma.invoice.count({ where: { shopId } }),
    prisma.purchase.count({ where: { shopId } }),
    prisma.payment.count({ where: { shopId } }),
    prisma.stockMovement.count({ where: { shopId } }),
    prisma.activityLog.count({ where: { shopId } }),
    prisma.assistantThread.count({ where: { shopId } }),
    prisma.assistantMessage.count({ where: { thread: { shopId } } })
  ]);
  const stats = await shopStats(shopId);
  const limitChecks = {
    inventoryValue: stats.totalInventoryValue < MONEY_LIMIT,
    salesRevenue: stats.totalSalesRevenue < MONEY_LIMIT,
    paidAmount: stats.totalPaidAmount < MONEY_LIMIT,
    customerDues: stats.customerDues < MONEY_LIMIT,
    supplierPayables: stats.supplierPayables < MONEY_LIMIT,
    totalPurchaseValue: stats.totalPurchaseValue < MONEY_LIMIT
  };

  return {
    shopId: shop?.id || shopId,
    shopName: shop?.name || SHOP.name,
    usersCount,
    adminCount,
    staffCount,
    categoryCount,
    productCount,
    customerCount,
    supplierCount,
    invoiceCount,
    purchaseCount,
    paymentCount,
    stockMovementCount,
    activityLogCount,
    assistantThreadCount,
    assistantMessageCount,
    ...stats,
    allMoneyTotalsUnderLimit: Object.values(limitChecks).every(Boolean),
    limitChecks
  };
}

function printValidation(stats: Awaited<ReturnType<typeof validateAlamSeed>>) {
  console.log("\nAlam General Store seed validation");
  console.log("----------------------------------");
  console.log(`Shop id: ${stats.shopId}`);
  console.log(`Shop name: ${stats.shopName}`);
  console.log(`Users count: ${stats.usersCount}`);
  console.log(`Exactly one ADMIN: ${stats.adminCount === 1 ? "yes" : `no (${stats.adminCount})`}`);
  console.log(`Staff count: ${stats.staffCount}`);
  console.log(`Category count: ${stats.categoryCount}`);
  console.log(`Product count: ${stats.productCount}`);
  console.log(`Customer count: ${stats.customerCount}`);
  console.log(`Supplier count: ${stats.supplierCount}`);
  console.log(`Invoice count: ${stats.invoiceCount}`);
  console.log(`Purchase count: ${stats.purchaseCount}`);
  console.log(`Payment count: ${stats.paymentCount}`);
  console.log(`Stock movement count: ${stats.stockMovementCount}`);
  console.log(`Activity log count: ${stats.activityLogCount}`);
  console.log(`Assistant thread/message count: ${stats.assistantThreadCount}/${stats.assistantMessageCount}`);
  console.log(`Inventory value: PKR ${Math.round(stats.totalInventoryValue).toLocaleString()}`);
  console.log(`Sales revenue: PKR ${Math.round(stats.totalSalesRevenue).toLocaleString()}`);
  console.log(`Paid amount: PKR ${Math.round(stats.totalPaidAmount).toLocaleString()}`);
  console.log(`Customer dues: PKR ${Math.round(stats.customerDues).toLocaleString()}`);
  console.log(`Supplier payables: PKR ${Math.round(stats.supplierPayables).toLocaleString()}`);
  console.log(`Total purchase value: PKR ${Math.round(stats.totalPurchaseValue).toLocaleString()}`);
  console.log(`Low stock products: ${stats.lowStockCount}`);
  console.log(`All money totals under PKR 1,000,000: ${stats.allMoneyTotalsUnderLimit ? "yes" : "no"}`);
  console.log("Top products by quantity sold:");
  for (const row of stats.topProducts) console.log(`- ${row.name}: ${row.quantity} units`);
  console.log("Top categories by revenue:");
  for (const row of stats.topCategories) console.log(`- ${row.name}: PKR ${Math.round(row.revenue).toLocaleString()}`);
}

function assertSeedShape(stats: Awaited<ReturnType<typeof validateAlamSeed>>) {
  const countChecks = [
    ["products", stats.productCount >= 20 && stats.productCount <= 40],
    ["customers", stats.customerCount >= 15 && stats.customerCount <= 25],
    ["suppliers", stats.supplierCount >= 4 && stats.supplierCount <= 6],
    ["users", stats.usersCount === 2],
    ["admin", stats.adminCount === 1],
    ["staff", stats.staffCount === 1],
    ["invoices", stats.invoiceCount >= 70 && stats.invoiceCount <= 110],
    ["purchases", stats.purchaseCount >= 15 && stats.purchaseCount <= 25],
    ["activity logs", stats.activityLogCount >= 20 && stats.activityLogCount <= 35]
  ] as const;
  const failed = countChecks.filter(([, ok]) => !ok).map(([label]) => label);
  if (failed.length) throw new Error(`Alam seed validation failed count checks: ${failed.join(", ")}`);
  if (!stats.allMoneyTotalsUnderLimit) {
    throw new Error(`Alam seed validation failed: one or more money totals exceeded PKR ${MONEY_LIMIT.toLocaleString()}.`);
  }
}

async function main() {
  const shop = await findOrCreateShop();
  const marker = await prisma.activityLog.findFirst({ where: { shopId: shop.id, type: SEED_MARKER }, select: { id: true } });
  if (marker) {
    console.log("Alam General Store seed already applied. No duplicate data created.");
    printValidation(await validateAlamSeed(shop.id));
    return;
  }

  const users = await ensureUsers(shop.id);
  const categories = await ensureCategories(shop.id);
  const suppliers = await ensureSuppliers(shop.id);
  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));
  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name, supplier.id]));
  const products = await ensureProducts(shop.id, categoryByName, supplierByName, users.staff.id);
  const customers = await ensureCustomers(shop.id);
  const stockById = new Map(products.map((product) => [product.id, product.stockQty]));

  await seedPurchases(shop.id, products, suppliers, users.users, stockById);
  await seedInvoices(shop.id, products, customers, users.users, stockById);
  await seedAdjustments(shop.id, products, users.users, stockById);
  await flushStock(shop.id, products, stockById);
  await recalculateCustomerBalances(shop.id);
  await recalculateSupplierBalances(shop.id);
  await seedAssistantThreads(shop.id, users.admin.id);
  await seedActivityLogs(shop.id, users.users);

  const statsBeforeMarker = await validateAlamSeed(shop.id);
  assertSeedShape(statsBeforeMarker);
  await prisma.activityLog.create({
    data: {
      shopId: shop.id,
      userId: users.admin.id,
      type: SEED_MARKER,
      title: "Alam General Store seed completed",
      details: "Append-only tiny local general store dataset created successfully for Alam General Store.",
      metadata: {
        products: statsBeforeMarker.productCount,
        customers: statsBeforeMarker.customerCount,
        invoices: statsBeforeMarker.invoiceCount,
        purchases: statsBeforeMarker.purchaseCount,
        inventoryValue: Math.round(statsBeforeMarker.totalInventoryValue),
        salesRevenue: Math.round(statsBeforeMarker.totalSalesRevenue),
        totalPurchaseValue: Math.round(statsBeforeMarker.totalPurchaseValue),
        allMoneyTotalsUnderLimit: statsBeforeMarker.allMoneyTotalsUnderLimit
      }
    }
  });

  const finalStats = await validateAlamSeed(shop.id);
  assertSeedShape(finalStats);
  printValidation(finalStats);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import bcrypt from "bcryptjs";
import {
  Prisma,
  PrismaClient,
  type InvoiceStatus,
  type PaymentMethod,
  type PurchaseStatus,
  type StockMovementType,
  type UserRole
} from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const SEED_MARKER = "SEED_KIRYANA_V1_COMPLETED";
const PASSWORD = "demo12345";
const SHOP = {
  name: "Al-Madina Kiryana Store",
  city: "Karachi",
  address: "Shop 12, Block 7, Gulshan-e-Iqbal, Karachi",
  phone: "0300-1112233",
  currency: "PKR"
};

let seed = 2026051802;
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
  date.setHours(randInt(8, 23), randInt(0, 59), randInt(0, 59), 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function makeSku(index: number) {
  return `KIR-KHI-${String(index).padStart(4, "0")}`;
}

function makeBarcode(index: number) {
  return String(8971000000000 + index);
}

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
}

function invoiceStatusPicker(): InvoiceStatus {
  const roll = random();
  if (roll < 0.82) return "PAID";
  if (roll < 0.92) return "PARTIAL";
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
      { item: "CASH", weight: 55 },
      { item: "BANK_TRANSFER", weight: 25 },
      { item: "CHEQUE", weight: 10 },
      { item: "EASYPAISA", weight: 5 },
      { item: "JAZZCASH", weight: 5 }
    ]);
  }
  return weightedPick<PaymentMethod>([
    { item: "CASH", weight: 70 },
    { item: "JAZZCASH", weight: 10 },
    { item: "EASYPAISA", weight: 8 },
    { item: "CARD", weight: 5 },
    { item: "BANK_TRANSFER", weight: 5 },
    { item: "OTHER", weight: 2 }
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
  return `${prefix[method]}-KIR-${String(index).padStart(4, "0")}`;
}

async function createManyInChunks<T>(delegate: { createMany(args: { data: T[]; skipDuplicates?: boolean }): Promise<unknown> }, data: T[], size = 1000) {
  for (let index = 0; index < data.length; index += size) {
    const chunk = data.slice(index, index + size);
    if (chunk.length) await delegate.createMany({ data: chunk, skipDuplicates: true });
  }
}

const CATEGORY_NAMES = [
  "Grocery Staples",
  "Rice, Flour & Pulses",
  "Tea, Beverages & Drinks",
  "Snacks, Biscuits & Bakery",
  "Dairy & Chilled",
  "Household & Cleaning",
  "Personal Care",
  "Baby, Stationery & Misc"
] as const;

const SUPPLIERS = [
  ["Jodia Bazaar Grocery Supplier", "Grocery Wholesale", "Jodia Bazaar, Karachi"],
  ["Local Rice & Flour Dealer", "Rice & Flour Dealer", "Gulshan Wholesale Market, Karachi"],
  ["Karachi FMCG Distributor", "FMCG Distributor", "Saddar, Karachi"],
  ["Beverage Crate Supplier", "Beverages", "Water Pump Market, Karachi"],
  ["Dairy & Chilled Distributor", "Dairy & Chilled", "Dhoraji, Karachi"],
  ["Cleaning Products Wholesaler", "Household Cleaning", "Federal B Area, Karachi"],
  ["Personal Care Distributor", "Personal Care", "Tariq Road, Karachi"],
  ["Bakery & Bread Supplier", "Bakery", "Gulshan Wholesale Market, Karachi"],
  ["Stationery Small Items Supplier", "Stationery & Misc", "Saddar, Karachi"],
  ["Baby Products Wholesaler", "Baby Products", "Tariq Road, Karachi"]
] as const;

const STAFF = [
  ["Ahmed Raza", "kiryana.cashier@shopiq.local", "STAFF", "Cashier", "Morning", "Counter"],
  ["Faisal Khan", "kiryana.stock@shopiq.local", "STAFF", "Stock Helper", "Afternoon", "Store Room"],
  ["Noman Ali", "kiryana.delivery@shopiq.local", "STAFF", "Delivery Boy", "Evening", "Delivery"]
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
  p("Sugar 1kg", "Local Sugar", "Grocery Staples", "kg", 185, [0.05, 0.1], "fast", "Front Shelf", "Jodia Bazaar Grocery Supplier", "Staple"),
  p("Sugar 5kg", "Local Sugar", "Grocery Staples", "bag", 900, [0.05, 0.1], "fast", "Back Shelf", "Jodia Bazaar Grocery Supplier", "Staple"),
  p("Salt 800g", "National", "Grocery Staples", "pack", 90, [0.08, 0.12], "fast", "Front Shelf", "Karachi FMCG Distributor", "Staple"),
  p("Cooking Oil 1L", "Dalda", "Grocery Staples", "bottle", 580, [0.06, 0.1], "fast", "Front Shelf", "Karachi FMCG Distributor", "Cooking Oil"),
  p("Cooking Oil 3L", "Dalda", "Grocery Staples", "bottle", 1700, [0.06, 0.1], "fast", "Store Room", "Karachi FMCG Distributor", "Cooking Oil"),
  p("Banaspati Ghee 1kg", "Sufi", "Grocery Staples", "pack", 560, [0.06, 0.1], "fast", "Front Shelf", "Karachi FMCG Distributor", "Ghee"),
  p("Banaspati Ghee 5kg", "Sufi", "Grocery Staples", "tin", 2650, [0.06, 0.1], "fast", "Store Room", "Karachi FMCG Distributor", "Ghee"),
  p("Shan Biryani Masala", "Shan", "Grocery Staples", "box", 170, [0.1, 0.18], "fast", "Counter Rack", "Karachi FMCG Distributor", "Masala"),
  p("National Karahi Masala", "National", "Grocery Staples", "box", 165, [0.1, 0.18], "fast", "Counter Rack", "Karachi FMCG Distributor", "Masala"),
  p("Red Chilli Powder 200g", "National", "Grocery Staples", "pack", 260, [0.08, 0.14], "medium", "Front Shelf", "Jodia Bazaar Grocery Supplier", "Spices"),
  p("Turmeric Powder 200g", "National", "Grocery Staples", "pack", 220, [0.08, 0.14], "medium", "Front Shelf", "Jodia Bazaar Grocery Supplier", "Spices"),
  p("Coriander Powder 200g", "National", "Grocery Staples", "pack", 230, [0.08, 0.14], "medium", "Front Shelf", "Jodia Bazaar Grocery Supplier", "Spices"),
  p("Tomato Ketchup 400g", "Knorr", "Grocery Staples", "bottle", 360, [0.1, 0.18], "medium", "Front Shelf", "Karachi FMCG Distributor", "Condiment"),
  p("Mayonnaise 250ml", "Young's", "Grocery Staples", "jar", 330, [0.12, 0.2], "medium", "Front Shelf", "Karachi FMCG Distributor", "Condiment"),
  p("Basmati Rice 1kg", "Local Premium", "Rice, Flour & Pulses", "kg", 380, [0.05, 0.12], "fast", "Rice Bags Corner", "Local Rice & Flour Dealer", "Rice"),
  p("Basmati Rice 5kg", "Local Premium", "Rice, Flour & Pulses", "bag", 1850, [0.05, 0.12], "fast", "Rice Bags Corner", "Local Rice & Flour Dealer", "Rice"),
  p("Sela Rice 5kg", "Guard", "Rice, Flour & Pulses", "bag", 2050, [0.05, 0.12], "medium", "Rice Bags Corner", "Local Rice & Flour Dealer", "Rice"),
  p("Chakki Atta 5kg", "Sunridge", "Rice, Flour & Pulses", "bag", 780, [0.05, 0.1], "fast", "Flour Stack", "Local Rice & Flour Dealer", "Flour"),
  p("Chakki Atta 10kg", "Sunridge", "Rice, Flour & Pulses", "bag", 1550, [0.05, 0.1], "fast", "Flour Stack", "Local Rice & Flour Dealer", "Flour"),
  p("Maida 1kg", "Bake Parlor", "Rice, Flour & Pulses", "pack", 190, [0.07, 0.12], "medium", "Back Shelf", "Local Rice & Flour Dealer", "Flour"),
  p("Besan 1kg", "Local", "Rice, Flour & Pulses", "pack", 280, [0.07, 0.12], "medium", "Back Shelf", "Local Rice & Flour Dealer", "Flour"),
  p("Dal Chana 1kg", "Local", "Rice, Flour & Pulses", "pack", 390, [0.07, 0.12], "fast", "Back Shelf", "Jodia Bazaar Grocery Supplier", "Pulses"),
  p("Dal Masoor 1kg", "Local", "Rice, Flour & Pulses", "pack", 430, [0.07, 0.12], "fast", "Back Shelf", "Jodia Bazaar Grocery Supplier", "Pulses"),
  p("Dal Moong 1kg", "Local", "Rice, Flour & Pulses", "pack", 470, [0.07, 0.12], "medium", "Back Shelf", "Jodia Bazaar Grocery Supplier", "Pulses"),
  p("White Chana 1kg", "Local", "Rice, Flour & Pulses", "pack", 520, [0.07, 0.12], "medium", "Back Shelf", "Jodia Bazaar Grocery Supplier", "Pulses"),
  p("Red Beans 1kg", "Local", "Rice, Flour & Pulses", "pack", 560, [0.07, 0.12], "medium", "Back Shelf", "Jodia Bazaar Grocery Supplier", "Pulses"),
  p("Tapal Danedar 190g", "Tapal", "Tea, Beverages & Drinks", "pack", 460, [0.08, 0.15], "fast", "Top Shelf", "Karachi FMCG Distributor", "Tea"),
  p("Tapal Danedar 475g", "Tapal", "Tea, Beverages & Drinks", "pack", 1100, [0.08, 0.15], "fast", "Top Shelf", "Karachi FMCG Distributor", "Tea"),
  p("Lipton Yellow Label 190g", "Lipton", "Tea, Beverages & Drinks", "pack", 480, [0.08, 0.15], "fast", "Top Shelf", "Karachi FMCG Distributor", "Tea"),
  p("Milk Powder 400g", "Nido", "Tea, Beverages & Drinks", "tin", 980, [0.1, 0.18], "medium", "Top Shelf", "Karachi FMCG Distributor", "Milk Powder"),
  p("Rooh Afza 800ml", "Hamdard", "Tea, Beverages & Drinks", "bottle", 520, [0.1, 0.18], "medium", "Front Shelf", "Beverage Crate Supplier", "Syrup"),
  p("Tang Orange 375g", "Tang", "Tea, Beverages & Drinks", "pack", 560, [0.12, 0.2], "medium", "Front Shelf", "Beverage Crate Supplier", "Powder Drink"),
  p("Pepsi 1.5L", "Pepsi", "Tea, Beverages & Drinks", "bottle", 250, [0.08, 0.18], "fast", "Drinks Fridge", "Beverage Crate Supplier", "Soft Drink"),
  p("Coca-Cola 1.5L", "Coca-Cola", "Tea, Beverages & Drinks", "bottle", 250, [0.08, 0.18], "fast", "Drinks Fridge", "Beverage Crate Supplier", "Soft Drink"),
  p("Sprite 1.5L", "Sprite", "Tea, Beverages & Drinks", "bottle", 250, [0.08, 0.18], "fast", "Drinks Fridge", "Beverage Crate Supplier", "Soft Drink"),
  p("Nestle Water 1.5L", "Nestle", "Tea, Beverages & Drinks", "bottle", 120, [0.08, 0.16], "fast", "Drinks Fridge", "Beverage Crate Supplier", "Water"),
  p("Juice Pack 1L", "Nestle Fruita Vitals", "Tea, Beverages & Drinks", "pack", 340, [0.1, 0.18], "medium", "Drinks Fridge", "Beverage Crate Supplier", "Juice"),
  p("Peek Freans Sooper", "Peek Freans", "Snacks, Biscuits & Bakery", "pack", 140, [0.12, 0.25], "fast", "Biscuit Rack", "Karachi FMCG Distributor", "Biscuits"),
  p("LU Prince", "LU", "Snacks, Biscuits & Bakery", "pack", 120, [0.12, 0.25], "fast", "Biscuit Rack", "Karachi FMCG Distributor", "Biscuits"),
  p("Tuc Crackers", "LU", "Snacks, Biscuits & Bakery", "pack", 110, [0.12, 0.25], "fast", "Biscuit Rack", "Karachi FMCG Distributor", "Biscuits"),
  p("Rio Biscuits", "Bisconni", "Snacks, Biscuits & Bakery", "pack", 100, [0.12, 0.25], "fast", "Biscuit Rack", "Karachi FMCG Distributor", "Biscuits"),
  p("Bisconni Chocolate Chip", "Bisconni", "Snacks, Biscuits & Bakery", "pack", 160, [0.12, 0.25], "medium", "Biscuit Rack", "Karachi FMCG Distributor", "Biscuits"),
  p("Kurkure Pack", "Kurkure", "Snacks, Biscuits & Bakery", "pack", 80, [0.14, 0.25], "fast", "Hanging Items Wall", "Karachi FMCG Distributor", "Snacks"),
  p("Lays Classic", "Lays", "Snacks, Biscuits & Bakery", "pack", 90, [0.14, 0.25], "fast", "Hanging Items Wall", "Karachi FMCG Distributor", "Snacks"),
  p("Nimco Mix 200g", "Kolson", "Snacks, Biscuits & Bakery", "pack", 240, [0.14, 0.25], "medium", "Counter Rack", "Karachi FMCG Distributor", "Snacks"),
  p("Cupcake Pack", "Hilal", "Snacks, Biscuits & Bakery", "pack", 180, [0.15, 0.28], "medium", "Counter Rack", "Bakery & Bread Supplier", "Bakery", true),
  p("Fresh Bread Small", "Local Bakery", "Snacks, Biscuits & Bakery", "loaf", 120, [0.15, 0.28], "fast", "Counter Rack", "Bakery & Bread Supplier", "Bread", true),
  p("Fresh Bread Large", "Local Bakery", "Snacks, Biscuits & Bakery", "loaf", 180, [0.15, 0.28], "fast", "Counter Rack", "Bakery & Bread Supplier", "Bread", true),
  p("Rusk Pack", "Bake Parlor", "Snacks, Biscuits & Bakery", "pack", 180, [0.12, 0.24], "medium", "Biscuit Rack", "Bakery & Bread Supplier", "Rusk"),
  p("Olpers Milk 1L", "Olpers", "Dairy & Chilled", "pack", 340, [0.08, 0.15], "fast", "Cold Fridge", "Dairy & Chilled Distributor", "Dairy", true),
  p("Milkpak 1L", "Milkpak", "Dairy & Chilled", "pack", 335, [0.08, 0.15], "fast", "Cold Fridge", "Dairy & Chilled Distributor", "Dairy", true),
  p("Dairy Omung 1L", "Dairy Omung", "Dairy & Chilled", "pack", 260, [0.08, 0.15], "fast", "Cold Fridge", "Dairy & Chilled Distributor", "Dairy", true),
  p("Yogurt 400g", "Dayfresh", "Dairy & Chilled", "tub", 250, [0.08, 0.15], "medium", "Cold Fridge", "Dairy & Chilled Distributor", "Dairy", true),
  p("Butter 200g", "Nurpur", "Dairy & Chilled", "pack", 620, [0.08, 0.15], "medium", "Cold Fridge", "Dairy & Chilled Distributor", "Dairy", true),
  p("Cheese Slices", "Adams", "Dairy & Chilled", "pack", 760, [0.1, 0.16], "medium", "Cold Fridge", "Dairy & Chilled Distributor", "Dairy", true),
  p("Eggs Dozen", "Farm Fresh", "Dairy & Chilled", "dozen", 360, [0.08, 0.15], "fast", "Counter Rack", "Dairy & Chilled Distributor", "Eggs", true),
  p("Frozen Paratha Pack", "Dawn", "Dairy & Chilled", "pack", 460, [0.1, 0.16], "medium", "Cold Fridge", "Dairy & Chilled Distributor", "Frozen"),
  p("Ice Cream Cup", "Walls", "Dairy & Chilled", "cup", 120, [0.12, 0.18], "medium", "Cold Fridge", "Dairy & Chilled Distributor", "Ice Cream", true),
  p("Surf Excel 500g", "Surf Excel", "Household & Cleaning", "pack", 340, [0.12, 0.22], "fast", "Cleaning Shelf", "Cleaning Products Wholesaler", "Detergent"),
  p("Surf Excel 1kg", "Surf Excel", "Household & Cleaning", "pack", 620, [0.12, 0.22], "fast", "Cleaning Shelf", "Cleaning Products Wholesaler", "Detergent"),
  p("Bonus Detergent 1kg", "Bonus", "Household & Cleaning", "pack", 420, [0.12, 0.22], "fast", "Cleaning Shelf", "Cleaning Products Wholesaler", "Detergent"),
  p("Ariel 500g", "Ariel", "Household & Cleaning", "pack", 360, [0.12, 0.22], "medium", "Cleaning Shelf", "Cleaning Products Wholesaler", "Detergent"),
  p("Lemon Max Dishwash Bar", "Lemon Max", "Household & Cleaning", "bar", 95, [0.14, 0.24], "fast", "Cleaning Shelf", "Cleaning Products Wholesaler", "Dishwash"),
  p("Vim Bar", "Vim", "Household & Cleaning", "bar", 85, [0.14, 0.24], "fast", "Cleaning Shelf", "Cleaning Products Wholesaler", "Dishwash"),
  p("Harpic 500ml", "Harpic", "Household & Cleaning", "bottle", 420, [0.14, 0.25], "medium", "Cleaning Shelf", "Cleaning Products Wholesaler", "Cleaner"),
  p("Dettol Surface Cleaner", "Dettol", "Household & Cleaning", "bottle", 520, [0.14, 0.25], "medium", "Cleaning Shelf", "Cleaning Products Wholesaler", "Cleaner"),
  p("Tissue Roll", "Rose Petal", "Household & Cleaning", "roll", 120, [0.12, 0.22], "fast", "Top Shelf", "Cleaning Products Wholesaler", "Paper Goods"),
  p("Garbage Bags Small", "Local", "Household & Cleaning", "pack", 180, [0.15, 0.25], "medium", "Hanging Items Wall", "Cleaning Products Wholesaler", "Household"),
  p("Matchbox Pack", "Ship", "Household & Cleaning", "pack", 70, [0.14, 0.24], "fast", "Counter Rack", "Jodia Bazaar Grocery Supplier", "Household"),
  p("Lifebuoy Soap", "Lifebuoy", "Personal Care", "bar", 150, [0.12, 0.24], "fast", "Personal Care Shelf", "Personal Care Distributor", "Soap"),
  p("Dettol Soap", "Dettol", "Personal Care", "bar", 170, [0.12, 0.24], "fast", "Personal Care Shelf", "Personal Care Distributor", "Soap"),
  p("Lux Soap", "Lux", "Personal Care", "bar", 160, [0.12, 0.24], "fast", "Personal Care Shelf", "Personal Care Distributor", "Soap"),
  p("Colgate Toothpaste", "Colgate", "Personal Care", "tube", 290, [0.12, 0.24], "fast", "Personal Care Shelf", "Personal Care Distributor", "Oral Care"),
  p("Closeup Toothpaste", "Closeup", "Personal Care", "tube", 310, [0.12, 0.24], "medium", "Personal Care Shelf", "Personal Care Distributor", "Oral Care"),
  p("Sunsilk Shampoo Sachet", "Sunsilk", "Personal Care", "sachet", 20, [0.15, 0.25], "fast", "Hanging Items Wall", "Personal Care Distributor", "Hair Care"),
  p("Head & Shoulders Sachet", "Head & Shoulders", "Personal Care", "sachet", 25, [0.15, 0.25], "fast", "Hanging Items Wall", "Personal Care Distributor", "Hair Care"),
  p("Fair & Lovely Cream", "Glow & Lovely", "Personal Care", "tube", 360, [0.16, 0.25], "medium", "Personal Care Shelf", "Personal Care Distributor", "Skin Care"),
  p("Vaseline Small", "Vaseline", "Personal Care", "jar", 220, [0.16, 0.25], "medium", "Personal Care Shelf", "Personal Care Distributor", "Skin Care"),
  p("Hand Wash 250ml", "Lifebuoy", "Personal Care", "bottle", 280, [0.14, 0.24], "medium", "Personal Care Shelf", "Personal Care Distributor", "Hand Wash"),
  p("Toothbrush", "Colgate", "Personal Care", "pcs", 170, [0.15, 0.25], "medium", "Personal Care Shelf", "Personal Care Distributor", "Oral Care"),
  p("Pampers Small Pack", "Pampers", "Baby, Stationery & Misc", "pack", 900, [0.15, 0.25], "medium", "Top Shelf", "Baby Products Wholesaler", "Baby Care"),
  p("Baby Wipes Small", "Canbebe", "Baby, Stationery & Misc", "pack", 260, [0.15, 0.25], "medium", "Top Shelf", "Baby Products Wholesaler", "Baby Care"),
  p("Cerelac 175g", "Nestle", "Baby, Stationery & Misc", "tin", 500, [0.12, 0.2], "medium", "Top Shelf", "Baby Products Wholesaler", "Baby Food"),
  p("Ball Pen", "Dollar", "Baby, Stationery & Misc", "pcs", 30, [0.2, 0.35], "medium", "Counter Rack", "Stationery Small Items Supplier", "Stationery"),
  p("Pencil Pack", "Goldfish", "Baby, Stationery & Misc", "pack", 120, [0.2, 0.35], "slow", "Counter Rack", "Stationery Small Items Supplier", "Stationery"),
  p("Notebook Small", "Local", "Baby, Stationery & Misc", "pcs", 100, [0.2, 0.35], "medium", "Counter Rack", "Stationery Small Items Supplier", "Stationery"),
  p("AA Battery Pair", "Osaka", "Baby, Stationery & Misc", "pair", 220, [0.18, 0.3], "slow", "Counter Rack", "Stationery Small Items Supplier", "Battery"),
  p("Mobile Charger Cable", "Audionic", "Baby, Stationery & Misc", "pcs", 380, [0.2, 0.35], "slow", "Counter Rack", "Stationery Small Items Supplier", "Mobile Accessories")
];

const AREAS = ["Gulshan-e-Iqbal Block 7", "Gulshan-e-Iqbal Block 6", "Dhoraji", "Bahadurabad", "University Road", "Johar Mor", "Nipa", "Federal B Area", "Scheme 33"];
const FIRST_NAMES = ["Ahmed", "Ali", "Bilal", "Danish", "Fahad", "Hassan", "Imran", "Kamran", "Noman", "Owais", "Saad", "Tariq", "Usman", "Ayesha", "Fatima", "Hina", "Iqra", "Maham", "Nida", "Sadia", "Zainab"];
const LAST_NAMES = ["Khan", "Ahmed", "Raza", "Malik", "Qureshi", "Farooqui", "Ali", "Hussain", "Sheikh", "Ansari", "Memon", "Akhtar", "Nadeem", "Alam", "Iqbal"];
const CUSTOMER_NOTES = [
  "Nearby regular customer",
  "Monthly ration customer",
  "Takes small credit",
  "Pays weekly",
  "Pays by cash",
  "Sends order on WhatsApp",
  "Office tea/snacks account",
  "Family grocery customer"
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
    where: { email: "kiryana.admin@shopiq.local" },
    update: {
      shopId,
      name: "Muhammad Imran",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Owner",
      phone: "0300-1112233",
      cnic: "42101-7000000-1",
      shift: "Flexible",
      branchArea: "Owner Counter",
      joiningDate: daysAgo(730),
      permissions: { workspace: "full", canApproveAiWrites: true, canManageStaff: true }
    },
    create: {
      shopId,
      name: "Muhammad Imran",
      email: "kiryana.admin@shopiq.local",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Owner",
      phone: "0300-1112233",
      cnic: "42101-7000000-1",
      shift: "Flexible",
      branchArea: "Owner Counter",
      joiningDate: daysAgo(730),
      permissions: { workspace: "full", canApproveAiWrites: true, canManageStaff: true }
    }
  });

  const users = [admin];
  for (let index = 0; index < STAFF.length; index += 1) {
    const [name, email, role, designation, shift, branchArea] = STAFF[index];
    users.push(await prisma.user.upsert({
      where: { email },
      update: {
        shopId,
        name,
        passwordHash,
        role: role as UserRole,
        status: "ACTIVE",
        designation,
        phone: `0300-0002${String(index + 1).padStart(3, "0")}`,
        cnic: `42101-70${String(index + 10).padStart(5, "0")}-${randInt(1, 9)}`,
        shift,
        branchArea,
        joiningDate: daysAgo(randInt(90, 500)),
        permissions: {
          canUsePOS: designation === "Cashier",
          canReceiveStock: designation === "Stock Helper",
          canDeliverOrders: designation === "Delivery Boy"
        }
      },
      create: {
        shopId,
        name,
        email,
        passwordHash,
        role: role as UserRole,
        status: "ACTIVE",
        designation,
        phone: `0300-0002${String(index + 1).padStart(3, "0")}`,
        cnic: `42101-70${String(index + 10).padStart(5, "0")}-${randInt(1, 9)}`,
        shift,
        branchArea,
        joiningDate: daysAgo(randInt(90, 500)),
        permissions: {
          canUsePOS: designation === "Cashier",
          canReceiveStock: designation === "Stock Helper",
          canDeliverOrders: designation === "Delivery Boy"
        }
      }
    }));
  }
  return { admin, users };
}

async function ensureCategories(shopId: string) {
  const colors = ["emerald", "amber", "cyan", "violet", "blue", "lime", "rose", "teal"];
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
    const id = `kiryana_supplier_${String(index + 1).padStart(3, "0")}`;
    const data = {
      shopId,
      name,
      phone: `0300-0003${String(index + 1).padStart(3, "0")}`,
      email: `supplier${String(index + 1).padStart(3, "0")}@kiryana-demo.local`,
      address,
      contactPerson: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      paymentTerms: pick(["Cash on delivery", "7 days credit", "15 days credit", "Weekly settlement"]),
      ntn: `${randInt(1000000, 9999999)}-${randInt(1, 9)}`,
      gstNumber: `GST-KIR-${randInt(10000, 99999)}`,
      leadTimeDays: randInt(1, 5),
      supplierType,
      balance: money(0),
      reliabilityScore: randInt(70, 95),
      notes: `Local supplier used for kiryana operations and small weekly stock replenishment.`
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
  if (speed === "fast") return { stock: randInt(25, 120), reorderLevel: randInt(10, 25), reorderQuantity: randInt(20, 60) };
  if (speed === "medium") return { stock: randInt(10, 60), reorderLevel: randInt(5, 12), reorderQuantity: randInt(10, 30) };
  return { stock: randInt(3, 25), reorderLevel: randInt(2, 6), reorderQuantity: randInt(5, 15) };
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
    const expiryDate = item.perishable ? addDays(new Date(), randInt(4, 45)) : undefined;
    const product = await prisma.product.upsert({
      where: { shopId_sku: { shopId, sku } },
      update: {
        categoryId: categoryByName.get(item.category),
        supplierId: supplierByName.get(item.supplier),
        barcode: makeBarcode(index + 1),
        name: item.name,
        brand: item.brand,
        description: `${item.name} stocked for realistic small general store operations at Al-Madina Kiryana Store.`,
        unit: item.unit,
        costPrice: money(costPrice),
        salePrice: money(item.price),
        taxRate: money(0),
        discountRate: money(item.speed === "fast" ? randInt(0, 2) : randInt(0, 4)),
        reorderLevel: stockPlan.reorderLevel,
        reorderQuantity: stockPlan.reorderQuantity,
        location: item.location,
        aisle: item.location,
        shelf: `${String.fromCharCode(65 + (index % 5))}-${randInt(1, 6)}`,
        productType: item.productType,
        isPerishable: Boolean(item.perishable),
        batchNo: `KIR-B${String(index + 1).padStart(3, "0")}-${randInt(10, 99)}`,
        manufactureDate: item.perishable ? daysAgo(randInt(1, 8)) : undefined,
        expiryDate
      },
      create: {
        shopId,
        categoryId: categoryByName.get(item.category),
        supplierId: supplierByName.get(item.supplier),
        sku,
        barcode: makeBarcode(index + 1),
        name: item.name,
        brand: item.brand,
        description: `${item.name} stocked for realistic small general store operations at Al-Madina Kiryana Store.`,
        unit: item.unit,
        costPrice: money(costPrice),
        salePrice: money(item.price),
        taxRate: money(0),
        discountRate: money(item.speed === "fast" ? randInt(0, 2) : randInt(0, 4)),
        stockQty: stockPlan.stock,
        reorderLevel: stockPlan.reorderLevel,
        reorderQuantity: stockPlan.reorderQuantity,
        location: item.location,
        aisle: item.location,
        shelf: `${String.fromCharCode(65 + (index % 5))}-${randInt(1, 6)}`,
        productType: item.productType,
        isPerishable: Boolean(item.perishable),
        batchNo: `KIR-B${String(index + 1).padStart(3, "0")}-${randInt(10, 99)}`,
        manufactureDate: item.perishable ? daysAgo(randInt(1, 8)) : undefined,
        expiryDate
      },
      include: { category: true, supplier: true }
    });

    const openingExists = await prisma.stockMovement.findFirst({
      where: { shopId, productId: product.id, type: "OPENING", reference: "KIR-OPENING-2026" },
      select: { id: true }
    });
    if (!openingExists && product.stockQty > 0) {
      await prisma.stockMovement.create({
        data: {
          id: `kiryana_opening_${String(index + 1).padStart(3, "0")}`,
          shopId,
          productId: product.id,
          userId: stockUserId,
          type: "OPENING",
          quantity: product.stockQty,
          beforeQty: 0,
          afterQty: product.stockQty,
          reference: "KIR-OPENING-2026",
          notes: "Opening stock for local store dataset.",
          movedAt: daysAgo(92)
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
    { type: "NEARBY_HOUSEHOLD", weight: 34, credit: [0, 5000] },
    { type: "MONTHLY_RATION", weight: 26, credit: [5000, 15000] },
    { type: "SMALL_CREDIT", weight: 22, credit: [1000, 8000] },
    { type: "OFFICE_TEA_SNACKS", weight: 10, credit: [10000, 30000] },
    { type: "PHONE_DELIVERY", weight: 8, credit: [0, 7000] }
  ] as const;
  for (let index = 0; index < 48; index += 1) {
    const segment = weightedPick(segments.map((item) => ({ item, weight: item.weight })));
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const id = `kiryana_customer_${String(index + 1).padStart(3, "0")}`;
    const phone = `0300-0004${String(index + 1).padStart(3, "0")}`;
    const creditLimit = randInt(segment.credit[0], segment.credit[1]);
    rows.push(await prisma.customer.upsert({
      where: { id },
      update: {
        shopId,
        name,
        phone,
        email: `customer${String(index + 1).padStart(3, "0")}@kiryana-demo.local`,
        address: `${pick(AREAS)}, Karachi`,
        loyaltyCardNo: `KIR-LC-${String(index + 1).padStart(5, "0")}`,
        customerType: segment.type,
        area: pick(AREAS),
        city: "Karachi",
        whatsapp: phone,
        loyaltyPoints: randInt(0, 480),
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
        email: `customer${String(index + 1).padStart(3, "0")}@kiryana-demo.local`,
        address: `${pick(AREAS)}, Karachi`,
        loyaltyCardNo: `KIR-LC-${String(index + 1).padStart(5, "0")}`,
        customerType: segment.type,
        area: pick(AREAS),
        city: "Karachi",
        whatsapp: phone,
        loyaltyPoints: randInt(0, 480),
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
  return weightedPick(pool.map((product) => ({ item: product, weight: product.saleWeight })));
}

async function seedPurchases(
  shopId: string,
  products: ProductRuntime[],
  suppliers: Awaited<ReturnType<typeof ensureSuppliers>>,
  users: Awaited<ReturnType<typeof ensureUsers>>["users"],
  stockById: Map<string, number>
) {
  const existingIds = new Set((await prisma.purchase.findMany({
    where: { shopId, purchaseNo: { startsWith: "KIR-PO-2026-" } },
    select: { id: true }
  })).map((row) => row.id));
  const purchaseUsers = users.filter((user) => user.role === "ADMIN" || user.designation === "Stock Helper");
  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name, supplier]));
  const purchases: Prisma.PurchaseCreateManyInput[] = [];
  const items: Prisma.PurchaseItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];

  for (let index = 1; index <= 60; index += 1) {
    const purchaseId = `kiryana_purchase_${String(index).padStart(6, "0")}`;
    const purchaseNo = `KIR-PO-2026-${String(index).padStart(6, "0")}`;
    const status = purchaseStatusPicker();
    const date = daysAgo(randInt(1, 90));
    const creator = pick(purchaseUsers);
    const lineCount = randInt(2, 8);
    const selected = new Set<string>();
    const purchaseItems: Array<{ id: string; product: ProductRuntime; quantity: number; receivedQty: number; unitCost: number; total: number }> = [];

    for (let line = 1; line <= lineCount; line += 1) {
      const product = productForBasket(products);
      if (selected.has(product.id)) continue;
      selected.add(product.id);
      const baseQty = product.speed === "fast" ? randInt(12, 48) : product.speed === "medium" ? randInt(6, 24) : randInt(3, 12);
      const receivedQty = status === "ORDERED" ? 0 : status === "PARTIAL" ? Math.max(1, Math.floor(baseQty * (randInt(35, 70) / 100))) : baseQty;
      const unitCost = Math.max(1, num(product.costPrice) * (0.96 + random() * 0.08));
      purchaseItems.push({
        id: `kiryana_purchase_item_${String(index).padStart(6, "0")}_${String(line).padStart(2, "0")}`,
        product,
        quantity: baseQty,
        receivedQty,
        unitCost,
        total: baseQty * unitCost
      });
    }
    if (!purchaseItems.length || existingIds.has(purchaseId)) continue;

    const supplier = supplierByName.get(pick(purchaseItems).product.supplier?.name || "") || pick(suppliers);
    const subtotal = purchaseItems.reduce((sum, item) => sum + item.total, 0);
    const paidBehavior = weightedPick([
      { item: "FULL", weight: 65 },
      { item: "PARTIAL", weight: 25 },
      { item: "UNPAID", weight: 10 }
    ] as const);
    const paidAmount = status === "ORDERED" ? 0 : paidBehavior === "FULL" ? subtotal : paidBehavior === "PARTIAL" ? subtotal * (randInt(35, 75) / 100) : 0;
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
      notes: `${supplier.name} replenishment for small kiryana shelf stock.`
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
          id: `kiryana_purchase_move_${String(index).padStart(6, "0")}_${item.id.slice(-2)}`,
          shopId,
          productId: item.product.id,
          userId: creator.id,
          type: "PURCHASE",
          quantity: item.receivedQty,
          beforeQty,
          afterQty,
          reference: purchaseNo,
          notes: status === "PARTIAL" ? "Partial supplier delivery received." : "Supplier purchase received.",
          movedAt: date
        });
      }
    }
    // Payment handled via Purchase paidAmount
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
    where: { shopId, invoiceNo: { startsWith: "KIR-" } },
    select: { id: true }
  })).map((row) => row.id));
  const cashiers = users.filter((user) => user.role === "ADMIN" || user.designation === "Cashier" || user.designation === "Delivery Boy");
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const items: Prisma.InvoiceItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  let posSeq = 1;
  let creditSeq = 1;
  let deliverySeq = 1;

  for (let index = 1; index <= 240; index += 1) {
    const channel = weightedPick([
      { item: "POS", weight: 75 },
      { item: "CREDIT", weight: 15 },
      { item: "PHONE_DELIVERY", weight: 10 }
    ] as const);
    const invoiceId = `kiryana_invoice_${String(index).padStart(6, "0")}`;
    const invoiceNo = channel === "POS"
      ? `KIR-POS-2026-${String(posSeq++).padStart(6, "0")}`
      : channel === "CREDIT"
        ? `KIR-CREDIT-2026-${String(creditSeq++).padStart(6, "0")}`
        : `KIR-DEL-2026-${String(deliverySeq++).padStart(6, "0")}`;
    const date = daysAgo(randInt(0, 75));
    const status = invoiceStatusPicker();
    const cashier = channel === "PHONE_DELIVERY"
      ? users.find((user) => user.designation === "Delivery Boy") || pick(cashiers)
      : pick(cashiers);
    const customerRequired = channel !== "POS" || status !== "PAID" || random() < 0.35;
    const customer = customerRequired ? pick(customers) : null;
    const monthlyBasket = customer?.customerType === "MONTHLY_RATION" && random() < 0.3;
    const itemCount = monthlyBasket ? randInt(8, 15) : randInt(1, 7);
    const preferredCategories = monthlyBasket
      ? ["Grocery Staples", "Rice, Flour & Pulses", "Tea, Beverages & Drinks", "Household & Cleaning"]
      : channel === "PHONE_DELIVERY"
        ? ["Grocery Staples", "Tea, Beverages & Drinks", "Snacks, Biscuits & Bakery", "Dairy & Chilled"]
        : undefined;
    const selected = new Set<string>();
    const saleItems: Array<{ id: string; product: ProductRuntime; quantity: number; unitPrice: number; costPrice: number; total: number }> = [];

    for (let line = 1; line <= itemCount; line += 1) {
      const product = productForBasket(products, preferredCategories);
      if (selected.has(product.id)) continue;
      const available = stockById.get(product.id) || 0;
      if (available <= 0) continue;
      selected.add(product.id);
      const maxQty = monthlyBasket ? Math.min(available, product.speed === "fast" ? randInt(2, 6) : randInt(1, 3)) : Math.min(available, product.speed === "fast" ? randInt(1, 4) : 2);
      const quantity = Math.max(1, maxQty);
      saleItems.push({
        id: `kiryana_invoice_item_${String(index).padStart(6, "0")}_${String(line).padStart(2, "0")}`,
        product,
        quantity,
        unitPrice: num(product.salePrice),
        costPrice: num(product.costPrice),
        total: quantity * num(product.salePrice)
      });
    }
    if (!saleItems.length || existingIds.has(invoiceId)) continue;

    const subtotal = saleItems.reduce((sum, item) => sum + item.total, 0);
    const discountRate = customer?.customerType === "MONTHLY_RATION"
      ? randInt(2, 5) / 100
      : customer?.customerType === "OFFICE_TEA_SNACKS"
        ? randInt(2, 4) / 100
        : channel === "POS"
          ? 0
          : randInt(0, 3) / 100;
    const discount = subtotal * discountRate;
    const total = Math.max(subtotal - discount, 0);
    const paidAmount = status === "CANCELLED" || status === "UNPAID"
      ? 0
      : status === "PAID"
        ? total
        : total * (randInt(25, 75) / 100);
    const dueAmount = status === "CANCELLED" ? 0 : Math.max(total - paidAmount, 0);
    const method = paidAmount > 0 ? paymentMethodPicker("customer") : undefined;
    const notes = channel === "PHONE_DELIVERY" ? "Phone delivery sale" : channel === "CREDIT" ? "Credit sale" : "Counter sale";

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
      dueDate: dueAmount > 0 ? addDays(date, randInt(3, 21)) : undefined,
      cashierCounter: channel === "PHONE_DELIVERY" ? "Phone/WhatsApp Counter" : "Counter 01",
      channel,
      loyaltyDiscount: money(0),
      promoCode: discount > 0 ? "LOCAL-REGULAR" : undefined,
      receiptNo: invoiceNo.replace("KIR-", "RCPT-KIR-"),
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
          id: `kiryana_sale_move_${String(index).padStart(6, "0")}_${item.id.slice(-2)}`,
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
        id: `kiryana_customer_payment_${String(index).padStart(6, "0")}`,
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

async function seedAdjustments(shopId: string, products: ProductRuntime[], users: Awaited<ReturnType<typeof ensureUsers>>["users"], stockById: Map<string, number>) {
  const existingIds = new Set((await prisma.stockMovement.findMany({
    where: { shopId, id: { startsWith: "kiryana_adjustment_" } },
    select: { id: true }
  })).map((row) => row.id));
  const stockUser = users.find((user) => user.designation === "Stock Helper") || users[0];
  const reasons = [
    ["RETURN_IN", "Bread returned by customer at counter"],
    ["DAMAGE", "Damaged biscuit packet removed from shelf"],
    ["DAMAGE", "Cold fridge item expired"],
    ["ADJUSTMENT", "Cycle count correction after shelf check"],
    ["DAMAGE", "Leaked oil pouch removed"],
    ["RETURN_IN", "Wrong item returned by regular customer"]
  ] as const;
  const movements: Prisma.StockMovementCreateManyInput[] = [];

  for (let index = 1; index <= 12; index += 1) {
    const id = `kiryana_adjustment_${String(index).padStart(3, "0")}`;
    const [type, reason] = pick(reasons);
    const preferred = type === "DAMAGE" ? products.filter((product) => product.isPerishable || product.categoryName.includes("Snacks") || product.productType === "Cooking Oil") : products;
    const product = pick(preferred.length ? preferred : products);
    const beforeQty = stockById.get(product.id) || 0;
    let quantity = randInt(1, type === "ADJUSTMENT" ? 4 : 3);
    let signedQuantity = quantity;
    if (type === "DAMAGE") signedQuantity = -Math.min(quantity, beforeQty);
    if (type === "ADJUSTMENT") signedQuantity = random() < 0.55 ? Math.min(quantity, 8) : -Math.min(quantity, beforeQty);
    const afterQty = Math.max(0, beforeQty + signedQuantity);
    if (existingIds.has(id) || signedQuantity === 0) continue;
    stockById.set(product.id, afterQty);
    movements.push({
      id,
      shopId,
      productId: product.id,
      userId: stockUser.id,
      type: type as StockMovementType,
      quantity: signedQuantity,
      beforeQty,
      afterQty,
      reference: `KIR-ADJ-2026-${String(index).padStart(4, "0")}`,
      notes: reason,
      movedAt: daysAgo(randInt(1, 60))
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
  const paymentAgg = await prisma.payment.aggregate({
    where: { shopId, direction: "CUSTOMER_IN" },
    _sum: { amount: true }
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
    totalPaidAmount: num(paymentAgg._sum.amount ?? invoiceAgg._sum.paidAmount),
    customerDues: num(customerAgg._sum.balance),
    supplierPayables: num(supplierAgg._sum.balance),
    lowStockCount: lowStock.length,
    lowStockNames: lowStock.slice(0, 6).map((product) => `${product.name} (${product.stockQty})`),
    topProducts: [...productSales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    topCategories: [...categorySales.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
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
      id: "kiryana_assistant_thread_daily",
      title: "Daily Kiryana Store Summary",
      user: "Summarize today's sales, cash collected, credit sales, and low stock items.",
      assistant: [
        `Today has ${todayInvoices._count.id} active bills with PKR ${Math.round(num(todayInvoices._sum.total)).toLocaleString()} in sales.`,
        `Cash/customer collections recorded: PKR ${Math.round(num(todayInvoices._sum.paidAmount)).toLocaleString()}. Open credit from today's bills: PKR ${Math.round(num(todayInvoices._sum.dueAmount)).toLocaleString()}.`,
        stats.lowStockNames.length ? `Low stock watchlist: ${stats.lowStockNames.join(", ")}.` : "No urgent low-stock items are showing right now.",
        `Current customer dues across the store are PKR ${Math.round(stats.customerDues).toLocaleString()}.`
      ].join("\n")
    },
    {
      id: "kiryana_assistant_thread_reorder",
      title: "Weekly Reorder Suggestions",
      user: "Which items should I buy again from wholesale market this week?",
      assistant: [
        "Prioritize the fast-moving grocery and beverage lines first, then refill chilled items in smaller quantities.",
        `Top movement products: ${stats.topProducts.map((item) => `${item.name} (${item.quantity} sold)`).join(", ")}.`,
        stats.lowStockNames.length ? `Buy again soon: ${stats.lowStockNames.join(", ")}.` : "Reorder pressure is light, but keep milk, bread, tea and detergents reviewed daily.",
        `Supplier payables currently stand at PKR ${Math.round(stats.supplierPayables).toLocaleString()}, so split cash purchases and short-credit purchases carefully.`
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
        { id: `${row.id}_user`, threadId: row.id, authorId: adminId, role: "user", content: row.user, metadata: { source: "kiryana operations" }, createdAt: daysAgo(randInt(1, 8)) },
        { id: `${row.id}_assistant`, threadId: row.id, role: "assistant", content: row.assistant, metadata: { source: "generated retail records" }, createdAt: daysAgo(randInt(1, 8)) }
      ],
      skipDuplicates: true
    });
  }
}

async function seedActivityLogs(shopId: string, users: Awaited<ReturnType<typeof ensureUsers>>["users"]) {
  const existingIds = new Set((await prisma.activityLog.findMany({
    where: { shopId, id: { startsWith: "kiryana_activity_" } },
    select: { id: true }
  })).map((row) => row.id));
  const templates = [
    ["SEED", "Local store dataset prepared", "Generated retail records added for Al-Madina Kiryana Store."],
    ["PRODUCT_CREATED", "Product shelf reviewed", "A fast-moving grocery product was verified for stock and pricing."],
    ["CUSTOMER_CREATED", "Regular customer added", "A nearby customer account was added with local contact details."],
    ["SUPPLIER_CREATED", "Supplier profile checked", "A local wholesale supplier profile was prepared for purchase tracking."],
    ["INVOICE_CREATED", "Counter sale completed", "A daily kiryana invoice was recorded through POS."],
    ["CREDIT_SALE_CREATED", "Credit sale recorded", "A regular customer bought grocery items on short credit."],
    ["PURCHASE_RECEIVED", "Wholesale stock received", "A small supplier purchase increased available shelf stock."],
    ["PAYMENT_RECEIVED", "Customer payment received", "Customer collection was recorded against open dues."],
    ["SUPPLIER_PAYMENT", "Supplier payment made", "Cash or bank payment was recorded for supplier settlement."],
    ["STOCK_ADJUSTMENT", "Stock count adjusted", "Shelf count was corrected after manual review."],
    ["LOW_STOCK_ALERT", "Low stock item flagged", "A fast-moving SKU reached reorder attention."],
    ["STAFF_LOGIN", "Staff workspace opened", "A store team member checked the operating workspace."],
    ["ASSISTANT_SUMMARY", "Assistant summary generated", "AI assistant summarized sales, dues and reorder pressure."]
  ] as const;
  const logs: Prisma.ActivityLogCreateManyInput[] = [];
  for (let index = 1; index <= 55; index += 1) {
    const id = `kiryana_activity_${String(index).padStart(3, "0")}`;
    if (existingIds.has(id)) continue;
    const [type, title, details] = pick(templates);
    logs.push({
      id,
      shopId,
      userId: pick(users).id,
      type,
      title,
      details,
      metadata: { workspace: "small general store workspace", sequence: index },
      createdAt: daysAgo(randInt(0, 75))
    });
  }
  await createManyInChunks(prisma.activityLog, logs);
}

async function validateKiryanaSeed(shopId: string) {
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
    ...stats
  };
}

function printValidation(stats: Awaited<ReturnType<typeof validateKiryanaSeed>>) {
  console.log("\nKiryana seed validation");
  console.log("-----------------------");
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
  console.log(`Total inventory value: PKR ${Math.round(stats.totalInventoryValue).toLocaleString()}`);
  console.log(`Total sales revenue: PKR ${Math.round(stats.totalSalesRevenue).toLocaleString()}`);
  console.log(`Total paid amount: PKR ${Math.round(stats.totalPaidAmount).toLocaleString()}`);
  console.log(`Customer dues: PKR ${Math.round(stats.customerDues).toLocaleString()}`);
  console.log(`Supplier payables: PKR ${Math.round(stats.supplierPayables).toLocaleString()}`);
  console.log(`Low stock product count: ${stats.lowStockCount}`);
  console.log("Top 5 products by quantity sold:");
  for (const row of stats.topProducts) console.log(`- ${row.name}: ${row.quantity} units`);
  console.log("Top 5 categories by revenue:");
  for (const row of stats.topCategories) console.log(`- ${row.name}: PKR ${Math.round(row.revenue).toLocaleString()}`);
}

async function main() {
  const shop = await findOrCreateShop();
  const marker = await prisma.activityLog.findFirst({ where: { shopId: shop.id, type: SEED_MARKER }, select: { id: true } });
  if (marker) {
    console.log("Kiryana store seed already applied. No duplicate data created.");
    printValidation(await validateKiryanaSeed(shop.id));
    return;
  }

  const users = await ensureUsers(shop.id);
  const categories = await ensureCategories(shop.id);
  const suppliers = await ensureSuppliers(shop.id);
  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));
  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name, supplier.id]));
  const stockUser = users.users.find((user) => user.designation === "Stock Helper") || users.admin;
  const products = await ensureProducts(shop.id, categoryByName, supplierByName, stockUser.id);
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

  const statsBeforeMarker = await validateKiryanaSeed(shop.id);
  await prisma.activityLog.create({
    data: {
      shopId: shop.id,
      userId: users.admin.id,
      type: SEED_MARKER,
      title: "Kiryana store seed completed",
      details: "Append-only local store dataset created successfully for Al-Madina Kiryana Store.",
      metadata: {
        products: statsBeforeMarker.productCount,
        customers: statsBeforeMarker.customerCount,
        invoices: statsBeforeMarker.invoiceCount,
        purchases: statsBeforeMarker.purchaseCount,
        totalSalesRevenue: Math.round(statsBeforeMarker.totalSalesRevenue)
      }
    }
  });

  printValidation(await validateKiryanaSeed(shop.id));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

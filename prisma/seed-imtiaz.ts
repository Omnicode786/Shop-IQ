import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, type InvoiceStatus, type PaymentMethod, type PurchaseStatus, type StockMovementType, type UserRole } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const SEED_MARKER = "SEED_IMTIAZ_V1_COMPLETED";
const PASSWORD = "demo12345";
const SHOP = {
  name: "Imtiaz",
  city: "Karachi",
  address: "Main Rashid Minhas Road, Gulshan-e-Iqbal, Karachi",
  phone: "021-111-468-429",
  currency: "PKR"
};

let seed = 20260518;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function money(n: number) {
  return new Prisma.Decimal((Math.round(n * 100) / 100).toFixed(2));
}

function randInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick<T>(array: T[]) {
  return array[randInt(0, array.length - 1)];
}

function weightedPick<T>(options: Array<{ item: T; weight: number }>) {
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
  date.setHours(randInt(9, 22), randInt(0, 59), randInt(0, 59), 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function makeSku(index: number) {
  return `IMT-KHI-${String(index).padStart(4, "0")}`;
}

function makeBarcode(index: number) {
  return String(8961000000000 + index);
}

function invoiceStatusPicker(): InvoiceStatus {
  const roll = random();
  if (roll < 0.78) return "PAID";
  if (roll < 0.9) return "PARTIAL";
  if (roll < 0.98) return "UNPAID";
  return "CANCELLED";
}

function purchaseStatusPicker(): PurchaseStatus {
  const roll = random();
  if (roll < 0.85) return "RECEIVED";
  if (roll < 0.95) return "PARTIAL";
  return "ORDERED";
}

function paymentMethodPicker(kind: "customer" | "supplier"): PaymentMethod {
  if (kind === "supplier") {
    return weightedPick<PaymentMethod>([
      { item: "BANK_TRANSFER", weight: 65 },
      { item: "CHEQUE", weight: 20 },
      { item: "CASH", weight: 15 }
    ]);
  }
  return weightedPick<PaymentMethod>([
    { item: "CASH", weight: 45 },
    { item: "CARD", weight: 25 },
    { item: "JAZZCASH", weight: 10 },
    { item: "EASYPAISA", weight: 8 },
    { item: "BANK_TRANSFER", weight: 8 },
    { item: "CHEQUE", weight: 2 },
    { item: "OTHER", weight: 2 }
  ]);
}

function slug(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
}

function fakePhone() {
  return `03${randInt(0, 4)}${randInt(0, 9)}${String(randInt(0, 9999999)).padStart(7, "0")}`;
}

async function createManyInChunks<T>(delegate: any, data: T[], size = 1000) {
  for (let index = 0; index < data.length; index += size) {
    const chunk = data.slice(index, index + size);
    if (chunk.length) await delegate.createMany({ data: chunk, skipDuplicates: true });
  }
}

const CATEGORY_NAMES = [
  "Grocery Staples",
  "Rice, Flour & Pulses",
  "Beverages",
  "Confectionery & Bakery",
  "Dairy & Frozen",
  "Meat, Seafood & Produce",
  "Baby & Newborn",
  "Household & Cleaning",
  "Pharmacy, Health & Personal Care",
  "Electronics & Accessories",
  "Homeware, Crockery & Decor",
  "Fashion, Hosiery & Accessories",
  "Stationery, Toys & Sports",
  "Dry Fruits & Imported Goods",
  "Perfumes, Makeup & Beauty",
  "Chill Zone & Ready-to-Eat"
];

const SUPPLIERS = [
  ["Karachi FMCG Distribution", "FMCG Distributor", "SITE Area, Karachi"],
  ["Pakistan Grocery Wholesale Hub", "Grocery Wholesale", "Jodia Bazaar, Karachi"],
  ["Fresh Farms Karachi", "Fresh Produce", "New Sabzi Mandi, Karachi"],
  ["Meat & Seafood Cold Chain", "Cold Chain", "Korangi Industrial Area, Karachi"],
  ["Beverage Supply Network", "Beverages", "Shahrah-e-Faisal, Karachi"],
  ["Dairy Cold Storage Distributor", "Dairy Cold Storage", "Landhi Industrial Area, Karachi"],
  ["Household Care Distributor", "Household Care", "Bolton Market, Karachi"],
  ["Health & Personal Care Supply", "Health & Personal Care", "Saddar, Karachi"],
  ["Bakery Production Unit", "Bakery", "Tariq Road, Karachi"],
  ["Baby Care Wholesale", "Baby Care", "Bahadurabad, Karachi"],
  ["Electronics Accessories Market", "Electronics Accessories", "Saddar, Karachi"],
  ["Crockery & Homeware Traders", "Homeware", "Bolton Market, Karachi"],
  ["Stationery & Toy Wholesale", "Stationery & Toys", "Urdu Bazaar, Karachi"],
  ["Textile Basics Supplier", "Textile Basics", "Tariq Road, Karachi"],
  ["Frozen Foods Distributor", "Frozen Foods", "Korangi Industrial Area, Karachi"],
  ["Mandi Produce Partner", "Produce", "Super Highway, Karachi"],
  ["Pharmacy OTC Distributor", "Pharmacy OTC", "Saddar, Karachi"],
  ["Imported Goods Distributor", "Imported Goods", "Shahrah-e-Faisal, Karachi"],
  ["Beauty & Perfume Wholesale", "Beauty & Perfume", "Tariq Road, Karachi"],
  ["Dry Fruit Market Supplier", "Dry Fruits", "Jodia Bazaar, Karachi"],
  ["Chill Zone Ready Foods", "Ready-to-Eat", "Gulshan-e-Iqbal, Karachi"],
  ["Apparel Basics Distributor", "Apparel Basics", "Tariq Road, Karachi"]
] as const;

const LOCATIONS = {
  grocery: "Aisle 01 - Grocery Staples",
  rice: "Aisle 02 - Rice, Flour & Pulses",
  oil: "Aisle 03 - Cooking Oil & Masala",
  beverage: "Aisle 04 - Beverages",
  bakery: "Bakery Counter",
  cold: "Cold Room",
  frozen: "Frozen Section",
  fresh: "Fresh Counter",
  meat: "Meat Section",
  seafood: "Seafood Counter",
  pharmacy: "Pharmacy Shelf",
  electronics: "Electronics Bay",
  crockery: "Crockery Bay",
  beauty: "Beauty Wall",
  newborn: "Newborn Section",
  toys: "Toys & Sports Aisle",
  chill: "Chill Zone",
  dry: "Dry Fruits Counter",
  fashion: "Fashion Basics Wall"
};

type ProductSeed = {
  name: string;
  brand: string;
  category: string;
  unit: string;
  price: number;
  margin: [number, number];
  speed: "fast" | "medium" | "slow";
  location: string;
  supplier: string;
  productType: string;
  perishable?: boolean;
};

const PRODUCTS: ProductSeed[] = [
  { name: "Basmati Rice 5kg", brand: "Falak", category: "Rice, Flour & Pulses", unit: "bag", price: 1850, margin: [0.05, 0.1], speed: "fast", location: LOCATIONS.rice, supplier: "Pakistan Grocery Wholesale Hub", productType: "Staple" },
  { name: "Super Kernel Rice 5kg", brand: "Guard", category: "Rice, Flour & Pulses", unit: "bag", price: 2150, margin: [0.05, 0.1], speed: "fast", location: LOCATIONS.rice, supplier: "Pakistan Grocery Wholesale Hub", productType: "Staple" },
  { name: "Chakki Atta 10kg", brand: "Sunridge", category: "Rice, Flour & Pulses", unit: "bag", price: 1680, margin: [0.05, 0.1], speed: "fast", location: LOCATIONS.rice, supplier: "Pakistan Grocery Wholesale Hub", productType: "Staple" },
  { name: "Fine Atta 5kg", brand: "Bake Parlor", category: "Rice, Flour & Pulses", unit: "bag", price: 780, margin: [0.05, 0.1], speed: "fast", location: LOCATIONS.rice, supplier: "Pakistan Grocery Wholesale Hub", productType: "Staple" },
  { name: "Sugar 5kg", brand: "Imtiaz Value", category: "Grocery Staples", unit: "bag", price: 875, margin: [0.05, 0.09], speed: "fast", location: LOCATIONS.grocery, supplier: "Pakistan Grocery Wholesale Hub", productType: "Staple" },
  { name: "Dal Chana 1kg", brand: "Imtiaz Value", category: "Rice, Flour & Pulses", unit: "pack", price: 390, margin: [0.08, 0.12], speed: "fast", location: LOCATIONS.rice, supplier: "Pakistan Grocery Wholesale Hub", productType: "Pulses" },
  { name: "Dal Masoor 1kg", brand: "Imtiaz Value", category: "Rice, Flour & Pulses", unit: "pack", price: 430, margin: [0.08, 0.12], speed: "fast", location: LOCATIONS.rice, supplier: "Pakistan Grocery Wholesale Hub", productType: "Pulses" },
  { name: "Cooking Oil 5L", brand: "Dalda", category: "Grocery Staples", unit: "bottle", price: 2850, margin: [0.06, 0.12], speed: "fast", location: LOCATIONS.oil, supplier: "Karachi FMCG Distribution", productType: "Cooking Oil" },
  { name: "Banaspati Ghee 5kg", brand: "Sufi", category: "Grocery Staples", unit: "tin", price: 2650, margin: [0.06, 0.12], speed: "fast", location: LOCATIONS.oil, supplier: "Karachi FMCG Distribution", productType: "Ghee" },
  { name: "Shan Biryani Masala", brand: "Shan", category: "Grocery Staples", unit: "box", price: 170, margin: [0.1, 0.18], speed: "fast", location: LOCATIONS.oil, supplier: "Karachi FMCG Distribution", productType: "Masala" },
  { name: "National Karahi Masala", brand: "National", category: "Grocery Staples", unit: "box", price: 165, margin: [0.1, 0.18], speed: "fast", location: LOCATIONS.oil, supplier: "Karachi FMCG Distribution", productType: "Masala" },
  { name: "Tapal Danedar Tea 950g", brand: "Tapal", category: "Grocery Staples", unit: "pack", price: 1580, margin: [0.08, 0.15], speed: "fast", location: LOCATIONS.grocery, supplier: "Karachi FMCG Distribution", productType: "Tea" },
  { name: "Lipton Yellow Label Tea 900g", brand: "Lipton", category: "Grocery Staples", unit: "pack", price: 1720, margin: [0.08, 0.15], speed: "fast", location: LOCATIONS.grocery, supplier: "Karachi FMCG Distribution", productType: "Tea" },
  { name: "Nestle Water 1.5L", brand: "Nestle", category: "Beverages", unit: "bottle", price: 120, margin: [0.08, 0.16], speed: "fast", location: LOCATIONS.beverage, supplier: "Beverage Supply Network", productType: "Water" },
  { name: "Pepsi 1.5L", brand: "Pepsi", category: "Beverages", unit: "bottle", price: 250, margin: [0.08, 0.18], speed: "fast", location: LOCATIONS.beverage, supplier: "Beverage Supply Network", productType: "Soft Drink" },
  { name: "Coca-Cola 1.5L", brand: "Coca-Cola", category: "Beverages", unit: "bottle", price: 250, margin: [0.08, 0.18], speed: "fast", location: LOCATIONS.beverage, supplier: "Beverage Supply Network", productType: "Soft Drink" },
  { name: "Sprite 1.5L", brand: "Sprite", category: "Beverages", unit: "bottle", price: 250, margin: [0.08, 0.18], speed: "fast", location: LOCATIONS.beverage, supplier: "Beverage Supply Network", productType: "Soft Drink" },
  { name: "Rooh Afza 800ml", brand: "Hamdard", category: "Beverages", unit: "bottle", price: 520, margin: [0.1, 0.18], speed: "medium", location: LOCATIONS.beverage, supplier: "Beverage Supply Network", productType: "Syrup" },
  { name: "Tang Orange 750g", brand: "Tang", category: "Beverages", unit: "jar", price: 950, margin: [0.12, 0.2], speed: "medium", location: LOCATIONS.beverage, supplier: "Beverage Supply Network", productType: "Powder Drink" },
  { name: "Peek Freans Sooper", brand: "Peek Freans", category: "Confectionery & Bakery", unit: "pack", price: 140, margin: [0.15, 0.28], speed: "fast", location: LOCATIONS.bakery, supplier: "Bakery Production Unit", productType: "Biscuits" },
  { name: "LU Prince", brand: "LU", category: "Confectionery & Bakery", unit: "pack", price: 120, margin: [0.15, 0.28], speed: "fast", location: LOCATIONS.bakery, supplier: "Bakery Production Unit", productType: "Biscuits" },
  { name: "Tuc Crackers", brand: "LU", category: "Confectionery & Bakery", unit: "pack", price: 110, margin: [0.15, 0.28], speed: "fast", location: LOCATIONS.bakery, supplier: "Bakery Production Unit", productType: "Crackers" },
  { name: "Dairy Milk", brand: "Cadbury", category: "Confectionery & Bakery", unit: "bar", price: 220, margin: [0.18, 0.32], speed: "medium", location: LOCATIONS.bakery, supplier: "Imported Goods Distributor", productType: "Chocolate" },
  { name: "Fresh Bread Large", brand: "Imtiaz Bakery", category: "Confectionery & Bakery", unit: "loaf", price: 180, margin: [0.15, 0.3], speed: "fast", location: LOCATIONS.bakery, supplier: "Bakery Production Unit", productType: "Bakery", perishable: true },
  { name: "Plain Cake", brand: "Imtiaz Bakery", category: "Confectionery & Bakery", unit: "piece", price: 420, margin: [0.18, 0.35], speed: "medium", location: LOCATIONS.bakery, supplier: "Bakery Production Unit", productType: "Bakery", perishable: true },
  { name: "Olpers Milk 1L", brand: "Olpers", category: "Dairy & Frozen", unit: "pack", price: 340, margin: [0.08, 0.16], speed: "fast", location: LOCATIONS.cold, supplier: "Dairy Cold Storage Distributor", productType: "Dairy", perishable: true },
  { name: "Milkpak 1L", brand: "Milkpak", category: "Dairy & Frozen", unit: "pack", price: 335, margin: [0.08, 0.16], speed: "fast", location: LOCATIONS.cold, supplier: "Dairy Cold Storage Distributor", productType: "Dairy", perishable: true },
  { name: "Dayfresh Yogurt", brand: "Dayfresh", category: "Dairy & Frozen", unit: "tub", price: 250, margin: [0.1, 0.18], speed: "medium", location: LOCATIONS.cold, supplier: "Dairy Cold Storage Distributor", productType: "Dairy", perishable: true },
  { name: "Adams Cheese Slices", brand: "Adams", category: "Dairy & Frozen", unit: "pack", price: 760, margin: [0.12, 0.22], speed: "medium", location: LOCATIONS.cold, supplier: "Dairy Cold Storage Distributor", productType: "Dairy", perishable: true },
  { name: "Frozen Paratha", brand: "Dawn", category: "Dairy & Frozen", unit: "pack", price: 460, margin: [0.12, 0.22], speed: "medium", location: LOCATIONS.frozen, supplier: "Frozen Foods Distributor", productType: "Frozen" },
  { name: "Frozen Nuggets", brand: "K&N's", category: "Dairy & Frozen", unit: "pack", price: 920, margin: [0.12, 0.22], speed: "medium", location: LOCATIONS.frozen, supplier: "Frozen Foods Distributor", productType: "Frozen" },
  { name: "Chicken Boneless 1kg", brand: "Imtiaz Fresh", category: "Meat, Seafood & Produce", unit: "kg", price: 980, margin: [0.08, 0.18], speed: "medium", location: LOCATIONS.meat, supplier: "Meat & Seafood Cold Chain", productType: "Meat", perishable: true },
  { name: "Beef Mince 1kg", brand: "Imtiaz Fresh", category: "Meat, Seafood & Produce", unit: "kg", price: 1350, margin: [0.08, 0.18], speed: "medium", location: LOCATIONS.meat, supplier: "Meat & Seafood Cold Chain", productType: "Meat", perishable: true },
  { name: "Fish Fillet 1kg", brand: "Imtiaz Fresh", category: "Meat, Seafood & Produce", unit: "kg", price: 1650, margin: [0.1, 0.2], speed: "medium", location: LOCATIONS.seafood, supplier: "Meat & Seafood Cold Chain", productType: "Seafood", perishable: true },
  { name: "Eggs Dozen", brand: "Imtiaz Fresh", category: "Meat, Seafood & Produce", unit: "dozen", price: 360, margin: [0.08, 0.16], speed: "fast", location: LOCATIONS.fresh, supplier: "Fresh Farms Karachi", productType: "Eggs", perishable: true },
  { name: "Potatoes 1kg", brand: "Fresh Farms", category: "Meat, Seafood & Produce", unit: "kg", price: 120, margin: [0.08, 0.18], speed: "fast", location: LOCATIONS.fresh, supplier: "Mandi Produce Partner", productType: "Produce", perishable: true },
  { name: "Onion 1kg", brand: "Fresh Farms", category: "Meat, Seafood & Produce", unit: "kg", price: 140, margin: [0.08, 0.18], speed: "fast", location: LOCATIONS.fresh, supplier: "Mandi Produce Partner", productType: "Produce", perishable: true },
  { name: "Tomato 1kg", brand: "Fresh Farms", category: "Meat, Seafood & Produce", unit: "kg", price: 180, margin: [0.08, 0.18], speed: "fast", location: LOCATIONS.fresh, supplier: "Mandi Produce Partner", productType: "Produce", perishable: true },
  { name: "Apples 1kg", brand: "Fresh Farms", category: "Meat, Seafood & Produce", unit: "kg", price: 460, margin: [0.1, 0.2], speed: "medium", location: LOCATIONS.fresh, supplier: "Mandi Produce Partner", productType: "Produce", perishable: true },
  { name: "Bananas Dozen", brand: "Fresh Farms", category: "Meat, Seafood & Produce", unit: "dozen", price: 260, margin: [0.1, 0.2], speed: "fast", location: LOCATIONS.fresh, supplier: "Mandi Produce Partner", productType: "Produce", perishable: true },
  { name: "Pampers Diapers Small", brand: "Pampers", category: "Baby & Newborn", unit: "pack", price: 1450, margin: [0.12, 0.22], speed: "medium", location: LOCATIONS.newborn, supplier: "Baby Care Wholesale", productType: "Baby Care" },
  { name: "Baby Wipes", brand: "Canbebe", category: "Baby & Newborn", unit: "pack", price: 380, margin: [0.12, 0.24], speed: "medium", location: LOCATIONS.newborn, supplier: "Baby Care Wholesale", productType: "Baby Care" },
  { name: "Surf Excel 1kg", brand: "Surf Excel", category: "Household & Cleaning", unit: "pack", price: 620, margin: [0.12, 0.22], speed: "fast", location: LOCATIONS.grocery, supplier: "Household Care Distributor", productType: "Detergent" },
  { name: "Ariel 1kg", brand: "Ariel", category: "Household & Cleaning", unit: "pack", price: 650, margin: [0.12, 0.22], speed: "fast", location: LOCATIONS.grocery, supplier: "Household Care Distributor", productType: "Detergent" },
  { name: "Harpic Toilet Cleaner", brand: "Harpic", category: "Household & Cleaning", unit: "bottle", price: 420, margin: [0.14, 0.25], speed: "medium", location: LOCATIONS.grocery, supplier: "Household Care Distributor", productType: "Cleaner" },
  { name: "Dettol Surface Cleaner", brand: "Dettol", category: "Household & Cleaning", unit: "bottle", price: 520, margin: [0.14, 0.25], speed: "medium", location: LOCATIONS.grocery, supplier: "Household Care Distributor", productType: "Cleaner" },
  { name: "Lifebuoy Soap", brand: "Lifebuoy", category: "Pharmacy, Health & Personal Care", unit: "bar", price: 150, margin: [0.12, 0.24], speed: "fast", location: LOCATIONS.pharmacy, supplier: "Health & Personal Care Supply", productType: "Personal Care" },
  { name: "Head & Shoulders Shampoo", brand: "Head & Shoulders", category: "Pharmacy, Health & Personal Care", unit: "bottle", price: 780, margin: [0.14, 0.25], speed: "medium", location: LOCATIONS.pharmacy, supplier: "Health & Personal Care Supply", productType: "Hair Care" },
  { name: "Colgate Toothpaste", brand: "Colgate", category: "Pharmacy, Health & Personal Care", unit: "tube", price: 290, margin: [0.12, 0.24], speed: "fast", location: LOCATIONS.pharmacy, supplier: "Health & Personal Care Supply", productType: "Oral Care" },
  { name: "Panadol Pack", brand: "GSK", category: "Pharmacy, Health & Personal Care", unit: "strip", price: 60, margin: [0.1, 0.18], speed: "medium", location: LOCATIONS.pharmacy, supplier: "Pharmacy OTC Distributor", productType: "OTC" },
  { name: "ORS Sachet", brand: "Electral", category: "Pharmacy, Health & Personal Care", unit: "sachet", price: 45, margin: [0.1, 0.18], speed: "medium", location: LOCATIONS.pharmacy, supplier: "Pharmacy OTC Distributor", productType: "OTC" },
  { name: "LED Bulb 12W", brand: "Philips", category: "Electronics & Accessories", unit: "pcs", price: 650, margin: [0.22, 0.35], speed: "slow", location: LOCATIONS.electronics, supplier: "Electronics Accessories Market", productType: "Electronics" },
  { name: "Extension Board", brand: "PakLite", category: "Electronics & Accessories", unit: "pcs", price: 1250, margin: [0.22, 0.38], speed: "slow", location: LOCATIONS.electronics, supplier: "Electronics Accessories Market", productType: "Electronics" },
  { name: "USB Cable", brand: "Audionic", category: "Electronics & Accessories", unit: "pcs", price: 380, margin: [0.25, 0.4], speed: "medium", location: LOCATIONS.electronics, supplier: "Electronics Accessories Market", productType: "Mobile Accessories" },
  { name: "Dinner Plate Set", brand: "Ocean", category: "Homeware, Crockery & Decor", unit: "set", price: 2850, margin: [0.22, 0.38], speed: "slow", location: LOCATIONS.crockery, supplier: "Crockery & Homeware Traders", productType: "Crockery" },
  { name: "Glass Set", brand: "Bormioli", category: "Homeware, Crockery & Decor", unit: "set", price: 1450, margin: [0.22, 0.38], speed: "slow", location: LOCATIONS.crockery, supplier: "Crockery & Homeware Traders", productType: "Crockery" },
  { name: "Fry Pan", brand: "Prestige", category: "Homeware, Crockery & Decor", unit: "pcs", price: 2150, margin: [0.22, 0.38], speed: "slow", location: LOCATIONS.crockery, supplier: "Crockery & Homeware Traders", productType: "Kitchenware" },
  { name: "Men Socks Pack", brand: "Basics", category: "Fashion, Hosiery & Accessories", unit: "pack", price: 650, margin: [0.25, 0.42], speed: "slow", location: LOCATIONS.fashion, supplier: "Apparel Basics Distributor", productType: "Hosiery" },
  { name: "Basic T-Shirt", brand: "Basics", category: "Fashion, Hosiery & Accessories", unit: "pcs", price: 950, margin: [0.25, 0.42], speed: "slow", location: LOCATIONS.fashion, supplier: "Textile Basics Supplier", productType: "Menswear" },
  { name: "Ball Pen Pack", brand: "Dollar", category: "Stationery, Toys & Sports", unit: "pack", price: 220, margin: [0.2, 0.35], speed: "medium", location: LOCATIONS.toys, supplier: "Stationery & Toy Wholesale", productType: "Stationery" },
  { name: "Notebook Register", brand: "Local", category: "Stationery, Toys & Sports", unit: "pcs", price: 180, margin: [0.2, 0.35], speed: "medium", location: LOCATIONS.toys, supplier: "Stationery & Toy Wholesale", productType: "Stationery" },
  { name: "Football", brand: "Star", category: "Stationery, Toys & Sports", unit: "pcs", price: 1350, margin: [0.25, 0.4], speed: "slow", location: LOCATIONS.toys, supplier: "Stationery & Toy Wholesale", productType: "Sports" },
  { name: "Toy Car", brand: "Kids Joy", category: "Stationery, Toys & Sports", unit: "pcs", price: 780, margin: [0.25, 0.4], speed: "slow", location: LOCATIONS.toys, supplier: "Stationery & Toy Wholesale", productType: "Toys" },
  { name: "Almonds 250g", brand: "Imtiaz Premium", category: "Dry Fruits & Imported Goods", unit: "pack", price: 980, margin: [0.25, 0.4], speed: "medium", location: LOCATIONS.dry, supplier: "Dry Fruit Market Supplier", productType: "Dry Fruits" },
  { name: "Cashew 250g", brand: "Imtiaz Premium", category: "Dry Fruits & Imported Goods", unit: "pack", price: 1250, margin: [0.25, 0.4], speed: "medium", location: LOCATIONS.dry, supplier: "Dry Fruit Market Supplier", productType: "Dry Fruits" },
  { name: "Imported Chocolate", brand: "Lindt", category: "Dry Fruits & Imported Goods", unit: "bar", price: 950, margin: [0.25, 0.45], speed: "slow", location: LOCATIONS.dry, supplier: "Imported Goods Distributor", productType: "Imported" },
  { name: "Olive Oil 500ml", brand: "Borges", category: "Dry Fruits & Imported Goods", unit: "bottle", price: 1850, margin: [0.22, 0.38], speed: "slow", location: LOCATIONS.dry, supplier: "Imported Goods Distributor", productType: "Imported" },
  { name: "Body Spray", brand: "Axe", category: "Perfumes, Makeup & Beauty", unit: "bottle", price: 720, margin: [0.25, 0.42], speed: "medium", location: LOCATIONS.beauty, supplier: "Beauty & Perfume Wholesale", productType: "Fragrance" },
  { name: "Perfume 100ml", brand: "J.", category: "Perfumes, Makeup & Beauty", unit: "bottle", price: 2850, margin: [0.28, 0.45], speed: "slow", location: LOCATIONS.beauty, supplier: "Beauty & Perfume Wholesale", productType: "Perfume" },
  { name: "Lipstick", brand: "Medora", category: "Perfumes, Makeup & Beauty", unit: "pcs", price: 420, margin: [0.25, 0.42], speed: "medium", location: LOCATIONS.beauty, supplier: "Beauty & Perfume Wholesale", productType: "Makeup" },
  { name: "Nail Polish", brand: "Rivaj", category: "Perfumes, Makeup & Beauty", unit: "pcs", price: 260, margin: [0.25, 0.42], speed: "medium", location: LOCATIONS.beauty, supplier: "Beauty & Perfume Wholesale", productType: "Makeup" }
];

const STAFF = [
  ["Ahsan Siddiqui", "imtiaz.manager@shopiq.local", "MANAGER", "Branch Manager", "Morning", "Management Office"],
  ["Sara Khan", "imtiaz.cashier1@shopiq.local", "STAFF", "Senior Cashier", "Morning", "POS Front End"],
  ["Bilal Ahmed", "imtiaz.cashier2@shopiq.local", "STAFF", "POS Cashier", "Evening", "POS Front End"],
  ["Hina Malik", "imtiaz.inventory@shopiq.local", "STAFF", "Inventory Officer", "Morning", "Back Store"],
  ["Danish Raza", "imtiaz.purchase@shopiq.local", "STAFF", "Purchase Coordinator", "Morning", "Receiving Bay"],
  ["Maham Tariq", "imtiaz.customer.service@shopiq.local", "STAFF", "Customer Service", "Evening", "Service Counter"],
  ["Usman Ali", "imtiaz.floor@shopiq.local", "STAFF", "Floor Supervisor", "Closing", "Sales Floor"],
  ["Nabeel Farooqui", "imtiaz.delivery@shopiq.local", "STAFF", "Dispatch Coordinator", "Flexible", "Dispatch Desk"],
  ["Zainab Ali", "imtiaz.pharmacy@shopiq.local", "STAFF", "Pharmacy Counter Staff", "Evening", "Pharmacy"],
  ["Hamza Qureshi", "imtiaz.fresh@shopiq.local", "STAFF", "Fresh Section Supervisor", "Morning", "Fresh Section"]
] as const;

const AREAS = ["Gulshan-e-Iqbal", "Bahadurabad", "Clifton", "DHA", "Nazimabad", "PECHS", "Malir", "North Nazimabad", "Korangi", "Saddar", "Tariq Road", "Gulistan-e-Johar", "Federal B Area", "Shahrah-e-Faisal", "Model Colony", "Gulshan-e-Maymar", "Scheme 33", "Johar Chowrangi", "University Road"];
const FIRST_NAMES = ["Ayesha", "Fatima", "Hina", "Maham", "Zainab", "Sadia", "Nida", "Anum", "Mariam", "Iqra", "Ahmed", "Bilal", "Danish", "Hamza", "Hassan", "Usman", "Ahsan", "Saad", "Fahad", "Nabeel", "Tariq", "Shahzad", "Kamran", "Owais", "Imran"];
const LAST_NAMES = ["Khan", "Siddiqui", "Ahmed", "Raza", "Malik", "Qureshi", "Farooqui", "Ali", "Hussain", "Sheikh", "Ansari", "Memon", "Jamal", "Akhtar", "Nadeem", "Alam", "Mirza", "Soomro", "Hashmi", "Iqbal"];
const CUSTOMER_NOTES = [
  "Loyalty card customer",
  "Monthly household grocery buyer",
  "Office pantry account",
  "Usually pays by card",
  "Eligible for promo discount",
  "Prefers weekend shopping",
  "High-value monthly basket",
  "Frequently buys baby products",
  "Uses bank transfer for office purchases"
];

type ProductRuntime = Awaited<ReturnType<typeof prisma.product.findFirstOrThrow>> & {
  saleWeight: number;
  speed: ProductSeed["speed"];
  categoryName: string;
};

async function findOrCreateShop() {
  const existing = await prisma.shop.findFirst({ where: { name: SHOP.name, city: SHOP.city } });
  if (existing) {
    return prisma.shop.update({ where: { id: existing.id }, data: SHOP });
  }
  return prisma.shop.create({ data: SHOP });
}

async function ensureUsers(shopId: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: "imtiaz.admin@shopiq.local" },
    update: {
      shopId,
      name: "Muhammad Muzammil Alam",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Core Admin / Store Owner",
      phone: "03402211076",
      cnic: "42101-0000000-1",
      shift: "Flexible",
      branchArea: "Store Ownership",
      joiningDate: daysAgo(420),
      permissions: { workspace: "full", branch: "Imtiaz Gulshan", canApproveAiWrites: true }
    },
    create: {
      shopId,
      name: "Muhammad Muzammil Alam",
      email: "imtiaz.admin@shopiq.local",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Core Admin / Store Owner",
      phone: "03402211076",
      cnic: "42101-0000000-1",
      shift: "Flexible",
      branchArea: "Store Ownership",
      joiningDate: daysAgo(420),
      permissions: { workspace: "full", branch: "Imtiaz Gulshan", canApproveAiWrites: true }
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
        phone: fakePhone(),
        cnic: `42101-${String(1000000 + index).padStart(7, "0")}-${randInt(1, 9)}`,
        shift,
        branchArea,
        joiningDate: daysAgo(randInt(60, 520)),
        permissions: { branchArea, canUsePOS: designation.includes("Cashier"), canReceiveStock: designation.includes("Inventory") || designation.includes("Purchase") }
      },
      create: {
        shopId,
        name,
        email,
        passwordHash,
        role: role as UserRole,
        status: "ACTIVE",
        designation,
        phone: fakePhone(),
        cnic: `42101-${String(1000000 + index).padStart(7, "0")}-${randInt(1, 9)}`,
        shift,
        branchArea,
        joiningDate: daysAgo(randInt(60, 520)),
        permissions: { branchArea, canUsePOS: designation.includes("Cashier"), canReceiveStock: designation.includes("Inventory") || designation.includes("Purchase") }
      }
    }));
  }
  return { admin, users };
}

async function ensureCategories(shopId: string) {
  const colors = ["emerald", "blue", "cyan", "amber", "violet", "rose", "teal", "lime"];
  const rows = [];
  for (let index = 0; index < CATEGORY_NAMES.length; index += 1) {
    rows.push(await prisma.category.upsert({
      where: { shopId_name: { shopId, name: CATEGORY_NAMES[index] } },
      update: { color: colors[index % colors.length] },
      create: { shopId, name: CATEGORY_NAMES[index], color: colors[index % colors.length] }
    }));
  }
  return rows;
}

async function ensureSuppliers(shopId: string) {
  const rows = [];
  for (let index = 0; index < SUPPLIERS.length; index += 1) {
    const [name, supplierType, address] = SUPPLIERS[index];
    const existing = await prisma.supplier.findFirst({ where: { shopId, name } });
    const data = {
      phone: `021-${randInt(3400000, 3899999)}`,
      email: `${slug(name)}@supplier.test`,
      address,
      contactPerson: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      paymentTerms: pick(["7 days after delivery", "15 days credit", "30 days credit", "Cash on delivery", "Monthly settlement"]),
      ntn: `${randInt(1000000, 9999999)}-${randInt(1, 9)}`,
      gstNumber: `GST-KHI-${randInt(10000, 99999)}`,
      leadTimeDays: randInt(1, 9),
      supplierType,
      balance: money(0),
      reliabilityScore: randInt(72, 97),
      notes: `Generated retail supplier for ${supplierType.toLowerCase()} operations.`
    };
    rows.push(existing ? await prisma.supplier.update({ where: { id: existing.id }, data }) : await prisma.supplier.create({ data: { shopId, name, ...data } }));
  }
  return rows;
}

async function ensureProducts(shopId: string, categoryByName: Map<string, string>, supplierByName: Map<string, string>, adminId: string) {
  const rows: ProductRuntime[] = [];
  for (let index = 0; index < PRODUCTS.length; index += 1) {
    const item = PRODUCTS[index];
    const sku = makeSku(index + 1);
    const margin = item.margin[0] + random() * (item.margin[1] - item.margin[0]);
    const costPrice = item.price / (1 + margin);
    const initialStock = item.speed === "fast" ? randInt(360, 820) : item.speed === "medium" ? randInt(120, 280) : randInt(18, 90);
    const reorderLevel = item.speed === "fast" ? randInt(60, 110) : item.speed === "medium" ? randInt(24, 55) : randInt(5, 18);
    const expiryDate = item.perishable ? addDays(new Date(), randInt(7, 90)) : item.productType === "OTC" ? addDays(new Date(), randInt(360, 900)) : undefined;
    const created = await prisma.product.upsert({
      where: { shopId_sku: { shopId, sku } },
      update: {
        categoryId: categoryByName.get(item.category),
        supplierId: supplierByName.get(item.supplier),
        barcode: makeBarcode(index + 1),
        name: item.name,
        brand: item.brand,
        description: `${item.name} stocked for Imtiaz-style supermarket operations in ${item.location}.`,
        unit: item.unit,
        costPrice: money(costPrice),
        salePrice: money(item.price),
        taxRate: money(["Electronics", "Mobile Accessories", "Perfume", "Makeup"].includes(item.productType) ? randInt(3, 8) : 0),
        discountRate: money(item.speed === "fast" ? randInt(0, 4) : randInt(0, 8)),
        reorderLevel,
        reorderQuantity: reorderLevel * (item.speed === "fast" ? 5 : item.speed === "medium" ? 3 : 2),
        location: item.location,
        aisle: item.location,
        shelf: `${String.fromCharCode(65 + (index % 6))}-${randInt(1, 8)}`,
        productType: item.productType,
        isPerishable: Boolean(item.perishable),
        batchNo: `IMT-B${String(index + 1).padStart(3, "0")}-${randInt(10, 99)}`,
        manufactureDate: item.perishable ? daysAgo(randInt(1, 10)) : undefined,
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
        description: `${item.name} stocked for Imtiaz-style supermarket operations in ${item.location}.`,
        unit: item.unit,
        costPrice: money(costPrice),
        salePrice: money(item.price),
        taxRate: money(["Electronics", "Mobile Accessories", "Perfume", "Makeup"].includes(item.productType) ? randInt(3, 8) : 0),
        discountRate: money(item.speed === "fast" ? randInt(0, 4) : randInt(0, 8)),
        stockQty: initialStock,
        reorderLevel,
        reorderQuantity: reorderLevel * (item.speed === "fast" ? 5 : item.speed === "medium" ? 3 : 2),
        location: item.location,
        aisle: item.location,
        shelf: `${String.fromCharCode(65 + (index % 6))}-${randInt(1, 8)}`,
        productType: item.productType,
        isPerishable: Boolean(item.perishable),
        batchNo: `IMT-B${String(index + 1).padStart(3, "0")}-${randInt(10, 99)}`,
        manufactureDate: item.perishable ? daysAgo(randInt(1, 10)) : undefined,
        expiryDate
      }
    });
    const openingExists = await prisma.stockMovement.findFirst({ where: { shopId, productId: created.id, type: "OPENING", reference: "IMT-OPENING-2026" }, select: { id: true } });
    if (!openingExists && created.stockQty > 0) {
      await prisma.stockMovement.create({
        data: { shopId, productId: created.id, userId: adminId, type: "OPENING", quantity: created.stockQty, beforeQty: 0, afterQty: created.stockQty, reference: "IMT-OPENING-2026", notes: "Opening stock for Imtiaz operational seed.", movedAt: daysAgo(181) }
      });
    }
    rows.push({ ...created, saleWeight: item.speed === "fast" ? 9 : item.speed === "medium" ? 4 : 1.2, speed: item.speed, categoryName: item.category });
  }
  return rows;
}

async function ensureCustomers(shopId: string) {
  const rows = [];
  for (let index = 1; index <= 100; index += 1) {
    const segment = weightedPick([
      { item: "WALK_IN_LOYALTY", weight: 42 },
      { item: "FAMILY_MONTHLY", weight: 28 },
      { item: "OFFICE_PANTRY", weight: 15 },
      { item: "BULK_BUYER", weight: 15 }
    ]);
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const area = pick(AREAS);
    const email = `${slug(name)}.${String(index).padStart(3, "0")}@customer.test`;
    const creditLimit = segment === "WALK_IN_LOYALTY" ? randInt(0, 5000) : segment === "FAMILY_MONTHLY" ? randInt(10000, 30000) : segment === "OFFICE_PANTRY" ? randInt(50000, 120000) : randInt(60000, 150000);
    const existing = await prisma.customer.findFirst({ where: { shopId, email } });
    const data = {
      name,
      phone: fakePhone(),
      whatsapp: fakePhone(),
      email,
      address: `${randInt(12, 488)} ${area}, Karachi`,
      area,
      city: "Karachi",
      customerType: segment,
      loyaltyCardNo: `IMT-LOY-${String(500000 + index).padStart(6, "0")}`,
      loyaltyPoints: randInt(80, 8200),
      lastVisitAt: daysAgo(randInt(0, 45)),
      preferredPaymentMethod: paymentMethodPicker("customer"),
      creditLimit: money(creditLimit),
      balance: money(0),
      notes: pick(CUSTOMER_NOTES)
    };
    rows.push(existing ? await prisma.customer.update({ where: { id: existing.id }, data }) : await prisma.customer.create({ data: { shopId, ...data } }));
  }
  return rows;
}

async function seedPurchases(shopId: string, products: ProductRuntime[], suppliers: Awaited<ReturnType<typeof ensureSuppliers>>, users: Awaited<ReturnType<typeof ensureUsers>>["users"], stockById: Map<string, number>) {
  const purchaseUsers = users.filter((user) => user.role === "ADMIN" || user.role === "MANAGER" || user.designation?.includes("Purchase") || user.designation?.includes("Inventory"));
  for (let index = 1; index <= 260; index += 1) {
    const purchaseNo = `IMT-PO-2026-${String(index).padStart(6, "0")}`;
    if (await prisma.purchase.findUnique({ where: { shopId_purchaseNo: { shopId, purchaseNo } }, select: { id: true } })) continue;
    const supplier = pick(suppliers);
    const creator = pick(purchaseUsers);
    const status = purchaseStatusPicker();
    const purchaseDate = daysAgo(randInt(0, 180));
    const itemCount = randInt(3, 15);
    const selected = Array.from({ length: itemCount }, () => weightedPick(products.map((product) => ({ item: product, weight: product.speed === "fast" ? 8 : product.speed === "medium" ? 4 : 1.5 }))));
    const items = selected.map((product) => {
      const quantity = product.speed === "fast" ? randInt(42, 160) : product.speed === "medium" ? randInt(18, 80) : randInt(4, 28);
      const unitCost = Number(product.costPrice) * (0.96 + random() * 0.08);
      return { product, quantity, unitCost, total: quantity * unitCost };
    });
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const paidRatio = status === "ORDERED" ? (random() < 0.45 ? 0 : random() * 0.2) : status === "PARTIAL" ? 0.25 + random() * 0.45 : 0.6 + random() * 0.4;
    const paidAmount = Math.min(subtotal, subtotal * paidRatio);
    const dueAmount = Math.max(0, subtotal - paidAmount);
    const purchase = await prisma.purchase.create({
      data: {
        shopId,
        supplierId: supplier.id,
        createdById: creator.id,
        purchaseNo,
        status,
        subtotal: money(subtotal),
        total: money(subtotal),
        paidAmount: money(paidAmount),
        dueAmount: money(dueAmount),
        purchaseDate,
        notes: `${supplier.supplierType || "Supplier"} replenishment for Imtiaz branch stock.`,
        items: { create: items.map((item) => ({ productId: item.product.id, quantity: item.quantity, unitCost: money(item.unitCost), total: money(item.total) })) }
      }
    });
    if (paidAmount > 0) {
      // Payment handled via Purchase paidAmount
    }
    if (status !== "ORDERED") {
      for (const item of items) {
        const receivedQty = status === "PARTIAL" ? Math.max(1, Math.floor(item.quantity * (0.35 + random() * 0.45))) : item.quantity;
        const beforeQty = stockById.get(item.product.id) || 0;
        const afterQty = beforeQty + receivedQty;
        stockById.set(item.product.id, afterQty);
        await prisma.product.update({ where: { id: item.product.id }, data: { stockQty: afterQty, costPrice: money(item.unitCost) } });
        await prisma.stockMovement.create({ data: { shopId, productId: item.product.id, userId: creator.id, type: "PURCHASE", quantity: receivedQty, beforeQty, afterQty, reference: purchaseNo, notes: status === "PARTIAL" ? "Partial purchase received." : "Purchase received.", movedAt: purchaseDate } });
      }
    }
  }
}

async function seedInvoices(shopId: string, products: ProductRuntime[], customers: Awaited<ReturnType<typeof ensureCustomers>>, users: Awaited<ReturnType<typeof ensureUsers>>["users"], stockById: Map<string, number>) {
  const cashiers = users.filter((user) => user.role === "ADMIN" || user.role === "MANAGER" || user.designation?.includes("Cashier") || user.designation?.includes("Customer Service"));
  const counters = ["Counter 01", "Counter 02", "Counter 03", "Counter 04", "Counter 05", "Counter 06", "Counter 07", "Counter 08", "Fresh Counter", "Pharmacy Counter", "Customer Service Counter"];
  let posSeq = 1;
  let b2bSeq = 1;
  for (let index = 1; index <= 950; index += 1) {
    const channel = weightedPick([
      { item: "POS", weight: 72 },
      { item: "LOYALTY", weight: 20 },
      { item: "B2B", weight: 8 }
    ]);
    const invoiceNo = channel === "B2B" ? `IMT-B2B-2026-${String(b2bSeq++).padStart(6, "0")}` : `IMT-POS-2026-${String(posSeq++).padStart(6, "0")}`;
    if (await prisma.invoice.findUnique({ where: { shopId_invoiceNo: { shopId, invoiceNo } }, select: { id: true } })) continue;
    const status = invoiceStatusPicker();
    const invoiceDate = daysAgo(randInt(0, 120));
    const cashier = pick(cashiers);
    const needsCustomer = status !== "PAID" || channel !== "POS" || random() < 0.48;
    const customer = needsCustomer ? pick(customers) : null;
    const itemTarget = randInt(2, 12);
    const items: Array<{ product: ProductRuntime; quantity: number; unitPrice: number; costPrice: number; total: number }> = [];
    const used = new Set<string>();
    for (let attempt = 0; attempt < itemTarget * 4 && items.length < itemTarget; attempt += 1) {
      const product = weightedPick(products.map((entry) => ({ item: entry, weight: entry.saleWeight })));
      if (used.has(product.id)) continue;
      const available = stockById.get(product.id) || 0;
      const maxQty = product.speed === "fast" ? 8 : product.speed === "medium" ? 5 : 2;
      const quantity = status === "CANCELLED" ? randInt(1, maxQty) : Math.min(available, randInt(1, maxQty));
      if (quantity <= 0) continue;
      used.add(product.id);
      const unitPrice = Number(product.salePrice);
      items.push({ product, quantity, unitPrice, costPrice: Number(product.costPrice), total: quantity * unitPrice });
    }
    if (items.length < 2) continue;
    const subtotalRaw = items.reduce((sum, item) => sum + item.total, 0);
    const discount = status === "CANCELLED" ? 0 : subtotalRaw * (random() < 0.32 ? random() * 0.035 : 0);
    const loyaltyDiscount = status === "CANCELLED" ? 0 : channel === "LOYALTY" && customer ? subtotalRaw * (0.01 + random() * 0.035) : 0;
    const tax = status === "CANCELLED" ? 0 : Math.max(0, subtotalRaw - discount - loyaltyDiscount) * (channel === "B2B" ? 0.015 : random() < 0.18 ? 0.01 : 0);
    const total = status === "CANCELLED" ? 0 : Math.max(0, subtotalRaw - discount - loyaltyDiscount + tax);
    const paidAmount = status === "PAID" ? total : status === "PARTIAL" ? total * (0.25 + random() * 0.55) : 0;
    const dueAmount = status === "CANCELLED" ? 0 : Math.max(0, total - paidAmount);
    const paymentMethod = paidAmount > 0 ? paymentMethodPicker("customer") : undefined;
    const invoice = await prisma.invoice.create({
      data: {
        shopId,
        customerId: customer?.id || null,
        createdById: cashier.id,
        invoiceNo,
        status,
        subtotal: money(status === "CANCELLED" ? 0 : subtotalRaw),
        discount: money(discount),
        loyaltyDiscount: money(loyaltyDiscount),
        tax: money(tax),
        total: money(total),
        paidAmount: money(paidAmount),
        dueAmount: money(dueAmount),
        invoiceDate,
        dueDate: status === "UNPAID" || status === "PARTIAL" ? addDays(invoiceDate, channel === "B2B" ? 21 : 7) : undefined,
        cashierCounter: channel === "B2B" ? "Corporate / Bulk Desk" : pick(counters),
        channel,
        promoCode: loyaltyDiscount > 0 ? pick(["LOYALTY-SAVINGS", "BACHAT-DEAL", "IMTIAZ-REWARDS"]) : null,
        receiptNo: `RCPT-${invoiceNo.replace("IMT-", "")}`,
        paymentBreakdown: paymentMethod ? { [paymentMethod]: Number(money(paidAmount)) } : undefined,
        notes: channel === "B2B" ? "Bulk customer invoice generated at branch corporate desk." : channel === "LOYALTY" ? "Loyalty-card invoice with reward discount behavior." : "In-store POS invoice.",
        items: { create: items.map((item) => ({ productId: item.product.id, quantity: item.quantity, unitPrice: money(item.unitPrice), costPrice: money(item.costPrice), total: money(status === "CANCELLED" ? 0 : item.total) })) }
      }
    });
    if (paidAmount > 0 && paymentMethod) {
      await prisma.payment.create({ data: { shopId, customerId: customer?.id || null, invoiceId: invoice.id, createdById: cashier.id, direction: "CUSTOMER_IN", method: paymentMethod, amount: money(paidAmount), paidAt: invoiceDate, reference: invoiceNo, notes: "Customer receipt against Imtiaz invoice." } });
    }
    if (status !== "CANCELLED") {
      for (const item of items) {
        const beforeQty = stockById.get(item.product.id) || 0;
        const afterQty = beforeQty - item.quantity;
        stockById.set(item.product.id, afterQty);
        await prisma.product.update({ where: { id: item.product.id }, data: { stockQty: afterQty } });
        await prisma.stockMovement.create({ data: { shopId, productId: item.product.id, userId: cashier.id, type: "SALE", quantity: -item.quantity, beforeQty, afterQty, reference: invoiceNo, notes: "POS sale stock deduction.", movedAt: invoiceDate } });
      }
    }
  }
}

async function seedPurchasesFast(shopId: string, products: ProductRuntime[], suppliers: Awaited<ReturnType<typeof ensureSuppliers>>, users: Awaited<ReturnType<typeof ensureUsers>>["users"], stockById: Map<string, number>) {
  const purchaseUsers = users.filter((user) => user.role === "ADMIN" || user.role === "MANAGER" || user.designation?.includes("Purchase") || user.designation?.includes("Inventory"));
  const existing = await prisma.purchase.findMany({ where: { shopId, purchaseNo: { startsWith: "IMT-PO-2026-" } }, select: { purchaseNo: true } });
  const existingNos = new Set(existing.map((purchase) => purchase.purchaseNo));
  const purchases: Prisma.PurchaseCreateManyInput[] = [];
  const items: Prisma.PurchaseItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];

  for (let index = 1; index <= 260; index += 1) {
    const purchaseNo = `IMT-PO-2026-${String(index).padStart(6, "0")}`;
    if (existingNos.has(purchaseNo)) continue;
    const purchaseId = `imtiaz_purchase_${String(index).padStart(6, "0")}`;
    const supplier = pick(suppliers);
    const creator = pick(purchaseUsers);
    const status = purchaseStatusPicker();
    const purchaseDate = daysAgo(randInt(0, 180));
    const selected = Array.from({ length: randInt(3, 15) }, () => weightedPick(products.map((product) => ({ item: product, weight: product.speed === "fast" ? 8 : product.speed === "medium" ? 4 : 1.5 }))));
    const purchaseItems = selected.map((product, itemIndex) => {
      const quantity = product.speed === "fast" ? randInt(42, 160) : product.speed === "medium" ? randInt(18, 80) : randInt(4, 28);
      const unitCost = Number(product.costPrice) * (0.96 + random() * 0.08);
      return { id: `imtiaz_purchase_item_${String(index).padStart(6, "0")}_${itemIndex}`, product, quantity, unitCost, total: quantity * unitCost };
    });
    const subtotal = purchaseItems.reduce((sum, item) => sum + item.total, 0);
    const paidRatio = status === "ORDERED" ? (random() < 0.45 ? 0 : random() * 0.2) : status === "PARTIAL" ? 0.25 + random() * 0.45 : 0.6 + random() * 0.4;
    const paidAmount = Math.min(subtotal, subtotal * paidRatio);
    const dueAmount = Math.max(0, subtotal - paidAmount);

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
      purchaseDate,
      notes: `${supplier.supplierType || "Supplier"} replenishment for Imtiaz branch stock.`
    });
    for (const item of purchaseItems) {
      items.push({ id: item.id, purchaseId, productId: item.product.id, quantity: item.quantity, unitCost: money(item.unitCost), total: money(item.total) });
      if (status !== "ORDERED") {
        const receivedQty = status === "PARTIAL" ? Math.max(1, Math.floor(item.quantity * (0.35 + random() * 0.45))) : item.quantity;
        const beforeQty = stockById.get(item.product.id) || 0;
        const afterQty = beforeQty + receivedQty;
        stockById.set(item.product.id, afterQty);
        movements.push({ shopId, productId: item.product.id, userId: creator.id, type: "PURCHASE", quantity: receivedQty, beforeQty, afterQty, reference: purchaseNo, notes: status === "PARTIAL" ? "Partial purchase received." : "Purchase received.", movedAt: purchaseDate });
      }
    }
    if (paidAmount > 0) {
      // Payment handled via Purchase paidAmount
    }
  }

  await createManyInChunks(prisma.purchase, purchases, 500);
  await createManyInChunks(prisma.purchaseItem, items, 1000);
  await createManyInChunks(prisma.payment, payments, 1000);
  await createManyInChunks(prisma.stockMovement, movements, 1000);
}

async function seedInvoicesFast(shopId: string, products: ProductRuntime[], customers: Awaited<ReturnType<typeof ensureCustomers>>, users: Awaited<ReturnType<typeof ensureUsers>>["users"], stockById: Map<string, number>) {
  const cashiers = users.filter((user) => user.role === "ADMIN" || user.role === "MANAGER" || user.designation?.includes("Cashier") || user.designation?.includes("Customer Service"));
  const counters = ["Counter 01", "Counter 02", "Counter 03", "Counter 04", "Counter 05", "Counter 06", "Counter 07", "Counter 08", "Fresh Counter", "Pharmacy Counter", "Customer Service Counter"];
  const existing = await prisma.invoice.findMany({ where: { shopId, invoiceNo: { startsWith: "IMT-" } }, select: { invoiceNo: true } });
  const existingNos = new Set(existing.map((invoice) => invoice.invoiceNo));
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const items: Prisma.InvoiceItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  let posSeq = 1;
  let b2bSeq = 1;

  for (let index = 1; index <= 950; index += 1) {
    const channel = weightedPick([
      { item: "POS", weight: 72 },
      { item: "LOYALTY", weight: 20 },
      { item: "B2B", weight: 8 }
    ]);
    const sequence = channel === "B2B" ? b2bSeq++ : posSeq++;
    const invoiceNo = channel === "B2B" ? `IMT-B2B-2026-${String(sequence).padStart(6, "0")}` : `IMT-POS-2026-${String(sequence).padStart(6, "0")}`;
    if (existingNos.has(invoiceNo)) continue;
    const invoiceId = `imtiaz_invoice_${String(index).padStart(6, "0")}`;
    const status = invoiceStatusPicker();
    const invoiceDate = daysAgo(randInt(0, 120));
    const cashier = pick(cashiers);
    const needsCustomer = status !== "PAID" || channel !== "POS" || random() < 0.48;
    const customer = needsCustomer ? pick(customers) : null;
    const itemTarget = randInt(2, 12);
    const saleItems: Array<{ id: string; product: ProductRuntime; quantity: number; unitPrice: number; costPrice: number; total: number }> = [];
    const used = new Set<string>();
    for (let attempt = 0; attempt < itemTarget * 5 && saleItems.length < itemTarget; attempt += 1) {
      const product = weightedPick(products.map((entry) => ({ item: entry, weight: entry.saleWeight })));
      if (used.has(product.id)) continue;
      const available = stockById.get(product.id) || 0;
      const maxQty = product.speed === "fast" ? 8 : product.speed === "medium" ? 5 : 2;
      const quantity = status === "CANCELLED" ? randInt(1, maxQty) : Math.min(available, randInt(1, maxQty));
      if (quantity <= 0) continue;
      used.add(product.id);
      const unitPrice = Number(product.salePrice);
      saleItems.push({ id: `imtiaz_invoice_item_${String(index).padStart(6, "0")}_${saleItems.length}`, product, quantity, unitPrice, costPrice: Number(product.costPrice), total: quantity * unitPrice });
    }
    if (saleItems.length < 2) continue;
    const subtotalRaw = saleItems.reduce((sum, item) => sum + item.total, 0);
    const discount = status === "CANCELLED" ? 0 : subtotalRaw * (random() < 0.32 ? random() * 0.035 : 0);
    const loyaltyDiscount = status === "CANCELLED" ? 0 : channel === "LOYALTY" && customer ? subtotalRaw * (0.01 + random() * 0.035) : 0;
    const tax = status === "CANCELLED" ? 0 : Math.max(0, subtotalRaw - discount - loyaltyDiscount) * (channel === "B2B" ? 0.015 : random() < 0.18 ? 0.01 : 0);
    const total = status === "CANCELLED" ? 0 : Math.max(0, subtotalRaw - discount - loyaltyDiscount + tax);
    const paidAmount = status === "PAID" ? total : status === "PARTIAL" ? total * (0.25 + random() * 0.55) : 0;
    const dueAmount = status === "CANCELLED" ? 0 : Math.max(0, total - paidAmount);
    const paymentMethod = paidAmount > 0 ? paymentMethodPicker("customer") : undefined;

    invoices.push({
      id: invoiceId,
      shopId,
      customerId: customer?.id || null,
      createdById: cashier.id,
      invoiceNo,
      status,
      subtotal: money(status === "CANCELLED" ? 0 : subtotalRaw),
      discount: money(discount),
      loyaltyDiscount: money(loyaltyDiscount),
      tax: money(tax),
      total: money(total),
      paidAmount: money(paidAmount),
      dueAmount: money(dueAmount),
      invoiceDate,
      dueDate: status === "UNPAID" || status === "PARTIAL" ? addDays(invoiceDate, channel === "B2B" ? 21 : 7) : null,
      cashierCounter: channel === "B2B" ? "Corporate / Bulk Desk" : pick(counters),
      channel,
      promoCode: loyaltyDiscount > 0 ? pick(["LOYALTY-SAVINGS", "BACHAT-DEAL", "IMTIAZ-REWARDS"]) : null,
      receiptNo: `RCPT-${invoiceNo.replace("IMT-", "")}`,
      paymentBreakdown: paymentMethod ? { [paymentMethod]: Number((Math.round(paidAmount * 100) / 100).toFixed(2)) } : Prisma.JsonNull,
      notes: channel === "B2B" ? "Bulk customer invoice generated at branch corporate desk." : channel === "LOYALTY" ? "Loyalty-card invoice with reward discount behavior." : "In-store POS invoice."
    });
    for (const item of saleItems) {
      items.push({ id: item.id, invoiceId, productId: item.product.id, quantity: item.quantity, unitPrice: money(item.unitPrice), costPrice: money(item.costPrice), total: money(status === "CANCELLED" ? 0 : item.total) });
      if (status !== "CANCELLED") {
        const beforeQty = stockById.get(item.product.id) || 0;
        const afterQty = beforeQty - item.quantity;
        stockById.set(item.product.id, afterQty);
        movements.push({ shopId, productId: item.product.id, userId: cashier.id, type: "SALE", quantity: -item.quantity, beforeQty, afterQty, reference: invoiceNo, notes: "POS sale stock deduction.", movedAt: invoiceDate });
      }
    }
    if (paidAmount > 0 && paymentMethod) {
      payments.push({ id: `imtiaz_customer_payment_${String(index).padStart(6, "0")}`, shopId, customerId: customer?.id || null, invoiceId, createdById: cashier.id, direction: "CUSTOMER_IN", method: paymentMethod, amount: money(paidAmount), paidAt: invoiceDate, reference: invoiceNo, notes: "Customer receipt against Imtiaz invoice." });
    }
  }

  await createManyInChunks(prisma.invoice, invoices, 500);
  await createManyInChunks(prisma.invoiceItem, items, 1000);
  await createManyInChunks(prisma.payment, payments, 1000);
  await createManyInChunks(prisma.stockMovement, movements, 1000);
}

async function flushProductStock(stockById: Map<string, number>) {
  for (const [id, stockQty] of stockById) {
    await prisma.product.update({ where: { id }, data: { stockQty } });
  }
}

async function seedStockAdjustments(shopId: string, products: ProductRuntime[], users: Awaited<ReturnType<typeof ensureUsers>>["users"], stockById: Map<string, number>) {
  const inventoryUsers = users.filter((user) => user.designation?.includes("Inventory") || user.designation?.includes("Fresh") || user.role === "ADMIN");
  const notes = [
    "Fresh produce wastage removed after quality check.",
    "Bakery expiry cleared from shelf.",
    "Customer return processed at service counter.",
    "Cycle count correction after shelf audit.",
    "Damaged packaging removed from shelf.",
    "Chilled item spoilage recorded by fresh section."
  ];
  const types: StockMovementType[] = ["RETURN_IN", "RETURN_OUT", "ADJUSTMENT", "DAMAGE"];
  for (let index = 1; index <= 36; index += 1) {
    const product = weightedPick(products.map((entry) => ({ item: entry, weight: entry.speed === "fast" ? 5 : entry.speed === "medium" ? 3 : 1 })));
    const type = pick(types);
    const beforeQty = stockById.get(product.id) || 0;
    const rawQty = randInt(1, product.speed === "fast" ? 10 : 4);
    const signedQty = type === "RETURN_IN" ? rawQty : type === "ADJUSTMENT" && random() < 0.35 ? rawQty : -Math.min(beforeQty, rawQty);
    if (signedQty === 0) continue;
    const afterQty = beforeQty + signedQty;
    stockById.set(product.id, afterQty);
    await prisma.product.update({ where: { id: product.id }, data: { stockQty: afterQty } });
    await prisma.stockMovement.create({ data: { shopId, productId: product.id, userId: pick(inventoryUsers).id, type, quantity: signedQty, beforeQty, afterQty, reference: `IMT-ADJ-2026-${String(index).padStart(4, "0")}`, notes: pick(notes), movedAt: daysAgo(randInt(0, 40)) } });
  }
}

async function recalculateCustomerBalances(shopId: string) {
  const customers = await prisma.customer.findMany({ where: { shopId }, select: { id: true } });
  for (const customer of customers) {
    const invoices = await prisma.invoice.findMany({ where: { shopId, customerId: customer.id, status: { not: "CANCELLED" } }, select: { dueAmount: true } });
    const balance = invoices.reduce((sum, invoice) => sum + Number(invoice.dueAmount), 0);
    await prisma.customer.update({ where: { id: customer.id }, data: { balance: money(balance) } });
  }
}

async function recalculateSupplierBalances(shopId: string) {
  const suppliers = await prisma.supplier.findMany({ where: { shopId }, select: { id: true } });
  for (const supplier of suppliers) {
    const purchases = await prisma.purchase.findMany({ where: { shopId, supplierId: supplier.id, status: { not: "CANCELLED" } }, select: { dueAmount: true } });
    const balance = purchases.reduce((sum, purchase) => sum + Number(purchase.dueAmount), 0);
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: money(balance) } });
  }
}

async function buildSummary(shopId: string) {
  const [products, invoices, purchases, payments, customers, suppliers, movements] = await Promise.all([
    prisma.product.findMany({ where: { shopId }, include: { category: true } }),
    prisma.invoice.findMany({ where: { shopId }, include: { customer: true, items: { include: { product: { include: { category: true } } } } } }),
    prisma.purchase.findMany({ where: { shopId } }),
    prisma.payment.findMany({ where: { shopId } }),
    prisma.customer.findMany({ where: { shopId }, orderBy: { balance: "desc" }, take: 12 }),
    prisma.supplier.findMany({ where: { shopId }, orderBy: { balance: "desc" }, take: 12 }),
    prisma.stockMovement.findMany({ where: { shopId, type: "SALE" }, include: { product: { include: { category: true } } } })
  ]);
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "CANCELLED");
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const todaySales = activeInvoices.filter((invoice) => invoice.invoiceDate >= startToday).reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const categoryRevenue = new Map<string, number>();
  for (const invoice of activeInvoices) {
    for (const item of invoice.items) {
      const category = item.product.category?.name || "Uncategorized";
      categoryRevenue.set(category, (categoryRevenue.get(category) || 0) + Number(item.total));
    }
  }
  const productQty = new Map<string, { name: string; qty: number }>();
  for (const movement of movements) {
    const current = productQty.get(movement.productId) || { name: movement.product.name, qty: 0 };
    current.qty += Math.abs(movement.quantity);
    productQty.set(movement.productId, current);
  }
  const totalInvoiceRevenue = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const totalPaidAmount = payments.filter((payment) => payment.direction === "CUSTOMER_IN").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const customerDues = customers.reduce((sum, customer) => sum + Number(customer.balance), 0);
  const supplierPayables = suppliers.reduce((sum, supplier) => sum + Number(supplier.balance), 0);
  return {
    products,
    invoices,
    purchases,
    payments,
    customers,
    suppliers,
    movements,
    todaySales,
    totalInventoryValue: products.reduce((sum, product) => sum + Number(product.costPrice) * product.stockQty, 0),
    totalInvoiceRevenue,
    totalPaidAmount,
    customerDues,
    supplierPayables,
    lowStockCount: products.filter((product) => product.stockQty <= product.reorderLevel).length,
    topProducts: [...productQty.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    topCategories: [...categoryRevenue.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)
  };
}

async function seedActivityLogs(shopId: string, users: Awaited<ReturnType<typeof ensureUsers>>["users"], summary: Awaited<ReturnType<typeof buildSummary>>) {
  const templates: Array<[string, string, string]> = [
    ["SEED", "Imtiaz retail dataset prepared", "Operational seed generated for branch analysis."],
    ["PRODUCT_CREATED", "Fresh SKU shelf plan reviewed", "Product master includes aisle, shelf and reorder context."],
    ["CUSTOMER_CREATED", "New loyalty customer enrolled", "Loyalty card profile completed at service counter."],
    ["SUPPLIER_CREATED", "Supplier terms checked", "Supplier lead time and payment terms reviewed."],
    ["INVOICE_CREATED", "POS invoices closed", `Current generated revenue is PKR ${Math.round(summary.totalInvoiceRevenue).toLocaleString()}.`],
    ["PURCHASE_RECEIVED", "Receiving bay updated stock", "Purchase stock intake posted with product movements."],
    ["PAYMENT_RECEIVED", "Customer receipt posted", `Customer receipts total PKR ${Math.round(summary.totalPaidAmount).toLocaleString()}.`],
    ["SUPPLIER_PAYMENT", "Supplier payout scheduled", "Payable movement recorded for wholesale partners."],
    ["STOCK_ADJUSTMENT", "Cycle count correction posted", "Inventory count adjusted after floor audit."],
    ["LOW_STOCK_ALERT", "Low stock watchlist refreshed", `${summary.lowStockCount} products are at or below reorder level.`],
    ["STAFF_LOGIN", "Shift team signed in", "Cashier and floor supervisor activity recorded."],
    ["ASSISTANT_SUMMARY", "Assistant generated operating summary", "AI assistant thread prepared with live generated totals."],
    ["LOYALTY_DISCOUNT_APPLIED", "Loyalty savings applied", "Reward behavior captured on loyalty invoices."]
  ];
  for (let index = 0; index < 50; index += 1) {
    const [type, title, details] = pick(templates);
    await prisma.activityLog.create({ data: { shopId, userId: pick(users).id, type, title, details, metadata: { source: "imtiaz-operational-seed", sequence: index + 1 }, createdAt: daysAgo(randInt(0, 55)) } });
  }
}

async function seedAssistantThreads(shopId: string, adminId: string, summary: Awaited<ReturnType<typeof buildSummary>>) {
  const existing = await prisma.assistantThread.findMany({ where: { shopId, title: { in: ["Daily Imtiaz Operations Summary", "Reorder & Stock Risk Review", "Customer Dues Follow-up"] } }, select: { id: true } });
  if (existing.length) {
    await prisma.assistantMessage.deleteMany({ where: { threadId: { in: existing.map((thread) => thread.id) } } });
    await prisma.assistantThread.deleteMany({ where: { id: { in: existing.map((thread) => thread.id) } } });
  }
  const lowStock = summary.products.filter((product) => product.stockQty <= product.reorderLevel).slice(0, 8).map((product) => `${product.name} (${product.stockQty}/${product.reorderLevel})`).join(", ") || "No critical low-stock items";
  const topCategories = summary.topCategories.map((category) => `${category.name}: PKR ${Math.round(category.value).toLocaleString()}`).join(", ");
  const dues = summary.customers.filter((customer) => Number(customer.balance) > 0).slice(0, 5).map((customer) => `${customer.name}: PKR ${Number(customer.balance).toLocaleString()}`).join(", ");
  const payables = summary.suppliers.filter((supplier) => Number(supplier.balance) > 0).slice(0, 5).map((supplier) => `${supplier.name}: PKR ${Number(supplier.balance).toLocaleString()}`).join(", ");
  const threadData = [
    {
      title: "Daily Imtiaz Operations Summary",
      user: "Summarize today's branch performance.",
      ai: `Today's Imtiaz branch sales are PKR ${Math.round(summary.todaySales).toLocaleString()}. Total generated invoice revenue is PKR ${Math.round(summary.totalInvoiceRevenue).toLocaleString()}. Top category revenue: ${topCategories}. Customer receipts recorded: PKR ${Math.round(summary.totalPaidAmount).toLocaleString()}.`
    },
    {
      title: "Reorder & Stock Risk Review",
      user: "Which stock areas need attention before the next buying cycle?",
      ai: `Current low-stock count is ${summary.lowStockCount}. Watchlist: ${lowStock}. Fast movers by quantity: ${summary.topProducts.map((product) => `${product.name} (${product.qty})`).join(", ")}. Supplier payables currently stand at PKR ${Math.round(summary.supplierPayables).toLocaleString()}.`
    },
    {
      title: "Customer Dues Follow-up",
      user: "Show the dues follow-up plan for loyalty and bulk customers.",
      ai: `Customer dues total PKR ${Math.round(summary.customerDues).toLocaleString()}. Highest balances: ${dues || "No outstanding balances"}. Supplier payables for cash planning: ${payables || "No open supplier payables"}.`
    }
  ];
  for (const item of threadData) {
    const thread = await prisma.assistantThread.create({ data: { shopId, createdById: adminId, title: item.title, mode: "OPERATIONS" } });
    await prisma.assistantMessage.create({ data: { threadId: thread.id, authorId: adminId, role: "USER", content: item.user, createdAt: daysAgo(randInt(1, 8)) } });
    await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: item.ai, metadata: { provider: "gemini", source: "imtiaz-operational-seed" }, createdAt: daysAgo(randInt(0, 7)) } });
  }
}

async function validateImtiazSeed(shopId: string) {
  await recalculateCustomerBalances(shopId);
  await recalculateSupplierBalances(shopId);
  const summary = await buildSummary(shopId);
  const counts = {
    users: await prisma.user.count({ where: { shopId } }),
    admins: await prisma.user.count({ where: { shopId, role: "ADMIN" } }),
    staff: await prisma.user.count({ where: { shopId, role: { not: "ADMIN" } } }),
    categories: await prisma.category.count({ where: { shopId } }),
    products: await prisma.product.count({ where: { shopId } }),
    customers: await prisma.customer.count({ where: { shopId } }),
    suppliers: await prisma.supplier.count({ where: { shopId } }),
    invoices: await prisma.invoice.count({ where: { shopId } }),
    purchases: await prisma.purchase.count({ where: { shopId } }),
    payments: await prisma.payment.count({ where: { shopId } }),
    stockMovements: await prisma.stockMovement.count({ where: { shopId } }),
    activityLogs: await prisma.activityLog.count({ where: { shopId } }),
    assistantThreads: await prisma.assistantThread.count({ where: { shopId } }),
    assistantMessages: await prisma.assistantMessage.count({ where: { thread: { shopId } } })
  };
  if (counts.admins !== 1) throw new Error(`Expected exactly one Imtiaz ADMIN, found ${counts.admins}.`);
  const negativeStock = await prisma.product.count({ where: { shopId, stockQty: { lt: 0 } } });
  if (negativeStock > 0) throw new Error(`Seed validation failed: ${negativeStock} products have negative stock.`);

  console.log("\nImtiaz retail dataset validation");
  console.log("--------------------------------");
  console.log(`Imtiaz shop id: ${shopId}`);
  console.log(`users count: ${counts.users}`);
  console.log(`exactly one ADMIN confirmation: ${counts.admins === 1 ? "yes" : "no"}`);
  console.log(`staff count: ${counts.staff}`);
  console.log(`category count: ${counts.categories}`);
  console.log(`product count: ${counts.products}`);
  console.log(`customer count: ${counts.customers}`);
  console.log(`supplier count: ${counts.suppliers}`);
  console.log(`invoice count: ${counts.invoices}`);
  console.log(`purchase count: ${counts.purchases}`);
  console.log(`payment count: ${counts.payments}`);
  console.log(`stock movement count: ${counts.stockMovements}`);
  console.log(`activity log count: ${counts.activityLogs}`);
  console.log(`assistant thread/message count: ${counts.assistantThreads}/${counts.assistantMessages}`);
  console.log(`total inventory value: PKR ${Math.round(summary.totalInventoryValue).toLocaleString()}`);
  console.log(`total invoice revenue: PKR ${Math.round(summary.totalInvoiceRevenue).toLocaleString()}`);
  console.log(`total paid amount: PKR ${Math.round(summary.totalPaidAmount).toLocaleString()}`);
  console.log(`customer dues: PKR ${Math.round(summary.customerDues).toLocaleString()}`);
  console.log(`supplier payables: PKR ${Math.round(summary.supplierPayables).toLocaleString()}`);
  console.log(`low stock count: ${summary.lowStockCount}`);
  console.log("top 5 products by quantity sold:");
  for (const product of summary.topProducts) console.log(`- ${product.name}: ${product.qty.toLocaleString()} units`);
  console.log("top 5 categories by revenue:");
  for (const category of summary.topCategories) console.log(`- ${category.name}: PKR ${Math.round(category.value).toLocaleString()}`);
  return { counts, summary };
}

async function main() {
  const shop = await findOrCreateShop();
  const existingMarker = await prisma.activityLog.findFirst({ where: { shopId: shop.id, type: SEED_MARKER }, select: { id: true } });
  if (existingMarker) {
    console.log("Imtiaz seed already applied. No duplicate data created.");
    await validateImtiazSeed(shop.id);
    return;
  }

  const { admin, users } = await ensureUsers(shop.id);
  const categories = await ensureCategories(shop.id);
  const suppliers = await ensureSuppliers(shop.id);
  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));
  const supplierByName = new Map(suppliers.map((supplier) => [supplier.name, supplier.id]));
  const products = await ensureProducts(shop.id, categoryByName, supplierByName, admin.id);
  const customers = await ensureCustomers(shop.id);
  const stockById = new Map(products.map((product) => [product.id, product.stockQty]));

  await seedPurchasesFast(shop.id, products, suppliers, users, stockById);
  await seedInvoicesFast(shop.id, products, customers, users, stockById);
  await seedStockAdjustments(shop.id, products, users, stockById);
  await flushProductStock(stockById);
  await recalculateCustomerBalances(shop.id);
  await recalculateSupplierBalances(shop.id);
  const summary = await buildSummary(shop.id);
  await seedActivityLogs(shop.id, users, summary);
  await seedAssistantThreads(shop.id, admin.id, summary);
  await prisma.activityLog.create({ data: { shopId: shop.id, userId: admin.id, type: SEED_MARKER, title: "Imtiaz operational seed completed", details: "Append-only Imtiaz supermarket retail dataset applied successfully.", metadata: { version: 1, products: PRODUCTS.length, invoices: 950, purchases: 260 }, createdAt: new Date() } });
  await validateImtiazSeed(shop.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

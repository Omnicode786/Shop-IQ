import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { prisma } from "../src/lib/prisma";

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]) => arr[rand(0, arr.length - 1)];

async function main() {
  await prisma.assistantMessage.deleteMany();
  await prisma.assistantThread.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();

  const hash = await bcrypt.hash("demo12345", 12);
  const shop = await prisma.shop.create({ data: { name: "Metro Tech & Stationers", city: "Karachi", address: "Main Tariq Road, Karachi", phone: "+92 300 1112233", currency: "PKR" } });
  const owner = await prisma.user.create({ data: { shopId: shop.id, name: "Muzammil Ahmed", email: "owner@shopiq.dev", passwordHash: hash, role: "ADMIN", designation: "Owner" } });
  const staff = await prisma.user.create({ data: { shopId: shop.id, name: "Ayesha Khan", email: "staff@shopiq.dev", passwordHash: hash, role: "STAFF", designation: "Cashier" } });
  await prisma.user.create({ data: { shopId: shop.id, name: "Bilal Raza", email: "manager@shopiq.dev", passwordHash: hash, role: "MANAGER", designation: "Inventory Manager" } });

  const categoryNames = ["Laptops", "Mobiles", "Computer Accessories", "Printers", "Stationery", "Networking", "CCTV", "Office Furniture", "Storage", "Power & UPS"];
  const categories = await Promise.all(categoryNames.map((name, i) => prisma.category.create({ data: { shopId: shop.id, name, color: ["blue","emerald","amber","violet","cyan"][i%5] } })));
  const productNames = [
    ["HP EliteBook 840 G8","Laptops"],["Dell Latitude 5420","Laptops"],["Lenovo ThinkPad T14","Laptops"],["MacBook Air M1","Laptops"],["Acer Aspire 5","Laptops"],["iPhone 13 128GB","Mobiles"],["Samsung Galaxy A54","Mobiles"],["Redmi Note 13","Mobiles"],["Infinix Note 30","Mobiles"],["Tecno Spark 20","Mobiles"],["Logitech M185 Mouse","Computer Accessories"],["Logitech K120 Keyboard","Computer Accessories"],["USB-C Hub 7-in-1","Computer Accessories"],["HDMI Cable 2M","Computer Accessories"],["Kingston 64GB USB","Storage"],["Samsung 1TB SSD","Storage"],["HP LaserJet 107a","Printers"],["Canon LBP6030","Printers"],["Epson L3250","Printers"],["Printer Toner 85A","Printers"],["A4 Paper Ream","Stationery"],["Dollar Pointer Box","Stationery"],["Stapler Heavy Duty","Stationery"],["Files Pack 12pcs","Stationery"],["TP-Link Archer C6","Networking"],["Cat6 Cable Roll","Networking"],["D-Link Switch 8 Port","Networking"],["Dahua CCTV Camera","CCTV"],["Hikvision DVR 8ch","CCTV"],["APC UPS 1KVA","Power & UPS"],["Office Chair Ergonomic","Office Furniture"],["Steel Filing Cabinet","Office Furniture"]
  ];
  const products: any[] = [];
  for (let i=0;i<96;i++) {
    const base = productNames[i % productNames.length];
    const cat = categories.find(c=>c.name===base[1])!;
    const cost = rand(450, 230000);
    const sale = Math.round(cost * (1.12 + Math.random()*0.22));
    const stock = rand(0, 90);
    const reorder = rand(4, 18);
    const product = await prisma.product.create({ data: { shopId: shop.id, categoryId: cat.id, sku: `SIQ-${String(i+1).padStart(4,"0")}`, barcode: `890${rand(100000000,999999999)}`, name: `${base[0]} ${i>=productNames.length?`Batch ${Math.floor(i/productNames.length)+1}`:""}`.trim(), brand: base[0].split(" ")[0], unit: base[1]==="Stationery"?"pack":"pcs", costPrice: cost, salePrice: sale, stockQty: stock, reorderLevel: reorder, reorderQuantity: reorder*3, location: `Aisle ${rand(1,9)}-${String.fromCharCode(65+rand(0,5))}` } });
    products.push(product);
    await prisma.stockMovement.create({ data: { shopId: shop.id, productId: product.id, userId: owner.id, type: "OPENING", quantity: stock, beforeQty: 0, afterQty: stock, reference: "OPENING", movedAt: subDays(new Date(), rand(60, 180)) } });
  }

  const customerNames = ["Al Noor Academy", "Saeed Traders", "Bright Future School", "City Clinic", "Rahim & Sons", "Khan Office Supplies", "Blue Bird Logistics", "Prime Developers", "Al Madina Pharmacy", "Green Mart", "Oceanic Solutions", "Hassan Enterprises", "Pak Digital Lab", "United Motors", "Sultan Builders", "Faisal Stationers", "Care Hospital", "Atlas Coaching", "New Era Printers", "Karachi Textile House"];
  const customers = await Promise.all(Array.from({length: 70}, (_,i)=>prisma.customer.create({ data: { shopId: shop.id, name: `${customerNames[i%customerNames.length]} ${i>=customerNames.length?i:""}`.trim(), phone: `03${rand(0,4)}${rand(100000000,999999999)}`, address: pick(["Karachi", "Lahore", "Islamabad", "Hyderabad", "Multan"]), creditLimit: rand(50000, 900000), balance: rand(0, 260000), notes: "Seeded commercial customer with realistic purchase history." }})));
  const supplierNames = ["TechWorld Distribution", "Pak Stationery Wholesale", "MegaPrint Supplies", "Global Gadgets", "Raza Electronics", "OfficeLine Traders", "SecureVision CCTV", "NetLink Pakistan", "PowerSafe UPS", "Furniture Hub"];
  const suppliers = await Promise.all(Array.from({length: 20}, (_,i)=>prisma.supplier.create({ data: { shopId: shop.id, name: `${supplierNames[i%supplierNames.length]} ${i>=supplierNames.length?i:""}`.trim(), phone: `021-${rand(3000000,3999999)}`, address: pick(["Saddar", "Tariq Road", "Hall Road", "Blue Area", "Shah Alam Market"]), balance: rand(0, 750000), reliabilityScore: rand(68, 96), notes: "Wholesale supplier with active purchasing relationship." }})));

  for (let i=1;i<=420;i++) {
    const customer = pick(customers); const createdBy = Math.random() > 0.45 ? owner : staff; const date = subDays(new Date(), rand(0, 120));
    const itemCount = rand(1,5); const chosen = Array.from({length:itemCount},()=>pick(products));
    const items = chosen.map(p=>{const q=rand(1,5); const price=Number(p.salePrice); return {p,q,price,total:q*price,cost:Number(p.costPrice)};});
    const subtotal = items.reduce((s,it)=>s+it.total,0); const discount = rand(0,1)?rand(0, Math.round(subtotal*0.05)):0; const tax = Math.round((subtotal-discount)*0.02); const total = subtotal-discount+tax; const paid = Math.random()>0.35?total:rand(0,total); const status = paid>=total?"PAID":paid>0?"PARTIAL":"UNPAID";
    const inv = await prisma.invoice.create({ data: { shopId: shop.id, customerId: customer.id, createdById: createdBy.id, invoiceNo: `INV-${String(i).padStart(5,"0")}`, subtotal, discount, tax, total, paidAmount: paid, dueAmount: total-paid, status: status as any, invoiceDate: date, dueDate: addDays(date, 15), items: { create: items.map(it=>({ productId: it.p.id, quantity: it.q, unitPrice: it.price, costPrice: it.cost, total: it.total })) } } });
    if (total-paid>0) await prisma.customer.update({ where:{id:customer.id}, data:{ balance:{ increment: total-paid } } });
    if (paid>0) await prisma.payment.create({ data: { shopId: shop.id, customerId: customer.id, invoiceId: inv.id, createdById: createdBy.id, direction: "CUSTOMER_IN", method: pick(["CASH","BANK_TRANSFER","CARD","JAZZCASH","EASYPAISA"] as any), amount: paid, paidAt: date, reference: inv.invoiceNo } });
    for (const it of items) {
      const before = it.p.stockQty; it.p.stockQty = Math.max(0, before - it.q);
      await prisma.stockMovement.create({ data: { shopId: shop.id, productId: it.p.id, userId: createdBy.id, type: "SALE", quantity: -it.q, beforeQty: before, afterQty: it.p.stockQty, reference: inv.invoiceNo, movedAt: date } });
    }
  }

  for (let i=1;i<=170;i++) {
    const supplier=pick(suppliers); const p=pick(products); const qty=rand(5,40); const cost=Number(p.costPrice); const total=qty*cost; const paid=Math.random()>0.4?total:rand(0,total); const date=subDays(new Date(), rand(0, 150));
    const pur=await prisma.purchase.create({ data: { shopId: shop.id, supplierId:supplier.id, createdById:owner.id, purchaseNo:`PUR-${String(i).padStart(5,"0")}`, subtotal:total,total,paidAmount:paid,dueAmount:total-paid,status:"RECEIVED",purchaseDate:date,items:{create:{productId:p.id,quantity:qty,unitCost:cost,total}} } });
    if(total-paid>0) await prisma.supplier.update({where:{id:supplier.id},data:{balance:{increment:total-paid}}});
    // supplier payment is tracked implicitly via the purchase's paidAmount.
    await prisma.stockMovement.create({data:{shopId:shop.id,productId:p.id,userId:owner.id,type:"PURCHASE",quantity:qty,beforeQty:p.stockQty,afterQty:p.stockQty+qty,reference:pur.purchaseNo,movedAt:date}});
  }

  const activities = ["Low stock scan completed", "Monthly sales report generated", "Supplier payable review completed", "AI reorder suggestion generated", "Customer dues reminder prepared", "Inventory audit sampled"];
  for (let i=0;i<60;i++) await prisma.activityLog.create({ data: { shopId: shop.id, userId: pick([owner, staff]).id, type: "SEED_ACTIVITY", title: pick(activities), details: "Generated from realistic seeded operations.", createdAt: subDays(new Date(), rand(0, 45)) } });
  const thread = await prisma.assistantThread.create({ data: { shopId: shop.id, createdById: owner.id, title: "Business health review" } });
  await prisma.assistantMessage.create({ data: { threadId: thread.id, authorId: owner.id, role: "USER", content: "Summarize today’s business." } });
  await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: "## Business Summary\n\nSales are healthy, but several fast-moving SKUs are close to reorder level. Prioritize accessories and printer supplies before increasing slow-moving laptop inventory." } });
  console.log("Seeded ShopIQ with large-scale realistic market data.");
}

main().finally(async()=>prisma.$disconnect());

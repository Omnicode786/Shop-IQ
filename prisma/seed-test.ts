import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main(){
  console.log('Connecting...');
  await prisma.$connect();
  console.log('Connected. Clearing small sets...');
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();
  const hash = await bcrypt.hash('test1234', 8);
  const shop = await prisma.shop.create({ data: { name: 'Test Shop', city: 'Test City' } });
  console.log('Created shop', shop.id);
  const user = await prisma.user.create({ data: { shopId: shop.id, name: 'Test User', email: 'test@local', passwordHash: hash, role: 'ADMIN' } });
  console.log('Created user', user.id);
  await prisma.$disconnect();
  console.log('Test seed completed.');
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });

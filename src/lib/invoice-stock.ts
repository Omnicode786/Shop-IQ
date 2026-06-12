import { Prisma } from "@prisma/client";

export type SaleLineInput = {
  productId: string;
  quantity: number;
};

export type LockedSaleProduct = {
  id: string;
  name: string;
  stockQty: number;
  salePrice: Prisma.Decimal;
  costPrice: Prisma.Decimal;
};

export class SaleProductNotFoundError extends Error {
  constructor() {
    super("One of the selected products was not found.");
    this.name = "SaleProductNotFoundError";
  }
}

export class InsufficientStockError extends Error {
  constructor(productName: string, availableQty: number) {
    super(`${productName} has only ${availableQty} in stock.`);
    this.name = "InsufficientStockError";
  }
}

function demandByProduct(lines: SaleLineInput[]) {
  const demand = new Map<string, number>();
  for (const line of lines) {
    demand.set(line.productId, (demand.get(line.productId) || 0) + line.quantity);
  }
  return demand;
}

export async function lockActiveProductsForSale(tx: Prisma.TransactionClient, shopId: string, lines: SaleLineInput[]) {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  if (!productIds.length) throw new SaleProductNotFoundError();

  const products = await tx.$queryRaw<LockedSaleProduct[]>`
    SELECT "id", "name", "stockQty", "salePrice", "costPrice"
    FROM "Product"
    WHERE "shopId" = ${shopId}
      AND "id" IN (${Prisma.join(productIds)})
      AND "status" = 'ACTIVE'::"ProductStatus"
    ORDER BY "id"
    FOR UPDATE
  `;

  const productMap = new Map(products.map((product) => [product.id, product]));
  for (const productId of productIds) {
    if (!productMap.has(productId)) throw new SaleProductNotFoundError();
  }

  for (const [productId, quantity] of demandByProduct(lines)) {
    const product = productMap.get(productId)!;
    if (product.stockQty < quantity) throw new InsufficientStockError(product.name, product.stockQty);
  }

  return productMap;
}

export async function decrementStockForSale(
  tx: Prisma.TransactionClient,
  {
    shopId,
    userId,
    invoiceNo,
    lines,
    products,
    notes
  }: {
    shopId: string;
    userId: string;
    invoiceNo: string;
    lines: SaleLineInput[];
    products: Map<string, LockedSaleProduct>;
    notes: string;
  }
) {
  const runningStock = new Map([...products.values()].map((product) => [product.id, product.stockQty]));

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) throw new SaleProductNotFoundError();

    const beforeQty = runningStock.get(product.id) ?? product.stockQty;
    if (beforeQty < line.quantity) throw new InsufficientStockError(product.name, beforeQty);

    const result = await tx.product.updateMany({
      where: { id: product.id, shopId, stockQty: { gte: line.quantity } },
      data: { stockQty: { decrement: line.quantity } }
    });
    if (result.count !== 1) throw new InsufficientStockError(product.name, beforeQty);

    const afterQty = beforeQty - line.quantity;
    runningStock.set(product.id, afterQty);
    await tx.stockMovement.create({
      data: {
        shopId,
        productId: product.id,
        userId,
        type: "SALE",
        quantity: -line.quantity,
        beforeQty,
        afterQty,
        reference: invoiceNo,
        notes
      }
    });
  }
}

-- DropIndex
DROP INDEX "Invoice_shopId_status_invoiceDate_idx";

-- DropIndex
DROP INDEX "Payment_shopId_direction_paidAt_idx";

-- DropIndex
DROP INDEX "Product_shopId_status_updatedAt_idx";

-- DropIndex
DROP INDEX "Purchase_shopId_status_purchaseDate_idx";

-- DropIndex
DROP INDEX "User_shopId_email_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "area" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "customerType" TEXT,
ADD COLUMN     "lastVisitAt" TIMESTAMP(3),
ADD COLUMN     "loyaltyCardNo" TEXT,
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preferredPaymentMethod" "PaymentMethod",
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cashierCounter" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "loyaltyDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentBreakdown" JSONB,
ADD COLUMN     "promoCode" TEXT,
ADD COLUMN     "receiptNo" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "aisle" TEXT,
ADD COLUMN     "batchNo" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isPerishable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manufactureDate" TIMESTAMP(3),
ADD COLUMN     "productType" TEXT,
ADD COLUMN     "shelf" TEXT,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "ntn" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "supplierType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchArea" TEXT,
ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "joiningDate" TIMESTAMP(3),
ADD COLUMN     "permissions" JSONB,
ADD COLUMN     "shift" TEXT;

-- CreateIndex
CREATE INDEX "Customer_shopId_loyaltyCardNo_idx" ON "Customer"("shopId", "loyaltyCardNo");

-- CreateIndex
CREATE INDEX "Customer_shopId_customerType_idx" ON "Customer"("shopId", "customerType");

-- CreateIndex
CREATE INDEX "Customer_shopId_area_idx" ON "Customer"("shopId", "area");

-- CreateIndex
CREATE INDEX "Invoice_shopId_channel_idx" ON "Invoice"("shopId", "channel");

-- CreateIndex
CREATE INDEX "Invoice_shopId_receiptNo_idx" ON "Invoice"("shopId", "receiptNo");

-- CreateIndex
CREATE INDEX "Product_shopId_supplierId_idx" ON "Product"("shopId", "supplierId");

-- CreateIndex
CREATE INDEX "Product_shopId_productType_idx" ON "Product"("shopId", "productType");

-- CreateIndex
CREATE INDEX "Product_shopId_expiryDate_idx" ON "Product"("shopId", "expiryDate");

-- CreateIndex
CREATE INDEX "Supplier_shopId_supplierType_idx" ON "Supplier"("shopId", "supplierType");

-- CreateIndex
CREATE INDEX "User_shopId_branchArea_idx" ON "User"("shopId", "branchArea");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

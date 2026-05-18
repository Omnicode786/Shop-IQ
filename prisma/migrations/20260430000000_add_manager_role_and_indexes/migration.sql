-- Add manager role for shop-level team administration.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';

-- Extra operational indexes for common workspace filters and joins.
CREATE INDEX IF NOT EXISTS "User_shopId_email_idx" ON "User"("shopId", "email");
CREATE INDEX IF NOT EXISTS "Product_shopId_status_updatedAt_idx" ON "Product"("shopId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Invoice_shopId_status_invoiceDate_idx" ON "Invoice"("shopId", "status", "invoiceDate");
CREATE INDEX IF NOT EXISTS "Purchase_shopId_status_purchaseDate_idx" ON "Purchase"("shopId", "status", "purchaseDate");
CREATE INDEX IF NOT EXISTS "Payment_shopId_direction_paidAt_idx" ON "Payment"("shopId", "direction", "paidAt");

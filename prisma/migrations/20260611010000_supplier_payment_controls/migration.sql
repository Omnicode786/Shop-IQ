-- Add supplier ledger controls and real supplier payment links.
-- This migration is append-only and keeps existing rows intact.

DO $$
BEGIN
  CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT,
  ADD COLUMN IF NOT EXISTS "purchaseId" TEXT;

DO $$
BEGIN
  ALTER TYPE "PaymentDirection" ADD VALUE IF NOT EXISTS 'SUPPLIER_OUT';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_supplierId_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_purchaseId_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_purchaseId_fkey"
      FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Supplier_shopId_status_idx" ON "Supplier"("shopId", "status");
CREATE INDEX IF NOT EXISTS "Payment_shopId_supplierId_idx" ON "Payment"("shopId", "supplierId");
CREATE INDEX IF NOT EXISTS "Payment_shopId_purchaseId_idx" ON "Payment"("shopId", "purchaseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Supplier_reliabilityScore_range'
  ) THEN
    ALTER TABLE "Supplier"
      ADD CONSTRAINT "Supplier_reliabilityScore_range"
      CHECK ("reliabilityScore" >= 0 AND "reliabilityScore" <= 100)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Supplier_leadTimeDays_nonnegative'
  ) THEN
    ALTER TABLE "Supplier"
      ADD CONSTRAINT "Supplier_leadTimeDays_nonnegative"
      CHECK ("leadTimeDays" IS NULL OR "leadTimeDays" >= 0)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_amount_positive'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_amount_positive"
      CHECK ("amount" > 0)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Purchase_money_nonnegative'
  ) THEN
    ALTER TABLE "Purchase"
      ADD CONSTRAINT "Purchase_money_nonnegative"
      CHECK ("subtotal" >= 0 AND "total" >= 0 AND "paidAmount" >= 0 AND "dueAmount" >= 0)
      NOT VALID;
  END IF;
END $$;

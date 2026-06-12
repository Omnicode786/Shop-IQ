-- Harden the customer/product ledger features that were previously only schema-pushed
-- or enforced in application code. This migration is written defensively so it can
-- run on a clean migrated database or on a database where some columns were already
-- pushed directly during development.

-- Create the real Customer status enum and preserve existing ACTIVE/INACTIVE values.
DO $$
BEGIN
  CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

UPDATE "Customer"
SET "status" = 'ACTIVE'
WHERE "status" IS NULL OR "status"::text NOT IN ('ACTIVE', 'INACTIVE');

ALTER TABLE "Customer"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CustomerStatus" USING ("status"::text::"CustomerStatus"),
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "status" SET NOT NULL;

-- Add cycle-count enum support if the DB was only at the migration history state.
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'CYCLE_COUNT';

-- Add pack conversion fields if they were not already pushed.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "packUnit" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "packSize" INTEGER;

-- Normalize blank optional identifiers before enforcing uniqueness.
UPDATE "Product" SET "barcode" = NULL WHERE "barcode" IS NOT NULL AND btrim("barcode") = '';
UPDATE "Customer" SET "phone" = NULL WHERE "phone" IS NOT NULL AND btrim("phone") = '';

-- Keep the earliest duplicate value per shop and clear later duplicates so the new
-- database-safe uniqueness constraints can be applied without dropping records.
WITH ranked_product_barcodes AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "shopId", "barcode" ORDER BY "createdAt", "id") AS rn
  FROM "Product"
  WHERE "barcode" IS NOT NULL
)
UPDATE "Product"
SET "barcode" = NULL
WHERE "id" IN (SELECT "id" FROM ranked_product_barcodes WHERE rn > 1);

WITH ranked_customer_phones AS (
  SELECT
    "id",
    "phone",
    row_number() OVER (PARTITION BY "shopId", "phone" ORDER BY "createdAt", "id") AS rn
  FROM "Customer"
  WHERE "phone" IS NOT NULL
)
UPDATE "Customer" AS c
SET
  "notes" = concat_ws(E'\n', c."notes", 'Duplicate phone cleared by migration to enforce per-shop uniqueness: ' || r."phone"),
  "phone" = NULL
FROM ranked_customer_phones AS r
WHERE c."id" = r."id" AND r.rn > 1;

DROP INDEX IF EXISTS "Customer_shopId_phone_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Product_shopId_barcode_key" ON "Product"("shopId", "barcode");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_shopId_phone_key" ON "Customer"("shopId", "phone");

-- Database guardrails for quantities and pack conversion fields.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_stockQty_nonnegative') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_stockQty_nonnegative" CHECK ("stockQty" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_reorderLevel_nonnegative') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_reorderLevel_nonnegative" CHECK ("reorderLevel" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_reorderQuantity_nonnegative') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_reorderQuantity_nonnegative" CHECK ("reorderQuantity" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_packSize_positive') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_packSize_positive" CHECK ("packSize" IS NULL OR "packSize" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_creditLimit_nonnegative') THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_creditLimit_nonnegative" CHECK ("creditLimit" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItem_quantity_positive') THEN
    ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_quantity_positive" CHECK ("quantity" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseItem_quantity_positive') THEN
    ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_quantity_positive" CHECK ("quantity" > 0);
  END IF;
END $$;

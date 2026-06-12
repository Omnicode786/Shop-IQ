DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('ACTIVE', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "status" "PaymentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

UPDATE "Payment"
SET "reference" = NULL
WHERE "reference" IS NOT NULL AND btrim("reference") = '';

WITH ranked_references AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "shopId", "reference"
      ORDER BY "createdAt", "id"
    ) AS duplicate_rank
  FROM "Payment"
  WHERE "reference" IS NOT NULL AND btrim("reference") <> ''
)
UPDATE "Payment" AS payment
SET "reference" = left(payment."reference", 94) || '-DUP-' || ranked_references.duplicate_rank
FROM ranked_references
WHERE payment."id" = ranked_references."id"
  AND ranked_references.duplicate_rank > 1;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Payment_voidedById_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_voidedById_fkey"
      FOREIGN KEY ("voidedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_shopId_reference_key" ON "Payment"("shopId", "reference");
CREATE INDEX IF NOT EXISTS "Payment_shopId_status_idx" ON "Payment"("shopId", "status");
CREATE INDEX IF NOT EXISTS "Payment_shopId_voidedById_idx" ON "Payment"("shopId", "voidedById");

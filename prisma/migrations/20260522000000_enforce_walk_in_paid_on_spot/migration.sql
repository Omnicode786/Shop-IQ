-- Walk-in invoices do not carry identity details, so they cannot be left on credit.
-- Existing invalid walk-in rows, if any, are normalized before the check is added.
UPDATE "Invoice"
SET
  "paidAmount" = "total",
  "dueAmount" = 0,
  "status" = 'PAID',
  "dueDate" = NULL,
  "updatedAt" = NOW()
WHERE "customerId" IS NULL
  AND "status" <> 'CANCELLED'
  AND (
    "dueAmount" <> 0
    OR "paidAmount" < "total"
    OR "status" IN ('DRAFT', 'PARTIAL', 'UNPAID')
  );

UPDATE "Invoice"
SET
  "dueAmount" = 0,
  "updatedAt" = NOW()
WHERE "customerId" IS NULL
  AND "status" = 'CANCELLED'
  AND "dueAmount" <> 0;

ALTER TABLE "Invoice"
ADD CONSTRAINT "invoice_walk_in_paid_on_spot"
CHECK (
  "customerId" IS NOT NULL
  OR (
    "dueAmount" = 0
    AND (
      "status" = 'CANCELLED'
      OR (
        "status" = 'PAID'
        AND "paidAmount" >= "total"
      )
    )
  )
);

# ShopIQ Loopholes Review

This file reviews remaining loopholes, workflow gaps, security issues, and data-integrity risks in the current ShopIQ system.

The earlier invoice/payment loophole has already been fixed. It is still mentioned briefly for context, but this review focuses on other issues that may still exist.

## Latest Update Status - June 11, 2026

This section records the loopholes that were checked again after the latest ShopIQ hardening work.

**Migration created:** `20260611000000_harden_walkthrough_features`

**Checks completed:** `npx prisma format`, `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma generate`, `npx tsc --noEmit --pretty false`, `npm run lint`, and `npm run build`.

### Fixed In This Update

1. **Concurrent invoice stock overselling:** fixed with transaction-time product row locks, deterministic locking order, stock validation inside the transaction, and conditional stock decrements.
2. **Barcode duplication per shop:** fixed with a database-level unique constraint on `Product(shopId, barcode)` after safely clearing duplicate barcode values.
3. **Customer phone duplication per shop:** fixed with a database-level unique constraint on `Customer(shopId, phone)` after safely clearing duplicate phone values and preserving context in notes.
4. **Customer status:** fixed by converting customer status to a real Prisma/PostgreSQL enum: `CustomerStatus`.
5. **Pack size and pack unit:** fixed in schema/API flow so pack metadata is saved correctly and purchase receiving can convert buying packs into base stock units.
6. **Customer credit limits during invoices:** fixed in invoice create/edit logic and AI invoice execution. Customer rows are locked before balance and credit checks.
7. **Walk-in customer payment rule:** still fixed. Walk-in invoices must be fully paid because there is no known customer to collect from later.
8. **Cycle count input safety:** fixed at validation level by requiring integer physical counts and logging `CYCLE_COUNT` movements for stock corrections.
9. **Customer balance direct editing:** fixed for customers by using opening balance and controlled adjustment fields instead of raw balance overwrite.
10. **Product archive with stock:** fixed by blocking archive/delete unless product stock is zero through conditional database updates.
11. **AI write tools alignment:** improved so AI-created/updated products, customers, and invoices follow the same barcode, balance, credit-limit, pack-size, and stock-safety rules as the normal API.
12. **Basic database checks:** partially fixed with CHECK constraints for non-negative product stock/reorder values, positive pack size, non-negative customer credit limit, and positive invoice/purchase item quantities.

### Still Not Fixed Or Only Partially Fixed

1. **Refunds and returns:** payment voiding is now fixed, but paid invoice refund/reversal and partial return workflows are still incomplete.
2. **Full cycle-count workflow:** integer validation and `CYCLE_COUNT` logs exist, but there is no full count session, count sheet, approval, or variance review workflow yet.
3. **Expiry/batch enforcement:** batch and expiry fields exist, but billing does not yet block expired stock or enforce FEFO/FIFO selling.
4. **Costing method:** product cost still behaves like latest cost instead of weighted-average, FIFO, or batch costing.
5. **Reports/dashboard financial separation:** active payment collections are now separated from voided payments, but reports still need stronger separation of gross sales, net sales, cancelled sales, refunds, collections, dues, and tax.
6. **Security hardening:** login/signup rate limits, explicit CSRF/origin checks, MFA/password-change flow, and immediate suspended-session invalidation are still open.
7. **Ledger reconciliation:** customer/supplier balances are still stored fields and need reconciliation jobs/views to prove they match invoices, purchases, and payments.

## Second Loophole Fix Batch - June 12, 2026

This batch closed three more connected supplier/accounting loopholes across Prisma, migrations, APIs, UI, dashboard data, and ShopIQ Copilot.

**Migration created and applied:** `20260611010000_supplier_payment_controls`

### Fixed In This Batch

1. **Supplier ledger safety:** supplier balance is no longer a normal direct-edit field. Supplier creation now uses `openingBalance`, supplier updates use controlled `balanceAdjustment` fields with reasons, and each adjustment writes an activity log.
2. **Real supplier payments:** supplier payouts are now real `Payment` records using `PaymentDirection.SUPPLIER_OUT`, linked to `supplierId` and `purchaseId`. Purchase paid amount creates/updates an automatic supplier payment record like invoices already do for customer payments.
3. **Supplier overpayment and mismatch protection:** supplier payments must be linked to a purchase, the purchase controls the supplier, payment amount cannot exceed remaining purchase due, and paid purchases cannot be cancelled without handling payment reversal first.

### Also Improved In This Batch

1. **Supplier inactive status:** suppliers now have a real `SupplierStatus` enum with `ACTIVE` and `INACTIVE`. Suppliers with historical products, purchases, or payments are deactivated instead of deleted.
2. **Supplier selection safety:** inactive suppliers are hidden from new product, purchase, and AI operational flows.
3. **Dashboard cashflow accuracy:** dashboard cashflow now uses real supplier payout payments and excludes cancelled invoices from the main revenue snapshot.
4. **AI tool consistency:** ShopIQ Copilot now follows the same supplier opening-balance, supplier adjustment, purchase supplier requirement, supplier payment, and overpayment rules as the normal API.

## Third Loophole Fix Batch - June 12, 2026

This batch closed two payment/audit loopholes across Prisma, migration SQL, payment APIs, the Payments module UI, dashboard data, PDF report data, and ShopIQ Copilot reads/writes.

**Migration created and applied:** `20260612090000_payment_void_reference_controls`

### Fixed In This Batch

1. **Manual payment deletion no longer erases ledger history:** payment delete now voids the payment instead of deleting the row. The ledger effect is reversed transactionally, the payment is marked `VOIDED`, `voidedAt`, `voidedById`, and `voidReason` are stored, and an activity log entry is created.
2. **Payment references are now database-safe per shop:** `Payment(shopId, reference)` is unique at the database level. Existing duplicate references are safely suffixed during migration before the index is created, manual invoice/purchase payments now generate unique default references, and duplicate user-entered references return a clean validation error.

### Also Improved In This Batch

1. **Financial totals ignore voided payments:** dashboard cashflow, payment summary cards, PDF report cash collections, and AI sales summaries now count only `ACTIVE` payments.
2. **Voided payments remain visible for audit:** the Payments module still lists voided records, but blocks edit/void actions on them and labels them clearly.
3. **Automatic payment sync preserves audit rows:** automatic invoice and purchase payments are voided, reactivated, or updated instead of being hard-deleted when the source paid amount changes.

## Research Basis

I compared ShopIQ with real retail/POS workflows used by small stores and larger supermarket systems. Real systems usually connect these areas tightly:

- POS checkout
- Customer accounts
- Inventory on hand
- Purchase orders and receiving
- Supplier/vendor management
- Stock adjustments and cycle counts
- Returns and refunds
- Payment allocation
- Audit logs
- Reports
- Staff permissions

Public references used for workflow comparison:

- [Shopify POS](https://www.shopify.com/pos) describes POS as a connected system for sales, payments, customers, and inventory.
- [Square inventory management](https://squareup.com/help/us/en/article/5228-item-options) documents item inventory tracking and stock changes.
- [Lightspeed Retail inventory counts](https://www.lightspeedhq.com/blog/inventory-counts/) explains full counts, partial counts, spot counts, and how counts help find shrinkage.
- [Oracle Retail receiving documentation](https://docs.oracle.com/en/industries/retail/retail-store-inventory-management/) shows that enterprise retail receiving is treated as a structured workflow tied to purchase orders, receipt records, and inventory updates.
- [Vori supermarket platform](https://www.vori.com/supermarkets) presents supermarket operations as connected POS, payments, ordering, receiving, inventory, and pricing.

## Short Real-World Workflow Comparison

### Real-World Supermarket Workflow

1. Products are created with SKU, barcode, department, supplier, tax, cost, retail price, pack size, and reorder rules.
2. Stock comes in through purchase orders or receiving.
3. Receiving updates stock only when goods are actually received.
4. POS sales reduce stock immediately.
5. Returns and refunds are recorded separately from sales.
6. Stock adjustments require reason codes, user identity, and audit history.
7. Customer credit is tied to known customer accounts only.
8. Supplier payables are tied to supplier invoices or purchase receipts.
9. Daily cash closing reconciles invoice totals with actual payments.
10. Reports separate gross sales, net sales, paid collections, discounts, tax, refunds, and cancellations.

### Current ShopIQ Workflow

ShopIQ already has the main modules:

- Products
- Customers
- Suppliers
- Billing and invoices
- Payments
- Purchases
- Reports
- Activity logs
- AI Assistant
- Settings
- Staff permissions

The system is strong for a student/project retail app and already handles many important relationships. The remaining issues are mostly around advanced retail correctness: supplier ledger controls, purchase receiving/payment automation, cancellation/refund accounting, report accuracy, audit depth, and production security.

## Fixed / Previous Loopholes

### Fixed Issue: Invoice Paid Amount Did Not Always Create A Payment

**What the problem was:**
Earlier, an invoice could store a paid amount without creating a matching Payment record.

**Why it mattered:**
Invoices and Payments could disagree. Reports and cashflow would become confusing.

**Risk before fix:**
High. Sales and payment records could drift.

**Current status:**
Fixed. Creating an invoice with paid amount now creates a linked automatic Payment record. Editing invoice paid amount updates the automatic payment instead of creating duplicates.

**Priority:** Fixed

### Fixed Issue: Walk-In Customers Could Have Dues

**What the problem was:**
A walk-in invoice could be partial or unpaid even though no real customer was attached.

**Why it mattered:**
The shop would not know who owed the money.

**Risk before fix:**
High. Bad receivables and impossible collection.

**Current status:**
Fixed. Walk-in invoices must be fully paid on spot. If there is credit or due amount, the user must select or create a customer.

**Priority:** Fixed

### Fixed Issue: Payment Could Mismatch Invoice Customer

**What the problem was:**
An invoice-based payment could potentially be associated with the wrong customer.

**Why it mattered:**
Customer balances and invoice settlement would become incorrect.

**Risk before fix:**
High. Ledger corruption.

**Current status:**
Fixed. Selecting an invoice in Payments now controls the customer and prevents selecting another customer.

**Priority:** Fixed

### Fixed Issue: Concurrent Sales Can Oversell Stock

**What the problem was:**
Invoice creation checked stock before the transaction, then decremented stock inside the transaction. If two users sold the last units at the same time, both requests passed the stock check before either decrement finished.

**Why it mattered:**
Real POS systems must prevent negative stock or overselling when two counters sell the same product.

**Risk before fix:**
High. Stock could become negative or incorrect during busy use.

**Current status:**
Fixed. Invoice creation now locks all sold product rows inside the same database transaction, re-validates stock at transaction time, and then decrements stock with conditional updates. If any item is unavailable, the whole invoice rolls back before invoice items, payments, customer balance updates, stock movements, or activity logs are committed.

**Priority:** Fixed

### Fixed Issue: Manual Stock Edits Are Too Powerful

**What the problem was:**
Admins/managers could edit product stock directly from the product form without explaining the adjustment, bypassing standard audit requirements.

**Why it mattered:**
Real inventory systems require reason codes for stock adjustments.

**Risk before fix:**
High. Stock was changed without enough explanation, making audits weak.

**Current status:**
Fixed. Editing a product's stock quantity via the UI or API now mandatorily requires a `stockAdjustmentReason` (and an optional note for "Other" reasons), which is cleanly saved to both the Stock Movement and Activity Log tables for full auditing.

**Priority:** Fixed

### 3. Customer Balance Is Directly Editable (FIXED)

**The Loophole:**
Customer balances could be edited directly from the customer form, bypassing the invoice and payment ledger entirely.

**How we fixed it:**
1. Removed direct manual overriding of the `balance` field in the customer edit form (made it strictly read-only).
2. Introduced an `Opening balance` field exclusive to customer creation that formally logs the starting ledger state.
3. Added a dedicated adjustment workflow (`balanceAdjustment`, `adjustmentReason`, `adjustmentNote`) to the edit form.
4. Any balance adjustment now utilizes atomic database operations and generates a permanent `CUSTOMER_BALANCE_ADJUSTMENT` activity log with full context and diffs.

**Priority:** Fixed

## Products And Inventory

### 3. Archived Products Can Hide Real Stock (FIXED)

**What the problem was:**
Products could be archived even if they still had stock quantity.

**Why it matters:**
Archived products may disappear from normal active inventory calculations and selling workflows while still representing real stock in the shop.

**Risk before fix:**
Inventory value and stock counts may be understated.

**Current status:**
Fixed. Product archive/delete now uses conditional database updates that only succeed when `stockQty` is zero. The archive future-stock check also considers pending physical count changes.

**Priority:** Fixed

### 4. No True Cycle Count Workflow (PARTIALLY FIXED)

**What the problem is:**
The app now supports integer physical stock corrections with `CYCLE_COUNT` stock movements, but there is still no dedicated cycle count, spot count, or full inventory count session process.

**Why it matters:**
Real stores regularly compare physical stock with system stock to catch shrinkage, damage, theft, and mistakes.

**Possible risk:**
Stock drift can still go unnoticed at scale because there is no count sheet, approval step, or variance review workflow.

**Current status:**
Partially fixed. The dangerous free-form count input is now integer-validated and stock corrections are logged, but a complete operational cycle-count module is still pending.

**Priority:** Medium

### 5. Latest Purchase Cost Replaces Product Cost

**What the problem is:**
When a purchase is created, the product cost price is updated to the latest unit cost.

**Why it matters:**
Real retail systems often use weighted average cost, batch cost, FIFO, or another costing method. Latest cost can distort profit if older stock was bought cheaper or more expensive.

**Possible risk:**
Profit/loss reports may be inaccurate after cost changes.

**Priority:** High

### 6. Expiry And Batch Fields Exist But Are Not Enforced (PARTIALLY FIXED)

**What the problem is:**
Products support expiry date, manufacture date, batch number, and perishable flag, but billing does not enforce expiry checks or FEFO/FIFO selling.

**Why it matters:**
Supermarkets and grocery stores must prevent expired stock from being sold.

**Possible risk:**
Expired or wrong-batch goods can be sold.

**Current status:**
Partially fixed. Product forms/API handling are cleaner around perishable metadata, but the POS/invoice flow still does not block expired batches or choose earliest-expiring stock.

**Priority:** Medium

### 7. No Pack Size Or Unit Conversion (FIXED FOR PURCHASE RECEIVING)

**What the problem was:**
The system had one unit field, but did not save pack metadata cleanly enough for carton-to-piece or case-pack buying versus individual selling.

**Why it matters:**
Small stores often buy cartons and sell pieces.

**Risk before fix:**
Stock can be entered in one unit and sold in another without conversion accuracy.

**Current status:**
Fixed for the current one-level purchase receiving workflow. Products now persist `packUnit` and `packSize`, and receiving can convert purchased packs into base stock units. More advanced nested conversions such as carton-to-box-to-piece are still outside the current scope.

**Priority:** Fixed

### 8. Barcode Is Not Unique Per Shop (FIXED)

**What the problem was:**
SKU was unique per shop, but barcode was not.

**Why it matters:**
If two active products share a barcode, scanning can identify the wrong item.

**Risk before fix:**
Wrong product billed or restocked.

**Current status:**
Fixed. The database now has a unique index on `Product(shopId, barcode)`. Existing duplicate barcode values were safely cleared before the constraint was applied, and API/AI product creation now returns a clear duplicate-barcode error.

**Priority:** Fixed

### 9. Sale Price Can Be Lower Than Cost Without Warning (FIXED)

**What the problem was:**
The app allowed sale price to be lower than cost price without enough visibility.

**Why it matters:**
Sometimes this is intentional for promos, but it should warn the owner.

**Risk before fix:**
Accidental loss-making prices.

**Current status:**
Fixed at the product form level. The UI warns when sale price is below cost so intentional promos can still be saved while accidental margin loss is easier to catch.

**Priority:** Fixed

## Customers


### 11. Credit Limit Is Not Enforced During Billing (FIXED)

**What the problem was:**
Customers had credit limits, but invoice creation did not consistently block a new due amount that exceeded the available credit.

**Why it matters:**
Credit limits only help if the billing flow checks them.

**Risk before fix:**
Staff can create large dues beyond the allowed customer limit.

**Current status:**
Fixed. Invoice create/edit now locks the customer row inside the transaction, calculates available credit against current balance, and rejects invoices that would exceed the limit. AI invoice execution uses the same rule before writing.

**Priority:** Fixed

### 12. Duplicate Customer Records Are Easy (PARTIALLY FIXED)

**What the problem is:**
Phone is now database-unique per shop, but WhatsApp, email, and loyalty card number are still not all protected by database-level uniqueness rules.

**Why it matters:**
The same customer can be created multiple times.

**Possible risk:**
Dues and loyalty history split across multiple customer profiles.

**Current status:**
Partially fixed. The strongest everyday identifier, `Customer(shopId, phone)`, is now unique in the database. Existing duplicate phone values were cleaned safely before applying the constraint. Remaining optional identifiers should still be reviewed later.

**Priority:** Medium

### 13. No Customer Active/Inactive Status (FIXED)

**What the problem was:**
Customers could be deleted only if they had no invoices/payments, but there was no proper archived/inactive customer state.

**Why it matters:**
Old customers should be hidden from normal selection without deleting history.

**Risk before fix:**
Customer dropdowns and reports become cluttered.

**Current status:**
Fixed. Customer status is now a real Prisma/PostgreSQL enum with `ACTIVE` and `INACTIVE`, rather than loose text.

**Priority:** Fixed

### 14. Staff Can Edit Sensitive Customer Ledger Fields (PARTIALLY FIXED)

**What the problem is:**
The raw customer balance field is no longer directly editable, but customer credit/ledger permissions still need final role review across the UI and APIs.

**Why it matters:**
Staff should usually update contact details, not ledger values.

**Possible risk:**
Accidental or intentional credit policy changes if role rules are too broad.

**Current status:**
Partially fixed. Customer balance now uses opening balance and controlled balance adjustments with activity logs. The remaining concern is permission design: who can adjust balances, credit limits, or customer status should be reviewed role by role.

**Priority:** Medium

## Suppliers

### 15. Supplier Balance Is Directly Editable (FIXED)

**What the problem was:**
Supplier balance could be edited in the supplier form.

**Why it matters:**
Supplier balance should come from purchases, supplier payments, opening payables, and adjustments.

**Risk before fix:**
Supplier payable may not match purchase/payment records.

**Current status:**
Fixed. Supplier creation uses `openingBalance`, supplier edits use controlled `balanceAdjustment`, `balanceAdjustmentReason`, and `balanceAdjustmentNote`, and adjustments create `SUPPLIER_BALANCE_ADJUSTMENT` activity logs with before/after context.

**Priority:** Fixed

### 16. Purchase Can Have Due Amount Without Supplier Through API (FIXED)

**What the problem was:**
The guided purchase UI asked for a supplier when a purchase had due amount, but the API allowed `supplierId` to be optional. If a due purchase was created without supplier, no supplier balance was updated.

**Why it matters:**
Credit purchases need a supplier account.

**Risk before fix:**
Payables can disappear from supplier ledger.

**Current status:**
Fixed. Purchase creation now requires an active supplier in the UI, API, and AI action path. Purchase edits also prevent removing the supplier, keeping payable history traceable.

**Priority:** Fixed

### 17. Supplier Payment Can Overpay Purchase (FIXED)

**What the problem was:**
Invoice payments had remaining-balance checks, but supplier purchase payments did not have the same strict overpayment protection.

**Why it matters:**
Supplier payouts should not exceed purchase due unless advance/refund logic exists.

**Risk before fix:**
Negative supplier balances or incorrect purchase paid amounts.

**Current status:**
Fixed. Supplier payouts are now linked to a purchase, the purchase controls the supplier, and the payment amount cannot exceed the purchase's remaining due amount. Payment create/edit/delete reverses ledger effects transactionally.

**Priority:** Fixed

### 18. No Supplier Inactive Status (FIXED)

**What the problem was:**
Suppliers with records could not be deleted, but there was no inactive/archive status.

**Why it matters:**
Old suppliers should be hidden from normal receiving without deleting history.

**Risk before fix:**
Supplier selection becomes messy over time.

**Current status:**
Fixed. `SupplierStatus` is now a real enum. Suppliers with products, purchases, or payments are marked `INACTIVE` instead of being deleted, and inactive suppliers are hidden from new operational selection flows.

**Priority:** Fixed

### 19. Supplier Tax Identity Is Not Unique

**What the problem is:**
NTN and GST number fields exist but are not unique per shop.

**Why it matters:**
Real vendor records often rely on tax identity to prevent duplicates.

**Possible risk:**
Duplicate supplier accounts and split payables.

**Priority:** Medium

## Invoices And Billing

### 20. Guided Billing Is Still Too Simple For Real Baskets

**What the problem is:**
The guided billing UI is focused on a simple product-line sale. The API supports item arrays, but the main UI does not behave like a full cart for multi-product grocery baskets.

**Why it matters:**
Real POS checkout usually sells multiple items in one invoice.

**Possible risk:**
Users may create multiple invoices for one sale or avoid using the system for real counter billing.

**Priority:** Medium

### 21. Editing Invoice Totals Can Break Item Totals

**What the problem is:**
Invoice edit allows fields like total, paid amount, discount, tax, and status, but does not edit invoice line items or recalculate stock from changed items.

**Why it matters:**
Invoice totals should match item totals.

**Possible risk:**
Invoice item data, grand total, paid amount, and reports can disagree.

**Priority:** High

### 22. No Proper Refund Workflow

**What the problem is:**
Cancelling an invoice reverses stock and clears due, but there is no complete refund/payment reversal workflow for paid invoices.

**Why it matters:**
If the customer already paid, cancellation should record whether cash/card money was refunded or kept as credit.

**Possible risk:**
Payments module may still show money collected even though invoice was cancelled.

**Priority:** High

### 23. No Formal Return Exchange Flow

**What the problem is:**
Invoice cancellation exists, but there is no separate return, exchange, partial return, damaged return, or refund receipt workflow.

**Why it matters:**
Real shops often return only one item from a multi-item bill.

**Possible risk:**
Users may cancel entire invoices for partial returns.

**Priority:** Medium

### 24. Date-Based Invoice Numbering Is Weak

**What the problem is:**
Default invoice numbers use `INV-${Date.now()}` style fallback.

**Why it matters:**
Real billing usually needs predictable receipt sequences per shop, counter, and date.

**Possible risk:**
Duplicate conflicts under heavy concurrency or weak invoice traceability.

**Priority:** Medium

### 25. Discount And Tax Are Invoice-Level, Not Line-Level

**What the problem is:**
Discount and tax are stored mostly at invoice level. Details view distributes them across lines for display, but line-level tax/discount is not stored.

**Why it matters:**
Different products can have different taxes or discounts.

**Possible risk:**
Tax and profit reports can be less accurate.

**Priority:** Medium

## Payments

### 26. Customer Payment Without Invoice Can Leave Old Invoices Open

**What the problem is:**
A customer payment can be recorded against the customer without selecting an invoice. This reduces customer balance, but does not allocate payment to specific unpaid invoices.

**Why it matters:**
Real receivable systems allocate receipts to invoices.

**Possible risk:**
Customer balance may look lower while old invoices still show PARTIAL or UNPAID.

**Priority:** High

### 27. Manual Payment Deletion Removes Financial Record (FIXED)

**What the problem was:**
Manual payments can be deleted by admins/managers. The app logs deletion, but the payment row is removed.

**Why it matters:**
Financial systems usually void or reverse payments instead of deleting them.

**Possible risk before fix:**
Audit trail loses full payment details.

**Current status:**
Fixed. Payment delete now reverses the ledger effect inside a transaction, marks the payment `VOIDED`, stores `voidedAt`, `voidedById`, and `voidReason`, writes a `PAYMENT_VOIDED` activity log, and keeps the payment row visible for audit. Voided payments are locked from further edit/void actions and excluded from cash totals.

**Priority:** Fixed

### 28. No Cash Drawer Or Day Closing

**What the problem is:**
Payments are recorded, but there is no shift closing, cashier cash drawer count, or expected-vs-actual cash reconciliation.

**Why it matters:**
Retail shops need to compare system cash with physical cash.

**Possible risk:**
Cash shortages or overages are hard to detect.

**Priority:** Medium

### 29. Split Payments Are Not Normalized

**What the problem is:**
Invoice has a paymentBreakdown JSON field, but the main payment workflow is one Payment record at a time.

**Why it matters:**
Customers may pay part cash and part card/JazzCash.

**Possible risk:**
Payment method reports can be inaccurate if split payments are stored inconsistently.

**Priority:** Medium

### 30. Payment Reference Is Not Unique (FIXED)

**What the problem was:**
Payment reference numbers are not unique per shop.

**Why it matters:**
Bank/JazzCash/card references may need duplicate detection.

**Possible risk before fix:**
Duplicate payment entries can be recorded.

**Current status:**
Fixed. `Payment(shopId, reference)` is now unique in PostgreSQL. Existing duplicate references are safely suffixed by the migration before the unique index is created. New manual invoice and purchase payments generate unique default references, and duplicate user-entered references return a clean validation error.

**Priority:** Fixed

## Purchases And Receiving

### 31. Purchase Status Is Not A True Receiving Workflow

**What the problem is:**
Purchase creation immediately creates RECEIVED purchases and increases stock. ORDERED and PARTIAL statuses exist, but the UI/API do not fully model ordered, partially received, received, and closed stages.

**Why it matters:**
Real receiving separates ordering from actual stock arrival.

**Possible risk:**
Stock may be increased before goods are physically received.

**Priority:** High

### 32. Purchase Editing Does Not Reconcile Item Quantities

**What the problem is:**
Purchase edit updates total, paid amount, supplier, status, and notes, but not purchase items or stock quantities.

**Why it matters:**
If quantity or unit cost was wrong, there is no clean edit path that adjusts stock and item totals together.

**Possible risk:**
Purchase totals and product stock can disagree.

**Priority:** High

### 33. Supplier Payment Is Not Automatically Created On Purchase Paid Amount (FIXED)

**What the problem was:**
Creating a purchase stored `paidAmount`, but there was no clear matching automatic supplier payment record like the invoice automatic payment flow.

**Why it matters:**
Payments module should show supplier cash paid at receiving time.

**Risk before fix:**
Purchase paid amounts and supplier payment cashflow may disagree.

**Current status:**
Fixed. Purchase create/edit now syncs an automatic `SUPPLIER_OUT` payment linked to the purchase. The Payments module shows those records, and they cannot be edited directly; users adjust them by editing the purchase paid amount.

**Priority:** Fixed

### 34. Cancel Purchase Does Not Handle Supplier Refunds (PARTIALLY FIXED)

**What the problem is:**
Cancelling a purchase reverses stock and due, but does not clearly handle money already paid to the supplier.

**Why it matters:**
If the shop already paid, cancellation should create refund/credit logic.

**Possible risk:**
Supplier cashflow and purchase status can disagree.

**Current status:**
Partially fixed. The system now blocks cancellation of purchases that already have supplier payments, preventing silent cashflow corruption. A full supplier refund/credit-note workflow is still needed.

**Priority:** Medium

## Reports And PDF Reports

### 35. Dashboard Snapshot Can Include Cancelled Invoices (FIXED)

**What the problem was:**
The dashboard snapshot loaded invoices by shop without excluding CANCELLED status in the main snapshot query.

**Why it matters:**
Cancelled invoices should not count as active revenue.

**Risk before fix:**
Sales pulse, monthly revenue, timelines, and dashboard cards can overstate business performance.

**Current status:**
Fixed. The dashboard snapshot now excludes `CANCELLED` invoices from the main invoice query used for sales, revenue, timelines, and status charts.

**Priority:** Fixed

### 36. Billing Module Gross Totals Can Include Cancelled Invoices

**What the problem is:**
Billing aggregate metrics sum invoice totals without clearly excluding cancelled invoices.

**Why it matters:**
Cancelled sales should be separated from active billed sales.

**Possible risk:**
Gross billed and open due cards can mislead the user.

**Priority:** High

### 37. Report Export Uses Limited Snapshot Data

**What the problem is:**
The dashboard snapshot used for reports limits invoices, payments, purchases, movements, and activities.

**Why it matters:**
Reports for large stores need complete date-range aggregation, not only recent rows.

**Possible risk:**
PDF reports become incomplete as data grows.

**Priority:** High

### 38. PDF Download Link Regenerates Report

**What the problem is:**
Activity links point back to the report export API instead of a stored PDF file. Clicking the link can regenerate a new PDF and create another activity log.

**Why it matters:**
A report should ideally represent the exact generated document at that time.

**Possible risk:**
Activity spam and inconsistent historical report contents.

**Priority:** Medium

### 39. Reports Do Not Clearly Separate Gross, Net, Paid, Due, Refunds

**What the problem is:**
Reports include many useful totals, but business reporting needs strict separation between gross sales, discounts, taxes, cancelled sales, paid collections, dues, refunds, and net sales.

**Why it matters:**
Owners make decisions using these numbers.

**Possible risk:**
Wrong interpretation of business performance.

**Priority:** Medium

## Activity Tab / Activity Feed

### 40. Activity Details Are Too Light For Audit

**What the problem is:**
Many activity records say that something was updated, but do not store before/after values.

**Why it matters:**
Audit logs should explain what changed, not only that something changed.

**Possible risk:**
Hard to investigate wrong balances, stock changes, price edits, or payment edits.

**Priority:** Medium

### 41. Deleted Payments Lose Full Row History (FIXED)

**What the problem was:**
When a manual payment is deleted, activity logs the deletion but the payment row is gone.

**Why it matters:**
Financial records should usually be voided/reversed, not erased.

**Possible risk before fix:**
Audit history becomes incomplete.

**Current status:**
Fixed. Manual payment deletion is now a void workflow. The payment row remains with status `VOIDED`, void metadata, and a reversal activity entry, while financial totals use active payments only.

**Priority:** Fixed

### 42. Report Activity Can Duplicate

**What the problem is:**
Generating and later downloading the same report URL can create multiple PDF report activity entries.

**Why it matters:**
Activity should distinguish original generation from later downloads.

**Possible risk:**
Activity stream becomes noisy.

**Priority:** Low

## Dashboard Analytics

### 43. Revenue Cards Can Mix Billed Sales With Real Cash

**What the problem is:**
Dashboard revenue uses invoice totals, while payment method mix uses payments.

**Why it matters:**
Owners need to know the difference between billed sales and money actually collected.

**Possible risk:**
User may think all billed revenue has been received.

**Priority:** Medium

### 44. Latest Active Day Fallback Can Be Misread As Today

**What the problem is:**
If today has no sales, dashboard falls back to latest active sales day.

**Why it matters:**
The helper label explains it, but users may still read the main number as today's sales.

**Possible risk:**
Small confusion in daily review.

**Priority:** Low

### 45. Inventory Value Ignores Archived Stock (PARTIALLY FIXED)

**What the problem is:**
Dashboard inventory value uses active products.

**Why it matters:**
If archived products still have stock, real stock value may be hidden.

**Possible risk:**
Inventory value understated.

**Current status:**
Partially fixed. New product archive/delete actions are blocked unless stock is zero, so this issue should not grow through normal workflows. A one-time audit is still useful in case older data already contains archived products with remaining stock.

**Priority:** Low

## Settings

### 46. Signup Can Create Unlimited Workspaces

**What the problem is:**
The signup route creates a new shop and admin account without invitation, rate limiting, or approval.

**Why it matters:**
This is okay for a demo, but risky for a deployed production app.

**Possible risk:**
Spam shops, unwanted admins, database growth, and abuse.

**Priority:** High

### 47. Currency Is Free Text

**What the problem is:**
Currency is stored as text and can be edited to any value.

**Why it matters:**
Reports and money labels expect a valid currency such as PKR.

**Possible risk:**
Incorrect report labels or inconsistent shop settings.

**Priority:** Low

### 48. No Backup/Restore Or Data Export Setting

**What the problem is:**
Settings does not provide owner-level backup, restore, or full export controls.

**Why it matters:**
Real businesses need data portability and recovery.

**Possible risk:**
Harder disaster recovery.

**Priority:** Low

## ShopIQ Copilot / AI Assistant

### 49. AI Can Prepare Powerful Stock Adjustments

**What the problem is:**
AI write actions require approval, but stock adjustments can still be prepared by AI and approved by an authorized user.

**Why it matters:**
Stock adjustments directly change inventory.

**Possible risk:**
Wrong prompt or careless approval can create bad stock.

**Priority:** Medium

### 50. AI Chat Stores Business Context

**What the problem is:**
Assistant messages can contain customer names, dues, product data, and business context.

**Why it matters:**
Chat history is operational data and may include sensitive business/customer information.

**Possible risk:**
Sensitive data stored longer than intended.

**Priority:** Medium

### 51. No User-Level AI Rate Limits

**What the problem is:**
The Gemini system has queueing, key cooldowns, caching, and backend protections, but there is no clear per-user daily quota or abuse limit.

**Why it matters:**
One user can still generate many AI requests.

**Possible risk:**
Quota exhaustion or unnecessary API cost.

**Priority:** Medium

### 52. AI Validation Must Stay In Sync With API Validation

**What the problem is:**
AI tools have their own schemas and preparation logic. If API validation changes later but AI validation does not, they can drift.

**Why it matters:**
AI should never create records that normal UI/API rules would reject.

**Possible risk:**
Different behavior between AI and manual workflows.

**Priority:** Medium

## Security And Permissions

### 53. Suspended Users May Keep Existing Session

**What the problem is:**
Login checks that user status is ACTIVE, but `getCurrentUser` returns the user by session id without clearly blocking users who were suspended after login.

**Why it matters:**
Suspending a user should remove access immediately.

**Possible risk:**
Suspended staff may continue using the app until session expiry.

**Priority:** High

### 54. No Login Rate Limiting Or Account Lockout

**What the problem is:**
Login does not appear to rate-limit attempts or lock accounts after repeated failures.

**Why it matters:**
Public login forms need brute-force protection.

**Possible risk:**
Password guessing attacks.

**Priority:** High

### 55. No CSRF Token On Cookie-Based Mutations

**What the problem is:**
The app uses cookie sessions and many POST/PATCH/DELETE routes. SameSite helps, but there is no explicit CSRF token or origin check shown.

**Why it matters:**
Sensitive mutation routes should be protected against cross-site request attacks.

**Possible risk:**
Unwanted actions if browser/session protections are bypassed.

**Priority:** Medium

### 56. No MFA Or Password Change Workflow

**What the problem is:**
There is staff creation and password reset through staff edit, but no user self-service password change or MFA.

**Why it matters:**
Owner/admin accounts protect all shop data.

**Possible risk:**
Weak account security.

**Priority:** Medium

### 57. Permissions JSON Exists But Is Not Used

**What the problem is:**
User records include a permissions JSON field, but enforcement appears to use role rules only.

**Why it matters:**
Future developers may assume custom permissions work when they do not.

**Possible risk:**
Permission confusion.

**Priority:** Low

### 58. Default Demo Passwords Are Dangerous In Production

**What the problem is:**
Seeded/demo accounts often use simple passwords such as `demo12345`.

**Why it matters:**
This is acceptable for local demo data but not production.

**Possible risk:**
Unauthorized access if demo accounts reach production.

**Priority:** High

## Database Consistency

### 59. Ledger Balances Are Denormalized Without Reconciliation

**What the problem is:**
Customer and supplier balances are stored fields updated by workflows.

**Why it matters:**
Stored balances can drift from invoices, purchases, and payments if bugs or manual edits occur.

**Possible risk:**
Wrong receivables/payables.

**Priority:** High

### 60. Missing Database Check Constraints (PARTIALLY FIXED)

**What the problem is:**
Some non-negative and positive-quantity rules are now protected by database CHECK constraints, but not every financial relationship is database-enforced yet.

**Why it matters:**
Database-level constraints protect against future API bugs, scripts, or direct SQL changes.

**Possible risk:**
Negative totals, invalid quantities, impossible discounts, or bad paid/due amounts.

**Current status:**
Partially fixed. The latest migration added CHECK constraints for product stock/reorder quantities, positive product pack size, non-negative customer credit limit, and positive invoice/purchase item quantities. Remaining work includes stricter money checks, paid/due/total relationship checks, and status/payment consistency rules.

**Priority:** Medium

### 61. No Strong Optimistic Locking

**What the problem is:**
Records have updatedAt, but update routes do not require the client to send an expected updatedAt/version.

**Why it matters:**
Two users can edit the same record, and the later save can overwrite the earlier save.

**Possible risk:**
Lost updates.

**Priority:** Medium

### 62. Money Uses JavaScript Number During Calculations

**What the problem is:**
Prisma Decimal values are often converted to Number for totals and reports.

**Why it matters:**
For normal PKR values this is usually okay, but Decimal-safe calculations are better for financial systems.

**Possible risk:**
Rounding issues in edge cases.

**Priority:** Low

### 63. Deletes Use Cascade In Some Relations

**What the problem is:**
Shop deletion would cascade all data. Assistant threads cascade with users/shops. Product stock movements cascade with product.

**Why it matters:**
Cascade behavior is useful but dangerous if a future delete endpoint is added.

**Possible risk:**
Large accidental data loss.

**Priority:** Medium

## Final Priority Checklist

### High Priority

1. Add conditional stock decrement or row locking for invoice creation. **Fixed on June 11, 2026.**
2. Remove direct editable customer/supplier balance fields from normal forms or move them to controlled opening-balance/adjustment workflows. **Fixed for customers and suppliers.**
3. Enforce customer credit limit during billing. **Fixed on June 11, 2026.**
4. Require supplier when purchase has due amount at API level. **Fixed; purchases now require active suppliers.**
5. Add supplier payment overpayment checks. **Fixed for purchase-linked supplier payouts.**
6. Make purchase paid amount create supplier payment records. **Fixed with automatic `SUPPLIER_OUT` payment sync.**
7. Add refund/return workflow for paid invoice cancellation. **Payment voiding is fixed; invoice refund/return logic is still open.**
8. Exclude cancelled invoices from dashboard and billing financial metrics. **Dashboard fixed; billing module aggregate review still recommended.**
9. Build reports from complete date-range aggregation, not limited snapshot rows.
10. Block suspended users immediately in `getCurrentUser`.
11. Add login/signup rate limiting.
12. Add DB CHECK constraints for non-negative money, quantities, paid/due relationships, and status/payment logic. **Partially fixed: stock, reorder, pack size, customer credit limit, and item quantity checks are now in the database.**
13. Add balance reconciliation jobs or views for customer/supplier ledgers.
14. Remove demo passwords from production.

### Medium Priority

1. Add cart-style multi-item billing UI.
2. Add purchase order receiving stages: ordered, partial received, received, closed.
3. Add cycle counts and stock adjustment reason codes. **Partially fixed: integer physical counts and `CYCLE_COUNT` movement logs exist; full count sessions are still open.**
4. Add product expiry/batch enforcement for perishable goods.
5. Add weighted-average or FIFO costing.
6. Add payment allocation to oldest/unpaid invoices.
7. Add split payment support.
8. Add void/reversal instead of hard delete for payments. **Fixed with `PaymentStatus.VOIDED` and ledger reversal.**
9. Add before/after metadata to activity logs.
10. Store generated PDFs or report snapshots instead of regenerating from activity links.
11. Add CSRF origin/token checks for mutation routes.
12. Add per-user AI usage limits.
13. Add optimistic locking on sensitive updates.

### Low Priority

1. Add inactive/archive state for customers and suppliers. **Fixed for customers and suppliers.**
2. Make currency a controlled list.
3. Add backup/export settings.
4. Add duplicate warnings for customer phone, loyalty card, supplier tax number, barcode, and payment reference. **Product barcode, customer phone, and payment reference are now database-safe; remaining identifiers still need work.**
5. Add margin warning when sale price is below cost. **Fixed in product UI.**
6. Clarify dashboard labels when latest active day is shown instead of today.

## Short Fix Direction

The safest next improvements should continue with accounting and operational correctness:

1. Add refund/return logic before relying on cancellation for paid records.
2. Add supplier refund/credit-note workflow for paid purchase reversals.
3. Filter cancelled records out of every billing/report aggregate, not only the dashboard snapshot.
4. Add ledger reconciliation queries/jobs for customers and suppliers.
5. Harden sessions, login, signup, and production seed credentials.

After those are done, improve retail depth:

1. Multi-item billing cart.
2. Purchase order receiving stages.
3. Full cycle count sessions and variance approval.
4. Expiry/batch handling.
5. Better costing method.

ShopIQ already has a strong base. The remaining risks are the kinds of issues that appear when a demo retail system grows into a real operational POS and inventory system.

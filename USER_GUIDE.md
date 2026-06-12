# ShopIQ User Guide

This guide is written for the current ShopIQ project. It explains how the app is meant to be used by a shop owner, manager, cashier, stock helper, or staff member.

ShopIQ is a retail operating system for Pakistani shops and stores. It connects inventory, billing, customers, suppliers, payments, purchases, reports, activity logs, and ShopIQ Copilot into one workflow.

The most important idea is simple:

- Products are what you sell.
- Customers are people or accounts you sell to.
- Suppliers are people or companies you buy stock from.
- Invoices prove what was sold.
- Billing is the guided workflow for making an invoice.
- Payments prove money moved.
- Purchases prove stock came in from suppliers.
- Stock movements explain why stock increased or decreased.
- Reports turn the data into PDF business documents.
- Activity shows what happened in the shop.
- ShopIQ Copilot helps you search, understand, and prepare actions, but write actions need approval.

## Roles In ShopIQ

ShopIQ uses role-based access so every user sees the tools they are allowed to use.

| Role | Best for | Main access |
| --- | --- | --- |
| Admin | Owner or system controller | Full workspace access, staff management, settings, reports, supplier side, all CRUD actions |
| Manager | Branch manager or senior operator | Most owner-level work, can manage staff members, cannot create admins or managers |
| Staff | Cashier, counter worker, shop assistant | Billing, customers, inventory view, customer payments, AI assistant, limited settings view |

### What Each Role Can Usually Do

| Module | Admin | Manager | Staff |
| --- | --- | --- | --- |
| Dashboard | View full dashboard | View full dashboard | View role-limited dashboard |
| Products / Inventory | Create, read, update, archive | Create, read, update, archive | Read |
| Customers | Create, read, update, delete if allowed | Create, read, update, delete if allowed | Create, read, update |
| Suppliers | Create, read, update, delete | Create, read, update, delete | Not available in staff nav |
| Billing / Invoices | Create, read, update, cancel | Create, read, update, cancel | Create, read |
| Payments | Customer receipts and supplier payouts | Customer receipts and supplier payouts | Customer receipts only |
| Purchases | Create, read, update, cancel | Create, read, update, cancel | Not available in staff nav |
| Reports | Generate and view reports | Generate and view reports | Not available in staff nav |
| Staff | Manage users | Manage staff only | Not available |
| Settings | View and update | View and update | View only where available |
| AI Assistant | Use role-aware tools | Use role-aware tools | Use role-aware tools with staff limits |

Important staff rule: Staff can record customer money coming in, but supplier payouts are reserved for admin and manager roles.

## Navigation Overview

The main workspace has these modules:

1. Dashboard
2. Inventory
3. Billing
4. Customers
5. Suppliers
6. Payments
7. Purchases
8. Reports
9. AI Assistant
10. Staff
11. Settings

Staff users see a smaller navigation set:

1. Dashboard
2. Billing
3. Inventory
4. Customers
5. Payments
6. AI Assistant
7. Settings

The desktop sidebar stays fixed on the left. The top bar stays fixed at the top. Only the main page content scrolls.

## Core Terms

### What Is A Product?

A product is an item your shop sells or tracks in stock.

Examples:

- Sugar 1kg
- Cooking Oil 1L
- Tapal Danedar 190g
- Olpers Milk 1L
- Colgate Toothpaste

A product stores the item name, price, cost, stock quantity, reorder level, category, supplier, and location.

### What Is A Customer?

A customer is a person, family, business, office, or loyalty buyer linked to sales and dues.

You do not need a customer for every quick counter sale. A paid walk-in sale can be made without a customer. But if the sale is unpaid or partially paid, ShopIQ needs a customer so the balance can be tracked.

### What Is A Supplier?

A supplier is the person, wholesaler, distributor, or company you buy stock from.

Suppliers are used in purchases and supplier payments. Supplier balances show how much your shop still owes.

### What Is An Invoice?

An invoice is the saved sale record.

It answers:

- What was sold?
- Who bought it?
- Which products were included?
- What was the total?
- How much was paid?
- How much is still due?
- What is the payment status?

### What Is Billing?

Billing is the guided workflow for creating an invoice.

Invoices are the record. Billing is the process.

For example, when a cashier sells a product, they use Billing. ShopIQ then creates the invoice, decreases stock, creates a payment if money was received, and updates customer balance if anything is still due.

### What Is A Payment?

A payment is a money movement record.

It answers:

- Who paid?
- Who was paid?
- How much money moved?
- Was it cash, card, JazzCash, EasyPaisa, bank transfer, cheque, or other?
- Which invoice or purchase does the money belong to?

Payments are separate from invoices because invoices say what was sold, while payments say when and how money was actually received.

This matters for partial payments, installments, customer credit, supplier payouts, cash reconciliation, and auditing.

### What Is A Purchase?

A purchase is stock bought from a supplier.

It answers:

- Which supplier did you buy from?
- Which product came in?
- What quantity was received?
- What was the unit cost?
- How much was paid to the supplier?
- How much is still payable?

### What Is A Stock Movement?

A stock movement is the reason stock changed.

Examples:

- Opening stock
- Purchase received
- Sale made
- Invoice cancelled
- Return
- Damage
- Adjustment

Stock movement records are useful when a product stock count looks wrong and you need to know what changed it.

## Dashboard

### Purpose

The Dashboard is the command center. It gives a short live view of the shop without forcing the user to open every module.

The dashboard uses real database data from invoices, payments, products, customers, suppliers, stock movements, and activity logs.

### Main Dashboard Areas

#### Welcome Card

The top card greets the current user and shows stock health. Stock health is based on how many products are at or below reorder level.

#### Quick Actions

Quick Actions help users start common tasks quickly:

- Create invoice
- Add customer
- Record payment
- Manage stock
- Export report

These buttons navigate directly to the correct workflow.

#### Metric Cards

The main cards show:

- Sales pulse: sales for today, or the latest active sales day if today has no sales
- Revenue: current month gross sales, or latest active 30 days if there is no current-month data
- Inventory value: active product stock multiplied by cost price
- Customer dues: customer receivables still to collect

#### Charts

Dashboard charts are intentionally limited so the page stays useful instead of crowded.

Current dashboard charts include:

- Revenue timeline
- Category inventory value pie chart
- Payment method mix

Charts use actual Chart.js behavior and real database values. They should not invent extra data just to fill empty space.

#### Tables

The dashboard also shows:

- Low stock watchlist
- Recent invoices
- Activity feed

### When To Use The Dashboard

Use the dashboard when you want to answer:

- How is the shop doing today?
- Which products are low?
- How much money is tied up in inventory?
- Which customer dues need attention?
- What happened recently?

## Customers Module

### Purpose

The Customers module is the customer ledger and loyalty workspace. It stores people and accounts that buy from your shop.

Customers are especially important when a sale is unpaid or partially paid. ShopIQ cannot safely track dues for an unknown walk-in buyer.

### Important Fields

| Field | Why it exists |
| --- | --- |
| Customer name | Main identity of the customer |
| Phone | Calling or searching the customer |
| WhatsApp | Follow-up, delivery, reminders |
| Email | Optional digital contact |
| Address | Delivery or account location |
| Area | Easier local filtering, for example Gulshan or DHA |
| City | Useful for multi-city or report context |
| Customer type | Tells whether the customer is walk-in loyalty, family monthly, office pantry, or bulk buyer |
| Loyalty card no | Tracks loyalty customer identity |
| Loyalty points | Stores reward points |
| Preferred payment | Helps staff know how the customer usually pays |
| Credit limit | Maximum credit the shop is comfortable giving |
| Balance | Current amount the customer owes |
| Notes | Any practical note, such as "pays weekly" or "office account" |

### How Customer Balance Works

Customer balance increases when an invoice has a due amount.

Customer balance decreases when a customer payment is recorded.

Example:

- Customer buys PKR 10,000.
- Customer pays PKR 4,000.
- Invoice is partial.
- Customer balance increases by PKR 6,000.
- Later customer pays PKR 6,000.
- Customer balance decreases back to zero.

### Add Customer Step By Step

1. Open Customers.
2. Click Add customer.
3. Enter customer name.
4. Add phone or WhatsApp if available.
5. Add area and city if the customer is local or delivery-based.
6. Select customer type if known.
7. Add credit limit if you allow credit.
8. Add opening balance only if the customer already owes money from before using ShopIQ.
9. Save.

### When You Should Add A Customer

Add a customer when:

- The buyer may pay later.
- The buyer is a monthly ration customer.
- The buyer is an office or business account.
- You want loyalty history.
- You need delivery details.
- You want customer dues to be visible in reports.

Do not create a full customer record for every tiny cash sale unless you actually need history.

## Products / Inventory Module

### Purpose

The Inventory module manages all product records, pricing, stock, reorder levels, and product location.

This module is the base of billing. You cannot sell a product properly unless it exists in inventory.

### Important Fields

| Field | Why it exists |
| --- | --- |
| Product name | The human-readable item name |
| SKU | Internal shop code, useful when names are similar |
| Barcode | Scanning or lookup code |
| Brand | FMCG or product brand |
| Category | Groups products for search, reports, and charts |
| Primary supplier | Main supplier for restocking |
| Unit | Pieces, kg, bottle, pack, carton, etc. |
| Cost price | What the shop paid for one unit |
| Sale price | What the customer pays for one unit |
| Tax rate | Optional tax percentage |
| Discount rate | Optional product-level discount percentage |
| Stock quantity | Current quantity available |
| Low stock level | Reorder warning point |
| Reorder quantity | Suggested purchase quantity |
| Location | Physical place in the shop |
| Aisle/counter | More precise product placement |
| Shelf | Even more precise placement |
| Product type | General, perishable, electronics, grocery, etc. |
| Description | Extra product details |
| Status | Active products can be sold; archived products are hidden from normal selling |

The database also supports image URL, batch number, manufacture date, expiry date, perishable flag, and shelf-level metadata where needed.

### Add Product Step By Step

1. Open Inventory.
2. Click Add product.
3. Enter product name.
4. Add SKU if you have a code. If not, use a simple shop code.
5. Add barcode if available.
6. Select category.
7. Select supplier if known.
8. Enter unit, for example pcs, kg, pack, bottle, carton.
9. Enter cost price.
10. Enter sale price.
11. Enter current stock quantity.
12. Set low stock level.
13. Set reorder quantity.
14. Add location, aisle, or shelf if useful.
15. Save.

### Managing Stock

Stock changes when:

- A product is created with opening stock.
- A purchase is received.
- An invoice is created.
- An invoice is cancelled and stock is returned.
- An adjustment, return, or damage movement is recorded.

Do not manually change stock without understanding why. If stock is wrong, check stock movement history first.

### Low Stock Meaning

A product is low stock when:

`stockQty <= reorderLevel`

Example:

- Stock quantity: 6
- Reorder level: 10
- Product is low stock.

Low stock does not mean zero stock. It means the shop should think about restocking before the product runs out.

## Suppliers Module

### Purpose

The Suppliers module stores wholesalers, distributors, dealers, and vendors from whom the shop buys stock.

Suppliers connect to purchases and supplier payments.

### Important Fields

| Field | Why it exists |
| --- | --- |
| Supplier name | Main supplier identity |
| Phone | Contact number |
| Email | Optional formal contact |
| Address | Market or business location |
| Contact person | The person you deal with |
| Supplier type | Grocery, dairy, beverages, electronics, etc. |
| Payment terms | Cash, weekly credit, monthly credit, etc. |
| Lead time days | How long restocking usually takes |
| NTN | Tax identity if used |
| GST number | Sales tax identity if used |
| Opening payable | Amount already owed before using ShopIQ |
| Reliability score | Internal reliability rating from 0 to 100 |
| Notes | Practical notes, for example "delivers Monday" |

### Add Supplier Step By Step

1. Open Suppliers.
2. Click Add supplier.
3. Enter supplier name.
4. Add phone and address.
5. Add contact person if available.
6. Add supplier type.
7. Add payment terms and lead time.
8. Add opening payable only if you already owe the supplier money.
9. Save.

### When Supplier Balance Changes

Supplier balance increases when a purchase has an unpaid due amount.

Supplier balance decreases when a supplier payout is recorded.

Staff cannot record supplier payouts. Admins and managers can.

## Purchases Module

### Purpose

The Purchases module records stock bought from suppliers.

Purchases affect:

- Product stock
- Supplier payable balance
- Purchase history
- Stock movement history
- Reports

### Purchase Statuses

| Status | Meaning |
| --- | --- |
| ORDERED | Purchase has been ordered but not fully received |
| RECEIVED | Stock has been received |
| PARTIAL | Some purchase state is partial |
| CANCELLED | Purchase was cancelled and should not count as active intake |

### Important Fields

| Field | Why it exists |
| --- | --- |
| Purchase number | Unique purchase reference |
| Supplier | Who the shop bought from |
| Product | Item being received |
| Quantity | Quantity received |
| Unit cost | Cost paid per unit |
| Paid amount | Money paid to supplier at purchase time |
| Total | Purchase total |
| Status | Receiving/payment state |
| Notes | Extra purchase context |

### Receive Stock Step By Step

1. Open Purchases.
2. Click Receive stock.
3. Select an existing supplier or create a new supplier inside the flow.
4. Select the product being received.
5. Enter quantity.
6. Enter unit cost.
7. Enter paid amount.
8. If any amount remains due, make sure a supplier is selected or created.
9. Add notes if needed.
10. Save.

### What Happens After Saving A Purchase

ShopIQ:

1. Creates the purchase record.
2. Increases product stock for received items.
3. Creates a PURCHASE stock movement.
4. Updates supplier balance if any amount is due.
5. Creates activity history.

## Billing Module

### Purpose

Billing is the main sales workflow. It creates invoices from live inventory.

Use Billing when a customer is buying something.

### Billing Compared To Invoices

Billing is the workflow.

Invoice is the final saved record.

Example:

1. Cashier opens Billing.
2. Cashier selects customer and product.
3. Cashier enters quantity and paid amount.
4. ShopIQ saves the invoice.
5. ShopIQ updates stock and payments.

### Important Billing Fields

| Field | Why it exists |
| --- | --- |
| Customer | Links dues and customer history; blank means walk-in |
| Product | Product being sold |
| Quantity | How many units are sold |
| Discount | Invoice discount |
| Paid amount | Money collected at invoice time |
| Channel | POS, loyalty counter, or B2B |
| Notes | Extra sale note |

### Walk-In Customer Rule

Walk-in customers must pay the full invoice amount on spot.

Reason: The shop does not know who the person is, so ShopIQ cannot safely track credit or future dues.

If payment is partial or unpaid, select an existing customer or create a new customer.

### Create Invoice Step By Step

1. Open Billing.
2. Click Create invoice.
3. In the Customer section, choose one option:
   - Walk-in customer for fully paid counter sale.
   - Select existing customer for known customer or credit sale.
   - Create new customer if this buyer should be tracked.
4. Select the product.
5. Enter quantity.
6. Enter discount if any.
7. Enter paid amount.
8. Choose channel.
9. Add notes if needed.
10. Save.

### What Happens After An Invoice Is Created

ShopIQ:

1. Validates stock.
2. Calculates subtotal, discount, tax, total, paid amount, and due amount.
3. Blocks walk-in credit.
4. Creates the invoice.
5. Creates invoice items.
6. Decreases product stock.
7. Creates SALE stock movements.
8. Creates an automatic payment if paid amount is greater than zero.
9. Updates customer balance if there is due amount.
10. Writes activity history.

### Invoice Status Meaning

| Status | Meaning |
| --- | --- |
| UNPAID | Paid amount is zero |
| PARTIAL | Paid amount is more than zero but less than total |
| PAID | Paid amount equals total |
| CANCELLED | Invoice was cancelled and stock/due effects were reversed where applicable |

### Invoice Details

The invoice Details view shows the products a customer bought.

For each item it shows:

- Product name
- Quantity
- Unit price
- Discount if any
- Tax if any
- Line total

It also shows invoice totals:

- Subtotal
- Discount
- Tax
- Paid amount
- Remaining balance
- Grand total
- Payment status

Use Details when you want to check what was purchased without opening Edit.

## Payments Module

### Purpose

Payments is the cashflow and settlement module.

It tracks money received from customers and money paid to suppliers.

Payments are separate because money does not always move at the same time as an invoice or purchase.

### Payment Directions

| Direction | Meaning |
| --- | --- |
| CUSTOMER_IN | Money received from customer |
| SUPPLIER_OUT | Money paid to supplier |

Staff users can record CUSTOMER_IN only.

Admin and manager users can record both CUSTOMER_IN and SUPPLIER_OUT.

### Payment Methods

ShopIQ supports:

- Cash
- Bank transfer
- Card
- JazzCash
- EasyPaisa
- Cheque
- Other

### Automatic Invoice Payments

When an invoice is created with a paid amount greater than zero, ShopIQ automatically creates a linked Payment record.

Example:

- Invoice total: PKR 5,000
- Paid at invoice time: PKR 2,000
- ShopIQ creates a partial invoice and a PKR 2,000 customer payment.

Automatic invoice payments are protected. To change them, edit the invoice paid amount instead of directly editing the payment row.

### Manual Payments

Manual payments are used for later money collection.

Use manual payment when:

- A customer pays remaining balance later.
- A customer pays in installments.
- An unpaid invoice becomes partial or paid.
- A supplier payout is made after a purchase.

### Add Payment Step By Step

1. Open Payments.
2. Click Record payment.
3. Select direction:
   - Customer in for customer receipts.
   - Supplier out for supplier payouts.
4. Select payment method.
5. Enter amount.
6. If this is an invoice payment, select the invoice.
7. When an invoice is selected, ShopIQ auto-fills and locks the correct customer.
8. Review invoice total, already paid, remaining balance, status, and product summary.
9. Add reference or notes if needed.
10. Save.

### Invoice-Based Payment Rules

When payment is linked to an invoice:

- Direction must be CUSTOMER_IN.
- The invoice controls the customer.
- You cannot manually choose a different customer.
- Payment cannot exceed the remaining invoice balance.
- A fully paid invoice cannot receive another payment unless refund or overpayment logic is added later.
- Invoice paid amount, due amount, and status update automatically.
- Customer balance updates automatically.

### Why Payments Exist If Invoice Already Has Paid Amount

The invoice tells what was sold and how much is due.

The payment tells how money moved.

For a small cash sale, they may feel like the same thing. But for real shop work they are different:

- A customer may pay half today and half later.
- A customer may pay by JazzCash after the invoice.
- A supplier may be paid days after purchase.
- A manager may need to audit payment method totals.
- Reports need to know actual cashflow, not just billed sales.

## Reports Module

### Purpose

Reports creates business-ready PDF reports from live ShopIQ data.

The Reports module uses actual records only. It does not use fake filler data.

### Available Report Types

ShopIQ supports:

- General Business
- Daily Operations
- Sales
- Inventory
- Customer
- Customer Dues
- Supplier
- Profit And Loss
- Stock Movement
- Business Insight
- Full Business Review

### What Reports Include

Depending on the report type and available data, PDFs may include:

- Professional report header
- Report date
- Generated-by info
- Shop details
- Summary metrics
- Sales totals
- Invoice count
- Gross profit
- Inventory value
- Low stock records
- Customer dues
- Supplier payables
- Fast moving products
- Slow moving products
- Tables
- Useful insights

### Generate Report Step By Step

1. Open Reports.
2. Click the export/report button.
3. Select report type if the UI asks.
4. Select date range if needed.
5. Generate the PDF.
6. Download or open the PDF.

### Activity After Report Generation

Every generated PDF report writes an activity entry.

The activity entry includes:

- Report type
- Generation time
- Context or date range
- Link to download the PDF when available

## Activity Feed

### Purpose

Activity is the audit trail of the shop.

In the current workspace, activity appears on the dashboard as the Store stream. If the UI labels this as Activity in a tab or panel, it refers to the same idea.

### What Activity Tracks

Activity can include:

- Invoice created
- Invoice updated
- Invoice cancelled
- Payment recorded
- Payment updated
- Payment deleted
- Product created or updated
- Customer created or updated
- Supplier created or updated
- Purchase received
- Report generated
- AI action completed
- Low stock warning

### Why Activity Matters

Activity answers:

- Who did this?
- What happened?
- When did it happen?
- Was a PDF report generated?
- Was an invoice cancelled?
- Was a payment changed?

Activity is for review and accountability. It is not where you edit records.

## ShopIQ Copilot / AI Assistant

### Purpose

ShopIQ Copilot is the AI assistant workspace. It uses Gemini on the server side and connects to ShopIQ tools.

It can answer business questions, search records, summarize live data, prepare reports, and prepare record creation or updates.

### Chat Threads

Every new conversation becomes a saved chat thread after the first message.

The title is generated from the context of the first question.

Old chats can be opened later from the history panel.

Chat history can be deleted with confirmation.

### What Copilot Can Help With

Copilot can help answer questions like:

- How much earning did we do this month?
- Which products are low stock?
- Which customers owe the most money?
- Which supplier payable is high?
- Which products are weak sellers?
- Which products should I reorder?
- Generate a sales PDF report.
- Create a customer record.
- Prepare an invoice for this customer.
- Add a product with cost, sale price, stock, and low stock level.
- Record a customer payment.

### Read-Only AI Actions

Read-only actions can run directly because they do not change the database.

Examples:

- Search products
- Search customers
- Show unpaid invoices
- Summarize customer dues
- Prepare reorder suggestions
- Explain business trends

### Write AI Actions

Any database write action must show a preview and require approval.

Write actions include:

- Create category
- Create product
- Create customer
- Create supplier
- Create invoice
- Create payment
- Create purchase
- Create stock adjustment
- Create staff member
- Update supported records

Copilot cannot silently change the database. You must approve the preview first.

### AI Reports

When Copilot generates a report, the final output should be a PDF report, not only a chat message.

The chat may show a short summary and a button/link, but the report itself is generated from the Reports PDF system.

### Good Prompts For Copilot

Try prompts like:

```text
Show me the highest customer dues and suggest who to follow up with first.
```

```text
Find products that are low stock and prepare a reorder plan.
```

```text
Generate a sales PDF report for this month.
```

```text
Create customer: Bright Star School, phone 03001234567, address Gulberg Lahore, credit limit 250000.
```

```text
Add product: Surf Excel 1kg, category Household & Cleaning, cost 540, sale price 620, stock 30, low stock 8.
```

```text
Search products named milk before preparing an invoice.
```

### AI Safety Rules

ShopIQ Copilot follows these rules:

- API keys stay on the server.
- Role permissions still apply.
- Staff cannot use AI to bypass supplier payout restrictions.
- Record creation or updates need approval.
- If Gemini is not working, the user receives a clean failure message.
- User messages that fail before a real AI answer are not saved as successful chat content.
- The AI should not invent database values when exact records are needed.

## Staff Module

### Purpose

The Staff module manages shop user accounts and access.

Admins can manage admins, managers, and staff.

Managers can add and maintain staff accounts, but cannot create admins or managers.

Staff cannot manage staff accounts.

### Important Fields

| Field | Why it exists |
| --- | --- |
| Name | Staff member identity |
| Email | Login email |
| Temporary password | Initial or reset password |
| Role | Access level |
| Status | Active, invited, or suspended |
| Designation | Job title such as cashier or inventory officer |
| Phone | Contact number |
| CNIC | Optional local identity field |
| Shift | Morning, evening, closing, or flexible |
| Branch area | Area or department where staff works |

### Add Staff Step By Step

1. Open Staff.
2. Click Add member.
3. Enter name and email.
4. Enter a temporary password if needed.
5. Select role.
6. Select status.
7. Add designation, phone, shift, and branch area.
8. Save.

If you are a manager, the role list will only allow staff-level users.

## Settings Module

### Purpose

Settings controls workspace identity and appearance.

### Profile Tab

The Profile tab shows one fixed shop details card. It is not a table because each ShopIQ workspace is meant to represent one active shop profile.

Fields:

| Field | Why it exists |
| --- | --- |
| Shop name | Appears across workspace, reports, and documents |
| City | Business location context |
| Address | Printed/report context |
| Phone | Contact detail |
| Currency | Usually PKR for this project |

Admins and managers can edit the shop profile. Staff users may see settings but cannot update protected fields unless allowed.

### Appearance Tab

Theme controls live in Settings under Appearance.

You can choose:

- System, light, or dark color mode
- Liquid glass or classic UI mode
- ShopIQ original theme
- TweakCN theme presets
- Orange-accented original ShopIQ palette where available

The selected appearance applies across the whole app.

## Searching, Filters, Pagination, And Tables

Most record modules use searchable, paginated tables.

Tables support:

- Search query
- Status filters where useful
- Type/category/supplier/customer filters where useful
- Date filters where useful
- Server-side pagination
- Details button
- Edit button if role allows
- Delete, archive, cancel, or suspend action if role allows

Details is for reading the full record.

Edit is for changing the record.

Delete-style actions are protected and use confirmation.

## Toasts And Feedback

ShopIQ uses clean toast notifications for important outcomes.

Examples:

- Customer created successfully.
- Invoice created successfully.
- Payment recorded successfully.
- Unable to create invoice.
- Payment cannot exceed the remaining invoice balance.
- Walk-in customers must pay the full invoice amount on spot.

If something fails, read the toast carefully. It usually explains what needs fixing.

## Complete Workflows

### Workflow 1: Add A New Customer For Credit Sales

Use this when the buyer may pay later.

1. Go to Customers.
2. Click Add customer.
3. Enter name.
4. Add phone or WhatsApp.
5. Add area or address.
6. Choose customer type.
7. Set credit limit.
8. Add notes such as "Pays weekly".
9. Save.
10. Use this customer in Billing when making a partial or unpaid invoice.

### Workflow 2: Add A New Product

Use this before selling or purchasing an item.

1. Go to Inventory.
2. Click Add product.
3. Add name, category, unit, cost price, sale price.
4. Add stock quantity.
5. Add low stock level.
6. Add reorder quantity.
7. Add supplier and location if available.
8. Save.

### Workflow 3: Create A Paid Walk-In Invoice

Use this for normal cash counter sale.

1. Go to Billing.
2. Click Create invoice.
3. Keep customer as Walk-in customer.
4. Select product.
5. Enter quantity.
6. Paid amount is automatically treated as full total.
7. Save.
8. ShopIQ creates a paid invoice, automatic payment, stock movement, and activity entry.

### Workflow 4: Create A Partial Customer Invoice

Use this when the buyer is known and will pay later.

1. Go to Billing.
2. Click Create invoice.
3. Select an existing customer or create a new one.
4. Select product.
5. Enter quantity.
6. Enter paid amount less than total.
7. Save.
8. ShopIQ creates a partial invoice.
9. ShopIQ creates an automatic payment for the paid amount.
10. The remaining balance is added to customer balance.

### Workflow 5: Add Later Payment For An Invoice

Use this when a customer comes back and pays due amount.

1. Go to Payments.
2. Click Record payment.
3. Select CUSTOMER_IN.
4. Select payment method.
5. Select the invoice.
6. Confirm the customer auto-fills from the invoice.
7. Check remaining balance.
8. Enter amount.
9. Save.
10. ShopIQ updates payment, invoice paid amount, invoice due amount, invoice status, and customer balance.

### Workflow 6: Receive Stock From Supplier

Use this when you buy stock from market or supplier.

1. Go to Purchases.
2. Click Receive stock.
3. Select supplier or create a supplier.
4. Select product.
5. Enter quantity.
6. Enter unit cost.
7. Enter paid amount.
8. Save.
9. ShopIQ increases stock, creates stock movement, updates supplier payable if due, and logs activity.

### Workflow 7: Generate A PDF Report

1. Go to Reports.
2. Click export/report action.
3. Choose report type if available.
4. Choose date range if available.
5. Generate PDF.
6. Download or view the PDF.
7. Check dashboard activity for the generated report log.

### Workflow 8: Use AI To Create A Record

1. Go to AI Assistant.
2. Ask for the record in plain English.
3. Example: "Create customer: Ali Khan, phone 03001234567, area Gulshan, credit limit 10000."
4. Copilot prepares a preview.
5. Review every field.
6. Click Approve only if it is correct.
7. ShopIQ saves the record and refreshes relevant data.

### Workflow 9: Use AI To Generate A Report

1. Go to AI Assistant.
2. Ask for a report.
3. Example: "Generate an inventory PDF report for this month."
4. Copilot prepares the report using database data.
5. Open or download the PDF from the response.
6. Check Activity feed for the report entry.

## Workflow Loopholes, Safeguards, And Things To Watch

This section lists the important workflow gaps that were considered while improving ShopIQ.

### Safeguards Already Implemented

1. Walk-in customers cannot owe money.
   - A walk-in invoice must be fully paid on spot.
   - If there is a due amount, the user must select or create a customer.

2. Invoice paid amount creates a payment record automatically.
   - If paid amount is greater than zero, ShopIQ creates a linked customer payment.

3. Editing invoice paid amount updates the automatic payment.
   - ShopIQ avoids duplicate automatic payments.

4. Manual invoice payments cannot mismatch customers.
   - When an invoice is selected in Payments, the invoice controls the customer.

5. Payment amount cannot exceed remaining invoice balance.
   - ShopIQ blocks over-collection for invoice-linked payments.

6. Fully paid invoices cannot receive extra manual payments.
   - Overpayment/refund logic is not currently a normal workflow.

7. Automatic invoice payments are protected.
   - Users edit invoice paid amount instead of directly editing the automatic payment row.

8. Invoice details show purchased products.
   - Users do not need to open Edit just to see what a customer bought.

9. Stock cannot go negative during invoice creation.
   - Invoice creation checks available stock before saving.

10. Invoice cancellation reverses stock and open due effects.
   - Cancelled invoices return sold quantity back into stock.

11. Staff cannot access supplier payouts.
   - Staff can record customer receipts only.

12. Reports are generated as PDFs.
   - Report activity is logged with download context where available.

13. AI write actions require approval.
   - Copilot cannot silently create or update records.

### Current Workflow Limits To Be Aware Of

1. Guided Billing is optimized for a focused invoice flow.
   - The current guided billing UI is simple and product-line focused.
   - If a full cart-style invoice is needed for many items at once, the invoice API supports item arrays, but the guided UI may need a future multi-item cart enhancement.

2. Guided Purchase is product-line focused.
   - It is excellent for quick receiving.
   - A future enhancement could add multi-product purchase orders in one modal.

3. Older seeded or historical records may not follow the latest automation perfectly.
   - Records created before invoice-payment automation may not have the same automatic payment marker.
   - New records follow the current rules.

4. Refunds and overpayments are not a full workflow yet.
   - Paid invoice cancellation returns stock and clears due, but business-specific refund handling should be added if the shop needs formal refunds.

5. Supplier overpayment logic is simpler than invoice payment validation.
   - Customer invoice payments have stricter remaining-balance checks.
   - Supplier-side payment controls can be expanded later if needed.

6. Profit reports depend on correct cost prices.
   - If product cost price is wrong, profit/loss numbers will also be wrong.

7. AI depends on Gemini configuration.
   - If Gemini keys or quota fail, the user sees a clean unavailable message.

8. Customer balance should be treated as ledger state.
   - Do not randomly edit opening balance after invoices and payments exist unless you know exactly why.

9. Product stock should be changed through proper workflows.
   - Use purchases, sales, cancellations, or adjustments instead of treating stock as a random number.

10. Deleting important records with linked history should be avoided.
   - Products are archived.
   - Invoices and purchases are cancelled.
   - Staff are suspended.
   - This protects history.

## Practical Examples

### Example 1: Customer Pays Half Now

Sale total: PKR 8,000

Customer pays: PKR 3,000

ShopIQ does this:

- Invoice status becomes PARTIAL.
- Paid amount becomes PKR 3,000.
- Due amount becomes PKR 5,000.
- Automatic customer payment is created for PKR 3,000.
- Customer balance increases by PKR 5,000.

### Example 2: Walk-In Wants Credit

Do not keep it as walk-in.

Create or select a customer first.

Reason: You need a real customer record to track who owes the money.

### Example 3: Product Is Low Stock

Product stock: 4

Reorder level: 10

ShopIQ marks it low stock.

Action: Use Purchases to receive more stock from supplier.

### Example 4: Customer Pays Remaining Balance Later

Invoice due: PKR 5,000

Customer pays: PKR 5,000

Use Payments, select that invoice, enter PKR 5,000, save.

ShopIQ:

- Creates payment.
- Updates invoice to PAID.
- Reduces customer balance.

## FAQ

### What even is a payment? Why do I add it if I already created an invoice?

An invoice is the bill. A payment is the money movement.

If every sale was always paid fully at the same time, this would feel repetitive. But real shops have partial payments, later payments, supplier payouts, JazzCash references, bank transfers, and credit customers. That is why Payment is its own module.

### Why should I add a customer before billing?

You only need to add/select a customer if the buyer needs history, loyalty, delivery, or credit.

If the customer is unknown and paying full cash, use walk-in.

If the customer will pay later, ShopIQ needs a customer record.

### Can a walk-in customer have due balance?

No.

Walk-in means unknown buyer. Unknown buyers must pay on spot.

### Why is the paid amount locked for walk-in billing?

Because walk-in invoices must be fully paid. If payment is not full, select or create a customer.

### Can I edit an invoice?

Admin and manager roles can edit invoices. Staff can create and read invoices, but update and cancel permissions are protected.

### Can I cancel an invoice?

Admin and manager roles can cancel invoices. Cancellation reverses stock and clears open due effects where applicable.

### Why can I not add payment to a fully paid invoice?

Because the invoice has no remaining balance. ShopIQ blocks overpayment unless a separate refund or advance-payment workflow is added later.

### Why is the customer field locked after I select an invoice in Payments?

Because the invoice already belongs to a customer. Allowing another customer would corrupt the ledger.

### What if I selected the wrong customer on an invoice?

If your role allows invoice editing, open the invoice Edit modal and change the customer. ShopIQ recalculates due effects safely.

### Why can I not edit an automatic payment?

Automatic payments are controlled by the invoice paid amount. Edit the invoice paid amount instead.

### What happens if I change invoice paid amount?

ShopIQ updates:

- Invoice paid amount
- Invoice due amount
- Invoice status
- Customer balance
- Linked automatic payment

### What if customer pays in three installments?

Create the invoice with the first paid amount. Then record later installments from Payments by selecting the invoice each time.

### Why is customer balance different from total sales?

Customer balance is only what the customer still owes. Total sales is the invoice total. They are not the same.

### What does remaining balance mean?

Remaining balance means:

`invoice total - invoice paid amount`

### Why does payment amount get rejected?

Common reasons:

- Amount is zero or negative.
- Amount exceeds invoice remaining balance.
- Invoice is already fully paid.
- Customer or supplier is missing.
- Staff tried to create supplier payout.

### Can I make a customer payment without selecting an invoice?

Yes, if you select a customer. But for invoice settlement, selecting the invoice is better because it updates that invoice status and due amount.

### Can I pay a supplier from Payments?

Admin and manager users can. Staff users cannot.

### Why does stock decrease when I create invoice?

Because the product was sold. ShopIQ creates a SALE stock movement and decreases product quantity.

### Why does stock increase when I cancel invoice?

Because cancelling means the sale should no longer count as active. ShopIQ returns the item quantity back into stock using a return movement.

### Why is a product showing low stock even though it is not zero?

Low stock means the product is at or below reorder level, not necessarily zero.

### Do I need SKU and barcode both?

No. SKU is your internal code. Barcode is for scanning or packaged item lookup. Use both if available.

### What if a product has no supplier?

You can still create and sell it. But supplier helps future purchasing and reporting.

### What if I sell a product that is not in Inventory?

Add the product first. Billing depends on inventory records so stock and profit can be tracked.

### Why does profit look wrong in reports?

Profit depends on product cost price and invoice item cost price. If cost prices were entered incorrectly, profit will be incorrect.

### Why are reports PDF instead of just page tables?

PDF reports are easier to share, submit, print, and archive. ShopIQ also logs report generation in activity.

### Can AI generate a report?

Yes. Ask Copilot to generate a report. The final output should be a PDF, with a summary in chat.

### Can AI create a product or customer?

Yes, but only after preview and approval.

### Can AI delete records?

The current assistant is designed around safe, confirmation-gated actions. Destructive actions should remain protected and should not happen silently.

### Can staff use AI to create admin users?

No. Role permissions still apply inside AI tools.

### Why did AI say it is unavailable?

Gemini may be misconfigured, rate limited, out of quota, or temporarily failing. ShopIQ should stop waiting and show a clean error instead of saving a failed user prompt as a normal completed chat.

### Why are old chats saved?

Assistant conversations are stored as chat threads so you can continue previous work and review past decisions.

### Can I delete old AI chats?

Yes. Use the delete option in chat history and confirm deletion.

### Why are some modules missing for staff?

Staff users have a smaller workspace. Supplier management, purchases, reports, and staff access are protected for admin/manager users.

### What is Activity for?

Activity is the shop history. It helps you see important actions like reports, invoices, payments, and cancellations.

### Can I use ShopIQ for a tiny shop?

Yes. ShopIQ supports small general stores, kiryana stores, and larger supermarket-style setups.

### Can I use ShopIQ without suppliers?

You can sell products without suppliers, but purchasing and payable reports become less useful.

### Can I use ShopIQ without customers?

Yes for fully paid walk-in sales. No for credit sales.

### Why does Billing ask for product and quantity?

Because ShopIQ needs to know what was sold so it can decrease stock and show purchased items in invoice details.

### Why is there both Billing and Payments?

Billing creates sales. Payments settle money. They are connected but not the same.

### Why is there both Purchases and Suppliers?

Suppliers are the people or businesses. Purchases are the stock intake records from those suppliers.

### What if I entered wrong stock quantity?

If the product was just created, edit carefully. If stock changed because of business activity, prefer a proper stock adjustment workflow so history stays explainable.

### What if customer returns a product?

The current cancellation flow can reverse invoice stock effects. A more detailed return/refund workflow can be added later if needed.

### Why should I fill product location?

Location helps staff find products faster, especially when the shop grows.

### Why should I fill reorder quantity?

Reorder quantity helps the owner or AI assistant suggest how much to buy again.

### Why should I fill supplier lead time?

Lead time tells how early you need to reorder before stock runs out.

### Why should I fill customer preferred payment?

It helps staff know whether the customer usually pays cash, card, bank, JazzCash, EasyPaisa, cheque, or another method.

### What if the customer pays by two methods?

Use payment notes or payment breakdown where available. If the business needs formal split payments, that can be expanded in the payment workflow.

### What if I want multi-branch stores?

The current workspace is scoped by shop. Multi-branch support can be expanded by adding branch-level controls and branch-specific stock.

## Best Practices

1. Use walk-in only for fully paid quick sales.
2. Create customer records for credit, delivery, loyalty, or monthly accounts.
3. Keep cost price accurate.
4. Keep reorder levels realistic.
5. Record purchases when stock comes in.
6. Record payments when money moves.
7. Use invoice details before editing.
8. Avoid deleting history. Archive, cancel, or suspend where possible.
9. Use reports for review, not guesswork.
10. Use AI for help, but approve write actions carefully.

## Glossary

| Term | Meaning |
| --- | --- |
| SKU | Internal product code |
| Barcode | Scannable product code |
| Cost price | Price the shop paid |
| Sale price | Price customer pays |
| Reorder level | Stock warning point |
| Reorder quantity | Suggested restock amount |
| Receivable | Money customers owe the shop |
| Payable | Money the shop owes suppliers |
| Invoice | Saved sale record |
| Payment | Money movement record |
| Purchase | Stock bought from supplier |
| Stock movement | History of stock changes |
| Walk-in | Unknown customer paying on spot |
| Partial | Some money paid, some still due |
| Activity log | History of important shop actions |
| Copilot | ShopIQ AI assistant |

## Quick Troubleshooting

| Problem | Likely reason | What to do |
| --- | --- | --- |
| Cannot create walk-in unpaid invoice | Walk-in credit is blocked | Select or create customer |
| Payment rejected | Amount exceeds remaining balance | Check invoice due amount |
| Customer is locked in payment form | Invoice controls customer | Clear invoice or use correct invoice |
| Product not visible in billing | Product may be archived or unavailable | Check Inventory |
| Stock is low | Stock quantity is at or below reorder level | Receive stock through Purchases |
| Profit seems wrong | Cost price may be wrong | Check product cost and invoice item history |
| Staff cannot see supplier payouts | Role restriction | Ask admin or manager |
| Report did not generate | Server or PDF error | Try again and check activity/toast |
| AI not responding | Gemini issue, quota, or API key problem | Try later or check server env/logs |
| Old AI chat missing | It may have been deleted | Start new chat |

## Final Mental Model

Use ShopIQ like this:

1. Add products so the shop knows what exists.
2. Add suppliers so purchases and payables make sense.
3. Add customers only when you need history, delivery, loyalty, or credit.
4. Use Billing to create invoices.
5. Let ShopIQ create automatic payments for money received during invoice creation.
6. Use Payments for later installments or supplier payouts.
7. Use Purchases to receive stock.
8. Use Reports to create PDFs.
9. Use Activity to audit what happened.
10. Use Copilot to ask questions, generate reports, and prepare records safely.

If you remember one rule, remember this:

Walk-in is for paid-on-spot sales. Credit belongs to a real customer.

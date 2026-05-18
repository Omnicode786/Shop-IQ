# ShopIQ

<p align="center"><strong>AI-powered inventory and sales operating system for real shops</strong></p>

ShopIQ turns everyday shop operations into an intelligent inventory and sales workspace. It is rebuilt as a Next.js application with the same premium workspace feeling, Liquid Glass UI mode, role-based dashboards, secure auth style, AI assistant behavior, and database-backed workflows inspired by MIZAN/LawSphere — but fully focused on shop operations.

## What this build includes

- Next.js 14 App Router
- Prisma + PostgreSQL schema designed for multi-shop inventory operations
- Secure JWT cookie auth with bcrypt password hashing
- Admin / Staff role workspaces
- Classic UI and Liquid Glass UI mode
- Premium dashboards, cards, tables, charts, sidebars, and topbar
- Large realistic seed data for markets and shops
- Product inventory, customers, suppliers, invoices, purchases, payments, reports, staff, and AI assistant
- Live Gemini AI business agent with role-aware tools, operating jobs, and confirmation-gated database actions
- Recharts-based inventory, category, velocity, and dues charts

## Product modules

| Module | Purpose |
| --- | --- |
| Smart Dashboard | Sales, revenue, stock risk, inventory value, dues, activity and charts |
| Inventory Workspace | Product master, stock levels, reorder thresholds, SKU tracking |
| Billing | Invoice history, payment state, customer linkage and sales totals |
| Customers | Customer ledger, balances, purchase and payment visibility |
| Suppliers | Supplier payables, reliability score and purchase relationship |
| Payments | Customer receipts and supplier payouts |
| Purchases | Supplier purchase and stock intake records |
| Reports | Charts for top movers, slow movers, category value, dues and revenue |
| AI Assistant | Business-aware answers and preview-first database actions |
| Staff | Role-aware team accounts and hashed seed users |

## Architecture

```mermaid
flowchart TB
  User[Admin / Staff] --> UI[Next.js App Router UI]
  UI --> Auth[JWT Cookie Auth]
  UI --> API[Route Handlers]
  API --> Prisma[Prisma ORM]
  Prisma --> DB[(PostgreSQL)]
  API --> AI[AI Provider Layer]
  AI --> Gemini[Gemini API]
  AI --> Tools[ShopIQ role-aware tools]
  Tools --> Prisma
```

## Database design

The Prisma schema contains a normalized business structure:

- `Shop`
- `User`
- `Category`
- `Product`
- `Customer`
- `Supplier`
- `Invoice` and `InvoiceItem`
- `Purchase` and `PurchaseItem`
- `Payment`
- `StockMovement`
- `AssistantThread` and `AssistantMessage`
- `ActivityLog`

Indexes are included for common operational queries such as `shopId`, product SKU/name/category, low-stock scans, invoices by date/status, payments by date/direction, supplier/customer balances, and stock movement history.

## UI modes

ShopIQ includes the MIZAN-style UI mode system:

- **Classic UI**: clean professional SaaS interface
- **Liquid Glass UI**: frosted Apple-inspired glass panels with pointer-aware border glow

The mode is stored in localStorage through the existing theme provider and applied with `document.documentElement.dataset.uiMode`.

## AI behavior

The assistant is business-aware. It receives live shop context such as:

- sales and monthly revenue
- low stock products
- inventory value
- customer dues
- supplier payables
- fast-moving and slow-moving products

It can answer questions like:

- Which products should I reorder?
- Which customers owe me money?
- Summarize today's business.
- Which items are slow moving?
- What should I focus on this week?

### Agentic workflow

ShopIQ includes safe agent actions:

1. User asks AI to analyze data or prepare an action.
2. Gemini calls ShopIQ tools for live role-filtered data.
3. User confirms with “yes / add it / proceed”.
4. The server executes the action in PostgreSQL.
5. Activity log is written.

No mock fallback or destructive delete tools are implemented.

## Environment variables

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shopiq_next?schema=public"
JWT_SECRET="replace-this-with-a-long-random-secret"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"
```

## Quick start

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

## Demo accounts

After seeding:

| Role | Email | Password |
| --- | --- | --- |
| Admin / Owner | owner@shopiq.dev | demo12345 |
| Staff | staff@shopiq.dev | demo12345 |
| Manager | manager@shopiq.dev | demo12345 |

## Seed data scale

The seed creates realistic operational data:

- 1 large shop workspace
- admin + staff users
- 10 categories
- 96 products/SKUs
- 70 customers
- 20 suppliers
- 420 invoices
- 170 purchases
- payments, balances and stock movements
- 60 activity logs
- AI assistant thread history

## Route map

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/login` | Login |
| `/signup` | Signup |
| `/admin/dashboard` | Owner command center |
| `/admin/products` | Inventory workspace |
| `/admin/billing` | Invoice workspace |
| `/admin/customers` | Customer ledger |
| `/admin/suppliers` | Supplier cockpit |
| `/admin/payments` | Cashflow timeline |
| `/admin/purchases` | Supplier purchase records |
| `/admin/reports` | Charts and reports |
| `/admin/assistant` | AI business copilot |
| `/admin/staff` | Team accounts |
| `/staff/dashboard` | Staff dashboard |
| `/staff/billing` | Staff billing view |
| `/staff/products` | Staff inventory view |
| `/staff/customers` | Staff customer view |
| `/staff/payments` | Staff payments view |
| `/staff/assistant` | Staff AI copilot |

## Manual verification checklist

- Login as `owner@shopiq.dev`
- Open dashboard and verify charts load
- Open Inventory and add a product
- Ask the AI to add a product and confirm it
- Check customer/supplier ledgers
- Review billing, payments, purchases and reports
- Toggle light/dark mode
- Toggle Classic/Liquid Glass mode
- Login as staff and verify staff workspace access

## Notes

This is a rebuilt Next.js ShopIQ app inspired by MIZAN’s UI and workflow quality. It keeps the product domain completely focused on inventory, billing, suppliers, customers, stock, payments, reporting and AI-powered business decisions.

## Theme Studio: Original + TweakCN-style presets

ShopIQ now includes a stronger shadcn/tweakcn-style theme system instead of a simple global color swap.

The topbar Theme Studio controls two layers:

| Layer | Options | What changes |
| --- | --- | --- |
| UI Mode | Classic / Liquid | Overall surface behavior, glass treatment, shadows, and pointer glow |
| shadcn Theme Preset | Original, Claude, Supabase, Claymorphism, Brutalist | Semantic shadcn tokens, radius, surface style, button/input personality, cards, navbar/sidebar, and dark/light background language |

The implementation follows the shadcn/ui theming approach of semantic CSS variables such as `--background`, `--foreground`, `--primary`, `--card`, `--border`, and `--radius`, then layers additional component-level styling so every preset feels visibly different in the actual product UI.

Storage keys:

| Key | Purpose |
| --- | --- |
| `shopiq-theme` | light / dark / system |
| `shopiq-ui-mode` | classic / glass |
| `shopiq-shadcn-theme` | selected shadcn/tweakcn preset |

Applied document attributes:

```txt
<html data-ui-mode="glass" data-shadcn-theme="tweakcn-supabase">
```

## AI Agent Workflow Fix

The ShopIQ AI Copilot now uses a safer preview-first workflow for database actions.

Supported preview-first actions:

- create product
- create customer
- create supplier

Flow:

1. User asks the assistant to create/add a record.
2. The assistant extracts structured fields.
3. The assistant shows a preview card and asks for confirmation.
4. User replies `Yes, add it`.
5. The app creates the record in PostgreSQL.
6. The app writes an activity log.
7. The assistant returns a completion card with a workspace link.

Safety rules:

- no delete tools
- no destructive actions
- suppliers/products require admin permissions
- customers can be created by authorized users
- confirmation messages only apply to the latest pending action in the same AI thread
- cancelled previews are marked cancelled and cannot be accidentally executed later

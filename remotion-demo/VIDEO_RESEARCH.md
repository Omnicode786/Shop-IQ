# ShopIQ Video Research

## Product Found

Product name: **ShopIQ**

Project type: Next.js SaaS-style retail operating system for shops.

Positioning found in the repository: **AI-powered inventory and sales operating system for real shops.**

The project is not a generic dashboard. It is a shop management system centered on:

- Dashboard overview and quick actions
- Products and inventory
- Categories
- Customers and customer dues
- Suppliers and purchases
- Invoices and billing
- Payments
- Reports and PDF exports
- Activity history
- Role-based access
- ShopIQ Copilot / Gemini AI assistant
- Settings, theme modes, and shop configuration

## Real Audience / Context

The app copy, routes, and user guide show that ShopIQ is for real shop operations, especially small to medium retail stores that need stock, billing, payments, customer dues, supplier purchases, reports, and AI assistance in one system.

The video keeps the audience copy neutral and product-specific:

- Owners who need the whole shop in view
- Staff/cash counter users who need fast billing
- Managers who need stock, dues, reports, and protected workflows

## Real Routes and Modules Identified

- `/`
- `/login`
- `/signup`
- `/admin/dashboard`
- `/admin/products`
- `/admin/billing`
- `/admin/customers`
- `/admin/suppliers`
- `/admin/payments`
- `/admin/purchases`
- `/admin/reports`
- `/admin/assistant`
- `/admin/staff`
- `/admin/settings`
- Staff workspace routes for dashboard, billing, products, customers, payments, assistant, and settings

## Design Language Observed

ShopIQ uses a modern dark/liquid-glass style by default:

- Fixed sidebar and topbar
- Rounded glass panels
- Orange ShopIQ brand accent
- Blue, violet, green, amber, and rose chart/card accents
- Premium metric cards
- Clean tables and filters
- Role-aware module copy
- Theme support for light, dark, classic, liquid glass, and TweakCN presets

The video uses the real captured app screens and mirrors this language: dark glass as the main visual world, with a clear light-mode comparison section.

## Screenshots Captured

Captured from the real running app using Playwright and the owner/admin account:

- `public/screenshots/landing.png`
- `public/screenshots/dashboard.png`
- `public/screenshots/products.png`
- `public/screenshots/billing.png`
- `public/screenshots/customers.png`
- `public/screenshots/suppliers.png`
- `public/screenshots/payments.png`
- `public/screenshots/purchases.png`
- `public/screenshots/reports.png`
- `public/screenshots/assistant.png`
- `public/screenshots/settings.png`

Light/classic captures were also created:

- `public/screenshots-light/dashboard.png`
- `public/screenshots-light/products.png`
- `public/screenshots-light/billing.png`
- `public/screenshots-light/customers.png`
- `public/screenshots-light/suppliers.png`
- `public/screenshots-light/payments.png`
- `public/screenshots-light/purchases.png`
- `public/screenshots-light/reports.png`
- `public/screenshots-light/assistant.png`
- `public/screenshots-light/settings.png`

## Important Implementation Note

During screenshot capture, the product route exposed a real Next.js boundary issue: the server page was passing a function field condition into a client component. This was fixed by using a serializable `showWhen` field condition while keeping the form behavior the same.

## What The Video Will Show

The video will show only real ShopIQ capabilities:

- Dashboard command center
- Quick actions
- Inventory/product workspace
- Billing/invoice workflow
- Payment and purchase connection
- Business PDF reports
- ShopIQ Copilot / Gemini assistant
- Role-aware protection
- Light and dark mode support
- Connected workflow from product to invoice to payment to reports

## What The Video Will Not Claim

- No fake customers or testimonials
- No fake partner logos
- No unsupported integrations
- No invented industries
- No fake performance claims
- No fabricated analytics beyond what is visible in the captured app or used as abstract illustration


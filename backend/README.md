# Shop Manager — Full Shop Management System (v3)

A real, multi-feature shop management web app: point-of-sale, inventory,
suppliers & purchase orders, customer CRM with loyalty points, returns/
refunds, role-based access with account management, shop settings, an
activity audit trail, and a dashboard with charts.

## Features

- **Auth** — register/login with JWT; the first account created on a fresh
  install automatically becomes `admin`, every account after that is
  `staff`. Accounts can be deactivated (blocks login) without deleting them.
- **User management (admin)** — view every account, change roles, activate/
  deactivate, or delete users (can't touch your own account by accident).
- **Shop Settings (admin)** — shop name, address, phone, currency symbol,
  default tax rate and a receipt footer note. These flow into the sidebar
  branding, the POS's default tax rate, and printed invoices automatically.
- **Products** — categories, suppliers, SKU, barcode, cost vs. sale price,
  stock levels, low-stock threshold, product images, search + pagination,
  CSV export, and **bulk import from CSV/Excel** (auto-creates missing
  categories/suppliers, updates existing products by matching SKU or
  barcode, reports per-row errors).
- **Categories & Suppliers** — simple management screens (admin-only edits).
- **Customers (CRM)** — contact info, loyalty points (earned automatically
  on checkout), full purchase history per customer, CSV export.
- **Point of Sale (POS)** — cart-based checkout: scan a barcode (works with
  any USB/Bluetooth scanner that types + sends Enter, like a keyboard) or
  search products manually, add to cart, pick a customer (or walk-in),
  apply a flat discount and/or tax %, choose a payment method, complete
  the sale. Stock is decremented and an invoice is generated inside one
  atomic database transaction.
- **Sales history** — filterable by date, per-invoice line-item breakdown,
  CSV export, and a printable invoice/receipt view.
- **Returns / Refunds** — full or partial refund per sale, per line item.
  Restocks products automatically, tracks refunded amounts against the
  original sale, and won't let you refund more than was actually sold.
- **Purchase Orders** — create a PO against a supplier with line items;
  receiving a PO (admin) atomically adds stock and updates each product's
  cost price. Cancel pending POs.
- **Dashboard** — today/this-month revenue, low-stock count, a 7-day
  revenue chart, top-selling products, recent sales, and a live recent-
  activity feed.
- **Reports** — revenue/sales totals for a date range, payment-method
  breakdown chart, low-stock list.
- **Notifications** — a bell in the topbar surfaces low-stock alerts on
  every page, not just the dashboard.
- **Roles** — `admin` can delete records, manage suppliers/categories/
  purchase-order receiving, manage users and settings; `staff` runs the
  POS and manages products/customers, with destructive actions hidden.
- **Activity log** — logins, registrations, sales, refunds, purchase
  orders, product changes, and settings edits are all recorded and shown
  on the dashboard.
- **Stock audit trail** — every stock change (sale, purchase receipt,
  return) is logged in `stock_movements`.

## Project structure

```
backend/
  config/db.js             PostgreSQL/Neon connection pool + compatibility adapter
  middleware/                auth (JWT + roles), error handling, image upload
  controllers/                one per resource
  routes/                     one per resource, wired to controllers + middleware
  utils/generateCode.js     invoice/PO number generator
  utils/logActivity.js      writes to the activity_log table
  uploads/products/         uploaded product images (served at /uploads/...)
  schema.sql                 full DB schema — run this first
  run-schema.js              applies schema.sql directly to Neon via DATABASE_URL
  index.js                   app entrypoint
frontend/
  assets/js/api.js          every backend call, in one place
  assets/js/layout.js       shared sidebar/topbar + notification bell
  assets/css/style.css      shared design system (colors, type, components)
  login.html / register.html
  dashboard.html, products.html, categories.html, suppliers.html,
  customers.html, pos.html, sales-history.html, purchase-orders.html,
  reports.html, settings.html, users.html, invoice.html (printable)
```

## How to run it with Neon PostgreSQL

1. Create a Neon project and copy its **pooled** PostgreSQL connection string.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` plus a strong
   `JWT_SECRET`. Keep `.env` private; it is already ignored by Git.
3. Install dependencies and apply the schema:

```bash
cd backend
npm install
npm run db:schema
```

`schema.sql` is PostgreSQL/Neon compatible and does **not** drop your database.
It creates missing tables/types/indexes and inserts only the starter settings and
categories that do not already exist.

Then start the API:

```bash
npm start
```

The API runs on `http://localhost:5000`. Open `frontend/login.html` in a
browser (or serve the `frontend` folder with a static server such as
`npx serve frontend`). On a fresh Neon database, the first registered account
becomes `admin`; later accounts become `staff`.

For Vercel, add the same pooled Neon connection string as the `DATABASE_URL`
environment variable in the backend project. Do not put the real connection
string in GitHub.

## Notes on scaling this further

- Swap `frontend/assets/js/api.js`'s hardcoded `API_URL` for an environment
  variable if you deploy the frontend and backend on different hosts.
- `reports.html` summarizes client-side over the fetched page of sales —
  fine for a small/medium shop; for a large sales volume, add a dedicated
  aggregate SQL endpoint instead.
- The invoice/PO number generator (`utils/generateCode.js`) is good enough
  for a small team; for strict uniqueness under high concurrency, back it
  with a DB sequence/table instead of `Date.now() + random`.
- `activity_log` and `stock_movements` grow forever — add a periodic
  cleanup/archive job if you run this for a long time.

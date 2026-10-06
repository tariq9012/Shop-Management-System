# Neon PostgreSQL Setup

The backend has been migrated from MySQL (`mysql2`) to Neon PostgreSQL (`pg`).

## 1. Create the Neon database

Create a Neon project, open **Connection Details**, select the **Pooled**
connection, and copy the PostgreSQL connection string. It normally contains a
`-pooler` hostname and `sslmode=require`.

## 2. Configure local environment

Create `backend/.env` from `.env.example` and replace the placeholder:

```env
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-NEON-POOLER-HOST/DATABASE?sslmode=require
DB_POOL_MAX=10
JWT_SECRET=use_a_long_random_secret_here
JWT_EXPIRES_IN=8h
PORT=5000
```

Never commit `.env`.

## 3. Create the tables

From the `backend` folder:

```bash
npm install
npm run db:schema
```

You should see:

```text
Connecting to Neon PostgreSQL...
✅ schema.sql applied successfully to Neon PostgreSQL.
```

## 4. Run locally

```bash
npm start
```

Then register the first user. On an empty database, that first account is
automatically assigned the `admin` role.

## 5. Vercel backend environment variables

Add these in the Vercel backend project:

- `DATABASE_URL` — the same Neon pooled connection string
- `DB_POOL_MAX` — optional; `10` is the current default
- `JWT_SECRET` — a long random production secret
- `JWT_EXPIRES_IN` — for example `8h`

Do not add the old `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `DB_NAME`; they are
no longer used.

## Important: existing MySQL data

This migration changes the application code and schema to PostgreSQL. It does
not automatically copy rows from an old local MySQL database into Neon. If you
need the old products, customers, sales, or users, export/import them separately
before retiring the MySQL database.

## Important: product images

Neon stores database data only. Product images are still written to
`backend/uploads/products` for local development. Before relying on Vercel in
production, move dynamic uploads to persistent object storage such as
Cloudflare R2.

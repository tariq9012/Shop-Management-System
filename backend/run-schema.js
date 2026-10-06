// One-off helper: applies the PostgreSQL/Neon schema using DATABASE_URL.
// Run from backend/ with:
//   node run-schema.js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing. Copy your Neon connection string into backend/.env first.');
    process.exitCode = 1;
    return;
  }

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Connecting to Neon PostgreSQL...');
    await client.connect();
    await client.query(sql);
    console.log('✅ schema.sql applied successfully to Neon PostgreSQL.');
  } catch (err) {
    console.error('❌ Failed to apply schema.sql:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

run();

// One-off helper: applies schema.sql without needing the `mysql` CLI tool.
// Uses the same credentials as the app (backend/.env). Run with:
//   node run-schema.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // Connect WITHOUT selecting a database yet, since schema.sql itself
  // drops/creates the `shop` database.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    console.log('Connecting as', process.env.DB_USER, '@', process.env.DB_HOST, '...');
    await connection.query(sql);
    console.log('✅ schema.sql applied successfully — the `shop` database is now up to date.');
  } catch (err) {
    console.error('❌ Failed to apply schema.sql:', err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

run();

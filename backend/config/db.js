// config/db.js
// PostgreSQL / Neon connection layer.
//
// The controllers in this project were originally written against mysql2's
// promise API. This small adapter keeps the same response shape (`[rows]`,
// `insertId`, `affectedRows`, transactions) while executing real PostgreSQL
// queries underneath. That lets the app move to Neon without a risky rewrite
// of every controller.
const { Pool, types } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// pg returns BIGINT / NUMERIC values as strings by default. This app deals with
// shop-scale IDs and currency amounts, so returning JavaScript numbers keeps the
// existing frontend/API behaviour consistent with the old MySQL driver.
types.setTypeParser(20, value => Number(value));   // int8 / COUNT(*)
types.setTypeParser(1700, value => Number(value)); // numeric / decimal

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Add your Neon PostgreSQL connection string to backend/.env.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', err => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

function toPostgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function prepareSql(sql) {
  let converted = toPostgresPlaceholders(sql);

  // Runtime INSERTs in this project expect mysql2's result.insertId. PostgreSQL
  // only returns generated IDs when RETURNING is requested, so add it centrally.
  if (/^\s*INSERT\s+INTO\b/i.test(converted) && !/\bRETURNING\b/i.test(converted)) {
    converted = `${converted.trim().replace(/;$/, '')} RETURNING id`;
  }

  return converted;
}

async function execute(executor, sql, params = []) {
  const result = await executor.query(prepareSql(sql), params);
  const meta = {
    insertId: result.rows?.[0]?.id ?? null,
    affectedRows: result.rowCount ?? 0
  };

  // Preserve the mysql2 promise API shape used throughout the controllers:
  // SELECT => [rows, fields], writes => [resultMeta, fields]
  if (/^\s*(SELECT|WITH|SHOW)\b/i.test(sql)) {
    return [result.rows, result.fields];
  }
  return [meta, result.fields];
}

const db = {
  query(sql, params = []) {
    return execute(pool, sql, params);
  },

  async getConnection() {
    const client = await pool.connect();
    return {
      query(sql, params = []) {
        return execute(client, sql, params);
      },
      beginTransaction() {
        return client.query('BEGIN');
      },
      commit() {
        return client.query('COMMIT');
      },
      rollback() {
        return client.query('ROLLBACK');
      },
      release() {
        client.release();
      }
    };
  },

  async ping() {
    await pool.query('SELECT 1');
    return true;
  },

  async end() {
    await pool.end();
  }
};

module.exports = db;

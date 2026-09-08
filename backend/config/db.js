// config/db.js
const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// Connection pool (better than a single connection for a real web app —
// handles concurrent requests instead of queueing on one socket)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verify we can actually reach the DB at boot, without holding a connection open
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('MySQL connected (pool ready)');
    connection.release();
  }
});

// Promise-based API so controllers can use async/await instead of callback pyramids
const db = pool.promise();

module.exports = db;

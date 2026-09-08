const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/customers?search=&page=&limit=
const getCustomers = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
  const lim = Math.min(100, Math.max(1, parseInt(limit)));

  const where = search ? 'WHERE name LIKE ? OR contact LIKE ? OR email LIKE ?' : '';
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  const [rows] = await db.query(
    `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, lim, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM customers ${where}`, params);

  res.json({ data: rows, total, page: parseInt(page), limit: lim, pages: Math.ceil(total / lim) });
});

// GET /api/customers/:id/history — purchase history + loyalty points
const getCustomerHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [sales] = await db.query(
    `SELECT id, invoice_no, total, payment_method, created_at
     FROM sales WHERE customer_id = ? ORDER BY created_at DESC`,
    [id]
  );
  const [[customer]] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
  res.json({ customer, sales });
});

const addCustomer = asyncHandler(async (req, res) => {
  const { name, contact, email, address } = req.body;
  if (!name) return res.status(400).json({ msg: 'Customer name is required' });
  const [result] = await db.query(
    'INSERT INTO customers (name, contact, email, address) VALUES (?, ?, ?, ?)',
    [name, contact || null, email || null, address || null]
  );
  res.status(201).json({ id: result.insertId, msg: 'Customer added' });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, contact, email, address } = req.body;
  await db.query(
    'UPDATE customers SET name=?, contact=?, email=?, address=? WHERE id=?',
    [name, contact || null, email || null, address || null, id]
  );
  res.json({ msg: 'Customer updated' });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
  res.json({ msg: 'Customer deleted' });
});

module.exports = { getCustomers, getCustomerHistory, addCustomer, updateCustomer, deleteCustomer };

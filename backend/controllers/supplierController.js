const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const getSuppliers = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM suppliers ORDER BY name');
  res.json(rows);
});

const addSupplier = asyncHandler(async (req, res) => {
  const { name, contact, email, address } = req.body;
  if (!name) return res.status(400).json({ msg: 'Supplier name is required' });
  const [result] = await db.query(
    'INSERT INTO suppliers (name, contact, email, address) VALUES (?, ?, ?, ?)',
    [name, contact || null, email || null, address || null]
  );
  res.status(201).json({ id: result.insertId, msg: 'Supplier added' });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, contact, email, address } = req.body;
  await db.query(
    'UPDATE suppliers SET name=?, contact=?, email=?, address=? WHERE id=?',
    [name, contact || null, email || null, address || null, id]
  );
  res.json({ msg: 'Supplier updated' });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM suppliers WHERE id = ?', [id]);
  res.json({ msg: 'Supplier deleted' });
});

module.exports = { getSuppliers, addSupplier, updateSupplier, deleteSupplier };

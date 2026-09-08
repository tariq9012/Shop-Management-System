const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const getCategories = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
  res.json(rows);
});

const addCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ msg: 'Category name is required' });
  const [result] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
  res.status(201).json({ id: result.insertId, name });
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ msg: 'Category name is required' });
  await db.query('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
  res.json({ msg: 'Category updated' });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM categories WHERE id = ?', [id]);
  res.json({ msg: 'Category deleted' });
});

module.exports = { getCategories, addCategory, updateCategory, deleteCategory };

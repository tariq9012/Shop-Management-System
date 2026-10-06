const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const logActivity = require('../utils/logActivity');
const XLSX = require('xlsx');

// GET /api/products?search=&category=&page=1&limit=20
const getProducts = asyncHandler(async (req, res) => {
  const { search = '', category = '', page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
  const lim = Math.min(100, Math.max(1, parseInt(limit)));

  const where = [];
  const params = [];

  if (search) {
    where.push('(p.name ILIKE ? OR p.sku ILIKE ? OR p.barcode ILIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push('p.category_id = ?');
    params.push(category);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
    params
  );

  res.json({ data: rows, total, page: parseInt(page), limit: lim, pages: Math.ceil(total / lim) });
});

// GET /api/products/low-stock
const getLowStock = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM products WHERE stock <= low_stock_threshold ORDER BY stock ASC'
  );
  res.json(rows);
});

// GET /api/products/barcode/:code — exact match lookup for barcode scanners
const getProductByBarcode = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.barcode = ? OR p.sku = ?
     LIMIT 1`,
    [req.params.code, req.params.code]
  );
  if (rows.length === 0) return res.status(404).json({ msg: `No product matches "${req.params.code}"` });
  res.json(rows[0]);
});

// GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ msg: 'Product not found' });
  res.json(rows[0]);
});

// POST /api/products (multipart/form-data if an image is attached)
const addProduct = asyncHandler(async (req, res) => {
  const { name, sku, barcode, category_id, supplier_id, price, cost_price, stock, low_stock_threshold } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ msg: 'Name and price are required' });
  }
  const image = req.file ? `/uploads/products/${req.file.filename}` : null;

  const [result] = await db.query(
    `INSERT INTO products (name, sku, barcode, category_id, supplier_id, price, cost_price, stock, low_stock_threshold, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      sku || null,
      barcode || null,
      category_id || null,
      supplier_id || null,
      price,
      cost_price || 0,
      stock || 0,
      low_stock_threshold || 5,
      image
    ]
  );
  await logActivity(req.user.id, 'product_added', name);
  res.status(201).json({ id: result.insertId, msg: 'Product added' });
});

// PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, sku, barcode, category_id, supplier_id, price, cost_price, stock, low_stock_threshold } = req.body;

  const fields = [
    'name=?', 'sku=?', 'barcode=?', 'category_id=?', 'supplier_id=?',
    'price=?', 'cost_price=?', 'stock=?', 'low_stock_threshold=?'
  ];
  const values = [
    name, sku || null, barcode || null, category_id || null, supplier_id || null,
    price, cost_price || 0, stock || 0, low_stock_threshold || 5
  ];

  if (req.file) {
    fields.push('image=?');
    values.push(`/uploads/products/${req.file.filename}`);
  }
  values.push(id);

  await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id=?`, values);
  res.json({ msg: 'Product updated' });
});

// DELETE /api/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const [[product]] = await db.query('SELECT name FROM products WHERE id = ?', [req.params.id]);
  await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  await logActivity(req.user.id, 'product_deleted', product ? product.name : `#${req.params.id}`);
  res.json({ msg: 'Product deleted' });
});

// POST /api/products/import — bulk create/update products from a CSV or Excel file
// Expected columns (case-insensitive, any order): name, sku, barcode, category,
// supplier, price, cost_price, stock, low_stock_threshold.
// Rows with a sku or barcode that already exists update that product;
// everything else is treated as a new product.
const bulkImportProducts = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'Upload a .csv or .xlsx file under the "file" field' });
  }

  let rows;
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (err) {
    return res.status(400).json({ msg: 'Could not read that file — is it a valid CSV or Excel file?' });
  }

  if (rows.length === 0) {
    return res.status(400).json({ msg: 'That file has no rows to import' });
  }

  // Normalize header keys (case/spacing-insensitive) once per row
  const normalizeRow = raw => {
    const out = {};
    for (const key of Object.keys(raw)) {
      out[key.trim().toLowerCase().replace(/\s+/g, '_')] = String(raw[key]).trim();
    }
    return out;
  };

  const categoryCache = new Map();
  const supplierCache = new Map();

  async function resolveCategoryId(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    if (categoryCache.has(key)) return categoryCache.get(key);
    const [existing] = await db.query('SELECT id FROM categories WHERE LOWER(name) = ?', [key]);
    if (existing.length) { categoryCache.set(key, existing[0].id); return existing[0].id; }
    const [inserted] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
    categoryCache.set(key, inserted.insertId);
    return inserted.insertId;
  }

  async function resolveSupplierId(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    if (supplierCache.has(key)) return supplierCache.get(key);
    const [existing] = await db.query('SELECT id FROM suppliers WHERE LOWER(name) = ?', [key]);
    if (existing.length) { supplierCache.set(key, existing[0].id); return existing[0].id; }
    const [inserted] = await db.query('INSERT INTO suppliers (name) VALUES (?)', [name]);
    supplierCache.set(key, inserted.insertId);
    return inserted.insertId;
  }

  let created = 0, updated = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // account for the header row so numbers match the spreadsheet
    const row = normalizeRow(rows[i]);

    try {
      const name = row.name;
      const price = parseFloat(row.price);
      if (!name) throw new Error('missing "name"');
      if (isNaN(price)) throw new Error('missing or invalid "price"');

      const sku = row.sku || null;
      const barcode = row.barcode || null;
      const category_id = await resolveCategoryId(row.category);
      const supplier_id = await resolveSupplierId(row.supplier);
      const cost_price = parseFloat(row.cost_price) || 0;
      const stock = parseInt(row.stock) || 0;
      const low_stock_threshold = parseInt(row.low_stock_threshold) || 5;

      let existingId = null;
      if (sku) {
        const [match] = await db.query('SELECT id FROM products WHERE sku = ?', [sku]);
        if (match.length) existingId = match[0].id;
      }
      if (!existingId && barcode) {
        const [match] = await db.query('SELECT id FROM products WHERE barcode = ?', [barcode]);
        if (match.length) existingId = match[0].id;
      }

      if (existingId) {
        await db.query(
          `UPDATE products SET name=?, sku=?, barcode=?, category_id=?, supplier_id=?, price=?, cost_price=?, stock=?, low_stock_threshold=?
           WHERE id=?`,
          [name, sku, barcode, category_id, supplier_id, price, cost_price, stock, low_stock_threshold, existingId]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO products (name, sku, barcode, category_id, supplier_id, price, cost_price, stock, low_stock_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, sku, barcode, category_id, supplier_id, price, cost_price, stock, low_stock_threshold]
        );
        created++;
      }
    } catch (err) {
      errors.push({ row: rowNum, message: err.code === '23505' ? 'duplicate SKU or barcode' : err.message });
    }
  }

  await logActivity(req.user.id, 'products_imported', `${created} created, ${updated} updated, ${errors.length} failed`);
  res.json({ msg: 'Import complete', created, updated, errors });
});

module.exports = {
  getProducts, getProduct, getProductByBarcode, getLowStock,
  addProduct, updateProduct, deleteProduct, bulkImportProducts
};

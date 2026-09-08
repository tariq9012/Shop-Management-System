const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const generateCode = require('../utils/generateCode');
const logActivity = require('../utils/logActivity');

// GET /api/purchase-orders
const getPurchaseOrders = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT po.*, s.name AS supplier_name, u.username AS created_by
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     LEFT JOIN users u ON po.user_id = u.id
     ORDER BY po.created_at DESC`
  );
  res.json(rows);
});

// GET /api/purchase-orders/:id
const getPurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[po]] = await db.query(
    `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = ?`,
    [id]
  );
  if (!po) return res.status(404).json({ msg: 'Purchase order not found' });
  const [items] = await db.query(
    `SELECT poi.*, p.name AS product_name FROM purchase_order_items poi
     JOIN products p ON poi.product_id = p.id WHERE poi.purchase_order_id = ?`,
    [id]
  );
  res.json({ ...po, items });
});

// POST /api/purchase-orders — create a pending order (does NOT touch stock yet)
// body: { supplier_id, items: [{ product_id, quantity, cost_price }] }
const addPurchaseOrder = asyncHandler(async (req, res) => {
  const { supplier_id, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ msg: 'At least one item is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const total = items.reduce((sum, i) => sum + Number(i.cost_price) * Number(i.quantity), 0);
    const po_no = generateCode('PO');

    const [result] = await conn.query(
      `INSERT INTO purchase_orders (po_no, supplier_id, user_id, status, total) VALUES (?, ?, ?, 'pending', ?)`,
      [po_no, supplier_id || null, req.user.id, total]
    );
    const poId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, cost_price)
         VALUES (?, ?, ?, ?)`,
        [poId, item.product_id, item.quantity, item.cost_price]
      );
    }

    await conn.commit();
    await logActivity(req.user.id, 'po_created', `${po_no} — ${items.length} item(s)`);
    res.status(201).json({ id: poId, po_no, msg: 'Purchase order created' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// PUT /api/purchase-orders/:id/receive — marks received, adds stock, updates cost price
const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[po]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [id]);
    if (!po) throw Object.assign(new Error('Purchase order not found'), { status: 404 });
    if (po.status !== 'pending') {
      throw Object.assign(new Error(`Purchase order is already ${po.status}`), { status: 400 });
    }

    const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [id]);

    for (const item of items) {
      await conn.query(
        'UPDATE products SET stock = stock + ?, cost_price = ? WHERE id = ?',
        [item.quantity, item.cost_price, item.product_id]
      );
      await conn.query(
        `INSERT INTO stock_movements (product_id, type, quantity_change, reference)
         VALUES (?, 'purchase', ?, ?)`,
        [item.product_id, item.quantity, po.po_no]
      );
    }

    await conn.query(
      `UPDATE purchase_orders SET status = 'received', received_at = NOW() WHERE id = ?`,
      [id]
    );

    await conn.commit();
    await logActivity(req.user.id, 'po_received', `${po.po_no} received — stock updated`);
    res.json({ msg: 'Purchase order received — stock updated' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[po]] = await db.query('SELECT status FROM purchase_orders WHERE id = ?', [id]);
  if (!po) return res.status(404).json({ msg: 'Purchase order not found' });
  if (po.status !== 'pending') {
    return res.status(400).json({ msg: `Cannot cancel a ${po.status} order` });
  }
  await db.query(`UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?`, [id]);
  res.json({ msg: 'Purchase order cancelled' });
});

module.exports = {
  getPurchaseOrders,
  getPurchaseOrder,
  addPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder
};

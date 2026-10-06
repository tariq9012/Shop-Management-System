const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const generateCode = require('../utils/generateCode');
const logActivity = require('../utils/logActivity');

// GET /api/sales?from=&to=&page=&limit=
const getSales = asyncHandler(async (req, res) => {
  const { from, to, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
  const lim = Math.min(100, Math.max(1, parseInt(limit)));

  const where = [];
  const params = [];
  if (from) { where.push('s.created_at >= ?'); params.push(from); }
  if (to) { where.push('s.created_at <= ?'); params.push(to); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT s.id, s.invoice_no, s.subtotal, s.discount, s.tax, s.total, s.refunded_total, s.payment_method, s.created_at,
            c.name AS customer, u.username AS cashier
     FROM sales s
     LEFT JOIN customers c ON s.customer_id = c.id
     LEFT JOIN users u ON s.user_id = u.id
     ${whereSql}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM sales s ${whereSql}`, params);

  res.json({ data: rows, total, page: parseInt(page), limit: lim, pages: Math.ceil(total / lim) });
});

// GET /api/sales/:id — full invoice with line items
const getSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[sale]] = await db.query(
    `SELECT s.*, c.name AS customer, u.username AS cashier
     FROM sales s
     LEFT JOIN customers c ON s.customer_id = c.id
     LEFT JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`,
    [id]
  );
  if (!sale) return res.status(404).json({ msg: 'Sale not found' });

  const [items] = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
  const [refunds] = await db.query(
    `SELECT r.id, r.reason, r.total, r.created_at, u.username AS refunded_by
     FROM refunds r LEFT JOIN users u ON r.user_id = u.id
     WHERE r.sale_id = ? ORDER BY r.created_at DESC`,
    [id]
  );
  res.json({ ...sale, items, refunds });
});

// POST /api/sales/:id/refund — full or partial return
// body: { reason?, items?: [{ sale_item_id, quantity }] } — omit items for a full refund
const refundSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason = '', items } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[sale]] = await conn.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [id]);
    if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });

    const [saleItems] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

    // Figure out how much of each line item has already been refunded, so we
    // never let someone refund more than was actually sold.
    const [alreadyRefunded] = await conn.query(
      `SELECT sale_item_id, COALESCE(SUM(quantity),0) AS qty
       FROM refund_items WHERE sale_item_id = ANY(?::int[]) GROUP BY sale_item_id`,
      [saleItems.map(si => si.id).length ? saleItems.map(si => si.id) : [0]]
    );
    const refundedMap = Object.fromEntries(alreadyRefunded.map(r => [r.sale_item_id, r.qty]));

    // Default to a full refund of everything not yet refunded
    const toRefund = (items && items.length ? items : saleItems.map(si => ({ sale_item_id: si.id, quantity: si.quantity })))
      .map(reqItem => {
        const saleItem = saleItems.find(si => si.id === reqItem.sale_item_id);
        if (!saleItem) throw Object.assign(new Error('Invalid sale item'), { status: 400 });
        const alreadyQty = refundedMap[saleItem.id] || 0;
        const remaining = saleItem.quantity - alreadyQty;
        const quantity = Math.min(reqItem.quantity, remaining);
        if (quantity <= 0) throw Object.assign(new Error(`${saleItem.product_name} has already been fully refunded`), { status: 400 });
        return { saleItem, quantity };
      });

    let refundTotal = 0;
    const [refundResult] = await conn.query(
      'INSERT INTO refunds (sale_id, user_id, reason, total) VALUES (?, ?, ?, 0)',
      [id, req.user.id, reason]
    );
    const refundId = refundResult.insertId;

    for (const { saleItem, quantity } of toRefund) {
      const lineRefund = Number(saleItem.price) * quantity;
      refundTotal += lineRefund;

      await conn.query(
        'INSERT INTO refund_items (refund_id, sale_item_id, product_id, quantity, subtotal) VALUES (?, ?, ?, ?, ?)',
        [refundId, saleItem.id, saleItem.product_id, quantity, lineRefund]
      );
      await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [quantity, saleItem.product_id]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, type, quantity_change, reference) VALUES (?, 'return', ?, ?)`,
        [saleItem.product_id, quantity, sale.invoice_no]
      );
    }

    await conn.query('UPDATE refunds SET total = ? WHERE id = ?', [refundTotal, refundId]);
    await conn.query('UPDATE sales SET refunded_total = refunded_total + ? WHERE id = ?', [refundTotal, id]);

    await conn.commit();
    await logActivity(req.user.id, 'sale_refunded', `${sale.invoice_no} — refunded ${refundTotal.toFixed(2)}`);
    res.status(201).json({ msg: 'Refund recorded', refund_total: refundTotal });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// POST /api/sales — POS checkout
// body: { customer_id?, items: [{ product_id, quantity }], discount?, tax_rate?, payment_method? }
const addSale = asyncHandler(async (req, res) => {
  const { customer_id, items, discount = 0, tax_rate = 0, payment_method = 'cash' } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ msg: 'At least one item is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let subtotal = 0;
    const lineItems = [];

    for (const item of items) {
      const [[product]] = await conn.query(
        'SELECT id, name, price, stock FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );
      if (!product) throw Object.assign(new Error(`Product ${item.product_id} not found`), { status: 400 });
      if (product.stock < item.quantity) {
        throw Object.assign(new Error(`Not enough stock for ${product.name}`), { status: 400 });
      }

      const lineSubtotal = Number(product.price) * item.quantity;
      subtotal += lineSubtotal;
      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
        subtotal: lineSubtotal
      });
    }

    const tax = (subtotal * Number(tax_rate)) / 100;
    const total = subtotal - Number(discount) + tax;
    const invoice_no = generateCode('INV');

    const [saleResult] = await conn.query(
      `INSERT INTO sales (invoice_no, customer_id, user_id, subtotal, discount, tax, total, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice_no, customer_id || null, req.user.id, subtotal, discount, tax, total, payment_method]
    );
    const saleId = saleResult.insertId;

    for (const li of lineItems) {
      await conn.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, li.product_id, li.product_name, li.quantity, li.price, li.subtotal]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [li.quantity, li.product_id]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, type, quantity_change, reference)
         VALUES (?, 'sale', ?, ?)`,
        [li.product_id, -li.quantity, invoice_no]
      );
    }

    if (customer_id) {
      const points = Math.floor(total / 100); // 1 loyalty point per 100 spent
      await conn.query('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?', [points, customer_id]);
    }

    await conn.commit();
    await logActivity(req.user.id, 'sale_created', `${invoice_no} — ${lineItems.length} item(s), total ${total.toFixed(2)}`);
    res.status(201).json({ msg: 'Sale recorded', invoice_no, id: saleId, subtotal, discount, tax, total });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = { getSales, getSale, addSale, refundSale };

const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const logActivity = require('../utils/logActivity');

const getSettings = asyncHandler(async (req, res) => {
  const [[settings]] = await db.query('SELECT * FROM settings WHERE id = 1');
  res.json(settings || {});
});

const updateSettings = asyncHandler(async (req, res) => {
  const { shop_name, address, phone, currency_symbol, default_tax_rate, receipt_note } = req.body;
  await db.query(
    `UPDATE settings SET shop_name=?, address=?, phone=?, currency_symbol=?, default_tax_rate=?, receipt_note=? WHERE id = 1`,
    [shop_name, address || null, phone || null, currency_symbol || 'Rs', default_tax_rate || 0, receipt_note || null]
  );
  await logActivity(req.user.id, 'settings_updated', 'Shop settings were updated');
  res.json({ msg: 'Settings updated' });
});

module.exports = { getSettings, updateSettings };

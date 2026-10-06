const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const logActivity = require('../utils/logActivity');

const getUsers = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at'
  );
  res.json(rows);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ msg: 'Role must be admin or staff' });
  }
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ msg: 'You cannot change your own role' });
  }
  await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  await logActivity(req.user.id, 'user_role_changed', `User #${id} set to ${role}`);
  res.json({ msg: 'Role updated' });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ msg: 'You cannot deactivate your own account' });
  }
  await db.query('UPDATE users SET is_active = ? WHERE id = ?', [Boolean(is_active), id]);
  await logActivity(req.user.id, 'user_status_changed', `User #${id} ${is_active ? 'activated' : 'deactivated'}`);
  res.json({ msg: is_active ? 'User activated' : 'User deactivated' });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ msg: 'You cannot delete your own account' });
  }
  await db.query('DELETE FROM users WHERE id = ?', [id]);
  await logActivity(req.user.id, 'user_deleted', `User #${id} deleted`);
  res.json({ msg: 'User deleted' });
});

module.exports = { getUsers, updateUserRole, updateUserStatus, deleteUser };

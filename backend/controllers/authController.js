const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { asyncHandler } = require('../middleware/errorHandler');
const logActivity = require('../utils/logActivity');

function sign(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ msg: 'Password must be at least 6 characters' });
  }

  const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length > 0) {
    return res.status(409).json({ msg: 'Username already taken' });
  }

  // The very first account on a fresh install becomes admin automatically,
  // every account after that is regular staff (an admin can be promoted later
  // directly in the database if needed).
  const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM users');
  const role = count === 0 ? 'admin' : 'staff';

  const hashed = await bcrypt.hash(password, 10);
  const [insertResult] = await db.query(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    [username, email || null, hashed, role]
  );

  await logActivity(insertResult.insertId, 'user_registered', `${username} joined as ${role}`);

  res.status(201).json({ msg: 'User registered successfully', role });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ msg: 'Username and password are required' });
  }

  const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  if (rows.length === 0) {
    return res.status(400).json({ msg: 'User not found' });
  }

  const user = rows[0];
  if (!user.is_active) {
    return res.status(403).json({ msg: 'This account has been deactivated' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ msg: 'Wrong password' });
  }

  const token = sign(user);
  await logActivity(user.id, 'user_login', `${user.username} logged in`);
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role }
  });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, username, email, role, is_active, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ msg: 'User not found' });
  res.json(rows[0]);
});

module.exports = { register, login, me };

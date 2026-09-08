const db = require('../config/db');

// Fire-and-forget activity logger — never lets a logging failure break the
// actual request (it's audit trail, not critical path).
async function logActivity(userId, action, details = '') {
  try {
    await db.query(
      'INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)',
      [userId || null, action, details]
    );
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

module.exports = logActivity;

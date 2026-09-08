const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

router.get('/', verifyToken, getSettings);
router.put('/', verifyToken, requireRole('admin'), updateSettings);

module.exports = router;

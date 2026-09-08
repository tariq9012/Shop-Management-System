const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { getUsers, updateUserRole, updateUserStatus, deleteUser } = require('../controllers/userController');

router.get('/', verifyToken, requireRole('admin'), getUsers);
router.put('/:id/role', verifyToken, requireRole('admin'), updateUserRole);
router.put('/:id/status', verifyToken, requireRole('admin'), updateUserStatus);
router.delete('/:id', verifyToken, requireRole('admin'), deleteUser);

module.exports = router;

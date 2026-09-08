const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { getCategories, addCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');

router.get('/', verifyToken, getCategories);
router.post('/', verifyToken, requireRole('admin'), addCategory);
router.put('/:id', verifyToken, requireRole('admin'), updateCategory);
router.delete('/:id', verifyToken, requireRole('admin'), deleteCategory);

module.exports = router;

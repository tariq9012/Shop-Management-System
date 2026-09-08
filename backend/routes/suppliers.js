const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { getSuppliers, addSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');

router.get('/', verifyToken, getSuppliers);
router.post('/', verifyToken, requireRole('admin'), addSupplier);
router.put('/:id', verifyToken, requireRole('admin'), updateSupplier);
router.delete('/:id', verifyToken, requireRole('admin'), deleteSupplier);

module.exports = router;

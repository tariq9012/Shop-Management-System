const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  getPurchaseOrders, getPurchaseOrder, addPurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder
} = require('../controllers/purchaseOrderController');

router.get('/', verifyToken, getPurchaseOrders);
router.get('/:id', verifyToken, getPurchaseOrder);
router.post('/', verifyToken, addPurchaseOrder);
router.put('/:id/receive', verifyToken, requireRole('admin'), receivePurchaseOrder);
router.put('/:id/cancel', verifyToken, requireRole('admin'), cancelPurchaseOrder);

module.exports = router;

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getSales, getSale, addSale, refundSale } = require('../controllers/saleController');

router.get('/', verifyToken, getSales);
router.get('/:id', verifyToken, getSale);
router.post('/', verifyToken, addSale);
router.post('/:id/refund', verifyToken, refundSale);

module.exports = router;

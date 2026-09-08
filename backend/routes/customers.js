const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  getCustomers, getCustomerHistory, addCustomer, updateCustomer, deleteCustomer
} = require('../controllers/customerController');

router.get('/', verifyToken, getCustomers);
router.get('/:id/history', verifyToken, getCustomerHistory);
router.post('/', verifyToken, addCustomer);
router.put('/:id', verifyToken, updateCustomer);
router.delete('/:id', verifyToken, requireRole('admin'), deleteCustomer);

module.exports = router;

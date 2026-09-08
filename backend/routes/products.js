const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadImportFile } = require('../middleware/upload');
const {
  getProducts, getProduct, getProductByBarcode, getLowStock,
  addProduct, updateProduct, deleteProduct, bulkImportProducts
} = require('../controllers/productController');

router.get('/', verifyToken, getProducts);
router.get('/low-stock', verifyToken, getLowStock);
router.get('/barcode/:code', verifyToken, getProductByBarcode);
router.get('/:id', verifyToken, getProduct);
router.post('/', verifyToken, upload.single('image'), addProduct);
router.post('/import', verifyToken, uploadImportFile.single('file'), bulkImportProducts);
router.put('/:id', verifyToken, upload.single('image'), updateProduct);
router.delete('/:id', verifyToken, requireRole('admin'), deleteProduct);

module.exports = router;

const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const fileController = require('../controllers/file.controller');
const shopController = require('../controllers/shop.controller');
const { upload } = require('../config/upload');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

// --- Public : catalogue d'une boutique ---
router.get('/shop/:slug', optionalAuth, productController.listProductsByShop);
router.get('/shop/:slug/:productSlug', optionalAuth, productController.getProductBySlug);

// --- Gestion vendeur (propriétaire de la boutique, admin ou founder) ---
router.get(
  '/manage/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  productController.listProductsForOwner
);

router.post(
  '/manage/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  productController.createProduct
);

router.patch(
  '/manage/:shopId/:productId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  productController.loadProduct,
  productController.updateProduct
);

router.delete(
  '/manage/:shopId/:productId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  productController.loadProduct,
  productController.deleteProduct
);

// --- Fichiers livrables du produit ---
router.get(
  '/manage/:shopId/:productId/files',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  productController.loadProduct,
  fileController.listProductFiles
);

router.post(
  '/manage/:shopId/:productId/files',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  productController.loadProduct,
  upload.single('file'),
  fileController.uploadProductFile
);

router.delete(
  '/manage/:shopId/:productId/files/:fileId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  productController.loadProduct,
  fileController.deleteProductFile
);

module.exports = router;

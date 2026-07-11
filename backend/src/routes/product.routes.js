const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const shopController = require('../controllers/shop.controller');
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

module.exports = router;

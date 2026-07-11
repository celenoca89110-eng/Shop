const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const shopController = require('../controllers/shop.controller');
const fileController = require('../controllers/file.controller');
const { requireAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

// --- Client ---
router.post('/checkout', requireAuth, orderController.checkout);
router.get('/me', requireAuth, orderController.getMyOrders);
router.get('/me/:orderId', requireAuth, orderController.getMyOrderDetail);
router.get('/me/:orderId/downloads', requireAuth, fileController.getDownloadsForOrder);

// --- Gestion vendeur ---
router.get(
  '/manage/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  orderController.getShopOrders
);

router.patch(
  '/manage/:shopId/:orderId/status',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  orderController.updateOrderStatus
);

router.post(
  '/manage/:shopId/:orderId/refund',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  orderController.refundOrder
);

router.post(
  '/manage/:shopId/:orderId/confirm-crypto',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  orderController.confirmCryptoPayment
);

router.patch(
  '/manage/:shopId/:orderId/archive',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  orderController.archiveOrder
);

module.exports = router;

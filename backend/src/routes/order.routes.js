const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const shopController = require('../controllers/shop.controller');
const { requireAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

// --- Client ---
router.post('/checkout', requireAuth, orderController.checkout);
router.get('/me', requireAuth, orderController.getMyOrders);
router.get('/me/:orderId', requireAuth, orderController.getMyOrderDetail);

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

router.patch(
  '/manage/:shopId/:orderId/archive',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  orderController.archiveOrder
);

module.exports = router;

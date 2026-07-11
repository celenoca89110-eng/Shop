const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const shopController = require('../controllers/shop.controller');
const { requireAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

// --- Client ---
router.get('/me', requireAuth, subscriptionController.getMySubscriptions);
router.post('/:subscriptionId/renew', requireAuth, subscriptionController.renewSubscription);
router.patch('/:subscriptionId/cancel', requireAuth, subscriptionController.cancelSubscription);

// --- Calendrier vendeur ---
router.get(
  '/calendar/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  subscriptionController.getCalendar
);

router.get(
  '/calendar/:shopId/export.csv',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  subscriptionController.exportCalendarCsv
);

module.exports = router;

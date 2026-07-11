const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');
const shopController = require('../controllers/shop.controller');
const { requireAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

router.get(
  '/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  statsController.getShopStats
);

module.exports = router;

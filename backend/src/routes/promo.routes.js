const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promo.controller');
const shopController = require('../controllers/shop.controller');
const { requireAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

router.use('/manage/:shopId', requireAuth, shopController.loadShop, requireShopOwnerOrAdmin);

router.get('/manage/:shopId', promoController.listPromoCodes);
router.post('/manage/:shopId', promoController.createPromoCode);
router.patch('/manage/:shopId/:promoCodeId', promoController.updatePromoCode);
router.delete('/manage/:shopId/:promoCodeId', promoController.deletePromoCode);

module.exports = router;

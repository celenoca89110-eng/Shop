const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole, requireShopOwnerOrAdmin } = require('../middleware/roles');

// Public
router.get('/', optionalAuth, shopController.listShops);

// Authentifié : mes boutiques (doit être déclaré avant /:slug pour éviter le conflit de route)
router.get('/mine', requireAuth, shopController.getMyShops);

router.get('/:slug', optionalAuth, shopController.getShopBySlug);

// Authentifié : créer sa propre boutique
router.post('/', requireAuth, shopController.createShop);

// Gestion d'une boutique existante (propriétaire, admin ou founder uniquement)
router.patch(
  '/manage/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  shopController.updateShop
);

router.delete(
  '/manage/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  shopController.deleteShop
);

module.exports = router;

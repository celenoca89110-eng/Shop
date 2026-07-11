const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const shopController = require('../controllers/shop.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

// --- Public ---
router.get('/shop/:slug/:productSlug', optionalAuth, reviewController.listProductReviews);

// --- Client ---
router.post('/', requireAuth, reviewController.createReview);
router.get('/reviewable', requireAuth, reviewController.getReviewableItems);

// --- Vendeur ---
router.get(
  '/manage/:shopId',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  reviewController.getShopReviews
);

router.post(
  '/manage/:shopId/:reviewId/reply',
  requireAuth,
  shopController.loadShop,
  requireShopOwnerOrAdmin,
  reviewController.replyToReview
);

module.exports = router;

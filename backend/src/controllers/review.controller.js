const db = require('../config/db');

async function listProductReviews(req, res, next) {
  try {
    const { slug, productSlug } = req.params;

    const productResult = await db.query(
      `SELECT p.id FROM products p JOIN shops s ON s.id = p.shop_id WHERE s.slug = $1 AND p.slug = $2`,
      [slug, productSlug]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    const productId = productResult.rows[0].id;

    const reviews = await db.query(
      `SELECT r.*, u.username FROM product_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1 ORDER BY r.created_at DESC`,
      [productId]
    );

    const avgResult = await db.query(
      `SELECT COALESCE(AVG(rating), 0) AS average, COUNT(*) AS total FROM product_reviews WHERE product_id = $1`,
      [productId]
    );

    return res.json({
      reviews: reviews.rows,
      average: parseFloat(avgResult.rows[0].average).toFixed(1),
      total: parseInt(avgResult.rows[0].total, 10),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Crée un avis pour un article acheté. Un seul avis par article (order_item),
 * et seulement si la commande est payée/terminée.
 */
async function createReview(req, res, next) {
  try {
    const { orderItemId, rating, comment } = req.body;

    if (!orderItemId || !rating) {
      return res.status(400).json({ error: 'Article acheté et note requis.' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'La note doit être comprise entre 1 et 5.' });
    }

    const itemResult = await db.query(
      `SELECT oi.*, o.user_id, o.status FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1`,
      [orderItemId]
    );
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Article introuvable.' });
    }
    const item = itemResult.rows[0];

    if (item.user_id !== req.user.id) {
      return res.status(403).json({ error: "Cet article ne fait pas partie de vos commandes." });
    }
    const eligibleStatuses = ['paid', 'in_progress', 'completed', 'subscription_active', 'subscription_cancelled', 'subscription_expired'];
    if (!eligibleStatuses.includes(item.status)) {
      return res.status(400).json({ error: "Vous ne pouvez laisser un avis que sur un achat validé." });
    }
    if (!item.product_id) {
      return res.status(400).json({ error: "Ce produit n'existe plus." });
    }

    const existing = await db.query('SELECT id FROM product_reviews WHERE order_item_id = $1', [orderItemId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Vous avez déjà laissé un avis pour cet achat.' });
    }

    const { rows } = await db.query(
      `INSERT INTO product_reviews (product_id, order_item_id, user_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [item.product_id, orderItemId, req.user.id, rating, comment || null]
    );

    return res.status(201).json({ review: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Liste les articles achetés par le client connecté qui sont éligibles à un avis
 * (pas encore commentés). Utilisé pour proposer "Laisser un avis" côté client.
 */
async function getReviewableItems(req, res, next) {
  try {
    const eligibleStatuses = ['paid', 'in_progress', 'completed', 'subscription_active', 'subscription_cancelled', 'subscription_expired'];
    const { rows } = await db.query(
      `SELECT oi.id AS order_item_id, oi.product_name_snapshot, oi.product_id, o.created_at, s.name AS shop_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN shops s ON s.id = o.shop_id
       LEFT JOIN product_reviews r ON r.order_item_id = oi.id
       WHERE o.user_id = $1 AND o.status = ANY($2::order_status[]) AND r.id IS NULL AND oi.product_id IS NOT NULL
       ORDER BY o.created_at DESC`,
      [req.user.id, eligibleStatuses]
    );
    return res.json({ items: rows });
  } catch (err) {
    next(err);
  }
}

async function replyToReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'Réponse requise.' });

    const { rows } = await db.query(
      `UPDATE product_reviews SET seller_reply = $1, seller_reply_at = now()
       WHERE id = $2 AND product_id IN (SELECT id FROM products WHERE shop_id = $3)
       RETURNING *`,
      [reply, reviewId, req.shop.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Avis introuvable.' });
    }
    return res.json({ review: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getShopReviews(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT r.*, u.username, p.name AS product_name
       FROM product_reviews r
       JOIN users u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
       WHERE p.shop_id = $1 ORDER BY r.created_at DESC`,
      [req.shop.id]
    );
    return res.json({ reviews: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProductReviews,
  createReview,
  getReviewableItems,
  replyToReview,
  getShopReviews,
};

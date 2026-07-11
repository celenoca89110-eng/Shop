const express = require('express');
const router = express.Router();
const cryptoController = require('../controllers/crypto.controller');
const shopController = require('../controllers/shop.controller');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireShopOwnerOrAdmin } = require('../middleware/roles');

// --- Public : devises acceptées par une boutique (sans les adresses, juste pour affichage) ---
router.get('/shop/:slug', async (req, res, next) => {
  try {
    const shopResult = await db.query('SELECT id FROM shops WHERE slug = $1', [req.params.slug]);
    if (shopResult.rows.length === 0) return res.json({ currencies: [] });
    const { rows } = await db.query('SELECT currency FROM shop_crypto_wallets WHERE shop_id = $1', [shopResult.rows[0].id]);
    return res.json({ currencies: rows.map((r) => r.currency) });
  } catch (err) {
    next(err);
  }
});

router.use('/manage/:shopId', requireAuth, shopController.loadShop, requireShopOwnerOrAdmin);

router.get('/manage/:shopId', cryptoController.listWallets);
router.post('/manage/:shopId', cryptoController.upsertWallet);
router.delete('/manage/:shopId/:currency', cryptoController.deleteWallet);

module.exports = router;

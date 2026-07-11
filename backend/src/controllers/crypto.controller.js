const db = require('../config/db');

const CURRENCIES = ['BTC', 'ETH', 'LTC', 'SOL'];

async function listWallets(req, res, next) {
  try {
    const { rows } = await db.query('SELECT * FROM shop_crypto_wallets WHERE shop_id = $1', [req.shop.id]);
    return res.json({ wallets: rows });
  } catch (err) {
    next(err);
  }
}

async function upsertWallet(req, res, next) {
  try {
    const { currency, address } = req.body;
    if (!CURRENCIES.includes(currency) || !address) {
      return res.status(400).json({ error: 'Devise ou adresse invalide.' });
    }

    const { rows } = await db.query(
      `INSERT INTO shop_crypto_wallets (shop_id, currency, address)
       VALUES ($1,$2,$3)
       ON CONFLICT (shop_id, currency) DO UPDATE SET address = EXCLUDED.address
       RETURNING *`,
      [req.shop.id, currency, address]
    );

    return res.status(201).json({ wallet: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteWallet(req, res, next) {
  try {
    const { currency } = req.params;
    await db.query('DELETE FROM shop_crypto_wallets WHERE shop_id = $1 AND currency = $2', [req.shop.id, currency]);
    return res.json({ message: 'Wallet supprimé.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listWallets, upsertWallet, deleteWallet, CURRENCIES };

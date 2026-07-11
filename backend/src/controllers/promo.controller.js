const db = require('../config/db');

async function listPromoCodes(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM promo_codes WHERE shop_id = $1 ORDER BY created_at DESC',
      [req.shop.id]
    );
    return res.json({ promoCodes: rows });
  } catch (err) {
    next(err);
  }
}

async function createPromoCode(req, res, next) {
  try {
    const { code, discountType, discountValue, expiresAt, maxUses, applicableProductIds } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'Code, type et valeur de réduction requis.' });
    }
    if (!['percent', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'Type de réduction invalide.' });
    }
    if (discountType === 'percent' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({ error: 'Un pourcentage doit être compris entre 1 et 100.' });
    }

    const normalizedCode = code.toUpperCase().trim();

    const existing = await db.query(
      'SELECT id FROM promo_codes WHERE shop_id = $1 AND code = $2',
      [req.shop.id, normalizedCode]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ce code promo existe déjà pour cette boutique.' });
    }

    const { rows } = await db.query(
      `INSERT INTO promo_codes (shop_id, code, discount_type, discount_value, expires_at, max_uses, applicable_product_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.shop.id, normalizedCode, discountType, discountValue,
        expiresAt || null, maxUses || null, JSON.stringify(applicableProductIds || []),
      ]
    );

    return res.status(201).json({ promoCode: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updatePromoCode(req, res, next) {
  try {
    const { promoCodeId } = req.params;
    const allowed = ['is_active', 'expires_at', 'max_uses', 'discount_value', 'applicable_product_ids'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(req.body)) {
      const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      if (allowed.includes(column)) {
        const v = column === 'applicable_product_ids' ? JSON.stringify(value) : value;
        updates.push(`${column} = $${idx}`);
        values.push(v);
        idx += 1;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ valide à mettre à jour.' });
    }

    values.push(promoCodeId, req.shop.id);
    const { rows } = await db.query(
      `UPDATE promo_codes SET ${updates.join(', ')} WHERE id = $${idx} AND shop_id = $${idx + 1} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Code promo introuvable.' });
    }

    return res.json({ promoCode: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deletePromoCode(req, res, next) {
  try {
    const { promoCodeId } = req.params;
    await db.query('DELETE FROM promo_codes WHERE id = $1 AND shop_id = $2', [promoCodeId, req.shop.id]);
    return res.json({ message: 'Code promo supprimé.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Valide un code promo pour une boutique + un panier donné.
 * Retourne le montant de réduction en centimes.
 * Utilisé en interne par le contrôleur de commande (checkout).
 */
async function validatePromoCode({ shopId, code, productIds, subtotalCents }) {
  const { rows } = await db.query(
    `SELECT * FROM promo_codes
     WHERE shop_id = $1 AND code = $2 AND is_active = true
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR used_count < max_uses)`,
    [shopId, code.toUpperCase().trim()]
  );

  if (rows.length === 0) {
    return { valid: false, reason: 'Code promo invalide, expiré ou épuisé.' };
  }

  const promo = rows[0];
  const applicableIds = promo.applicable_product_ids || [];

  if (applicableIds.length > 0) {
    const allApplicable = productIds.every((id) => applicableIds.includes(id));
    if (!allApplicable) {
      return { valid: false, reason: "Ce code ne s'applique pas à tous les produits du panier." };
    }
  }

  const discountCents =
    promo.discount_type === 'percent'
      ? Math.round((subtotalCents * Number(promo.discount_value)) / 100)
      : Math.min(subtotalCents, Math.round(Number(promo.discount_value) * 100));

  return { valid: true, promo, discountCents };
}

module.exports = {
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
};

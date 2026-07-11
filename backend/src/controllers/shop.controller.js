const db = require('../config/db');

function slugify(str) {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function listShops(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, name, slug, description, logo_url, banner_url,
              color_primary, color_secondary, theme, is_active, is_default, created_at
       FROM shops WHERE is_active = true ORDER BY is_default DESC, created_at ASC`
    );
    return res.json({ shops: rows });
  } catch (err) {
    next(err);
  }
}

async function getMyShops(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM shops WHERE owner_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [req.user.id]
    );
    return res.json({ shops: rows });
  } catch (err) {
    next(err);
  }
}

async function getShopBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const { rows } = await db.query('SELECT * FROM shops WHERE slug = $1', [slug]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }
    return res.json({ shop: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function createShop(req, res, next) {
  try {
    const { name, description, logoUrl, bannerUrl, colorPrimary, colorSecondary, theme } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Le nom de la boutique est requis.' });
    }

    let slug = slugify(name);
    const existing = await db.query('SELECT id FROM shops WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const { rows } = await db.query(
      `INSERT INTO shops (owner_id, name, slug, description, logo_url, banner_url, color_primary, color_secondary, theme)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, '#7c3aed'), COALESCE($8, '#000000'), COALESCE($9, 'default'))
       RETURNING *`,
      [req.user.id, name, slug, description || null, logoUrl || null, bannerUrl || null, colorPrimary, colorSecondary, theme]
    );

    // Les nouveaux propriétaires de boutique passent shop_owner s'ils étaient user simple
    if (req.user.role === 'user') {
      await db.query(`UPDATE users SET role = 'shop_owner' WHERE id = $1`, [req.user.id]);
    }

    return res.status(201).json({ shop: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Middleware helper: charge la boutique depuis :shopId et l'attache à req.shop
async function loadShop(req, res, next) {
  try {
    const { shopId } = req.params;
    const { rows } = await db.query('SELECT * FROM shops WHERE id = $1', [shopId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }
    req.shop = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

async function updateShop(req, res, next) {
  try {
    const allowedFields = [
      'name', 'description', 'logo_url', 'banner_url',
      'color_primary', 'color_secondary', 'theme',
      'discord_webhook_url', 'discord_guild_id', 'payment_settings', 'delivery_settings', 'is_active',
    ];

    const updates = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(req.body)) {
      const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      if (allowedFields.includes(column)) {
        updates.push(`${column} = $${idx}`);
        values.push(value);
        idx += 1;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ valide à mettre à jour.' });
    }

    values.push(req.shop.id);
    const { rows } = await db.query(
      `UPDATE shops SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return res.json({ shop: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteShop(req, res, next) {
  try {
    if (req.shop.is_default) {
      return res.status(403).json({ error: 'La boutique par défaut CecaShop ne peut pas être supprimée.' });
    }
    await db.query('DELETE FROM shops WHERE id = $1', [req.shop.id]);
    return res.json({ message: 'Boutique supprimée.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listShops,
  getMyShops,
  getShopBySlug,
  createShop,
  loadShop,
  updateShop,
  deleteShop,
};

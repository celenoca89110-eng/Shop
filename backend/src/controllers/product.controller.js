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

// --- Liste publique des produits d'une boutique ---
async function listProductsByShop(req, res, next) {
  try {
    const { slug } = req.params;
    const { category, tag, featured, search } = req.query;

    const shopResult = await db.query('SELECT id FROM shops WHERE slug = $1', [slug]);
    if (shopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }
    const shopId = shopResult.rows[0].id;

    const conditions = ['shop_id = $1', 'is_active = true'];
    const values = [shopId];
    let idx = 2;

    if (category) {
      conditions.push(`category = $${idx}`);
      values.push(category);
      idx += 1;
    }
    if (featured === 'true') {
      conditions.push('is_featured = true');
    }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx += 1;
    }
    if (tag) {
      conditions.push(`tags @> $${idx}::jsonb`);
      values.push(JSON.stringify([tag]));
      idx += 1;
    }

    const { rows } = await db.query(
      `SELECT id, name, slug, description, price_cents, is_free, stock_type, stock_quantity,
              category, tags, is_featured, main_image_url, gallery, created_at
       FROM products
       WHERE ${conditions.join(' AND ')}
       ORDER BY is_featured DESC, created_at DESC`,
      values
    );

    return res.json({ products: rows });
  } catch (err) {
    next(err);
  }
}

// --- Détail d'un produit (public) + ses champs dynamiques ---
async function getProductBySlug(req, res, next) {
  try {
    const { slug, productSlug } = req.params;

    const { rows } = await db.query(
      `SELECT p.* FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE s.slug = $1 AND p.slug = $2 AND p.is_active = true`,
      [slug, productSlug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    const product = rows[0];

    const fields = await db.query(
      `SELECT id, label, field_type, is_required, options, position
       FROM product_fields WHERE product_id = $1 ORDER BY position ASC`,
      [product.id]
    );

    return res.json({ product: { ...product, fields: fields.rows } });
  } catch (err) {
    next(err);
  }
}

// --- Création d'un produit (vendeur / admin / founder) ---
async function createProduct(req, res, next) {
  try {
    const {
      name, description, priceCents, isFree, stockType, stockQuantity,
      category, tags, isFeatured, mainImageUrl, gallery, fields,
      isSubscription, subscriptionDurationType, subscriptionDurationDays, subscriptionAutoRenewDefault,
      discordRoleId,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Le nom du produit est requis.' });
    }

    let slug = slugify(name);
    const existing = await db.query(
      'SELECT id FROM products WHERE shop_id = $1 AND slug = $2',
      [req.shop.id, slug]
    );
    if (existing.rows.length > 0) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const { rows } = await db.query(
      `INSERT INTO products
        (shop_id, name, slug, description, price_cents, is_free, stock_type, stock_quantity,
         category, tags, is_featured, main_image_url, gallery,
         is_subscription, subscription_duration_type, subscription_duration_days, subscription_auto_renew_default,
         discord_role_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        req.shop.id, name, slug, description || null,
        isFree ? 0 : Math.max(0, parseInt(priceCents, 10) || 0),
        !!isFree,
        stockType === 'limited' ? 'limited' : 'unlimited',
        stockType === 'limited' ? parseInt(stockQuantity, 10) || 0 : null,
        category || null,
        JSON.stringify(tags || []),
        !!isFeatured,
        mainImageUrl || null,
        JSON.stringify(gallery || []),
        !!isSubscription,
        isSubscription ? (subscriptionDurationType || 'monthly') : null,
        isSubscription && subscriptionDurationType === 'custom' ? parseInt(subscriptionDurationDays, 10) || 30 : null,
        !!subscriptionAutoRenewDefault,
        discordRoleId || null,
      ]
    );

    const product = rows[0];

    // Champs dynamiques (optionnels, envoyés en tableau)
    if (Array.isArray(fields) && fields.length > 0) {
      for (let i = 0; i < fields.length; i += 1) {
        const f = fields[i];
        await db.query(
          `INSERT INTO product_fields (product_id, label, field_type, is_required, options, position)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [product.id, f.label, f.fieldType || 'text_short', f.isRequired !== false, JSON.stringify(f.options || []), i]
        );
      }
    }

    return res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

// --- Liste des produits d'une boutique pour son propriétaire (inclut inactifs) ---
async function listProductsForOwner(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM products WHERE shop_id = $1 ORDER BY created_at DESC`,
      [req.shop.id]
    );
    return res.json({ products: rows });
  } catch (err) {
    next(err);
  }
}

async function loadProduct(req, res, next) {
  try {
    const { productId } = req.params;
    const { rows } = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    req.product = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const allowed = [
      'name', 'description', 'price_cents', 'is_free', 'stock_type', 'stock_quantity',
      'category', 'tags', 'is_featured', 'is_active', 'main_image_url', 'gallery',
      'is_subscription', 'subscription_duration_type', 'subscription_duration_days',
      'subscription_auto_renew_default', 'discord_role_id',
    ];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(req.body)) {
      const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      if (allowed.includes(column)) {
        const v = ['tags', 'gallery'].includes(column) ? JSON.stringify(value) : value;
        updates.push(`${column} = $${idx}`);
        values.push(v);
        idx += 1;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ valide à mettre à jour.' });
    }

    values.push(req.product.id);
    const { rows } = await db.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return res.json({ product: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [req.product.id]);
    return res.json({ message: 'Produit supprimé.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProductsByShop,
  getProductBySlug,
  createProduct,
  listProductsForOwner,
  loadProduct,
  updateProduct,
  deleteProduct,
};

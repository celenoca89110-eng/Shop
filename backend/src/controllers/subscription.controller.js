const db = require('../config/db');
const stripe = require('../config/stripe');
const { computeSubscriptionEnd } = require('../utils/subscriptionDuration');

// ==========================================================
// Côté client
// ==========================================================

async function getMySubscriptions(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT sub.*, s.name AS shop_name, s.slug AS shop_slug
       FROM subscriptions sub JOIN shops s ON s.id = sub.shop_id
       WHERE sub.user_id = $1 ORDER BY sub.ends_at DESC`,
      [req.user.id]
    );
    return res.json({ subscriptions: rows });
  } catch (err) {
    next(err);
  }
}

/**
 * Renouvelle un abonnement : crée une commande + session Stripe (ou renouvellement
 * direct si le produit est gratuit). L'extension réelle de la date de fin se fait
 * au moment de la confirmation de paiement (voir order.controller.stripeWebhook).
 *
 * NOTE : ceci est un renouvellement "à la demande" (paiement unique renouvelé
 * manuellement ou déclenché par le client), pas un prélèvement automatique récurrent.
 * Un vrai prélèvement automatique nécessiterait l'API Stripe Subscriptions/Billing
 * et l'enregistrement d'un moyen de paiement — à prévoir si besoin d'auto-renew réel.
 */
async function renewSubscription(req, res, next) {
  const client = await db.pool.connect();
  try {
    const { subscriptionId } = req.params;

    const subResult = await client.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [subscriptionId, req.user.id]
    );
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Abonnement introuvable.' });
    }
    const subscription = subResult.rows[0];

    if (subscription.status === 'cancelled') {
      return res.status(400).json({ error: 'Cet abonnement a été annulé et ne peut pas être renouvelé.' });
    }
    if (!subscription.product_id) {
      return res.status(400).json({ error: "Le produit associé à cet abonnement n'existe plus." });
    }

    const productResult = await client.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [subscription.product_id]);
    if (productResult.rows.length === 0) {
      return res.status(400).json({ error: "Ce produit n'est plus disponible à la vente." });
    }
    const product = productResult.rows[0];
    const unitPrice = product.is_free ? 0 : product.price_cents;

    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, shop_id, status, subtotal_cents, discount_cents, total_cents)
       VALUES ($1,$2,'pending',$3,0,$3) RETURNING *`,
      [req.user.id, subscription.shop_id, unitPrice]
    );
    const order = orderResult.rows[0];

    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price_cents, quantity)
       VALUES ($1,$2,$3,$4,1)`,
      [order.id, product.id, product.name, unitPrice]
    );

    if (unitPrice === 0) {
      await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [order.id]);
      const newEnd = computeSubscriptionEnd(
        subscription.status === 'expired' ? new Date() : new Date(subscription.ends_at),
        product
      );
      await client.query(
        `UPDATE subscriptions SET status = 'active', ends_at = $1, renewed_count = renewed_count + 1 WHERE id = $2`,
        [newEnd, subscription.id]
      );
      await client.query(
        `INSERT INTO subscription_renewals (subscription_id, order_id, previous_end_at, new_end_at)
         VALUES ($1,$2,$3,$4)`,
        [subscription.id, order.id, subscription.ends_at, newEnd]
      );
      await client.query('COMMIT');
      return res.json({ free: true, orderId: order.id });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: { currency: 'eur', product_data: { name: `Renouvellement — ${product.name}` }, unit_amount: unitPrice },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/checkout/success?order=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel?order=${order.id}`,
      metadata: { orderId: order.id, shopId: subscription.shop_id, renewalOf: subscription.id },
    });

    await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, order.id]);
    await client.query('COMMIT');

    return res.json({ free: false, checkoutUrl: session.url, orderId: order.id });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/**
 * Annule un abonnement.
 * body.immediate = true  -> coupe l'accès immédiatement (status = cancelled)
 * body.immediate = false -> désactive juste le renouvellement automatique,
 *                           l'abonnement reste actif jusqu'à sa date de fin.
 */
async function cancelSubscription(req, res, next) {
  try {
    const { subscriptionId } = req.params;
    const { immediate } = req.body;

    const subResult = await db.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [subscriptionId, req.user.id]
    );
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Abonnement introuvable.' });
    }

    if (immediate) {
      await db.query(
        `UPDATE subscriptions SET status = 'cancelled', auto_renew = false, ends_at = now() WHERE id = $1`,
        [subscriptionId]
      );
    } else {
      await db.query(`UPDATE subscriptions SET auto_renew = false WHERE id = $1`, [subscriptionId]);
    }

    const { rows } = await db.query('SELECT * FROM subscriptions WHERE id = $1', [subscriptionId]);
    return res.json({ subscription: rows[0] });
  } catch (err) {
    next(err);
  }
}

// ==========================================================
// Côté vendeur : calendrier des abonnements
// ==========================================================

function buildCalendarQuery({ shopId, status, search, from, to }) {
  const conditions = ['sub.shop_id = $1'];
  const values = [shopId];
  let idx = 2;

  if (status) {
    conditions.push(`sub.status = $${idx}`);
    values.push(status);
    idx += 1;
  }
  if (search) {
    conditions.push(`(u.username ILIKE $${idx} OR u.email ILIKE $${idx} OR sub.product_name_snapshot ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx += 1;
  }
  if (from) {
    conditions.push(`sub.ends_at >= $${idx}`);
    values.push(from);
    idx += 1;
  }
  if (to) {
    conditions.push(`sub.ends_at <= $${idx}`);
    values.push(to);
    idx += 1;
  }

  const query = `
    SELECT sub.*, u.username, u.email
    FROM subscriptions sub
    JOIN users u ON u.id = sub.user_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY sub.ends_at ASC
  `;

  return { query, values };
}

async function getCalendar(req, res, next) {
  try {
    const { status, search, from, to } = req.query;
    const { query, values } = buildCalendarQuery({ shopId: req.shop.id, status, search, from, to });
    const { rows } = await db.query(query, values);

    const now = Date.now();
    const enriched = rows.map((r) => ({
      ...r,
      remaining_ms: Math.max(0, new Date(r.ends_at).getTime() - now),
    }));

    return res.json({ subscriptions: enriched });
  } catch (err) {
    next(err);
  }
}

async function exportCalendarCsv(req, res, next) {
  try {
    const { status, search, from, to } = req.query;
    const { query, values } = buildCalendarQuery({ shopId: req.shop.id, status, search, from, to });
    const { rows } = await db.query(query, values);

    const header = ['Client', 'Email', 'Produit', 'Date de début', 'Date de fin', 'Statut'];
    const lines = [header.join(';')];

    for (const r of rows) {
      lines.push(
        [
          r.username,
          r.email,
          `"${r.product_name_snapshot.replace(/"/g, '""')}"`,
          new Date(r.starts_at).toISOString(),
          new Date(r.ends_at).toISOString(),
          r.status,
        ].join(';')
      );
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="abonnements-${req.shop.slug}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMySubscriptions,
  renewSubscription,
  cancelSubscription,
  getCalendar,
  exportCalendarCsv,
};

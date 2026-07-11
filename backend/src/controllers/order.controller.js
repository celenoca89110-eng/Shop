const db = require('../config/db');
const stripe = require('../config/stripe');
const { validatePromoCode } = require('./promo.controller');
const { computeSubscriptionEnd } = require('../utils/subscriptionDuration');
const { runPostPurchaseActions } = require('../services/postPurchase');
const { sendDiscordWebhook, EVENTS } = require('../utils/discordWebhook');
const { CURRENCIES } = require('./crypto.controller');

/**
 * Crée une commande (pending) + une session Stripe Checkout.
 * Si le total est à 0€ (produits gratuits / code promo à 100%), la commande
 * est directement marquée "paid" sans passer par Stripe.
 */
async function checkout(req, res, next) {
  const client = await db.pool.connect();
  try {
    const { shopSlug, items, promoCode, paymentMethod, cryptoCurrency } = req.body;

    if (!shopSlug || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Boutique et articles requis.' });
    }

    const shopResult = await client.query('SELECT * FROM shops WHERE slug = $1 AND is_active = true', [shopSlug]);
    if (shopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }
    const shop = shopResult.rows[0];

    // Charge et valide chaque produit
    const productIds = items.map((i) => i.productId);
    const productsResult = await client.query(
      `SELECT * FROM products WHERE id = ANY($1::uuid[]) AND shop_id = $2 AND is_active = true`,
      [productIds, shop.id]
    );

    if (productsResult.rows.length !== productIds.length) {
      return res.status(400).json({ error: 'Un ou plusieurs produits sont invalides ou indisponibles.' });
    }

    const productsById = Object.fromEntries(productsResult.rows.map((p) => [p.id, p]));

    // Vérifie le stock limité
    for (const item of items) {
      const product = productsById[item.productId];
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (product.stock_type === 'limited' && product.stock_quantity < qty) {
        return res.status(400).json({ error: `Stock insuffisant pour "${product.name}".` });
      }
      // Vérifie les champs obligatoires
      const fieldsResult = await client.query(
        'SELECT * FROM product_fields WHERE product_id = $1 AND is_required = true',
        [product.id]
      );
      for (const field of fieldsResult.rows) {
        const response = item.fieldResponses?.[field.id];
        if (response === undefined || response === null || response === '') {
          return res.status(400).json({ error: `Le champ "${field.label}" est requis pour "${product.name}".` });
        }
      }
    }

    const subtotalCents = items.reduce((sum, item) => {
      const product = productsById[item.productId];
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      return sum + (product.is_free ? 0 : product.price_cents * qty);
    }, 0);

    let discountCents = 0;
    let promo = null;

    if (promoCode) {
      const validation = await validatePromoCode({
        shopId: shop.id,
        code: promoCode,
        productIds,
        subtotalCents,
      });
      if (!validation.valid) {
        return res.status(400).json({ error: validation.reason });
      }
      discountCents = validation.discountCents;
      promo = validation.promo;
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);

    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, shop_id, status, subtotal_cents, discount_cents, total_cents, promo_code_id)
       VALUES ($1,$2,'pending',$3,$4,$5,$6) RETURNING *`,
      [req.user.id, shop.id, subtotalCents, discountCents, totalCents, promo?.id || null]
    );
    const order = orderResult.rows[0];

    const lineItemsForStripe = [];
    const insertedItems = [];

    for (const item of items) {
      const product = productsById[item.productId];
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const unitPrice = product.is_free ? 0 : product.price_cents;

      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price_cents, quantity, field_responses)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [order.id, product.id, product.name, unitPrice, qty, JSON.stringify(item.fieldResponses || {})]
      );
      insertedItems.push(itemResult.rows[0]);

      if (unitPrice > 0) {
        lineItemsForStripe.push({
          price_data: {
            currency: 'eur',
            product_data: { name: product.name },
            unit_amount: unitPrice,
          },
          quantity: qty,
        });
      }
    }

    if (promo) {
      await client.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promo.id]);
    }

    // --- Commande gratuite : pas besoin de Stripe ---
    if (totalCents === 0) {
      await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [order.id]);
      await decrementStock(client, items, productsById);
      await createSubscriptionsForOrder(client, {
        orderId: order.id,
        userId: req.user.id,
        shopId: shop.id,
        itemRows: insertedItems,
        productsById,
      });
      await runPostPurchaseActions(client, {
        order: { ...order, status: 'paid' },
        shop,
        user: req.user,
        itemRows: insertedItems,
      });
      await client.query('COMMIT');
      return res.status(201).json({ free: true, orderId: order.id });
    }

    // --- Paiement en cryptomonnaie : pas de Stripe, confirmation manuelle par le vendeur ---
    if (paymentMethod === 'crypto') {
      if (!CURRENCIES.includes(cryptoCurrency)) {
        return res.status(400).json({ error: 'Devise crypto invalide.' });
      }
      const walletResult = await client.query(
        'SELECT * FROM shop_crypto_wallets WHERE shop_id = $1 AND currency = $2',
        [shop.id, cryptoCurrency]
      );
      if (walletResult.rows.length === 0) {
        return res.status(400).json({ error: "Cette boutique n'accepte pas cette cryptomonnaie." });
      }

      await client.query(
        `UPDATE orders SET payment_method = 'crypto', crypto_currency = $1, crypto_address = $2 WHERE id = $3`,
        [cryptoCurrency, walletResult.rows[0].address, order.id]
      );
      await client.query('COMMIT');

      return res.status(201).json({
        crypto: true,
        orderId: order.id,
        currency: cryptoCurrency,
        address: walletResult.rows[0].address,
        amountCents: totalCents,
      });
    }

    // --- Session Stripe Checkout ---
    // Si une réduction s'applique, on l'intègre en ajustant le premier article
    // (Stripe ne supporte pas nativement les coupons dynamiques par montant fixe ici,
    // on répercute donc la remise directement sur les prix envoyés).
    let itemsToSend = lineItemsForStripe;
    if (discountCents > 0 && lineItemsForStripe.length > 0) {
      const ratio = totalCents / subtotalCents;
      itemsToSend = lineItemsForStripe.map((li) => ({
        ...li,
        price_data: {
          ...li.price_data,
          unit_amount: Math.max(0, Math.round(li.price_data.unit_amount * ratio)),
        },
      }));
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: itemsToSend,
      success_url: `${process.env.FRONTEND_URL}/checkout/success?order=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel?order=${order.id}`,
      metadata: { orderId: order.id, shopId: shop.id },
    });

    await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, order.id]);
    await client.query('COMMIT');

    return res.status(201).json({ free: false, checkoutUrl: session.url, orderId: order.id });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function decrementStock(client, items, productsById) {
  for (const item of items) {
    const product = productsById[item.productId];
    if (product.stock_type === 'limited') {
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [qty, product.id]);
    }
  }
}

/**
 * Crée les instances d'abonnement pour les articles "produit abonnement" d'une commande.
 * itemRows : lignes issues de order_items (avec id, product_id, quantity, product_name_snapshot)
 * productsById : map productId -> produit complet (avec config d'abonnement)
 */
async function createSubscriptionsForOrder(client, { orderId, userId, shopId, itemRows, productsById }) {
  const now = new Date();
  for (const item of itemRows) {
    const product = item.product_id ? productsById[item.product_id] : null;
    if (!product || !product.is_subscription) continue;

    const endsAt = computeSubscriptionEnd(now, product);

    await client.query(
      `INSERT INTO subscriptions
        (order_id, order_item_id, user_id, shop_id, product_id, product_name_snapshot,
         status, auto_renew, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9)`,
      [
        orderId, item.id, userId, shopId, product.id, item.product_name_snapshot,
        !!product.subscription_auto_renew_default, now, endsAt,
      ]
    );
  }
}

/**
 * Webhook Stripe : confirme le paiement et met à jour la commande.
 * IMPORTANT : cette route utilise express.raw() (voir app.js), pas express.json().
 */
async function stripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    const renewalOf = session.metadata?.renewalOf;

    if (orderId) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length > 0 && orderResult.rows[0].status === 'pending') {
          await client.query(
            `UPDATE orders SET status = 'paid', stripe_payment_intent = $1 WHERE id = $2`,
            [session.payment_intent, orderId]
          );

          const itemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
          for (const item of itemsResult.rows) {
            if (item.product_id) {
              await client.query(
                `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - $1)
                 WHERE id = $2 AND stock_type = 'limited'`,
                [item.quantity, item.product_id]
              );
            }
          }

          if (renewalOf) {
            // --- Renouvellement d'un abonnement existant : on prolonge la date de fin ---
            const subResult = await client.query('SELECT * FROM subscriptions WHERE id = $1', [renewalOf]);
            if (subResult.rows.length > 0) {
              const subscription = subResult.rows[0];
              const productResult = await client.query('SELECT * FROM products WHERE id = $1', [subscription.product_id]);
              if (productResult.rows.length > 0) {
                const product = productResult.rows[0];
                const base = subscription.status === 'expired' ? new Date() : new Date(subscription.ends_at);
                const newEnd = require('../utils/subscriptionDuration').computeSubscriptionEnd(base, product);

                await client.query(
                  `UPDATE subscriptions SET status = 'active', ends_at = $1, renewed_count = renewed_count + 1 WHERE id = $2`,
                  [newEnd, subscription.id]
                );
                await client.query(
                  `INSERT INTO subscription_renewals (subscription_id, order_id, previous_end_at, new_end_at)
                   VALUES ($1,$2,$3,$4)`,
                  [subscription.id, orderId, subscription.ends_at, newEnd]
                );
              }
            }
          } else {
            // --- Nouvelle commande : crée les abonnements pour les produits concernés ---
            const productIds = itemsResult.rows.filter((i) => i.product_id).map((i) => i.product_id);
            let productsById = {};
            if (productIds.length > 0) {
              const productsResult = await client.query('SELECT * FROM products WHERE id = ANY($1::uuid[])', [productIds]);
              productsById = Object.fromEntries(productsResult.rows.map((p) => [p.id, p]));
              await createSubscriptionsForOrder(client, {
                orderId,
                userId: orderResult.rows[0].user_id,
                shopId: orderResult.rows[0].shop_id,
                itemRows: itemsResult.rows,
                productsById,
              });
            }

            const shopResult = await client.query('SELECT * FROM shops WHERE id = $1', [orderResult.rows[0].shop_id]);
            const userResult = await client.query('SELECT * FROM users WHERE id = $1', [orderResult.rows[0].user_id]);
            await runPostPurchaseActions(client, {
              order: { ...orderResult.rows[0], status: 'paid' },
              shop: shopResult.rows[0],
              user: userResult.rows[0],
              itemRows: itemsResult.rows,
            });
          }
          // TODO Phase 4 : envoyer une notification webhook Discord "Nouvelle commande"
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Stripe Webhook] Erreur traitement commande:', err);
      } finally {
        client.release();
      }
    }
  }

  return res.json({ received: true });
}

async function getMyOrders(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT o.*, s.name AS shop_name, s.slug AS shop_slug
       FROM orders o JOIN shops s ON s.id = o.shop_id
       WHERE o.user_id = $1 AND o.is_archived = false
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    return res.json({ orders: rows });
  } catch (err) {
    next(err);
  }
}

async function getMyOrderDetail(req, res, next) {
  try {
    const { orderId } = req.params;
    const orderResult = await db.query(
      `SELECT o.*, s.name AS shop_name, s.slug AS shop_slug
       FROM orders o JOIN shops s ON s.id = o.shop_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, req.user.id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }
    const items = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    return res.json({ order: { ...orderResult.rows[0], items: items.rows } });
  } catch (err) {
    next(err);
  }
}

async function getShopOrders(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT o.*, u.username, u.email
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.shop_id = $1 ORDER BY o.created_at DESC`,
      [req.shop.id]
    );
    return res.json({ orders: rows });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const validStatuses = [
      'pending', 'paid', 'in_progress', 'completed', 'cancelled',
      'subscription_active', 'subscription_cancelled', 'subscription_expired',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const { rows } = await db.query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND shop_id = $3 RETURNING *`,
      [status, orderId, req.shop.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    const order = rows[0];

    if (req.shop.discord_webhook_url) {
      if (status === 'completed') {
        await sendDiscordWebhook(req.shop.discord_webhook_url, EVENTS.orderCompleted(order, req.shop.name));
      } else if (status === 'cancelled') {
        await sendDiscordWebhook(req.shop.discord_webhook_url, EVENTS.refund(order, req.shop.name));
      }
    }

    return res.json({ order });
  } catch (err) {
    next(err);
  }
}

/**
 * Confirmation manuelle d'un paiement crypto par le vendeur (aucune vérification
 * blockchain automatique n'est effectuée — architecture prête pour une future
 * intégration avec un service de vérification comme BTCPay Server ou Coinbase Commerce).
 */
async function confirmCryptoPayment(req, res, next) {
  const client = await db.pool.connect();
  try {
    const { orderId } = req.params;
    const { txHash } = req.body;

    const orderResult = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND shop_id = $2 AND payment_method = 'crypto'`,
      [orderId, req.shop.id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande crypto introuvable.' });
    }
    const order = orderResult.rows[0];
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Cette commande a déjà été traitée.' });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE orders SET status = 'paid', crypto_tx_hash = $1, crypto_confirmed_at = now() WHERE id = $2`,
      [txHash || null, orderId]
    );

    const itemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    for (const item of itemsResult.rows) {
      if (item.product_id) {
        await client.query(
          `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - $1)
           WHERE id = $2 AND stock_type = 'limited'`,
          [item.quantity, item.product_id]
        );
      }
    }

    const productIds = itemsResult.rows.filter((i) => i.product_id).map((i) => i.product_id);
    if (productIds.length > 0) {
      const productsResult = await client.query('SELECT * FROM products WHERE id = ANY($1::uuid[])', [productIds]);
      const productsById = Object.fromEntries(productsResult.rows.map((p) => [p.id, p]));
      await createSubscriptionsForOrder(client, {
        orderId,
        userId: order.user_id,
        shopId: order.shop_id,
        itemRows: itemsResult.rows,
        productsById,
      });
    }

    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [order.user_id]);
    await runPostPurchaseActions(client, {
      order: { ...order, status: 'paid' },
      shop: req.shop,
      user: userResult.rows[0],
      itemRows: itemsResult.rows,
    });

    await client.query('COMMIT');

    const updated = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    return res.json({ order: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function refundOrder(req, res, next) {
  try {
    const { orderId } = req.params;

    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 AND shop_id = $2', [orderId, req.shop.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }
    const order = rows[0];

    if (!order.stripe_payment_intent) {
      return res.status(400).json({ error: "Cette commande n'a pas de paiement Stripe associé (produit gratuit ?)." });
    }

    await stripe.refunds.create({ payment_intent: order.stripe_payment_intent });

    const updated = await db.query(
      `UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [orderId]
    );

    if (req.shop.discord_webhook_url) {
      await sendDiscordWebhook(req.shop.discord_webhook_url, EVENTS.refund(updated.rows[0], req.shop.name));
    }

    return res.json({ order: updated.rows[0] });
  } catch (err) {
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: `Remboursement impossible : ${err.message}` });
    }
    next(err);
  }
}

async function archiveOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    const { archived } = req.body;
    const { rows } = await db.query(
      `UPDATE orders SET is_archived = $1 WHERE id = $2 AND shop_id = $3 RETURNING *`,
      [archived !== false, orderId, req.shop.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }
    return res.json({ order: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkout,
  stripeWebhook,
  getMyOrders,
  getMyOrderDetail,
  getShopOrders,
  updateOrderStatus,
  confirmCryptoPayment,
  refundOrder,
  archiveOrder,
};

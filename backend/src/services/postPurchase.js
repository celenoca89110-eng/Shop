const crypto = require('crypto');
const { sendDiscordWebhook, EVENTS } = require('../utils/discordWebhook');
const { grantDiscordRole } = require('../utils/discordRoles');

const DOWNLOAD_EXPIRY_DAYS = 7;
const DOWNLOAD_MAX_USES = 5;

/**
 * Exécute toutes les actions à déclencher juste après qu'une commande soit
 * confirmée payée : notification Discord, attribution de rôle, génération
 * des liens de téléchargement sécurisés.
 *
 * Ne lève jamais d'exception : chaque sous-action est isolée pour qu'une
 * erreur Discord/fichier n'invalide jamais la commande déjà payée.
 */
async function runPostPurchaseActions(client, { order, shop, user, itemRows }) {
  // --- 1. Notification Discord "Nouvelle commande" ---
  if (shop.discord_webhook_url) {
    await sendDiscordWebhook(shop.discord_webhook_url, EVENTS.newOrder(order, shop.name));

    try {
      const priorOrders = await client.query(
        `SELECT id FROM orders WHERE user_id = $1 AND shop_id = $2 AND status != 'pending' AND id != $3 LIMIT 1`,
        [user.id, shop.id, order.id]
      );
      if (priorOrders.rows.length === 0) {
        await sendDiscordWebhook(shop.discord_webhook_url, EVENTS.newCustomer(user, shop.name));
      }
    } catch (err) {
      console.error('[PostPurchase] Erreur vérification nouveau client:', err.message);
    }
  }

  // --- 2. Attribution automatique de rôle Discord ---
  for (const item of itemRows) {
    if (!item.product_id) continue;

    try {
      const productResult = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      const product = productResult.rows[0];
      if (!product?.discord_role_id) continue;

      if (!user.discord_id || !shop.discord_guild_id) {
        await client.query(
          `INSERT INTO discord_role_grants (user_id, shop_id, product_id, order_id, discord_role_id, status, error_message)
           VALUES ($1,$2,$3,$4,$5,'failed',$6)`,
          [
            user.id, shop.id, product.id, order.id, product.discord_role_id,
            !user.discord_id ? "L'utilisateur n'a pas lié son compte Discord." : "La boutique n'a pas d'ID de serveur Discord configuré.",
          ]
        );
        continue;
      }

      const result = await grantDiscordRole(shop.discord_guild_id, user.discord_id, product.discord_role_id);

      const subResult = await client.query(
        'SELECT id FROM subscriptions WHERE order_item_id = $1',
        [item.id]
      );
      const subscriptionId = subResult.rows[0]?.id || null;

      await client.query(
        `INSERT INTO discord_role_grants (user_id, shop_id, product_id, subscription_id, order_id, discord_role_id, status, error_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          user.id, shop.id, product.id, subscriptionId, order.id, product.discord_role_id,
          result.success ? 'granted' : 'failed',
          result.success ? null : result.error,
        ]
      );
    } catch (err) {
      console.error('[PostPurchase] Erreur attribution rôle Discord:', err.message);
    }
  }

  // --- 3. Génération des liens de téléchargement sécurisés ---
  for (const item of itemRows) {
    if (!item.product_id) continue;

    try {
      const filesResult = await client.query('SELECT * FROM product_files WHERE product_id = $1', [item.product_id]);
      for (const file of filesResult.rows) {
        const token = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        await client.query(
          `INSERT INTO download_links (order_item_id, product_file_id, user_id, token, max_downloads, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [item.id, file.id, user.id, token, DOWNLOAD_MAX_USES, expiresAt]
        );
      }
    } catch (err) {
      console.error('[PostPurchase] Erreur génération lien de téléchargement:', err.message);
    }
  }
}

/**
 * Révoque le rôle Discord associé à un abonnement expiré ou annulé.
 */
async function revokeSubscriptionDiscordRole(client, subscription) {
  try {
    const grantResult = await client.query(
      `SELECT * FROM discord_role_grants WHERE subscription_id = $1 AND status = 'granted' ORDER BY created_at DESC LIMIT 1`,
      [subscription.id]
    );
    if (grantResult.rows.length === 0) return;

    const grant = grantResult.rows[0];
    const shopResult = await client.query('SELECT * FROM shops WHERE id = $1', [grant.shop_id]);
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [grant.user_id]);
    const shop = shopResult.rows[0];
    const targetUser = userResult.rows[0];

    if (!shop?.discord_guild_id || !targetUser?.discord_id) return;

    const { revokeDiscordRole } = require('../utils/discordRoles');
    const result = await revokeDiscordRole(shop.discord_guild_id, targetUser.discord_id, grant.discord_role_id);

    await client.query(
      `UPDATE discord_role_grants SET status = $1, error_message = $2 WHERE id = $3`,
      [result.success ? 'revoked' : 'failed', result.success ? null : result.error, grant.id]
    );
  } catch (err) {
    console.error('[PostPurchase] Erreur retrait rôle Discord:', err.message);
  }
}

module.exports = { runPostPurchaseActions, revokeSubscriptionDiscordRole };

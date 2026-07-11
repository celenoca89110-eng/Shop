const cron = require('node-cron');
const db = require('../config/db');
const { sendDiscordWebhook, EVENTS } = require('../utils/discordWebhook');
const { revokeSubscriptionDiscordRole } = require('../services/postPurchase');

/**
 * Toutes les heures : passe en 'expired' les abonnements actifs dont la date
 * de fin est dépassée, et met à jour le statut de la commande liée.
 *
 * NOTE : ceci ne déclenche pas de prélèvement automatique même si auto_renew
 * est activé — voir le commentaire dans subscription.controller.js.
 */
function startSubscriptionExpiryJob() {
  const task = async () => {
    try {
      const { rows } = await db.query(
        `UPDATE subscriptions
         SET status = 'expired'
         WHERE status = 'active' AND ends_at < now()
         RETURNING *`
      );

      for (const sub of rows) {
        if (sub.order_id) {
          await db.query(
            `UPDATE orders SET status = 'subscription_expired' WHERE id = $1 AND status != 'cancelled'`,
            [sub.order_id]
          );
        }

        // Retrait automatique du rôle Discord lié à cet abonnement
        await revokeSubscriptionDiscordRole(db, sub);

        // Notification Discord "abonnement expiré"
        try {
          const shopResult = await db.query('SELECT * FROM shops WHERE id = $1', [sub.shop_id]);
          const userResult = await db.query('SELECT discord_id FROM users WHERE id = $1', [sub.user_id]);
          const shop = shopResult.rows[0];
          if (shop?.discord_webhook_url) {
            await sendDiscordWebhook(
              shop.discord_webhook_url,
              EVENTS.subscriptionExpired({ ...sub, discord_id: userResult.rows[0]?.discord_id }, shop.name)
            );
          }
        } catch (err) {
          console.error('[CecaShop] Erreur notification expiration:', err.message);
        }
      }

      if (rows.length > 0) {
        console.log(`[CecaShop] ${rows.length} abonnement(s) expiré(s) traité(s).`);
      }
    } catch (err) {
      console.error('[CecaShop] Erreur lors de la vérification des abonnements expirés:', err);
    }
  };

  // Toutes les heures, à la minute 0
  cron.schedule('0 * * * *', task);

  // Exécution immédiate au démarrage pour rattraper les abonnements déjà expirés
  task();
}

module.exports = { startSubscriptionExpiryJob };

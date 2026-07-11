const cron = require('node-cron');
const db = require('../config/db');

/**
 * Toutes les heures : passe en 'expired' les abonnements actifs dont la date
 * de fin est dépassée, et met à jour le statut de la commande liée.
 *
 * NOTE : ceci ne déclenche pas de prélèvement automatique même si auto_renew
 * est activé — voir le commentaire dans subscription.controller.js.
 * En Phase 4, ce job sera aussi responsable de déclencher le retrait du rôle
 * Discord lié à l'abonnement expiré.
 */
function startSubscriptionExpiryJob() {
  const task = async () => {
    try {
      const { rows } = await db.query(
        `UPDATE subscriptions
         SET status = 'expired'
         WHERE status = 'active' AND ends_at < now()
         RETURNING id, order_id`
      );

      for (const sub of rows) {
        if (sub.order_id) {
          await db.query(
            `UPDATE orders SET status = 'subscription_expired' WHERE id = $1 AND status != 'cancelled'`,
            [sub.order_id]
          );
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

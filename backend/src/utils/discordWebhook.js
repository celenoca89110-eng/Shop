/**
 * Envoie un message (embed) sur le webhook Discord d'une boutique.
 * N'échoue jamais bruyamment : une erreur Discord ne doit jamais faire
 * échouer une commande ou un paiement.
 */
async function sendDiscordWebhook(webhookUrl, { title, description, color = 0x7c3aed, fields = [] }) {
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            color,
            fields,
            timestamp: new Date().toISOString(),
            footer: { text: 'CecaShop' },
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`[Discord Webhook] Échec (${res.status}) pour ${webhookUrl}`);
    }
  } catch (err) {
    console.error('[Discord Webhook] Erreur réseau:', err.message);
  }
}

const EVENTS = {
  newOrder: (order, shopName) => ({
    title: '🛒 Nouvelle commande !',
    description: `Une nouvelle commande vient d'être passée sur **${shopName}**.`,
    color: 0x7c3aed,
    fields: [
      { name: 'Commande', value: `#${order.order_number}`, inline: true },
      { name: 'Montant', value: `${(order.total_cents / 100).toFixed(2)}€`, inline: true },
    ],
  }),
  orderCompleted: (order, shopName) => ({
    title: '✅ Commande terminée',
    description: `La commande #${order.order_number} sur **${shopName}** a été marquée comme terminée.`,
    color: 0x22c55e,
  }),
  subscriptionExpired: (subscription, shopName) => ({
    title: '⏰ Abonnement expiré',
    description: `L'abonnement **${subscription.product_name_snapshot}** de <@${subscription.discord_id || 'utilisateur'}> a expiré sur **${shopName}**.`,
    color: 0x6b7280,
  }),
  refund: (order, shopName) => ({
    title: '💸 Remboursement',
    description: `La commande #${order.order_number} sur **${shopName}** a été remboursée.`,
    color: 0xef4444,
  }),
  newCustomer: (user, shopName) => ({
    title: '👋 Nouveau client',
    description: `**${user.username}** vient de passer sa première commande sur **${shopName}**.`,
    color: 0x3b82f6,
  }),
};

module.exports = { sendDiscordWebhook, EVENTS };

/**
 * Supprime TOUTES les tables et types CecaShop de la base connectée.
 * À utiliser uniquement pour repartir d'une base propre (par ex. si une table
 * `users` incompatible existe déjà d'un précédent déploiement/projet).
 *
 * ⚠️ DESTRUCTIF — supprime définitivement toutes les données.
 *
 * Usage : npm run db:reset -- --yes
 */
require('dotenv').config();
const { pool } = require('../src/config/db');

const DROP_SQL = `
DROP TABLE IF EXISTS discord_role_grants CASCADE;
DROP TABLE IF EXISTS shop_crypto_wallets CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS ticket_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS download_links CASCADE;
DROP TABLE IF EXISTS product_files CASCADE;
DROP TABLE IF EXISTS subscription_renewals CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS product_fields CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS shops CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS crypto_currency CASCADE;
DROP TYPE IF EXISTS ticket_sender_role CASCADE;
DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS subscription_duration_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS promo_discount_type CASCADE;
DROP TYPE IF EXISTS dynamic_field_type CASCADE;
DROP TYPE IF EXISTS stock_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
`;

async function reset() {
  if (!process.argv.includes('--yes')) {
    console.error('⚠️  Ce script supprime TOUTES les tables et données CecaShop de la base connectée.');
    console.error('Si vous êtes sûr, relancez : npm run db:reset -- --yes');
    process.exit(1);
  }

  console.log('Suppression des tables et types CecaShop existants...');
  await pool.query(DROP_SQL);
  console.log('✅ Base nettoyée. Vous pouvez maintenant lancer "npm run migrate".');
  process.exit(0);
}

reset().catch((err) => {
  console.error('❌ Erreur lors de la réinitialisation :', err.message);
  process.exit(1);
});

/**
 * Script de migration CecaShop.
 *
 * Usage :
 *   node scripts/migrate.js              -> applique toutes les phases (1 à 5) dans l'ordre
 *   node scripts/migrate.js --only=phase2 -> applique uniquement la Phase 2
 *
 * C'est ce script qu'appelle `npm run migrate` (utilisé par Render au déploiement).
 * Chaque fichier SQL est idempotent (CREATE TABLE IF NOT EXISTS, colonnes ajoutées
 * avec IF NOT EXISTS, enums protégés par des blocs DO ... EXCEPTION), donc relancer
 * ce script plusieurs fois sur la même base ne casse rien.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const MIGRATIONS = [
  { key: 'phase1', name: 'Phase 1 — Socle (auth, rôles, boutiques)', file: 'schema.sql' },
  { key: 'phase2', name: 'Phase 2 — Produits, commandes, Stripe', file: 'phase2_products_orders.sql' },
  { key: 'phase3', name: 'Phase 3 — Abonnements', file: 'phase3_subscriptions.sql' },
  { key: 'phase4', name: 'Phase 4 — Discord & livraison de fichiers', file: 'phase4_discord_delivery.sql' },
  { key: 'phase5', name: 'Phase 5 — Support, avis, stats, crypto', file: 'phase5_support_reviews_stats.sql' },
];

/**
 * Détecte une table `users` préexistante et incompatible (par ex. avec un id de
 * type integer/serial au lieu de uuid). Cela arrive typiquement si la base a déjà
 * servi à un autre projet, ou si un déploiement précédent a créé des tables avec
 * un schéma différent. Comme nos migrations utilisent `CREATE TABLE IF NOT EXISTS`,
 * une table existante ne serait jamais recréée, et les futures clés étrangères UUID
 * échoueraient avec une erreur cryptique de Postgres. On préfère échouer tôt avec
 * un message clair.
 */
async function checkExistingSchemaCompatibility() {
  const { rows } = await pool.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
  `);

  if (rows.length > 0 && rows[0].data_type !== 'uuid') {
    throw new Error(
      `Une table "users" existe déjà dans cette base avec une colonne "id" de type ` +
      `"${rows[0].data_type}" (CecaShop attend "uuid" partout). ` +
      `Cela arrive si la base a déjà servi à un autre projet/déploiement. ` +
      `Solutions : (1) utilisez une base PostgreSQL neuve pour CecaShop, ou ` +
      `(2) exécutez "npm run db:reset -- --yes" (⚠️ supprime toutes les tables et données CecaShop existantes) ` +
      `puis relancez "npm run migrate".`
    );
  }
}

async function runMigrations(only) {
  await checkExistingSchemaCompatibility();

  const toRun = only ? MIGRATIONS.filter((m) => m.key === only) : MIGRATIONS;

  if (toRun.length === 0) {
    throw new Error(`Aucune migration ne correspond à "--only=${only}". Valeurs valides : ${MIGRATIONS.map((m) => m.key).join(', ')}`);
  }

  for (const migration of toRun) {
    const filePath = path.join(__dirname, '..', 'sql', migration.file);
    const sql = fs.readFileSync(filePath, 'utf8');
    process.stdout.write(`→ ${migration.name}... `);
    await pool.query(sql);
    console.log('OK');
  }

  console.log(`\n✅ ${toRun.length} migration(s) appliquée(s) avec succès.`);
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1] : null;

runMigrations(only)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Échec de la migration :', err.message);
    process.exit(1);
  });

/**
 * Script de seed à lancer une seule fois après la création de la base :
 *   node src/utils/seedFounder.js
 *
 * Crée (si absent) :
 *  - le compte Founder (email/discord_id définis dans .env ou config/founder.js)
 *  - la boutique par défaut "CecaShop" liée au Founder
 *
 * Le mot de passe initial du Founder est généré aléatoirement et affiché
 * une seule fois dans la console — changez-le immédiatement après connexion.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const { FOUNDER_EMAIL, FOUNDER_DISCORD_ID } = require('../config/founder');

async function seed() {
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [FOUNDER_EMAIL]);

  let founderId;

  if (existing.rows.length > 0) {
    founderId = existing.rows[0].id;
    // On s'assure que le rôle reste bien 'founder'
    await db.query(`UPDATE users SET role = 'founder', discord_id = $2 WHERE id = $1`, [
      founderId,
      FOUNDER_DISCORD_ID,
    ]);
    console.log(`[Seed] Compte Founder déjà existant (${FOUNDER_EMAIL}), rôle confirmé.`);
  } else {
    const tempPassword = crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, username, role, discord_id, email_verified)
       VALUES ($1, $2, 'Founder', 'founder', $3, true)
       RETURNING id`,
      [FOUNDER_EMAIL, passwordHash, FOUNDER_DISCORD_ID]
    );
    founderId = rows[0].id;

    console.log('========================================================');
    console.log('[Seed] Compte Founder créé avec succès !');
    console.log(`  Email        : ${FOUNDER_EMAIL}`);
    console.log(`  Mot de passe : ${tempPassword}  (à changer immédiatement)`);
    console.log('========================================================');
  }

  const existingShop = await db.query('SELECT id FROM shops WHERE slug = $1', ['cecashop']);
  if (existingShop.rows.length === 0) {
    await db.query(
      `INSERT INTO shops (owner_id, name, slug, description, is_default, color_primary, color_secondary, theme)
       VALUES ($1, 'CecaShop', 'cecashop', 'Boutique officielle CecaShop', true, '#7c3aed', '#000000', 'default')`,
      [founderId]
    );
    console.log('[Seed] Boutique par défaut "CecaShop" créée.');
  } else {
    console.log('[Seed] Boutique par défaut déjà existante.');
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Erreur:', err);
  process.exit(1);
});

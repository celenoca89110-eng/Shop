const { FOUNDER_EMAIL } = require('../config/founder');

/**
 * Empêche toute modification destructrice (suppression, changement de rôle,
 * bannissement) ciblant le compte Founder, quel que soit l'appelant.
 * À placer sur les routes admin qui modifient un utilisateur par id/email.
 */
async function protectFounderAccount(req, res, next) {
  try {
    const db = require('../config/db');
    const targetId = req.params.userId || req.body.userId;
    if (!targetId) return next();

    const { rows } = await db.query('SELECT email FROM users WHERE id = $1', [targetId]);
    if (rows.length && rows[0].email.toLowerCase() === FOUNDER_EMAIL) {
      return res.status(403).json({
        error: 'Le compte Founder est protégé et ne peut pas être modifié ou supprimé.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { protectFounderAccount };

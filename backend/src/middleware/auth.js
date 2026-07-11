const { verifyAccessToken } = require('../utils/jwt');
const db = require('../config/db');

/**
 * Vérifie le token JWT d'accès envoyé dans le header Authorization: Bearer <token>
 * Attache req.user = { id, email, role }
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }

    // On revérifie que l'utilisateur existe toujours et n'est pas banni
    const { rows } = await db.query(
      'SELECT id, email, username, role, is_banned FROM users WHERE id = $1',
      [payload.sub]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }

    const user = rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: 'Ce compte a été banni.' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware optionnel : n'échoue pas si pas de token, mais attache req.user si présent
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const { rows } = await db.query(
      'SELECT id, email, username, role, is_banned FROM users WHERE id = $1',
      [payload.sub]
    );
    if (rows.length > 0 && !rows[0].is_banned) {
      req.user = rows[0];
    }
  } catch (err) {
    // token invalide -> on ignore, l'utilisateur reste anonyme
  }
  next();
}

module.exports = { requireAuth, optionalAuth };

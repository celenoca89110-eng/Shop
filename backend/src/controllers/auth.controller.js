const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshExpiryDate,
} = require('../utils/jwt');
const { FOUNDER_EMAIL, FOUNDER_DISCORD_ID } = require('../config/founder');

const SALT_ROUNDS = 12;

function determineRole(email) {
  if (email.toLowerCase() === FOUNDER_EMAIL) return 'founder';
  return 'user';
}

async function register(req, res, next) {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, mot de passe et pseudo requis.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const role = determineRole(email);
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, username, role, email_verify_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, username, role, created_at`,
      [email.toLowerCase(), passwordHash, username, role, emailVerifyToken]
    );

    const user = rows[0];

    // TODO Phase suivante : envoyer un vrai email de vérification (SendGrid / Resend / SMTP)
    console.log(`[CecaShop] Email de vérification pour ${user.email}: token=${emailVerifyToken}`);

    return res.status(201).json({
      message: 'Compte créé. Vérifiez votre email pour activer votre compte.',
      user,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const user = rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: 'Ce compte a été banni.', reason: user.ban_reason });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashToken(refreshToken), refreshExpiryDate()]
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Aucun refresh token fourni.' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Refresh token invalide ou expiré.' });
    }

    const tokenHash = hashToken(token);
    const { rows } = await db.query(
      `SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked = false AND expires_at > now()`,
      [payload.sub, tokenHash]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Session invalide, veuillez vous reconnecter.' });
    }

    const { rows: userRows } = await db.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
    if (userRows.length === 0 || userRows[0].is_banned) {
      return res.status(401).json({ error: 'Utilisateur invalide.' });
    }

    const accessToken = signAccessToken(userRows[0]);
    return res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await db.query(
        `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
        [hashToken(token)]
      );
    }
    res.clearCookie('refreshToken');
    return res.json({ message: 'Déconnexion réussie.' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis.' });

    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    // On répond toujours pareil pour ne pas révéler si l'email existe
    if (rows.length === 0) {
      return res.json({ message: 'Si un compte existe, un email a été envoyé.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await db.query(
      `UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3`,
      [resetToken, expires, rows[0].id]
    );

    // TODO Phase suivante : envoyer un vrai email
    console.log(`[CecaShop] Reset password token pour ${email}: ${resetToken}`);

    return res.json({ message: 'Si un compte existe, un email a été envoyé.' });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const { rows } = await db.query(
      `SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expires > now()`,
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token invalide ou expiré.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      `UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2`,
      [passwordHash, rows[0].id]
    );

    return res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.params;
    const { rows } = await db.query('SELECT id FROM users WHERE email_verify_token = $1', [token]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token de vérification invalide.' });
    }
    await db.query(
      `UPDATE users SET email_verified = true, email_verify_token = NULL WHERE id = $1`,
      [rows[0].id]
    );
    return res.json({ message: 'Email vérifié avec succès.' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  me,
};

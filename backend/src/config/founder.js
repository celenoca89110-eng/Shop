// Identité protégée du Founder.
// Le rôle "founder" ne peut jamais être supprimé, rétrogradé ou banni.
// Toute tentative de modification de ce compte par une autre route
// que celle du Founder lui-même doit être bloquée (voir middleware/founderGuard.js).

module.exports = {
  FOUNDER_EMAIL: (process.env.FOUNDER_EMAIL || 'celenoca.ytb@gmail.com').toLowerCase(),
  FOUNDER_DISCORD_ID: process.env.FOUNDER_DISCORD_ID || '1112038418629808148',
};

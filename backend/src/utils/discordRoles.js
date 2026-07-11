/**
 * Attribution et retrait de rôles Discord via l'API REST du bot.
 * Nécessite DISCORD_BOT_TOKEN dans .env, et que le bot soit déjà présent
 * sur le serveur (guild) avec la permission "Gérer les rôles".
 *
 * Ces fonctions ne lancent jamais d'exception : elles retournent
 * { success, error } pour que l'appelant puisse journaliser sans jamais
 * faire échouer le paiement ou la commande sous-jacente.
 */

const DISCORD_API = 'https://discord.com/api/v10';

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function grantDiscordRole(guildId, discordUserId, roleId) {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { success: false, error: 'DISCORD_BOT_TOKEN non configuré.' };
  }
  if (!guildId || !discordUserId || !roleId) {
    return { success: false, error: 'guildId, discordUserId ou roleId manquant.' };
  }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
      method: 'PUT',
      headers: botHeaders(),
    });

    if (res.status === 204) {
      return { success: true };
    }
    const body = await res.text();
    return { success: false, error: `Discord API ${res.status}: ${body}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function revokeDiscordRole(guildId, discordUserId, roleId) {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { success: false, error: 'DISCORD_BOT_TOKEN non configuré.' };
  }
  if (!guildId || !discordUserId || !roleId) {
    return { success: false, error: 'guildId, discordUserId ou roleId manquant.' };
  }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: botHeaders(),
    });

    if (res.status === 204) {
      return { success: true };
    }
    const body = await res.text();
    return { success: false, error: `Discord API ${res.status}: ${body}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { grantDiscordRole, revokeDiscordRole };

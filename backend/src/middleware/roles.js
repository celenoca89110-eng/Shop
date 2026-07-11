/**
 * Hiérarchie des rôles CecaShop :
 * user < shop_owner < admin < founder
 *
 * requireRole('admin') laisse passer 'admin' ET 'founder' (accès total).
 */
const ROLE_LEVELS = {
  user: 0,
  shop_owner: 1,
  admin: 2,
  founder: 3,
};

function requireRole(minRole) {
  const minLevel = ROLE_LEVELS[minRole] ?? 0;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    const userLevel = ROLE_LEVELS[req.user.role] ?? 0;

    if (userLevel < minLevel) {
      return res.status(403).json({ error: "Vous n'avez pas les permissions nécessaires." });
    }

    next();
  };
}

/**
 * Vérifie que l'utilisateur est propriétaire de la boutique ciblée (ou admin/founder).
 * À utiliser après avoir chargé req.shop (voir routes/shop.routes.js).
 */
function requireShopOwnerOrAdmin(req, res, next) {
  if (!req.user || !req.shop) {
    return res.status(400).json({ error: 'Contexte manquant.' });
  }

  const isOwner = req.shop.owner_id === req.user.id;
  const isPrivileged = req.user.role === 'admin' || req.user.role === 'founder';

  if (!isOwner && !isPrivileged) {
    return res.status(403).json({ error: "Vous ne gérez pas cette boutique." });
  }

  next();
}

module.exports = { requireRole, requireShopOwnerOrAdmin, ROLE_LEVELS };

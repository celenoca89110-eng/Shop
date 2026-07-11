# CecaShop — Projet complet (Phases 1 à 5)

Marketplace de produits numériques et gaming, thème violet/noir/blanc, dark mode.
Ce livrable contient l'intégralité des 5 phases : **socle** (auth, rôles, boutiques),
**produits & paiements** (Stripe, codes promo, commandes), **abonnements** (calendrier,
renouvellement), **Discord & livraison de fichiers**, et **support, avis & statistiques**.

## Stack

- **Frontend** : Next.js 14 (App Router) + React 18 + TailwindCSS
- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL
- **Auth** : JWT (access + refresh) + bcrypt

## Contenu de la Phase 1

- ✅ Inscription / connexion / déconnexion
- ✅ Vérification email (token généré, envoi réel à brancher plus tard)
- ✅ Mot de passe oublié / réinitialisation
- ✅ Rôles : `user`, `shop_owner`, `admin`, `founder`
- ✅ Compte **Founder** protégé (email `celenoca.ytb@gmail.com`, Discord ID `1112038418629808148`) — non supprimable, non rétrogradable
- ✅ Création et gestion de boutiques (multi-boutiques), boutique par défaut **CecaShop**
- ✅ Sécurité : Helmet, rate limiting, protection XSS/HPP, requêtes paramétrées (anti SQL injection), cookies httpOnly
- ✅ Design violet/noir/blanc, dark mode, responsive

## Contenu de la Phase 2

- ✅ Produits : création, modification, activation/désactivation, suppression, stock illimité ou limité, catégorie, mise en avant
- ✅ Champs dynamiques par produit (texte court/long, nombre, liste déroulante, case à cocher, obligatoire ou non)
- ✅ Codes promo (pourcentage ou montant fixe, expiration, limite d'utilisation, restriction à certains produits)
- ✅ Commandes avec tous les statuts demandés (pending → paid → in_progress → completed, annulation, abonnements)
- ✅ Paiement Stripe Checkout (produits payants) + validation directe pour les produits gratuits ou remisés à 100%
- ✅ Webhook Stripe sécurisé (signature vérifiée) qui confirme le paiement et décrémente le stock
- ✅ Historique des commandes côté client + gestion des commandes côté vendeur (changement de statut, archivage)
- ✅ Pages boutique/produit publiques avec formulaire de champs dynamiques et saisie de code promo

## Installation locale

### 1. Base de données

```bash
createdb cecashop
cd backend
cp .env.example .env
# Éditez .env : DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
npm install
npm run migrate              # applique les 5 phases d'un coup (recommandé)
# ou individuellement :
npm run db:migrate          # applique sql/schema.sql (Phase 1)
npm run db:migrate:phase2   # applique sql/phase2_products_orders.sql (Phase 2)
npm run db:migrate:phase3   # applique sql/phase3_subscriptions.sql (Phase 3)
npm run db:migrate:phase4   # applique sql/phase4_discord_delivery.sql (Phase 4)
npm run db:migrate:phase5   # applique sql/phase5_support_reviews_stats.sql (Phase 5)
npm run seed:founder        # crée le compte Founder + boutique CecaShop
npm run dev                  # démarre l'API sur http://localhost:4000
```

### Stripe en local

Pour recevoir les webhooks Stripe en développement, utilisez le CLI Stripe :

```bash
stripe login
stripe listen --forward-to localhost:4000/api/stripe/webhook
# Copiez le "whsec_..." affiché dans STRIPE_WEBHOOK_SECRET de votre .env
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev               # démarre le site sur http://localhost:3000
```

## Déploiement sur Render

1. **PostgreSQL** : créez un service "PostgreSQL" sur Render, copiez l'URL interne dans `DATABASE_URL`.
2. **Backend** : nouveau "Web Service" pointant sur `/backend`
   - **Build command** : `npm install`
   - **Start command** : `npm run migrate && npm start`
     (ou déclenchez `npm run migrate` une fois via le Shell Render après le premier déploiement,
     puis laissez `npm start` comme Start command — au choix selon votre préférence)
   - Variables d'env : toutes celles de `.env.example` (avec vrais secrets Stripe en mode live/test)
   - Après le premier déploiement, lancez une fois via le Shell Render :
     `npm run migrate && npm run seed:founder`
   - Dans le dashboard Stripe, créez un endpoint webhook pointant vers
     `https://<votre-backend>.onrender.com/api/stripe/webhook` (événement `checkout.session.completed`)
     et copiez le secret signé dans `STRIPE_WEBHOOK_SECRET`.
   - Ajoutez `DISCORD_BOT_TOKEN` (créé sur https://discord.com/developers/applications, bot invité sur
     chaque serveur Discord des boutiques avec la permission "Gérer les rôles").
3. **Frontend** : nouveau "Web Service" (ou "Static Site" si export statique) pointant sur `/frontend`
   - Build command : `npm install && npm run build`
   - Start command : `npm start`
   - Variable d'env : `NEXT_PUBLIC_API_URL=https://<votre-backend>.onrender.com/api`

⚠️ Pensez à changer `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` pour des valeurs fortes et uniques en production.

## Roadmap complète

- **Phase 1** — Socle : auth, rôles, multi-boutiques ✅
- **Phase 2** — Produits, champs dynamiques, codes promo, commandes, Stripe ✅
- **Phase 3** — Abonnements + calendrier (filtres, export CSV) ✅
- **Phase 4** — Discord (webhooks, rôles automatiques), livraison de fichiers sécurisée ✅
- **Phase 5 (ce livrable)** — Tickets support, avis produits, dashboard statistiques, architecture crypto ✅

**Le projet des 5 phases est maintenant complet et fonctionnel de bout en bout.**

## Structure du projet

```
cecashop/
├── backend/
│   ├── src/
│   │   ├── config/       # DB, Stripe, upload (multer), config Founder
│   │   ├── middleware/   # auth, rôles, protection Founder
│   │   ├── controllers/  # auth, boutiques, produits, promo, commandes, abonnements,
│   │   │                 # fichiers, tickets, avis, stats, crypto
│   │   ├── services/     # postPurchase.js (webhooks Discord, rôles, liens de téléchargement)
│   │   ├── routes/       # routes Express
│   │   ├── cron/         # expiration automatique des abonnements
│   │   ├── utils/        # JWT, seed, durée d'abonnement, webhook Discord, rôles Discord
│   │   ├── app.js
│   │   └── server.js
│   ├── uploads/          # fichiers livrables uploadés (créé automatiquement, non versionné)
│   ├── sql/
│   │   ├── schema.sql                          # Phase 1
│   │   ├── phase2_products_orders.sql          # Phase 2
│   │   ├── phase3_subscriptions.sql            # Phase 3
│   │   ├── phase4_discord_delivery.sql         # Phase 4
│   │   └── phase5_support_reviews_stats.sql    # Phase 5
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── shop/[slug]/                        # catalogue + fiche produit (avis, paiement crypto)
    │   ├── checkout/success|cancel/             # retour Stripe
    │   ├── orders/                              # historique client + téléchargements
    │   ├── subscriptions/                       # mes abonnements (client)
    │   ├── support/                             # tickets support (client)
    │   ├── reviews/                             # laisser un avis (client)
    │   ├── profile/                             # liaison du compte Discord
    │   └── dashboard/shop/[shopId]/
    │       ├── products/       # gestion produits + champs dynamiques + abonnement + fichiers + rôle Discord
    │       ├── promo-codes/    # gestion codes promo
    │       ├── orders/         # gestion commandes vendeur + remboursement + confirmation crypto
    │       ├── calendar/       # calendrier des abonnements (filtres + export CSV)
    │       ├── settings/       # réglages boutique (webhook + Guild ID Discord, personnalisation)
    │       ├── tickets/        # gestion tickets support vendeur
    │       ├── reviews/        # réponse aux avis
    │       ├── stats/          # dashboard statistiques (graphiques)
    │       └── crypto/         # adresses de réception crypto
    ├── components/
    ├── context/           # AuthContext
    ├── lib/api.js         # client Axios + refresh auto
    └── .env.example
```

## Contenu de la Phase 3

- ✅ Produits configurables en abonnement (hebdomadaire, mensuel, annuel, durée personnalisée)
- ✅ Suivi complet du cycle de vie : actif, expiré, annulé + historique des renouvellements
- ✅ Renouvellement à la demande (paiement unique via Stripe, ou gratuit si le produit l'est)
- ✅ Annulation : désactivation du renouvellement automatique OU résiliation immédiate
- ✅ Tâche planifiée (cron horaire) qui expire automatiquement les abonnements et met à jour la commande liée
- ✅ Calendrier vendeur avec filtres (statut, recherche), vue jour/semaine/mois, et export CSV
- ✅ Page "Mes abonnements" côté client avec temps restant, renouvellement et résiliation

## Notes importantes Phase 2

- Le paiement Stripe utilise **Checkout Sessions** en mode `payment` (paiement unique).
- Les réductions des codes promo sont répercutées directement sur les montants envoyés à Stripe (Stripe Checkout ne gère pas nativement les remises en montant fixe arbitraire sans coupon pré-créé côté dashboard).
- La notification Discord "Nouvelle commande" est prévue mais pas encore branchée (Phase 4) — un commentaire `TODO` marque l'endroit exact dans `order.controller.js`.

## Contenu de la Phase 4

- ✅ Webhook Discord par boutique : nouvelle commande, commande terminée, remboursement, nouveau client, abonnement expiré
- ✅ Attribution automatique d'un rôle Discord à l'achat (produit standard ou abonnement), retrait automatique à l'expiration ou à la résiliation immédiate
- ✅ Liaison du compte Discord par l'utilisateur (page Profil) et configuration du webhook + Guild ID par boutique (page Réglages)
- ✅ Upload de fichiers livrables par produit (ZIP, EXE, TXT, PDF, images, scripts FiveM, configs…), 100 Mo max, stockage local sur disque
- ✅ Téléchargement sécurisé : lien à token unique, expirant (7 jours), limité en nombre d'utilisations (5 par défaut)
- ✅ Remboursement réel via l'API Stripe Refunds, déclenché depuis le dashboard vendeur
- ✅ Historique des attributions/retraits de rôle Discord tracé en base (`discord_role_grants`) pour audit

## Notes importantes Phase 3

- Le renouvellement est un **paiement à la demande**, pas un prélèvement automatique récurrent. Un vrai prélèvement automatique (auto-renew réel sans action du client) nécessiterait l'API Stripe Subscriptions/Billing avec enregistrement d'un moyen de paiement — actuellement hors-scope, mais l'architecture (colonne `auto_renew`) est prête pour cette évolution.
- Le cron d'expiration tourne dans le même processus que l'API (`node-cron`). Sur Render, cela fonctionne tant qu'au moins une instance du service reste active ; pour une charge plus importante, prévoir un "Cron Job" Render séparé qui appelle un futur endpoint dédié.

## Contenu de la Phase 5

- ✅ Tickets support : ouverture, fil de messages client/vendeur, statuts (ouvert, répondu, fermé, archivé), réouverture automatique si le client répond après une réponse vendeur
- ✅ Avis produits : notation 1 à 5 étoiles + commentaire, un seul avis par article réellement acheté, moyenne automatique par produit, réponse du vendeur affichée publiquement
- ✅ Dashboard statistiques vendeur : chiffre d'affaires total et du mois, nombre de clients, abonnements actifs, graphique des revenus (6 derniers mois), meilleurs produits, commandes récentes
- ✅ Architecture paiement crypto : adresses de réception configurables par boutique (BTC, ETH, LTC, SOL), le client voit l'adresse et le montant à envoyer, confirmation manuelle du vendeur depuis le dashboard commandes

## Notes importantes Phase 4

- L'attribution de rôle Discord nécessite un bot Discord (`DISCORD_BOT_TOKEN`) déjà présent sur le serveur de la boutique, avec la permission "Gérer les rôles", et un rôle de bot positionné **au-dessus** des rôles qu'il doit attribuer/retirer — sinon l'API Discord renverra une erreur 403 (journalisée dans `discord_role_grants`, sans jamais faire échouer la commande).
- Les fichiers sont actuellement stockés sur le disque local du serveur (`backend/uploads/`), comme prévu initialement. Sur Render, le disque n'est pas persistant entre déploiements par défaut — pensez à activer un "Persistent Disk" Render sur le service backend, ou migrer vers S3 plus tard (l'architecture par `storage_path` relatif permet ce changement sans casser les liens existants).
- Le webhook Stripe ne doit jamais échouer bruyamment à cause de Discord : toutes les actions Discord (webhook + rôle) sont encapsulées et journalisées sans jamais annuler la commande déjà payée.

## Notes importantes Phase 5

- **Crypto = architecture, pas de vérification blockchain automatique.** Comme précisé dans le cahier des charges ("prévoir architecture"), CecaShop ne surveille pas la blockchain : le vendeur doit vérifier manuellement la réception des fonds avant de cliquer sur "Confirmer paiement crypto". Pour une vérification automatique réelle, il faudrait intégrer un service tiers (BTCPay Server, Coinbase Commerce, ou une API d'explorateur de blockchain par devise) — l'architecture actuelle (adresse + montant + statut `pending`/`paid` par commande) permet de brancher ça sans tout refaire.
- Les avis ne peuvent être laissés que sur un article dont la commande est passée par un statut payé (`paid`, `in_progress`, `completed`, ou statuts d'abonnement) — impossible de noter un produit jamais acheté.

## Système de migration

Toutes les migrations SQL passent désormais par un script Node unique : `backend/scripts/migrate.js`.

- `npm run migrate` — applique les 5 phases dans l'ordre en une seule commande (c'est la commande à utiliser dans Render).
- `npm run db:migrate` / `db:migrate:phase2` / `...phase3` / `...phase4` / `...phase5` — appliquent une seule phase (utile en local pour déboguer).
- Chaque fichier SQL est idempotent (`CREATE TABLE IF NOT EXISTS`, colonnes ajoutées avec `IF NOT EXISTS`, enums protégés) : relancer `npm run migrate` plusieurs fois, y compris à chaque redeploy Render, ne casse rien et ne duplique rien.
- `npm run db:reset -- --yes` — ⚠️ supprime **toutes** les tables et données CecaShop de la base connectée, pour repartir d'une base propre. Ne jamais lancer sans avoir vérifié qu'il s'agit bien de la bonne base.

## Dépannage

### `npm error Missing script: "migrate"`
Corrigé : le script `migrate` existe maintenant dans `backend/package.json` et chaîne les 5 migrations. Si l'erreur persiste, vérifiez que la **Build/Start Command** sur Render pointe bien vers le dossier `backend` (Root Directory du service).

### `foreign key constraint cannot be implemented — Key columns "owner_id" and "id" are of incompatible types: uuid and integer`
Tout le schéma CecaShop utilise des UUID partout (`users.id`, `shops.id`, etc.), donc cette erreur ne vient pas d'une incohérence dans notre code. Elle apparaît quand la base PostgreSQL cible contient déjà une table `users` créée par un **autre projet ou un déploiement précédent**, avec un `id` de type `integer`/`serial` — et comme nos migrations utilisent `CREATE TABLE IF NOT EXISTS`, cette table existante n'est jamais recréée.

Le script de migration détecte maintenant ce cas automatiquement et affiche un message clair au lieu de l'erreur Postgres brute. Deux solutions :
1. **Utiliser une base PostgreSQL neuve** dédiée à CecaShop (recommandé sur Render : créez un nouveau service PostgreSQL plutôt que de réutiliser une base existante).
2. **Repartir de zéro sur la base actuelle** si elle ne contient aucune donnée importante : `npm run db:reset -- --yes` puis `npm run migrate`.


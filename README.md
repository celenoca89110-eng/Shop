# CecaShop — Phase 1 + Phase 2

Marketplace de produits numériques et gaming, thème violet/noir/blanc, dark mode.
Ce livrable contient la **Phase 1** (socle) et la **Phase 2** (produits, commandes, Stripe)
d'un projet en 5 phases (voir roadmap plus bas).

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
npm run db:migrate          # applique sql/schema.sql (Phase 1)
npm run db:migrate:phase2   # applique sql/phase2_products_orders.sql (Phase 2)
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
   - Build command : `npm install`
   - Start command : `npm start`
   - Variables d'env : toutes celles de `.env.example` (avec vrais secrets Stripe en mode live/test)
   - Après le premier déploiement, lancez une fois via le Shell Render :
     `npm run db:migrate && npm run db:migrate:phase2 && npm run seed:founder`
   - Dans le dashboard Stripe, créez un endpoint webhook pointant vers
     `https://<votre-backend>.onrender.com/api/stripe/webhook` (événement `checkout.session.completed`)
     et copiez le secret signé dans `STRIPE_WEBHOOK_SECRET`.
3. **Frontend** : nouveau "Web Service" (ou "Static Site" si export statique) pointant sur `/frontend`
   - Build command : `npm install && npm run build`
   - Start command : `npm start`
   - Variable d'env : `NEXT_PUBLIC_API_URL=https://<votre-backend>.onrender.com/api`

⚠️ Pensez à changer `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` pour des valeurs fortes et uniques en production.

## Roadmap complète

- **Phase 1** — Socle : auth, rôles, multi-boutiques ✅
- **Phase 2 (ce livrable)** — Produits, champs dynamiques, codes promo, commandes, Stripe ✅
- **Phase 3** — Abonnements + calendrier (filtres, export CSV)
- **Phase 4** — Discord (webhooks, rôles automatiques), livraison de fichiers sécurisée
- **Phase 5** — Tickets support, avis produits, dashboard vendeur avec statistiques, architecture crypto

## Structure du projet

```
cecashop/
├── backend/
│   ├── src/
│   │   ├── config/       # DB, Stripe, config Founder
│   │   ├── middleware/   # auth, rôles, protection Founder
│   │   ├── controllers/  # auth, boutiques, produits, promo, commandes
│   │   ├── routes/       # routes Express
│   │   ├── utils/        # JWT, seed
│   │   ├── app.js
│   │   └── server.js
│   ├── sql/
│   │   ├── schema.sql                    # Phase 1
│   │   └── phase2_products_orders.sql    # Phase 2
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── shop/[slug]/                        # catalogue + fiche produit
    │   ├── checkout/success|cancel/             # retour Stripe
    │   ├── orders/                              # historique client
    │   └── dashboard/shop/[shopId]/
    │       ├── products/       # gestion produits + champs dynamiques
    │       ├── promo-codes/    # gestion codes promo
    │       └── orders/         # gestion commandes vendeur
    ├── components/
    ├── context/           # AuthContext
    ├── lib/api.js         # client Axios + refresh auto
    └── .env.example
```

## Notes importantes Phase 2

- Le paiement Stripe utilise **Checkout Sessions** en mode `payment` (paiement unique). La gestion des abonnements récurrents Stripe sera traitée en Phase 3 avec la logique métier d'abonnement.
- Les réductions des codes promo sont répercutées directement sur les montants envoyés à Stripe (Stripe Checkout ne gère pas nativement les remises en montant fixe arbitraire sans coupon pré-créé côté dashboard).
- La notification Discord "Nouvelle commande" est prévue mais pas encore branchée (Phase 4) — un commentaire `TODO` marque l'endroit exact dans `order.controller.js`.


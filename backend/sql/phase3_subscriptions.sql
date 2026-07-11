-- ==========================================================
-- CecaShop — Schéma PostgreSQL — Phase 3
-- Produits abonnements, instances d'abonnement, calendrier
-- À exécuter après schema.sql et phase2_products_orders.sql
-- ==========================================================

-- ----------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE subscription_duration_type AS ENUM ('weekly', 'monthly', 'yearly', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------
-- Extension de la table products : configuration d'abonnement
-- ----------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_duration_type subscription_duration_type;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_duration_days INTEGER; -- utilisé si 'custom'
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_auto_renew_default BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------
-- TABLE: subscriptions (instances d'abonnement d'un client)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id         UUID REFERENCES order_items(id) ON DELETE SET NULL,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(200) NOT NULL,
    status                subscription_status NOT NULL DEFAULT 'active',
    auto_renew            BOOLEAN NOT NULL DEFAULT false,
    starts_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at               TIMESTAMPTZ NOT NULL,
    renewed_count         INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop ON subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ends_at ON subscriptions(ends_at);

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------
-- TABLE: subscription_renewals (historique des renouvellements)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_renewals (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
    previous_end_at   TIMESTAMPTZ NOT NULL,
    new_end_at        TIMESTAMPTZ NOT NULL,
    renewed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_renewals_sub ON subscription_renewals(subscription_id);

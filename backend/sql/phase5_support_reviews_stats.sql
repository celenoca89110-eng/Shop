-- ==========================================================
-- CecaShop — Schéma PostgreSQL — Phase 5
-- Tickets support, avis produits, statistiques, architecture crypto
-- À exécuter après phase4_discord_delivery.sql
-- ==========================================================

-- ----------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('open', 'answered', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE ticket_sender_role AS ENUM ('user', 'seller');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE crypto_currency AS ENUM ('BTC', 'ETH', 'LTC', 'SOL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------
-- TABLE: support_tickets
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
    subject     VARCHAR(200) NOT NULL,
    status      ticket_status NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_shop ON support_tickets(shop_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------
-- TABLE: ticket_messages
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role     ticket_sender_role NOT NULL,
    message         TEXT NOT NULL,
    attachment_path TEXT,
    attachment_name VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

-- ----------------------------------------------------------
-- TABLE: product_reviews
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    seller_reply    TEXT,
    seller_reply_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_item_id) -- un seul avis par article acheté
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);

DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON product_reviews;
CREATE TRIGGER trg_product_reviews_updated_at BEFORE UPDATE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------
-- TABLE: shop_crypto_wallets (architecture crypto — adresses de réception)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_crypto_wallets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    currency    crypto_currency NOT NULL,
    address     VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, currency)
);

-- ----------------------------------------------------------
-- Extension de la table orders : paiement crypto (confirmation manuelle)
-- ----------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'stripe';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crypto_currency crypto_currency;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crypto_address VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crypto_tx_hash VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crypto_confirmed_at TIMESTAMPTZ;

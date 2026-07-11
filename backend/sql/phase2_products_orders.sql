-- ==========================================================
-- CecaShop — Schéma PostgreSQL — Phase 2
-- Produits, champs dynamiques, codes promo, commandes, Stripe
-- À exécuter après schema.sql
-- ==========================================================

-- ----------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE stock_type AS ENUM ('unlimited', 'limited');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE dynamic_field_type AS ENUM ('text_short', 'text_long', 'number', 'select', 'checkbox');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE promo_discount_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending', 'paid', 'in_progress', 'completed', 'cancelled',
        'subscription_active', 'subscription_cancelled', 'subscription_expired'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------
-- TABLE: products
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL,
    description     TEXT,
    price_cents     INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    is_free         BOOLEAN NOT NULL DEFAULT false,
    stock_type      stock_type NOT NULL DEFAULT 'unlimited',
    stock_quantity  INTEGER,                 -- NULL si illimité
    category        VARCHAR(100),
    tags            JSONB DEFAULT '[]'::jsonb,
    is_featured     BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    main_image_url  TEXT,
    gallery         JSONB DEFAULT '[]'::jsonb,  -- tableau d'URLs
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------
-- TABLE: product_fields (champs dynamiques par produit)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_fields (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label           VARCHAR(150) NOT NULL,      -- ex: "Pseudo Discord", "UID FiveM"
    field_type      dynamic_field_type NOT NULL DEFAULT 'text_short',
    is_required     BOOLEAN NOT NULL DEFAULT true,
    options         JSONB DEFAULT '[]'::jsonb,  -- pour field_type = 'select'
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_fields_product ON product_fields(product_id);

-- ----------------------------------------------------------
-- TABLE: promo_codes
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id                 UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    code                    VARCHAR(50) NOT NULL,
    discount_type           promo_discount_type NOT NULL,
    discount_value          NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    expires_at              TIMESTAMPTZ,
    max_uses                INTEGER,             -- NULL = illimité
    used_count              INTEGER NOT NULL DEFAULT 0,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    applicable_product_ids  JSONB DEFAULT '[]'::jsonb, -- [] = tous les produits de la boutique
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_shop ON promo_codes(shop_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- ----------------------------------------------------------
-- TABLE: orders (commandes)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number          SERIAL,                 -- numéro court lisible (#123)
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    status                order_status NOT NULL DEFAULT 'pending',
    subtotal_cents        INTEGER NOT NULL DEFAULT 0,
    discount_cents        INTEGER NOT NULL DEFAULT 0,
    total_cents           INTEGER NOT NULL DEFAULT 0,
    promo_code_id         UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
    stripe_session_id     VARCHAR(255),
    stripe_payment_intent VARCHAR(255),
    is_archived           BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------
-- TABLE: order_items (lignes de commande)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(200) NOT NULL, -- conserve le nom même si le produit change/disparaît
    unit_price_cents      INTEGER NOT NULL DEFAULT 0,
    quantity              INTEGER NOT NULL DEFAULT 1,
    field_responses       JSONB DEFAULT '{}'::jsonb, -- réponses aux champs dynamiques {field_id: valeur}
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ----------------------------------------------------------
-- Note : la table "shops" possède déjà payment_settings JSONB
-- (Phase 1), utilisée pour stocker la clé Stripe Connect future
-- de chaque boutique si besoin d'un modèle multi-vendeur avancé.
-- ----------------------------------------------------------

-- ==========================================================
-- CecaShop — Schéma PostgreSQL — Phase 4
-- Discord (webhooks, rôles automatiques) + livraison de fichiers
-- À exécuter après phase3_subscriptions.sql
-- ==========================================================

-- ----------------------------------------------------------
-- Extension de la table shops : ID du serveur Discord
-- (le webhook discord_webhook_url existe déjà depuis la Phase 1)
-- ----------------------------------------------------------
ALTER TABLE shops ADD COLUMN IF NOT EXISTS discord_guild_id VARCHAR(50);

-- ----------------------------------------------------------
-- Extension de la table products : rôle Discord à attribuer à l'achat
-- ----------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS discord_role_id VARCHAR(50);

-- ----------------------------------------------------------
-- TABLE: product_files (fichiers livrables attachés à un produit)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    storage_path    TEXT NOT NULL,       -- chemin relatif sur le disque (backend/uploads/...)
    mime_type       VARCHAR(150),
    size_bytes      INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_files_product ON product_files(product_id);

-- ----------------------------------------------------------
-- TABLE: download_links (liens de téléchargement sécurisés, expirants)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS download_links (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id     UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_file_id   UUID NOT NULL REFERENCES product_files(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token             VARCHAR(64) UNIQUE NOT NULL,
    max_downloads     INTEGER NOT NULL DEFAULT 5,
    download_count    INTEGER NOT NULL DEFAULT 0,
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_links_token ON download_links(token);
CREATE INDEX IF NOT EXISTS idx_download_links_order_item ON download_links(order_item_id);

-- ----------------------------------------------------------
-- TABLE: discord_role_grants (traçabilité des attributions/retraits de rôle)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS discord_role_grants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
    subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
    discord_role_id   VARCHAR(50) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'granted', -- granted | revoked | failed
    error_message     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discord_grants_user ON discord_role_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_grants_subscription ON discord_role_grants(subscription_id);

DROP TRIGGER IF EXISTS trg_discord_grants_updated_at ON discord_role_grants;
CREATE TRIGGER trg_discord_grants_updated_at BEFORE UPDATE ON discord_role_grants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

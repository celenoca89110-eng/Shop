-- ==========================================================
-- CecaShop — Schéma PostgreSQL — Phase 1 (socle)
-- Users, Rôles, Boutiques
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- pour gen_random_uuid()

-- ----------------------------------------------------------
-- ENUM: rôles utilisateurs
-- ----------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'shop_owner', 'admin', 'founder');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------
-- TABLE: users
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             VARCHAR(255) UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    username          VARCHAR(100) NOT NULL,
    role              user_role NOT NULL DEFAULT 'user',
    discord_id        VARCHAR(50),
    email_verified    BOOLEAN NOT NULL DEFAULT false,
    email_verify_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMPTZ,
    is_banned         BOOLEAN NOT NULL DEFAULT false,
    ban_reason        TEXT,
    avatar_url        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------
-- Le compte Founder est unique et protégé au niveau applicatif
-- (email + discord_id vérifiés dans le backend, jamais supprimable)
-- ----------------------------------------------------------

-- ----------------------------------------------------------
-- TABLE: shops (boutiques)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(150) NOT NULL,
    slug              VARCHAR(150) UNIQUE NOT NULL,
    description       TEXT,
    logo_url          TEXT,
    banner_url        TEXT,
    color_primary     VARCHAR(20) DEFAULT '#7c3aed', -- violet par défaut
    color_secondary   VARCHAR(20) DEFAULT '#000000',
    theme             VARCHAR(50) DEFAULT 'default',
    discord_webhook_url TEXT,
    payment_settings  JSONB DEFAULT '{}'::jsonb,
    delivery_settings JSONB DEFAULT '{}'::jsonb,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    is_default        BOOLEAN NOT NULL DEFAULT false, -- true pour "CecaShop"
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);

-- ----------------------------------------------------------
-- TABLE: refresh_tokens (sessions JWT)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(255) NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ----------------------------------------------------------
-- TABLE: admin_logs (traçabilité)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    action        VARCHAR(100) NOT NULL,
    target_type   VARCHAR(50),
    target_id     UUID,
    details       JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- Trigger générique: updated_at auto
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shops_updated_at ON shops;
CREATE TRIGGER trg_shops_updated_at BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------
-- Seed: boutique par défaut "CecaShop"
-- (owner_id sera mis à jour une fois le compte Founder créé
--  via le script seed.js — voir backend/src/utils/seedFounder.js)
-- ----------------------------------------------------------

-- ============================================================
-- 001_auth.sql — Revflow Auth Schema
-- Run this in your Supabase SQL editor or via supabase db push
-- ============================================================

-- ── organisations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organisations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  country          CHAR(2)     NOT NULL DEFAULT 'NG',
  default_currency CHAR(3)     NOT NULL DEFAULT 'NGN',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Deny all direct access (all server ops use service role which bypasses RLS)
-- No policies = default deny for anon/authenticated roles

-- ── users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE NOT NULL,
  full_name   TEXT        NOT NULL DEFAULT '',
  avatar_url  TEXT,
  role        TEXT        CHECK (role IN ('admin', 'planner', 'finance_exec', 'compliance')),
  org_id      UUID        REFERENCES organisations(id) ON DELETE SET NULL,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- No policies = default deny for anon/authenticated roles

-- ── timeline_settings (seed table for Step 12 Chase Engine) ───────────────
CREATE TABLE IF NOT EXISTS timeline_settings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        REFERENCES organisations(id) ON DELETE CASCADE,
  setting_key   TEXT        NOT NULL,
  setting_value JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, setting_key)
);

ALTER TABLE timeline_settings ENABLE ROW LEVEL SECURITY;

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email   ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_org_id  ON users (org_id);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users (role);

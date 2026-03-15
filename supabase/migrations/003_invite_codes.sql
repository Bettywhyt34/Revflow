-- ============================================================
-- 003_invite_codes.sql — Invite codes for org self-signup
-- Paste into Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  code        TEXT        UNIQUE NOT NULL,
  created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invite_codes_org_id ON invite_codes (org_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code   ON invite_codes (code);

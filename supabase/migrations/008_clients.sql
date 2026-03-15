-- ============================================================
-- 008_clients.sql — Clients module
-- Paste into Supabase SQL Editor.
-- ============================================================

-- ── 1. Clients table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID         NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_name      TEXT         NOT NULL,
  contact_person   TEXT,
  email            TEXT,
  cc_emails        TEXT[]       NOT NULL DEFAULT '{}',
  phone            TEXT,
  address          TEXT,
  payment_terms    TEXT         NOT NULL DEFAULT 'Net 30',
  default_currency TEXT         NOT NULL DEFAULT 'NGN',
  notes            TEXT,
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients (org_id);

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. Link campaigns → clients ─────────────────────────────────────────────
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns (client_id);

-- ── 3. CC emails on documents ───────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cc_emails TEXT[] NOT NULL DEFAULT '{}';

-- ── org_settings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_settings (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID         NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,
  org_name             TEXT,
  logo_url             TEXT,
  primary_color        TEXT         NOT NULL DEFAULT '#0D9488',
  secondary_color      TEXT         NOT NULL DEFAULT '#065F59',
  default_currency     TEXT         NOT NULL DEFAULT 'NGN',
  vat_number           TEXT,
  rc_number            TEXT,
  address              TEXT,
  invoice_prefix       TEXT         NOT NULL DEFAULT 'INV',
  payment_terms        TEXT         NOT NULL DEFAULT 'Net 30',
  agency_fee_pct       NUMERIC(5,2) NOT NULL DEFAULT 10,
  bank_name            TEXT,
  bank_account_name    TEXT,
  bank_account_number  TEXT,
  sort_code            TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Email notifications preference on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;

-- Auto-update updated_at
CREATE TRIGGER set_org_settings_updated_at
  BEFORE UPDATE ON org_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

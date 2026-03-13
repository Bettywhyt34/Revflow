-- ============================================================
-- 002_schema.sql — Revflow Full Schema
-- Paste into Supabase SQL Editor. All DDL uses IF NOT EXISTS.
-- RLS enabled on all tables (default deny for anon/authenticated;
-- service role bypasses RLS automatically).
-- ============================================================

-- ── 1. Patch users table ───────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Seed default org (required for admin user FK)
INSERT INTO organisations (id, name, country, default_currency)
VALUES ('00000000-0000-0000-0000-000000000001', 'QVT Media', 'NG', 'NGN')
ON CONFLICT (id) DO NOTHING;

-- Seed admin user
-- Email: admin@revflow.local  |  Password: Admin1234!
INSERT INTO users (email, full_name, role, org_id, password_hash)
VALUES (
  'admin@revflow.local',
  'Revflow Admin',
  'admin',
  '00000000-0000-0000-0000-000000000001',
  '$2b$12$1qRkfRGcBk8US4lsMNDJI.2sVkgHn18cVJAvLpzgEo8XKovAxvbY.'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  org_id = EXCLUDED.org_id;

-- Seed default timeline_settings for the org
INSERT INTO timeline_settings (org_id, setting_key, setting_value)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'proforma_validity_days', '{"value": 30}'),
  ('00000000-0000-0000-0000-000000000001', 'payment_due_days',        '{"value": 30}'),
  ('00000000-0000-0000-0000-000000000001', 'chase_intervals_days',    '{"intervals": [7, 14, 21]}'),
  ('00000000-0000-0000-0000-000000000001', 'overdue_escalation_days', '{"value": 60}')
ON CONFLICT (org_id, setting_key) DO NOTHING;


-- ── 2. campaigns ───────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS campaigns_tracker_seq START 1;

CREATE TABLE IF NOT EXISTS campaigns (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tracker_id              TEXT        UNIQUE NOT NULL,
  title                   TEXT        NOT NULL,
  advertiser              TEXT        NOT NULL,
  brand                   TEXT        NOT NULL DEFAULT '',
  agency_name             TEXT,
  agency_fee_pct          NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  campaign_type           TEXT        NOT NULL CHECK (campaign_type IN ('direct','agency','programmatic')),
  status                  TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','ended','cancelled')),
  planned_contract_value  NUMERIC(15,2),
  currency                CHAR(3)     NOT NULL DEFAULT 'NGN',
  start_date              DATE,
  end_date                DATE,
  account_manager_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_by              UUID        NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Auto-assign tracker_id: TRK-001, TRK-002, …
CREATE OR REPLACE FUNCTION assign_tracker_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tracker_id IS NULL OR NEW.tracker_id = '' THEN
    NEW.tracker_id := 'TRK-' || LPAD(nextval('campaigns_tracker_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_tracker_id ON campaigns;
CREATE TRIGGER trg_assign_tracker_id
  BEFORE INSERT ON campaigns
  FOR EACH ROW EXECUTE FUNCTION assign_tracker_id();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 3. upload_records ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS upload_records (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  uploader_id                  UUID        NOT NULL REFERENCES users(id),
  file_name                    TEXT        NOT NULL,
  file_url                     TEXT        NOT NULL,
  file_type                    TEXT        NOT NULL,
  file_size_bytes              BIGINT,
  file_hash                    TEXT,
  status                       TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','processing','processed','failed')),
  detected_amount_before_vat   NUMERIC(15,2),
  confirmed_amount_before_vat  NUMERIC(15,2),
  detection_confidence         TEXT        CHECK (detection_confidence IN ('high','medium','low','not_found')),
  extraction_result            JSONB       NOT NULL DEFAULT '{}',
  extraction_method            TEXT        CHECK (extraction_method IN ('excel_direct','pdf_text','pdf_ocr','manual')),
  error_message                TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE upload_records ENABLE ROW LEVEL SECURITY;


-- ── 4. documents ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  upload_record_id  UUID        REFERENCES upload_records(id) ON DELETE SET NULL,
  type              TEXT        NOT NULL
                      CHECK (type IN ('proforma_invoice','purchase_order','invoice','receipt','compliance','write_off_summary')),
  status            TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','current','outdated','superseded','void')),
  document_number   TEXT        UNIQUE NOT NULL,
  version           INT         NOT NULL DEFAULT 1,
  amount_before_vat NUMERIC(15,2),
  agency_fee_amount NUMERIC(15,2),
  vat_amount        NUMERIC(15,2),
  total_amount      NUMERIC(15,2),
  currency          CHAR(3)     NOT NULL DEFAULT 'NGN',
  -- exchange_rate stored at creation time, never updated
  exchange_rate     NUMERIC(12,6) NOT NULL DEFAULT 1,
  due_date          DATE,
  issue_date        DATE,
  sent_at           TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  file_url          TEXT,
  file_hash         TEXT,
  notes             TEXT,
  terms             TEXT,
  created_by        UUID        NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 5. payments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  document_id    UUID        REFERENCES documents(id) ON DELETE SET NULL,
  amount         NUMERIC(15,2) NOT NULL,
  currency       CHAR(3)     NOT NULL DEFAULT 'NGN',
  payment_date   DATE        NOT NULL,
  payment_method TEXT        NOT NULL DEFAULT 'bank_transfer'
                   CHECK (payment_method IN ('bank_transfer','cheque','cash','other')),
  reference      TEXT,
  notes          TEXT,
  logged_by      UUID        NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;


-- ── 6. journal_entries ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  campaign_id      UUID        REFERENCES campaigns(id) ON DELETE SET NULL,
  document_id      UUID        REFERENCES documents(id) ON DELETE SET NULL,
  payment_id       UUID        REFERENCES payments(id) ON DELETE SET NULL,
  account_code     TEXT        NOT NULL
                     CHECK (account_code IN ('1000','1100','2400','4000','4100','6900')),
  debit            NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  description      TEXT,
  source_app       TEXT        NOT NULL DEFAULT 'revflow',
  reference        TEXT,
  transaction_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;


-- ── 7. value_mismatch_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS value_mismatch_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  document_id       UUID        REFERENCES documents(id) ON DELETE SET NULL,
  upload_record_id  UUID        REFERENCES upload_records(id) ON DELETE SET NULL,
  field_name        TEXT        NOT NULL,
  expected_value    TEXT,
  actual_value      TEXT,
  status            TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','resolved','ignored')),
  notes             TEXT,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE value_mismatch_log ENABLE ROW LEVEL SECURITY;


-- ── 8. notifications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,   -- NULL = org-wide broadcast
  campaign_id UUID        REFERENCES campaigns(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL
                CHECK (type IN ('invoice_due','payment_received','approval_required','chase','system','compliance')),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;


-- ── 9. public_holidays ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_holidays (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  country    CHAR(2) NOT NULL DEFAULT 'NG',
  date       DATE    NOT NULL,
  name       TEXT    NOT NULL,
  UNIQUE (country, date)
);

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

-- Seed: Nigeria fixed public holidays 2024–2026
INSERT INTO public_holidays (country, date, name) VALUES
  -- 2024 Fixed
  ('NG', '2024-01-01', 'New Year''s Day'),
  ('NG', '2024-05-01', 'Workers'' Day'),
  ('NG', '2024-05-27', 'Children''s Day'),
  ('NG', '2024-06-12', 'Democracy Day'),
  ('NG', '2024-10-01', 'Independence Day'),
  ('NG', '2024-12-25', 'Christmas Day'),
  ('NG', '2024-12-26', 'Boxing Day'),
  -- 2024 Islamic (approximate)
  ('NG', '2024-04-10', 'Eid el-Fitri'),
  ('NG', '2024-04-11', 'Eid el-Fitri (2nd day)'),
  ('NG', '2024-06-17', 'Eid el-Adha'),
  ('NG', '2024-06-18', 'Eid el-Adha (2nd day)'),
  ('NG', '2024-07-07', 'Islamic New Year'),
  ('NG', '2024-09-16', 'Maulud Nabi'),

  -- 2025 Fixed
  ('NG', '2025-01-01', 'New Year''s Day'),
  ('NG', '2025-05-01', 'Workers'' Day'),
  ('NG', '2025-05-27', 'Children''s Day'),
  ('NG', '2025-06-12', 'Democracy Day'),
  ('NG', '2025-10-01', 'Independence Day'),
  ('NG', '2025-12-25', 'Christmas Day'),
  ('NG', '2025-12-26', 'Boxing Day'),
  -- 2025 Islamic (approximate)
  ('NG', '2025-03-30', 'Eid el-Fitri'),
  ('NG', '2025-03-31', 'Eid el-Fitri (2nd day)'),
  ('NG', '2025-06-06', 'Eid el-Adha'),
  ('NG', '2025-06-07', 'Eid el-Adha (2nd day)'),
  ('NG', '2025-06-26', 'Islamic New Year'),
  ('NG', '2025-09-04', 'Maulud Nabi'),

  -- 2026 Fixed
  ('NG', '2026-01-01', 'New Year''s Day'),
  ('NG', '2026-05-01', 'Workers'' Day'),
  ('NG', '2026-05-27', 'Children''s Day'),
  ('NG', '2026-06-12', 'Democracy Day'),
  ('NG', '2026-10-01', 'Independence Day'),
  ('NG', '2026-12-25', 'Christmas Day'),
  ('NG', '2026-12-26', 'Boxing Day'),
  -- 2026 Islamic (approximate)
  ('NG', '2026-03-20', 'Eid el-Fitri'),
  ('NG', '2026-03-21', 'Eid el-Fitri (2nd day)'),
  ('NG', '2026-05-27', 'Eid el-Adha'),
  ('NG', '2026-05-28', 'Eid el-Adha (2nd day)'),
  ('NG', '2026-06-16', 'Islamic New Year'),
  ('NG', '2026-08-25', 'Maulud Nabi')

ON CONFLICT (country, date) DO NOTHING;


-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id          ON campaigns (org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status          ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_account_manager ON campaigns (account_manager_id);

CREATE INDEX IF NOT EXISTS idx_documents_campaign_type   ON documents (campaign_id, type);
CREATE INDEX IF NOT EXISTS idx_documents_status          ON documents (status);

CREATE INDEX IF NOT EXISTS idx_payments_campaign_id      ON payments (campaign_id);
CREATE INDEX IF NOT EXISTS idx_payments_document_id      ON payments (document_id);

CREATE INDEX IF NOT EXISTS idx_journal_org_id            ON journal_entries (org_id);
CREATE INDEX IF NOT EXISTS idx_journal_campaign_id       ON journal_entries (campaign_id);
CREATE INDEX IF NOT EXISTS idx_journal_account_code      ON journal_entries (account_code);
CREATE INDEX IF NOT EXISTS idx_journal_transaction_date  ON journal_entries (transaction_date);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_read    ON notifications (org_id, read_at);

CREATE INDEX IF NOT EXISTS idx_upload_records_campaign   ON upload_records (campaign_id, status);

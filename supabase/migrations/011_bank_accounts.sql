-- 1. Rename vat_number → tax_id
ALTER TABLE org_settings RENAME COLUMN vat_number TO tax_id;

-- 2. Drop legacy single bank columns from org_settings
ALTER TABLE org_settings
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_name,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS sort_code;

-- 3. Create org_bank_accounts
CREATE TABLE org_bank_accounts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID         NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bank_name       TEXT         NOT NULL,
  account_name    TEXT         NOT NULL,
  account_number  TEXT         NOT NULL,
  bank_code       TEXT,
  currency        TEXT         NOT NULL DEFAULT 'NGN',
  label           TEXT,
  is_default      BOOLEAN      NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. Add preferred bank account FK to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS preferred_bank_account_id UUID
    REFERENCES org_bank_accounts(id) ON DELETE SET NULL;

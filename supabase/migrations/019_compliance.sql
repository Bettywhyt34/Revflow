-- ============================================================
-- 019_compliance.sql — Compliance upload + dispute schema
-- ============================================================

-- 1. Compliance fields on campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS compliance_amount_before_vat numeric(15,2),
  ADD COLUMN IF NOT EXISTS compliance_pct              numeric(6,4),
  ADD COLUMN IF NOT EXISTS final_billable              numeric(15,2),
  ADD COLUMN IF NOT EXISTS adjustment_write_off        numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compliance_disputed         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_dispute_reason   text,
  ADD COLUMN IF NOT EXISTS compliance_dispute_raised_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS compliance_confirmed_by     uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS compliance_confirmed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS over_delivery               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS over_delivery_pct           numeric(6,4);

-- 2. compliance_disputes table
CREATE TABLE IF NOT EXISTS compliance_disputes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid REFERENCES organisations(id) NOT NULL,
  campaign_id           uuid REFERENCES campaigns(id),
  raised_by             uuid REFERENCES users(id),
  reason                text,
  disputed_amount       numeric(15,2),
  original_amount       numeric(15,2),
  notes                 text,
  agreed_amount         numeric(15,2),
  finance_exec_approved boolean DEFAULT false,
  admin_approved        boolean DEFAULT false,
  resolved_at           timestamptz,
  created_at            timestamptz DEFAULT now()
);

-- 3. Add write_off_summary to documents type check (if not present)
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
    CHECK (type IN (
      'proforma_invoice','purchase_order','invoice',
      'receipt','compliance','write_off_summary','compliance_report'
    ));

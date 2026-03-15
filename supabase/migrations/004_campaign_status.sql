-- ============================================================
-- 004_campaign_status.sql — Extend campaign statuses
-- Paste into Supabase SQL Editor.
-- ============================================================

-- Add new columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS plan_reference TEXT;

-- Give campaign_type a default so it's optional on insert
ALTER TABLE campaigns ALTER COLUMN campaign_type SET DEFAULT 'direct';

-- Widen the status constraint to cover the full billing lifecycle
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN (
    'draft',
    'plan_submitted',
    'proforma_sent',
    'po_received',
    'invoice_sent',
    'partially_paid',
    'fully_paid',
    'compliance_uploaded',
    'closed',
    'cancelled'
  ));

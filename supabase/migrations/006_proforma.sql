-- ============================================================
-- 006_proforma.sql — Proforma invoice additions
-- Paste into Supabase SQL Editor.
-- ============================================================

-- ── 1. Extend documents table ───────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS recognition_period_start DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS recognition_period_end   DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS recipient_email          TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS recipient_name           TEXT;

-- ── 2. Sequential document number generator (per org, per type) ─────────────
-- Returns: PROF-001, INV-001, PO-001, etc.
-- Note: uses COUNT+1, safe for single-org low-volume usage.
CREATE OR REPLACE FUNCTION next_document_number(p_org_id UUID, p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_count  INT;
BEGIN
  v_prefix := CASE p_type
    WHEN 'proforma_invoice' THEN 'PROF'
    WHEN 'invoice'          THEN 'INV'
    WHEN 'purchase_order'   THEN 'PO'
    WHEN 'receipt'          THEN 'RCP'
    WHEN 'compliance'       THEN 'COMP'
    ELSE                         'DOC'
  END;

  SELECT COALESCE(COUNT(*), 0) + 1
  INTO   v_count
  FROM   documents d
  JOIN   campaigns c ON c.id = d.campaign_id
  WHERE  c.org_id = p_org_id
    AND  d.type   = p_type;

  RETURN v_prefix || '-' || LPAD(v_count::TEXT, 3, '0');
END;
$$;

-- ============================================================
-- 015_document_sequences.sql
-- Replaces the COUNT-based document number generator with an
-- atomic sequence table.  Format: MMYYYYXXXX (e.g. 03202601)
-- Paste into Supabase SQL Editor and run once.
-- ============================================================

-- ── 1. Sequences table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_sequences (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID    NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_type TEXT    NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  UNIQUE (org_id, document_type)
);

-- Seed from existing documents so legacy numbering carries over
INSERT INTO document_sequences (org_id, document_type, last_sequence)
SELECT c.org_id, d.type, COUNT(*) AS last_sequence
FROM   documents d
JOIN   campaigns c ON c.id = d.campaign_id
WHERE  d.document_number IS NOT NULL
GROUP  BY c.org_id, d.type
ON CONFLICT (org_id, document_type)
DO UPDATE SET last_sequence = EXCLUDED.last_sequence;

-- ── 2. Replace the document number function ──────────────────────────────────
-- New format: MMYYYYXXXX  e.g. 03202601, 03202602 …
-- The INSERT … ON CONFLICT … DO UPDATE is atomic — no race conditions.
CREATE OR REPLACE FUNCTION next_document_number(p_org_id UUID, p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq  INTEGER;
  v_mm   TEXT;
  v_yyyy TEXT;
BEGIN
  INSERT INTO document_sequences (org_id, document_type, last_sequence)
  VALUES (p_org_id, p_type, 1)
  ON CONFLICT (org_id, document_type)
  DO UPDATE SET last_sequence = document_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;

  v_mm   := LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0');
  v_yyyy := EXTRACT(YEAR  FROM NOW())::TEXT;

  -- MMYYYYXXXX  e.g. 03202601
  RETURN v_mm || v_yyyy || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

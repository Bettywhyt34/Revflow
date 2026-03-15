-- ============================================================
-- 016_customer_id.sql
-- Adds clients.customer_id (e.g. TGI-01) with auto-generation.
-- Paste into Supabase SQL Editor and run once.
-- ============================================================

-- ── 1. Add the column ─────────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS customer_id TEXT UNIQUE;

-- ── 2. Auto-generation function ───────────────────────────────────────────
-- Returns the next available customer_id for a given org + client name.
-- Format: <FIRST 3 ALPHA CHARS>-<NN>  e.g. TGI-01, ARE-01, ARE-02
CREATE OR REPLACE FUNCTION generate_customer_id(p_org_id UUID, p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_max    INTEGER;
BEGIN
  -- Strip non-alpha, uppercase, take first 3 characters
  v_prefix := LEFT(UPPER(REGEXP_REPLACE(p_name, '[^a-zA-Z]', '', 'g')), 3);
  IF LENGTH(v_prefix) < 1 THEN
    v_prefix := 'CLI';
  END IF;

  -- Find highest existing sequence for this prefix in this org
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(customer_id, '-', 2) AS INTEGER)
  ), 0)
  INTO v_max
  FROM clients
  WHERE org_id = p_org_id
    AND customer_id ~ ('^' || v_prefix || '-[0-9]+$');

  RETURN v_prefix || '-' || LPAD((v_max + 1)::TEXT, 2, '0');
END;
$$;

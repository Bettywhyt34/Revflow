-- ============================================================
-- 007_po_received.sql — PO received fields on campaigns
-- Paste into Supabase SQL Editor.
-- ============================================================

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS po_number        TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS po_received_date DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS po_amount        NUMERIC(15,2);

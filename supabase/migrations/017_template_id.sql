-- ── 017_template_id.sql ────────────────────────────────────────────────────
-- Adds template selection to documents + org defaults
-- Template IDs: '1' = QVT Classic, '2' = Modern Minimal, '3' = Bold Corporate

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS template_id TEXT NOT NULL DEFAULT '1';

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS default_proforma_template TEXT NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS default_invoice_template  TEXT NOT NULL DEFAULT '1';

-- Migration 020: Document Bundle Architecture
-- Adds bundle metadata columns to documents + document_bundles table

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS bundle_order integer,
  ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);

CREATE TABLE IF NOT EXISTS document_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) NOT NULL,
  campaign_id uuid REFERENCES campaigns(id),
  created_by uuid REFERENCES users(id),
  document_ids jsonb,
  bundle_order jsonb,
  merged_pdf_url text,
  bundle_type text CHECK (bundle_type IN ('full','custom')),
  created_at timestamptz DEFAULT now()
);

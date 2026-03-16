-- Migration 021: Document Versioning + Clone Support
-- Adds version control columns for edit/version/clone workflows

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS cloned_from_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS edit_reason text,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES users(id);

-- 009_send_dialog.sql
-- Add missing columns to documents for the Send Dialog

ALTER TABLE documents ADD COLUMN IF NOT EXISTS bcc_emails  TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS subject      TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sent_by      UUID    REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- 005_invite_codes_role.sql — Add role to invite_codes
-- Paste into Supabase SQL Editor.
-- ============================================================

-- Add role column (nullable — existing rows get NULL, app always sets it on insert)
ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS role TEXT
  CHECK (role IN ('admin', 'planner', 'finance_exec', 'compliance'));

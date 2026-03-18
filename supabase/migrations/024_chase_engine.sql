-- ============================================================
-- 024_chase_engine.sql — Chase Engine indexes + default settings
-- Run in Supabase SQL editor
-- ============================================================

-- ── Index to speed up same-day chase dedup queries ────────────────────────────
-- Enables efficient: WHERE campaign_id = X AND type = 'chase' AND created_at >= today
CREATE INDEX IF NOT EXISTS idx_notifications_chase_dedup
  ON notifications (campaign_id, type, created_at DESC)
  WHERE campaign_id IS NOT NULL;

-- ── Seed default chase timeline settings for all existing orgs ───────────────
-- (ON CONFLICT DO NOTHING — safe to re-run; only inserts if no entry exists)
INSERT INTO timeline_settings (org_id, setting_key, setting_value)
SELECT
  id,
  'chase',
  '{
    "proforma_po_reminder_days": 12,
    "proforma_po_escalation_days": 14,
    "po_invoice_reminder_days": 5,
    "plan_no_action_reminder_days": 5,
    "invoice_overdue_reminder1_days": 1,
    "invoice_overdue_reminder2_days": 7,
    "invoice_overdue_escalation_days": 14
  }'::jsonb
FROM organisations
ON CONFLICT (org_id, setting_key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 023: Notification enhancements
-- • Add action_url to notifications (deep-link to relevant campaign)
-- • Add notification_prefs JSONB to users (per-type email toggle)
-- ══════════════════════════════════════════════════════════════════════════════

-- action_url links the in-app notification to the relevant campaign page
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url text;

-- Per-user notification preference map (email on/off per type)
-- email_notifications (existing boolean) acts as master toggle
-- notification_prefs controls per-type granularity
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT
    '{"payment_received":true,"approval_required":true,"invoice_due":true,"chase":true,"system":true,"compliance":true}'::jsonb;

-- Index for fast unread-count queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, org_id, read_at)
  WHERE read_at IS NULL;

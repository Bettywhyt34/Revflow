-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 022: RLS policies for role-based access control
-- Updated permission model:
--   admin        → full access
--   finance_exec → operational access (no user mgmt, no org settings, no void)
--   planner      → campaign/client creation, plan upload, view own campaigns
--   compliance   → compliance docs only, view assigned campaigns
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Helper: get current user's role and org ────────────────────────────────────
-- NOTE: The app uses service-role client which bypasses RLS.
-- These policies protect direct Supabase API access.

-- ── organisations ─────────────────────────────────────────────────────────────
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_select" ON organisations;
DROP POLICY IF EXISTS "org_update" ON organisations;

-- Any authenticated user can read their own org
CREATE POLICY "org_select" ON organisations
  FOR SELECT USING (
    id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Only admin can update org settings
CREATE POLICY "org_update" ON organisations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND org_id = organisations.id AND role = 'admin'
    )
  );

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_org" ON users;
DROP POLICY IF EXISTS "users_insert_admin" ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;

-- All authenticated users can view members of their own org
CREATE POLICY "users_select_own_org" ON users
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- Only admin can invite / create users
CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND org_id = NEW.org_id AND role = 'admin'
    )
  );

-- Admin can update any user; users can update their own profile (name, avatar only)
CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND org_id = users.org_id AND role = 'admin'
    )
  );

-- Only admin can delete users
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = users.org_id AND u.role = 'admin'
    )
  );

-- ── campaigns ─────────────────────────────────────────────────────────────────
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_select" ON campaigns;
DROP POLICY IF EXISTS "campaigns_insert" ON campaigns;
DROP POLICY IF EXISTS "campaigns_update" ON campaigns;
DROP POLICY IF EXISTS "campaigns_delete" ON campaigns;

-- admin + finance_exec: see all campaigns in org
-- planner: see only campaigns they created
-- compliance: see only campaigns where they are the assigned compliance user
CREATE POLICY "campaigns_select" ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.org_id = campaigns.org_id
        AND (
          u.role IN ('admin', 'finance_exec')
          OR (u.role = 'planner' AND campaigns.created_by = auth.uid())
          OR (u.role = 'compliance' AND campaigns.account_manager_id = auth.uid())
        )
    )
  );

-- admin, finance_exec, planner can create campaigns
CREATE POLICY "campaigns_insert" ON campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.org_id = NEW.org_id
        AND u.role IN ('admin', 'finance_exec', 'planner')
    )
  );

-- admin + finance_exec can update campaigns; planner can update their own
CREATE POLICY "campaigns_update" ON campaigns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.org_id = campaigns.org_id
        AND (
          u.role IN ('admin', 'finance_exec')
          OR (u.role = 'planner' AND campaigns.created_by = auth.uid())
        )
    )
  );

-- Only admin can delete campaigns
CREATE POLICY "campaigns_delete" ON campaigns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = campaigns.org_id AND u.role = 'admin'
    )
  );

-- ── upload_records ─────────────────────────────────────────────────────────────
ALTER TABLE upload_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upload_records_select" ON upload_records;
DROP POLICY IF EXISTS "upload_records_insert" ON upload_records;

-- Anyone in the org can view upload records (for campaign context)
CREATE POLICY "upload_records_select" ON upload_records
  FOR SELECT USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN users u ON u.org_id = c.org_id
      WHERE u.id = auth.uid()
    )
  );

-- admin, finance_exec, planner can upload plans
CREATE POLICY "upload_records_insert" ON upload_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = NEW.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND u.role IN ('admin', 'finance_exec', 'planner')
    )
  );

-- ── documents ─────────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select" ON documents;
DROP POLICY IF EXISTS "documents_insert" ON documents;
DROP POLICY IF EXISTS "documents_update" ON documents;
DROP POLICY IF EXISTS "documents_delete" ON documents;

-- admin + finance_exec: all documents in org
-- planner: documents on their campaigns only
-- compliance: compliance documents on their campaigns only
CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = documents.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND (
          u.role IN ('admin', 'finance_exec')
          OR (u.role = 'planner' AND c.created_by = auth.uid())
          OR (
            u.role = 'compliance'
            AND documents.type IN ('compliance', 'compliance_report')
            AND c.account_manager_id = auth.uid()
          )
        )
    )
  );

-- admin + finance_exec can create all doc types
-- compliance can create compliance docs only
CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = NEW.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND (
          u.role IN ('admin', 'finance_exec')
          OR (u.role = 'compliance' AND NEW.type IN ('compliance', 'compliance_report'))
        )
    )
  );

-- admin + finance_exec can update documents; compliance can update their own compliance docs
CREATE POLICY "documents_update" ON documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = documents.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND (
          u.role IN ('admin', 'finance_exec')
          OR (
            u.role = 'compliance'
            AND documents.type IN ('compliance', 'compliance_report')
            AND documents.created_by = auth.uid()
          )
        )
    )
  );

-- Only admin can hard-delete documents
CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = documents.campaign_id
      WHERE u.id = auth.uid() AND u.org_id = c.org_id AND u.role = 'admin'
    )
  );

-- ── payments ───────────────────────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "payments_update" ON payments;

-- admin + finance_exec only
CREATE POLICY "payments_select" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = payments.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND u.role IN ('admin', 'finance_exec')
    )
  );

CREATE POLICY "payments_insert" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = NEW.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND u.role IN ('admin', 'finance_exec')
    )
  );

CREATE POLICY "payments_update" ON payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = payments.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND u.role IN ('admin', 'finance_exec')
    )
  );

-- ── journal_entries ────────────────────────────────────────────────────────────
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_entries_select" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert" ON journal_entries;

-- admin + finance_exec only
CREATE POLICY "journal_entries_select" ON journal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.org_id = journal_entries.org_id
        AND u.role IN ('admin', 'finance_exec')
    )
  );

CREATE POLICY "journal_entries_insert" ON journal_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.org_id = NEW.org_id
        AND u.role IN ('admin', 'finance_exec')
    )
  );

-- ── value_mismatch_log ─────────────────────────────────────────────────────────
ALTER TABLE value_mismatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mismatch_select" ON value_mismatch_log;

CREATE POLICY "mismatch_select" ON value_mismatch_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.id = value_mismatch_log.campaign_id
      WHERE u.id = auth.uid()
        AND u.org_id = c.org_id
        AND u.role IN ('admin', 'finance_exec')
    )
  );

-- ── notifications ──────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

-- Users see notifications addressed to them or org-wide broadcasts
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.org_id = notifications.org_id
        AND (notifications.user_id = auth.uid() OR notifications.user_id IS NULL)
    )
  );

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (
    notifications.user_id = auth.uid()
  );

-- ── timeline_settings ──────────────────────────────────────────────────────────
ALTER TABLE timeline_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timeline_settings_select" ON timeline_settings;
DROP POLICY IF EXISTS "timeline_settings_upsert" ON timeline_settings;

-- All authenticated users in the org can read timeline settings
CREATE POLICY "timeline_settings_select" ON timeline_settings
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Only admin can change timeline settings
CREATE POLICY "timeline_settings_upsert" ON timeline_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = timeline_settings.org_id AND u.role = 'admin'
    )
  );

-- ── public_holidays ────────────────────────────────────────────────────────────
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_select" ON public_holidays;
DROP POLICY IF EXISTS "holidays_manage_admin" ON public_holidays;

-- All authenticated users can read holidays
CREATE POLICY "holidays_select" ON public_holidays
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Only admin can manage holidays
CREATE POLICY "holidays_manage_admin" ON public_holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = public_holidays.org_id AND u.role = 'admin'
    )
  );

-- ── org_bank_accounts ──────────────────────────────────────────────────────────
ALTER TABLE org_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts_select" ON org_bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_manage_admin" ON org_bank_accounts;

-- All authenticated users in org can read bank accounts (needed for document generation)
CREATE POLICY "bank_accounts_select" ON org_bank_accounts
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Only admin can manage bank accounts (document settings)
CREATE POLICY "bank_accounts_manage_admin" ON org_bank_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.org_id = org_bank_accounts.org_id AND u.role = 'admin'
    )
  );

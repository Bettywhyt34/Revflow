-- 1. WHT columns on clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS wht_applicable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS wht_type text DEFAULT 'agency_fee',
  ADD COLUMN IF NOT EXISTS wht_rate numeric(5,4) DEFAULT 0.05;

-- 2. WHT columns on payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS wht_applicable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wht_amount numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wht_rate numeric(5,4),
  ADD COLUMN IF NOT EXISTS wht_certificate_number text,
  ADD COLUMN IF NOT EXISTS wht_credit_note_number text,
  ADD COLUMN IF NOT EXISTS actual_cash_received numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_settled numeric(15,2);

-- 3. wht_credits table
CREATE TABLE IF NOT EXISTS wht_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) NOT NULL,
  campaign_id uuid REFERENCES campaigns(id),
  payment_id uuid REFERENCES payments(id),
  client_id uuid REFERENCES clients(id),
  wht_amount numeric(15,2) NOT NULL,
  wht_rate numeric(5,4),
  wht_type text,
  certificate_number text,
  credit_note_number text,
  tax_year integer,
  status text DEFAULT 'available'
    CHECK (status IN ('available','utilised','expired')),
  created_at timestamptz DEFAULT now()
);

-- 4. Add account code 1150 (WHT Receivable) to journal_entries constraint
ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_account_code_check;
ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_account_code_check
    CHECK (account_code IN ('1000','1100','1150','2400','4000','4100','6900'));

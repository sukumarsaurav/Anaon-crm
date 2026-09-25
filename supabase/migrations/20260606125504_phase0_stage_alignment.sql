-- Add token_paid stage between negotiation and closed_won
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'token_paid' AFTER 'negotiation';

-- Win/loss reason for reporting
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loss_reason text;
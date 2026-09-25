
-- Add delay tracking + payment trigger + completion attribution to construction_milestones
ALTER TABLE construction_milestones
  ADD COLUMN IF NOT EXISTS is_payment_trigger boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS delay_reason text,
  ADD COLUMN IF NOT EXISTS revised_expected_date date,
  ADD COLUMN IF NOT EXISTS delay_noted_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS delay_noted_at timestamptz;

-- Index for fast project lookups ordered by sequence
CREATE INDEX IF NOT EXISTS idx_construction_milestones_project_seq
  ON construction_milestones(project_id, sequence_order);

-- Index for delayed milestone queries across projects
CREATE INDEX IF NOT EXISTS idx_construction_milestones_status
  ON construction_milestones(status);

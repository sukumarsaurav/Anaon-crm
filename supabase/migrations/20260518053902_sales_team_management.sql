
-- ============================================================
-- MODULE 3: Sales Team Management
-- ============================================================

-- Extend profiles with HR fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth       date,
  ADD COLUMN IF NOT EXISTS joining_date        date,
  ADD COLUMN IF NOT EXISTS employee_id         text,
  ADD COLUMN IF NOT EXISTS base_salary         numeric(12,2),
  ADD COLUMN IF NOT EXISTS emergency_contact   text,
  ADD COLUMN IF NOT EXISTS address             text;

-- ------------------------------------------------------------
-- Monthly targets per advisor
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_targets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month                 smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                  smallint NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  target_revenue        numeric(14,2) NOT NULL DEFAULT 0,
  target_bookings       integer NOT NULL DEFAULT 0,
  target_site_visits    integer NOT NULL DEFAULT 0,
  target_calls          integer NOT NULL DEFAULT 0,
  created_by            uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);

-- ------------------------------------------------------------
-- Incentive / commission slabs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incentive_slabs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label               text NOT NULL,
  from_bookings       integer NOT NULL DEFAULT 0,
  to_bookings         integer,                       -- NULL = unlimited
  commission_percent  numeric(5,2) NOT NULL DEFAULT 0,
  bonus_amount        numeric(12,2) NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Default slabs
INSERT INTO incentive_slabs (label, from_bookings, to_bookings, commission_percent, bonus_amount, sort_order)
VALUES
  ('Base',       0, 2,    0,    0,       1),
  ('Silver',     3, 5,    1.0,  0,       2),
  ('Gold',       6, 9,    1.5,  25000,   3),
  ('Platinum',  10, NULL, 2.0,  50000,   4)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Daily attendance log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date              date NOT NULL,
  check_in_at       timestamptz,
  check_out_at      timestamptz,
  check_in_lat      double precision,
  check_in_lng      double precision,
  check_out_lat     double precision,
  check_out_lng     double precision,
  status            text NOT NULL DEFAULT 'present'
                      CHECK (status IN ('present','absent','half_day','on_leave','holiday','weekend')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_logs(user_id, date DESC);

-- ------------------------------------------------------------
-- Leave requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type      text NOT NULL CHECK (leave_type IN ('casual','sick','earned','unpaid','comp_off')),
  from_date       date NOT NULL,
  to_date         date NOT NULL,
  days_count      integer NOT NULL DEFAULT 1,
  reason          text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by     uuid REFERENCES profiles(id),
  reviewed_at     timestamptz,
  review_note     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status) WHERE status = 'pending';

-- ------------------------------------------------------------
-- Internal announcements / shoutouts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  type        text NOT NULL DEFAULT 'announcement'
                CHECK (type IN ('announcement','shoutout','alert','project_launch')),
  is_pinned   boolean NOT NULL DEFAULT false,
  branch_id   uuid REFERENCES branches(id),           -- NULL = broadcast to all
  author_id   uuid NOT NULL REFERENCES profiles(id),
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned  ON announcements(is_pinned) WHERE is_pinned = true;

-- ------------------------------------------------------------
-- RLS policies
-- ------------------------------------------------------------

ALTER TABLE team_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_slabs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements    ENABLE ROW LEVEL SECURITY;

-- team_targets: admin/manager can manage; advisors see own
CREATE POLICY "team_targets_select" ON team_targets FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
        AND p.role IN ('admin','manager')
    )
  );
CREATE POLICY "team_targets_insert" ON team_targets FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
  );
CREATE POLICY "team_targets_update" ON team_targets FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
  );

-- incentive_slabs: everyone reads; admin manages
CREATE POLICY "incentive_slabs_select" ON incentive_slabs FOR SELECT USING (true);
CREATE POLICY "incentive_slabs_manage" ON incentive_slabs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- attendance_logs: users see own; admin/manager see all
CREATE POLICY "attendance_select" ON attendance_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')
    )
  );
CREATE POLICY "attendance_insert" ON attendance_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attendance_update" ON attendance_logs FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
  );

-- leave_requests: user sees own; admin/manager sees all
CREATE POLICY "leave_select" ON leave_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
  );
CREATE POLICY "leave_insert" ON leave_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave_update" ON leave_requests FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
  );

-- announcements: all authenticated users read; admin/manager write
CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "announcements_insert" ON announcements FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
  );
CREATE POLICY "announcements_update" ON announcements FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
CREATE POLICY "announcements_delete" ON announcements FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_team_targets_updated_at    ON team_targets;
DROP TRIGGER IF EXISTS trg_attendance_updated_at       ON attendance_logs;
DROP TRIGGER IF EXISTS trg_leave_updated_at            ON leave_requests;
DROP TRIGGER IF EXISTS trg_announcements_updated_at    ON announcements;

CREATE TRIGGER trg_team_targets_updated_at
  BEFORE UPDATE ON team_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leave_updated_at
  BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- MODULE 4: Property & Inventory Management
-- ============================================================

-- ── Extend projects table ────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS gallery_urls          jsonb    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS legal_contact         text,
  ADD COLUMN IF NOT EXISTS contractor_name       text,
  ADD COLUMN IF NOT EXISTS hold_duration_hours   integer  NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS max_holds_per_advisor integer  NOT NULL DEFAULT 3;

-- ── Extend plot_status enum ──────────────────────────────────
ALTER TYPE plot_status ADD VALUE IF NOT EXISTS 'not_for_sale';

-- ── Extend plots table ───────────────────────────────────────
ALTER TABLE plots
  ADD COLUMN IF NOT EXISTS base_price_per_sqyd  numeric(14,2),
  ADD COLUMN IF NOT EXISTS grid_row             integer,
  ADD COLUMN IF NOT EXISTS grid_col             integer;

-- ── Premium matrix per project ──────────────────────────────
CREATE TABLE IF NOT EXISTS premium_matrix (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  premium_type   text NOT NULL
                   CHECK (premium_type IN ('corner','park_facing','road_facing','east_facing','other')),
  percent        numeric(5,2) NOT NULL DEFAULT 0,
  label          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, premium_type)
);

-- ── Plot holds log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plot_holds_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id     uuid NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  held_by     uuid NOT NULL REFERENCES profiles(id),
  held_at     timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  released_at timestamptz,
  outcome     text CHECK (outcome IN ('booked','released','expired')),
  lead_id     uuid REFERENCES leads(id),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plot_holds_log_plot ON plot_holds_log(plot_id, held_at DESC);
CREATE INDEX IF NOT EXISTS idx_plot_holds_log_user ON plot_holds_log(held_by, held_at DESC);

-- ── Project documents ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         text NOT NULL,
  category     text NOT NULL
                 CHECK (category IN ('layout_approval','noc','rera_certificate','title_deed',
                                     'environmental_clearance','bank_approval','demand_letter',
                                     'agreement_template','sale_deed_template','brochure',
                                     'price_list','other')),
  file_url     text NOT NULL,
  file_size    integer,
  mime_type    text,
  is_public    boolean NOT NULL DEFAULT false,  -- false = admin/legal only
  uploaded_by  uuid REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_docs_project ON project_documents(project_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE premium_matrix      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_holds_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents   ENABLE ROW LEVEL SECURITY;

-- premium_matrix: all authenticated users read; admin/manager write
CREATE POLICY "premium_matrix_read" ON premium_matrix FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "premium_matrix_write" ON premium_matrix FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')));

-- plot_holds_log: all read; authenticated insert; admin update
CREATE POLICY "holds_log_read" ON plot_holds_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "holds_log_insert" ON plot_holds_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "holds_log_update" ON plot_holds_log FOR UPDATE
  USING (held_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')));

-- project_documents: public docs → all; private → admin/manager
CREATE POLICY "project_docs_public" ON project_documents FOR SELECT
  USING (
    is_public = true
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager'))
  );
CREATE POLICY "project_docs_write" ON project_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')));

-- plots: all authenticated read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plots' AND policyname='plots_read') THEN
    CREATE POLICY "plots_read" ON plots FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- plots write: admin/manager
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plots' AND policyname='plots_write') THEN
    CREATE POLICY "plots_write" ON plots FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')));
  END IF;
END $$;

-- plots soft_hold update: advisors can update held_by/held_until/status only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plots' AND policyname='plots_hold') THEN
    CREATE POLICY "plots_hold" ON plots FOR UPDATE
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- projects: all authenticated read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='projects_read') THEN
    CREATE POLICY "projects_read" ON projects FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='projects_write') THEN
    CREATE POLICY "projects_write" ON projects FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_escalations' AND policyname='price_esc_read') THEN
    CREATE POLICY "price_esc_read" ON price_escalations FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_escalations' AND policyname='price_esc_write') THEN
    CREATE POLICY "price_esc_write" ON price_escalations FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','manager')));
  END IF;
END $$;

-- updated_at trigger for plots (if not exists)
DROP TRIGGER IF EXISTS trg_plots_updated_at ON plots;
CREATE TRIGGER trg_plots_updated_at
  BEFORE UPDATE ON plots FOR EACH ROW EXECUTE FUNCTION update_updated_at();

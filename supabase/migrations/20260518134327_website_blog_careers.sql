
-- Blog posts
CREATE TABLE blog_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  slug            text NOT NULL UNIQUE,
  excerpt         text,
  content         text NOT NULL DEFAULT '',
  featured_image_url text,
  category        text NOT NULL DEFAULT 'general',
  tags            text[] NOT NULL DEFAULT '{}',
  meta_title      text,
  meta_description text,
  is_published    boolean NOT NULL DEFAULT false,
  published_at    timestamptz,
  author_id       uuid REFERENCES profiles(id),
  view_count      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_posts_slug       ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published  ON blog_posts(is_published, published_at DESC);
CREATE INDEX idx_blog_posts_category   ON blog_posts(category);

-- Career listings
CREATE TABLE career_listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  department      text NOT NULL,
  employment_type text NOT NULL DEFAULT 'full_time',
  location        text NOT NULL DEFAULT 'Jaipur',
  description     text NOT NULL,
  requirements    text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Career applications (links to HR)
CREATE TABLE career_applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid REFERENCES career_listings(id) ON DELETE SET NULL,
  name        text NOT NULL,
  phone       text NOT NULL,
  email       text,
  resume_url  text,
  cover_letter text,
  status      text NOT NULL DEFAULT 'new',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Website testimonials (managed from CRM)
CREATE TABLE testimonials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  project     text,
  content     text NOT NULL,
  rating      int NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  photo_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: public read for published content
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published blogs"
  ON blog_posts FOR SELECT USING (is_published = true);
CREATE POLICY "admin all blogs"
  ON blog_posts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

ALTER TABLE career_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active careers"
  ON career_listings FOR SELECT USING (is_active = true);
CREATE POLICY "admin all careers"
  ON career_listings FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all applications"
  ON career_applications FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );
CREATE POLICY "public insert applications"
  ON career_applications FOR INSERT WITH CHECK (true);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active testimonials"
  ON testimonials FOR SELECT USING (is_active = true);
CREATE POLICY "admin all testimonials"
  ON testimonials FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

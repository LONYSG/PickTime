-- Public holidays table, populated by the weekly GitHub Actions batch job.
-- Clients read via anon key (SELECT only). Writes require service role key.
CREATE TABLE holidays (
  date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON holidays FOR SELECT USING (true);

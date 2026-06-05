-- Life OS — Whoop detected activities
-- Run in Supabase: SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS whoop_workouts (
  id          text PRIMARY KEY,        -- Whoop workout UUID
  sport       text,                    -- sport_name (e.g. "running")
  start_time  timestamptz,
  end_time    timestamptz,
  strain      numeric,
  avg_hr      numeric,
  max_hr      numeric,
  kilojoule   numeric,                 -- energy; kcal = kilojoule / 4.184
  distance_m  numeric,
  raw         jsonb,
  synced_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whoop_workouts_start_idx ON whoop_workouts (start_time DESC);

ALTER TABLE whoop_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access"
  ON whoop_workouts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

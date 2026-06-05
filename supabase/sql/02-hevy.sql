-- Life OS — Hevy integration schema
-- Run in Supabase: SQL Editor → New query → paste → Run

-- One row per Hevy workout. The full workout JSON (exercises/sets) is kept in
-- `raw` so the front-end can render whatever it needs without schema churn.
CREATE TABLE IF NOT EXISTS hevy_workouts (
  id           text PRIMARY KEY,          -- Hevy workout id
  title        text,
  start_time   timestamptz,
  end_time     timestamptz,
  updated_at   timestamptz,               -- Hevy's updated_at (for incremental sync)
  raw          jsonb NOT NULL,            -- full workout object from the Hevy API
  synced_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hevy_workouts_start_time_idx
  ON hevy_workouts (start_time DESC);

-- RLS: authenticated sessions only (same posture as kv_store)
ALTER TABLE hevy_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON hevy_workouts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

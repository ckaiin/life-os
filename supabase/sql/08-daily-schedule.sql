-- Life OS — recurring daily schedule blocks (for the full-day agenda)
-- Run in Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS daily_schedule (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label      text NOT NULL,
  time       text NOT NULL,                 -- "HH:MM" 24-hour, local (America/New_York)
  dows       int[] DEFAULT '{}',            -- weekdays it applies to, 0=Sun..6=Sat; empty = every day
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE daily_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access"
  ON daily_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);

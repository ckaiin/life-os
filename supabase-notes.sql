-- Life OS — voice capture: daily notes + dated reminders
-- Run in Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS daily_notes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        date NOT NULL,            -- the day the note belongs to
  text        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_notes_date_idx ON daily_notes (date DESC);
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access"
  ON daily_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS reminders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        date NOT NULL,            -- the day the reminder is for
  text        text NOT NULL,
  done        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_date_idx ON reminders (date);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access"
  ON reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);

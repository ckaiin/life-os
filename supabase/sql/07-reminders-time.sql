-- Life OS — timed reminders: add a due time + notification tracking
-- Run in Supabase → SQL Editor.

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS due_at   timestamptz;          -- exact due time (null = all-day)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS notified boolean DEFAULT false; -- 15-min email sent?

CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders (due_at) WHERE due_at IS NOT NULL;

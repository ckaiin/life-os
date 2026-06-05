-- Life OS — Whoop integration schema
-- Run in Supabase: SQL Editor → New query → paste → Run

-- OAuth tokens. NEVER exposed to the browser: RLS is enabled with no policy
-- for the `authenticated` role, so only the service role (used inside the
-- Edge Functions) can read/write. Single row, id = 1.
CREATE TABLE IF NOT EXISTS whoop_tokens (
  id            int PRIMARY KEY DEFAULT 1,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  oauth_state   text,            -- transient CSRF nonce during the auth handshake
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT whoop_tokens_singleton CHECK (id = 1)
);
ALTER TABLE whoop_tokens ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. Service role bypasses RLS.

-- Synced metrics, one row per day. Readable by the app for display.
CREATE TABLE IF NOT EXISTS whoop_data (
  date              date PRIMARY KEY,
  recovery_score    numeric,
  hrv               numeric,
  resting_hr        numeric,
  sleep_performance numeric,
  strain            numeric,
  raw               jsonb,
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE whoop_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access"
  ON whoop_data FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

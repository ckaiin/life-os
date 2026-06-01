-- Life OS v2.0 — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run

-- Single KV table mirrors localStorage 1:1
-- All existing data structures (todos JSON, weight log JSON, golf rounds JSON, etc.)
-- are stored exactly as they were in localStorage — no format changes needed.
CREATE TABLE IF NOT EXISTS kv_store (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Row Level Security: only authenticated sessions can read/write
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access"
  ON kv_store
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

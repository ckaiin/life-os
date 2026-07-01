// Life OS — Capture Read
//
// Returns recent voice-capture items (reminders + daily notes) as JSON, so the
// assistant can read Conor's brain dumps directly instead of him running a query.
// Read-only. Callable by the scheduler secret (x-cron-secret) OR a logged-in user JWT.
// Deploy with Verify JWT OFF (it authenticates itself).
//
// Auth: send header  x-cron-secret: <CRON_SECRET>   (same secret as the cron jobs)
// Query: ?days=N  (how far back to look; default 2)
//
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const CRON_SECRET = Deno.env.get('CRON_SECRET');

  // Auth: scheduler secret OR a logged-in user token.
  const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET;
  if (!isCron) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Not authenticated' }, 401);
    const { data: { user } } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
    if (!user) return json({ error: 'Not authenticated' }, 401);
  }

  // Look-back window (default 2 days, so an evening dump is still caught after midnight).
  const url = new URL(req.url);
  let days = parseInt(url.searchParams.get('days') || '2');
  if (isNaN(days) || days < 1) days = 2;
  if (days > 90) days = 90;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const [remRes, noteRes] = await Promise.all([
    db.from('reminders').select('id,date,text,done,due_at,created_at').gte('created_at', since).order('created_at', { ascending: false }),
    db.from('daily_notes').select('id,date,text,created_at').gte('created_at', since).order('created_at', { ascending: false }),
  ]);

  return json({
    since,
    days,
    reminders: remRes.data || [],
    notes: noteRes.data || [],
    counts: { reminders: (remRes.data || []).length, notes: (noteRes.data || []).length },
  });
});

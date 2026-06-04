// Life OS — Hevy sync Edge Function
//
// Pulls workouts from the Hevy API (key held server-side as a Supabase secret)
// and upserts them into the `hevy_workouts` table. The Hevy key NEVER reaches
// the browser — only this function can see it.
//
// Deploy from the Supabase dashboard (Edge Functions → Deploy) or CLI.
// Required secrets:
//   HEVY_API_KEY   — your Hevy Pro API key
// Auto-provided by Supabase:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HEVY_BASE = 'https://api.hevyapp.com/v1';
const PAGE_SIZE = 10; // Hevy max per page

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const HEVY_API_KEY = Deno.env.get('HEVY_API_KEY');

  if (!HEVY_API_KEY) return json({ error: 'HEVY_API_KEY secret not set' }, 500);

  // Auth: either the trusted scheduler (cron secret) or a logged-in user JWT.
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET;
  if (!isCron) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Not authenticated' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Not authenticated', detail: authErr?.message }, 401);
  }

  // Service-role client for writing (bypasses RLS, server-side only).
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Walk every page of workouts. 96 today; loop is bounded by page_count.
    let page = 1;
    let pageCount = 1;
    const rows: Record<string, unknown>[] = [];

    do {
      const res = await fetch(`${HEVY_BASE}/workouts?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: { 'api-key': HEVY_API_KEY, 'Accept': 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text();
        return json({ error: `Hevy API ${res.status}`, detail: text }, 502);
      }
      const data = await res.json();
      pageCount = data.page_count ?? 1;
      for (const w of (data.workouts ?? [])) {
        rows.push({
          id: w.id,
          title: w.title ?? null,
          start_time: w.start_time ?? null,
          end_time: w.end_time ?? null,
          updated_at: w.updated_at ?? null,
          raw: w,
          synced_at: new Date().toISOString(),
        });
      }
      page++;
    } while (page <= pageCount);

    if (rows.length) {
      const { error } = await db.from('hevy_workouts').upsert(rows, { onConflict: 'id' });
      if (error) return json({ error: 'DB upsert failed', detail: error.message }, 500);
    }

    return json({ synced: rows.length, pages: pageCount });
  } catch (e) {
    return json({ error: 'Sync failed', detail: String(e) }, 500);
  }
});

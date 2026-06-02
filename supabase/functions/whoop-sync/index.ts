// Life OS — Whoop sync Edge Function
//
// Uses the stored Whoop tokens (auto-refreshing when expired) to pull the
// latest recovery, sleep, and cycle/strain, then upserts a daily row into
// whoop_data. Tokens stay server-side. Deploy with "Verify JWT" OFF; the
// function verifies the user itself.
//
// Secrets required: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const API = 'https://api.prod.whoop.com/developer/v2';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID');
  const CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET');
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'Whoop secrets not set' }, 500);

  // Verify the Life OS user.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Not authenticated' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Not authenticated' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: t } = await db.from('whoop_tokens').select('*').eq('id', 1).maybeSingle();
    if (!t || !t.access_token) return json({ error: 'Whoop not connected' }, 400);

    let accessToken = t.access_token as string;

    // Refresh if expiring within a minute.
    if (!t.expires_at || new Date(t.expires_at).getTime() <= Date.now() + 60000) {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'offline',
      });
      const r = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!r.ok) return json({ error: 'Whoop token refresh failed', detail: await r.text() }, 502);
      const nt = await r.json();
      accessToken = nt.access_token;
      await db.from('whoop_tokens').upsert({
        id: 1,
        access_token: nt.access_token,
        refresh_token: nt.refresh_token ?? t.refresh_token,
        expires_at: new Date(Date.now() + (nt.expires_in ?? 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }

    const h = { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' };
    const getJson = async (path: string) => {
      const r = await fetch(API + path, { headers: h });
      if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
      return r.json();
    };

    // Pull recent history (Whoop returns up to 25 records per page).
    const cycles = (await getJson('/cycle?limit=25')).records ?? [];
    const recoveries = (await getJson('/recovery?limit=25')).records ?? [];
    const sleeps = (await getJson('/activity/sleep?limit=25')).records ?? [];

    const recByCycle: Record<string, any> = {};
    recoveries.forEach((r: any) => { if (r.cycle_id != null) recByCycle[r.cycle_id] = r; });
    const sleepById: Record<string, any> = {};
    sleeps.forEach((s: any) => { sleepById[s.id] = s; });
    const dayOf = (iso: string | null | undefined) => (iso ? new Date(iso) : new Date()).toISOString().slice(0, 10);

    // One row per cycle (= physiological day), aligned with its recovery + sleep.
    const byDate: Record<string, any> = {};
    cycles.forEach((c: any) => {
      const date = dayOf(c.start);
      if (byDate[date]) return; // collections are newest-first; keep the latest
      const rec = recByCycle[c.id];
      let slp = rec && rec.sleep_id != null ? sleepById[rec.sleep_id] : null;
      if (!slp) slp = sleeps.find((s: any) => dayOf(s.end) === date) || null;
      byDate[date] = {
        date,
        recovery_score: rec?.score?.recovery_score ?? null,
        hrv: rec?.score?.hrv_rmssd_milli ?? null,
        resting_hr: rec?.score?.resting_heart_rate ?? null,
        sleep_performance: slp?.score?.sleep_performance_percentage ?? null,
        strain: c?.score?.strain ?? null,
        raw: { cycle: c, recovery: rec ?? null, sleep: slp ?? null },
        updated_at: new Date().toISOString(),
      };
    });

    const rows = Object.values(byDate);
    if (rows.length) {
      const { error } = await db.from('whoop_data').upsert(rows, { onConflict: 'date' });
      if (error) return json({ error: 'DB upsert failed', detail: error.message }, 500);
    }

    // Whoop-detected activities (runs, lifts, etc.).
    const workouts = (await getJson('/activity/workout?limit=25')).records ?? [];
    const wrows = workouts.map((w: any) => ({
      id: w.id,
      sport: w.sport_name ?? null,
      start_time: w.start ?? null,
      end_time: w.end ?? null,
      strain: w.score?.strain ?? null,
      avg_hr: w.score?.average_heart_rate ?? null,
      max_hr: w.score?.max_heart_rate ?? null,
      kilojoule: w.score?.kilojoule ?? null,
      distance_m: w.score?.distance_meter ?? null,
      raw: w,
      synced_at: new Date().toISOString(),
    }));
    if (wrows.length) {
      const { error: we } = await db.from('whoop_workouts').upsert(wrows, { onConflict: 'id' });
      if (we) return json({ error: 'Workouts upsert failed', detail: we.message }, 500);
    }

    return json({ synced: rows.length, activities: wrows.length });
  } catch (e) {
    return json({ error: 'Sync failed', detail: String(e) }, 500);
  }
});

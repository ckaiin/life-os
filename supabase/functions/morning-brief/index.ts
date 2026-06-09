// Life OS — Morning Brief Edge Function
//
// Composes a daily readiness brief (Whoop + Hevy + weather + today's plan)
// and emails it via Resend. Callable by the scheduler (CRON_SECRET) or by a
// logged-in user (the "email test brief" button). Deploy with Verify JWT OFF.
//
// Secrets required:
//   RESEND_API_KEY  — from resend.com
//   BRIEF_EMAIL     — where to send (your Resend account email)
//   CRON_SECRET     — shared scheduler secret
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const PLAN: Record<string, string> = {
  Sunday: 'Zone 2 Run + Prep Day', Monday: 'Upper', Tuesday: 'Lower',
  Wednesday: 'Rest', Thursday: 'Zone 2 Run', Friday: 'Upper', Saturday: 'Rest',
};

function wmoDesc(code: number): [string, string] {
  const m: Record<number, [string, string]> = {
    0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'], 48: ['🌫️', 'Rime fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'],
    55: ['🌦️', 'Heavy drizzle'], 61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
    71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'],
    80: ['🌦️', 'Light showers'], 81: ['🌦️', 'Showers'], 82: ['⛈️', 'Heavy showers'],
    95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Thunderstorm'],
  };
  return m[code] || ['🌡️', 'Weather'];
}

async function getWeather() {
  const lat = 41.0262, lon = -73.6282;
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&temperature_unit=fahrenheit&timezone=auto&forecast_days=1');
    if (!r.ok) throw new Error('open-meteo');
    const d = await r.json();
    const c = d.current, day = d.daily;
    const [emoji, text] = wmoDesc(c.weather_code);
    return { emoji, text, temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature),
      hi: Math.round(day.temperature_2m_max[0]), lo: Math.round(day.temperature_2m_min[0]),
      chance: day.precipitation_probability_max ? day.precipitation_probability_max[0] : null };
  } catch (_) {
    const r = await fetch('https://wttr.in/' + lat + ',' + lon + '?format=j1');
    const d = await r.json();
    const cc = d.current_condition[0], today = d.weather[0];
    const text = cc.weatherDesc?.[0]?.value || 'Weather';
    const hourly = today.hourly || [];
    return { emoji: '🌡️', text, temp: Math.round(+cc.temp_F), feels: Math.round(+cc.FeelsLikeF),
      hi: Math.round(+today.maxtempF), lo: Math.round(+today.mintempF),
      chance: hourly.length ? Math.max(...hourly.map((h: any) => +h.chanceofrain || 0)) : null };
  }
}

function readiness(w: any, liftsThisWeek: number | null): string {
  if (!w) return 'No recent Whoop data yet.';
  const r = w.recovery_score, s = w.sleep_performance, hrv = w.hrv, rhr = w.resting_hr, st = w.strain;
  const parts: string[] = [];
  if (r != null) {
    const zone = r >= 67 ? 'green' : r >= 34 ? 'yellow' : 'red';
    const lead = r >= 67 ? 'Primed' : r >= 34 ? 'Moderately recovered' : 'Under-recovered';
    let line = `${lead} at ${Math.round(r)}% (${zone})`;
    if (s != null) line += ` on ${Math.round(s)}% sleep performance`;
    parts.push(line + '.');
    const bio: string[] = [];
    if (hrv != null) bio.push(`HRV ${Math.round(hrv)}ms`);
    if (rhr != null) bio.push(`resting HR ${Math.round(rhr)}bpm`);
    if (bio.length) parts.push(bio.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.');
    const target = r >= 67 ? '12–16' : r >= 34 ? '8–12' : '6–9';
    let g = r >= 67 ? 'Green light to push' : r >= 34 ? 'Train, but keep it controlled' : 'Prioritize easy movement and sleep';
    g += ` — strain target ${target}`;
    if (st != null) g += ` (${Number(st).toFixed(1)} so far)`;
    parts.push(g + '.');
  }
  if (s != null && s < 70) parts.push('Sleep ran short; bank more tonight.');
  if (liftsThisWeek === 0) parts.push('No lifts logged this week yet.');
  else if (liftsThisWeek != null) parts.push(`${liftsThisWeek} lift${liftsThisWeek > 1 ? 's' : ''} in this week.`);
  return parts.join(' ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const BRIEF_EMAIL = Deno.env.get('BRIEF_EMAIL');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');

  // Auth: scheduler secret or logged-in user.
  const isCron = !!CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET;
  if (!isCron) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Not authenticated' }, 401);
    const { data: { user } } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
    if (!user) return json({ error: 'Not authenticated' }, 401);
  }

  if (!RESEND_API_KEY || !BRIEF_EMAIL) return json({ error: 'RESEND_API_KEY / BRIEF_EMAIL not set' }, 500);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const tz = 'America/New_York';
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now);
  const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', day: 'numeric' }).format(now);
  const todayLd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD

  // Data
  const { data: wd } = await db.from('whoop_data').select('*').order('date', { ascending: false }).limit(1);
  const whoop = wd && wd[0];
  const { data: acts } = await db.from('whoop_workouts').select('sport,start_time,end_time').order('start_time', { ascending: false }).limit(20);
  const { data: lifts } = await db.from('hevy_workouts').select('start_time');
  // Reminders due today or overdue and not done.
  const { data: rems } = await db.from('reminders').select('date,text,done,due_at').eq('done', false).lte('date', todayLd).order('date', { ascending: true });
  // Recurring schedule blocks → today's agenda.
  const { data: sched } = await db.from('daily_schedule').select('label,time,dows').eq('active', true);
  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(weekday);
  const etHHMM = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const fmt12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM'); };
  const agenda: { time: string; label: string; kind: string }[] = [];
  (sched || []).forEach((b: any) => { const d = b.dows || []; if (d.length === 0 || d.includes(dow)) agenda.push({ time: b.time, label: b.label, kind: 'block' }); });
  (rems || []).forEach((r: any) => { if (r.due_at && r.date === todayLd) agenda.push({ time: etHHMM(r.due_at), label: r.text, kind: 'rem' }); });
  agenda.sort((a, b) => a.time.localeCompare(b.time));

  // lifts this week (Sunday start)
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const liftsThisWeek = (lifts || []).filter((l: any) => l.start_time && new Date(l.start_time) >= weekStart).length;

  let weather: any = null;
  try { weather = await getWeather(); } catch (_) { /* weather optional */ }

  const plan = PLAN[weekday] || '—';
  const summary = readiness(whoop, liftsThisWeek);
  const rainLine = weather && weather.chance != null
    ? (weather.chance >= 60 ? `Rain likely today (${weather.chance}%).` : weather.chance >= 30 ? `Some chance of rain (${weather.chance}%).` : 'No rain expected today.')
    : '';
  const yda = (acts || []).filter((a: any) => a.start_time && new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(a.start_time)) === todayLd);

  const wx = weather
    ? `${weather.emoji} ${weather.temp}° ${weather.text} · feels ${weather.feels}° · H ${weather.hi}° L ${weather.lo}°${rainLine ? ' · ' + rainLine : ''}`
    : 'Weather unavailable.';

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1a1e26;">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8f98;margin:0 0 2px;">Life OS · Morning Brief</p>
      <h1 style="font-size:22px;margin:0 0 16px;">${weekday}, ${dateLabel}</h1>
      <div style="background:#f4f5f7;border:1px solid #e1e3e8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 6px;">Readiness</p>
        <p style="font-size:14px;line-height:1.5;margin:0;">${summary}</p>
      </div>
      ${(rems && rems.length) ? `<div style="background:#fff7ed;border:1px solid #f0d9b8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 6px;">Reminders</p>
        ${rems.map((r: any) => `<p style="font-size:14px;margin:0 0 4px;">${r.date < todayLd ? '⚠️ ' : '• '}${(r.text || '').replace(/[<>]/g, '')}${r.date < todayLd ? ' <span style=\"color:#b45309;font-size:11px;\">(overdue)</span>' : ''}</p>`).join('')}
      </div>` : ''}
      <div style="background:#f4f5f7;border:1px solid #e1e3e8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 6px;">Today's plan</p>
        <p style="font-size:14px;margin:0;"><b>${plan}</b></p>
      </div>
      ${agenda.length ? `<div style="background:#f4f5f7;border:1px solid #e1e3e8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 8px;">Today's agenda</p>
        ${agenda.map((a) => `<p style="font-size:14px;margin:0 0 4px;"><span style="display:inline-block;min-width:78px;color:#6a6e76;font-variant-numeric:tabular-nums;">${fmt12(a.time)}</span>${(a.label || '').replace(/[<>]/g, '')}${a.kind === 'rem' ? ' <span style=\"color:#2c5080;font-size:11px;\">(reminder)</span>' : ''}</p>`).join('')}
      </div>` : ''}
      <div style="background:#f4f5f7;border:1px solid #e1e3e8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 6px;">Weather · Greenwich</p>
        <p style="font-size:14px;margin:0;">${wx}</p>
      </div>
      ${yda.length ? `<p style="font-size:12px;color:#6a6e76;">Already logged today: ${yda.map((a: any) => (a.sport || 'Activity')).join(', ')}.</p>` : ''}
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Life OS <onboarding@resend.dev>',
      to: BRIEF_EMAIL,
      subject: `Life OS — ${weekday} brief`,
      html,
    }),
  });
  if (!res.ok) return json({ error: 'Email send failed', detail: await res.text() }, 502);
  return json({ sent: true });
});

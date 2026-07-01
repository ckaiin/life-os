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
  Monday: 'Upper', Tuesday: 'Easy Run (25–35 min, HR ~145–150)', Wednesday: 'Lower',
  Thursday: 'Easy Run (25–35 min, HR ~145–150)', Friday: 'Upper',
  Saturday: 'Rest', Sunday: 'Long Run + Prep (easy, HR ≤150)',
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
  const { data: sched } = await db.from('daily_schedule').select('label,time,dows,date').eq('active', true);
  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(weekday);
  const etHHMM = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const fmt12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM'); };
  const agenda: { time: string; label: string; kind: string }[] = [];
  (sched || []).forEach((b: any) => { if (b.date) { if (b.date === todayLd) agenda.push({ time: b.time, label: b.label, kind: 'block' }); return; } const d = b.dows || []; if (d.length === 0 || d.includes(dow)) agenda.push({ time: b.time, label: b.label, kind: 'block' }); });
  (rems || []).forEach((r: any) => { if (r.due_at && r.date === todayLd) agenda.push({ time: etHHMM(r.due_at), label: r.text, kind: 'rem' }); });
  agenda.sort((a, b) => a.time.localeCompare(b.time));

  // Home maintenance due/overdue. Config comes from the app (kv 'maint-config',
  // single source of truth); falls back to a built-in list if absent.
  const FALLBACK_MAINT: [string, string, number][] = [
    ['m-pillowcase', 'Pillowcases', 3], ['m-sheets', 'Bed sheets', 7], ['m-duvet', 'Duvet cover', 30],
    ['m-pillow', 'Pillow', 90], ['m-bodytowel', 'Body towel', 5], ['m-handtowel', 'Hand towel', 5],
    ['m-toilet', 'Toilet', 7], ['m-sink', 'Sink & countertop', 7], ['m-shower', 'Shower / tub', 7],
    ['m-bathmat', 'Bath mat', 7], ['m-razor', 'Razor blade', 10], ['m-toothbrush', 'Toothbrush head', 60],
    ['m-dishcloth', 'Dish cloth / sponge', 7], ['m-counters', 'Kitchen counters', 7], ['m-floors', 'Floors', 7],
    ['m-fridge', 'Fridge wipe-down', 30], ['m-phone', 'Phone screen wipe', 1], ['m-laundry', 'Laundry', 7],
  ];
  const { data: kv } = await db.from('kv_store').select('key,value').like('key', 'maint-%');
  const kvMap: Record<string, string> = {};
  (kv || []).forEach((r: any) => { kvMap[r.key] = r.value; });
  let MAINT: [string, string, number][] = FALLBACK_MAINT;
  try {
    const cfg = JSON.parse(kvMap['maint-config'] || '[]');
    if (Array.isArray(cfg) && cfg.length) MAINT = cfg.map((c: any) => [c.key, c.name, c.days]);
  } catch (_) { /* keep fallback */ }
  const dueMaint = MAINT
    .map(([key, name, days]) => {
      const last = parseInt(kvMap['maint-' + key] || '0');
      const elapsed = last ? (now.getTime() - last) / 86400000 : 9999;
      return { name, over: Math.floor(elapsed - days) };
    })
    .filter((m) => m.over >= 0)
    .sort((a, b) => b.over - a.over);

  // Benefits milestones (fixed dates from the offer). Surface within 14 days, on
  // the day, or while an enrollment window is open.
  const BENEFITS: { name: string; date: string; end?: string; note: string }[] = [
    { name: 'Health insurance starts', date: '2026-07-01', note: 'coverage active' },
    { name: '401(k) eligible', date: '2026-08-01', note: 'enroll at 6% for the full match' },
    { name: 'ESPP enrollment opens', date: '2026-12-01', end: '2026-12-15', note: 'buy CHEF at 15% off' },
  ];
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const dueBenefits = BENEFITS
    .map((b) => {
      const start = new Date(b.date + 'T00:00:00');
      const end = b.end ? new Date(b.end + 'T00:00:00') : null;
      const inDays = Math.round((start.getTime() - midnight.getTime()) / 86400000);
      const windowOpen = end ? (midnight >= start && midnight <= end) : false;
      return { ...b, inDays, windowOpen };
    })
    .filter((b) => (b.inDays >= 0 && b.inDays <= 14) || b.windowOpen);

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

  // Sunday only: weekly review of the just-completed week (Sun–Sat) vs the week before.
  let weeklyReviewHtml = '';
  if (weekday === 'Sunday') {
    const iso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    const D = 86400000;
    const wkStart = iso(new Date(now.getTime() - 7 * D));
    const priorStart = iso(new Date(now.getTime() - 14 * D));
    const { data: revDays } = await db.from('whoop_data').select('date,recovery_score,hrv,resting_hr,sleep_performance,strain').gte('date', priorStart).lt('date', todayLd);
    const { data: revActs } = await db.from('whoop_workouts').select('start_time,distance_m').gte('start_time', priorStart);
    const avg = (rows: any[], f: (r: any) => any) => { const v = rows.map(f).filter((x) => x != null).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const stats = (start: string, end: string) => {
      const ds = (revDays || []).filter((d: any) => d.date >= start && d.date < end);
      const as = (revActs || []).filter((a: any) => a.start_time && a.start_time.slice(0, 10) >= start && a.start_time.slice(0, 10) < end);
      return { recovery: avg(ds, (d) => d.recovery_score), hrv: avg(ds, (d) => d.hrv), rhr: avg(ds, (d) => d.resting_hr), sleep: avg(ds, (d) => d.sleep_performance), strain: avg(ds, (d) => d.strain), workouts: as.length, km: as.reduce((s: number, a: any) => s + (a.distance_m || 0), 0) / 1000, n: ds.length };
    };
    const cur = stats(wkStart, todayLd);
    const prev = stats(priorStart, wkStart);
    if (cur.n) {
      const row = (label: string, c: any, p: any, unit: string, dec: number, dir: string) => {
        if (c == null) return '';
        let d = '';
        if (p != null) {
          const delta = c - p;
          const arrow = delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '–';
          const good = dir === 'up' ? delta > 0 : dir === 'down' ? delta < 0 : null;
          const color = Math.abs(delta) < 0.05 ? '#8a8f98' : (good ? '#1e7a46' : '#b45309');
          d = ` <span style="color:${color};font-size:11px;">${arrow} ${Math.abs(delta).toFixed(dec)}${unit}</span>`;
        }
        return `<p style="font-size:14px;margin:0 0 4px;"><span style="display:inline-block;min-width:112px;color:#6a6e76;">${label}</span>${c.toFixed(dec)}${unit}${d}</p>`;
      };
      weeklyReviewHtml = `<div style="background:#eef2f7;border:1px solid #d8dee8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 8px;">Last week in review</p>
        ${row('Recovery', cur.recovery, prev.recovery, '%', 0, 'up')}
        ${row('HRV', cur.hrv, prev.hrv, '', 0, 'up')}
        ${row('Resting HR', cur.rhr, prev.rhr, '', 0, 'down')}
        ${row('Sleep', cur.sleep, prev.sleep, '%', 0, 'up')}
        ${row('Avg strain', cur.strain, prev.strain, '', 1, 'neutral')}
        <p style="font-size:14px;margin:0;"><span style="display:inline-block;min-width:112px;color:#6a6e76;">Workouts</span>${cur.workouts}${cur.km >= 0.1 ? ` · ${cur.km.toFixed(1)} km` : ''}</p>
      </div>`;
    }
  }

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1a1e26;">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8f98;margin:0 0 2px;">Life OS · Morning Brief</p>
      <h1 style="font-size:22px;margin:0 0 16px;">${weekday}, ${dateLabel}</h1>
      <div style="background:#f4f5f7;border:1px solid #e1e3e8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 6px;">Readiness</p>
        <p style="font-size:14px;line-height:1.5;margin:0;">${summary}</p>
      </div>
      ${weeklyReviewHtml}
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
      ${dueMaint.length ? `<div style="background:#f4f5f7;border:1px solid #e1e3e8;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 6px;">Home maintenance due</p>
        ${dueMaint.map((m) => `<p style="font-size:14px;margin:0 0 4px;">${m.over > 0 ? '⚠️ ' : '• '}${m.name}${m.over > 0 ? ` <span style=\"color:#b45309;font-size:11px;\">(${m.over}d overdue)</span>` : ' <span style="color:#6a6e76;font-size:11px;">(due today)</span>'}</p>`).join('')}
      </div>` : ''}
      ${dueBenefits.length ? `<div style="background:#eef6f0;border:1px solid #cfe6d6;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a8f98;margin:0 0 6px;">Benefits</p>
        ${dueBenefits.map((b) => `<p style="font-size:14px;margin:0 0 4px;">${b.windowOpen ? '✅ ' : (b.inDays === 0 ? '🎉 ' : '• ')}${b.name}${b.windowOpen ? ` <span style=\"color:#1e7a46;font-size:11px;\">(window open — ${b.note})</span>` : (b.inDays === 0 ? ' <span style=\"color:#1e7a46;font-size:11px;\">(today)</span>' : ` <span style=\"color:#6a6e76;font-size:11px;\">(in ${b.inDays}d)</span>`)}</p>`).join('')}
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

// Life OS — Reminder Check Edge Function
//
// Runs frequently (cron, every few minutes). Emails a heads-up ~15 minutes
// before any timed reminder is due, then marks it notified. Scheduler-only.
//
// Secrets: RESEND_API_KEY, BRIEF_EMAIL, CRON_SECRET
// Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const BRIEF_EMAIL = Deno.env.get('BRIEF_EMAIL');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');

  // Scheduler-only.
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'Not authenticated' }, 401);
  }
  if (!RESEND_API_KEY || !BRIEF_EMAIL) return json({ error: 'RESEND_API_KEY / BRIEF_EMAIL not set' }, 500);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const in15 = new Date(now.getTime() + 15 * 60 * 1000);

  // Timed reminders coming due within the next 15 minutes, not yet notified.
  const { data: due, error } = await db.from('reminders')
    .select('id,text,due_at')
    .eq('notified', false)
    .eq('done', false)
    .gt('due_at', now.toISOString())
    .lte('due_at', in15.toISOString());
  if (error) return json({ error: 'Query failed', detail: error.message }, 500);
  if (!due || !due.length) return json({ checked: true, sent: 0 });

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const esc = (s: string) => String(s).replace(/[<>]/g, '');

  // Rest of today's schedule: upcoming reminders + recurring blocks (ET).
  const tz = 'America/New_York';
  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const nowHHMM = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const dowName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now);
  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dowName);
  const etHHMM = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const fmt12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM'); };

  const { data: rest } = await db.from('reminders')
    .select('id,text,due_at')
    .eq('date', todayEt).eq('done', false)
    .gt('due_at', now.toISOString())
    .order('due_at', { ascending: true });
  const { data: sched } = await db.from('daily_schedule').select('label,time,dows').eq('active', true);
  const blocks = (sched || [])
    .filter((b: any) => { const d = b.dows || []; return (d.length === 0 || d.includes(dow)) && b.time > nowHHMM; })
    .map((b: any) => ({ time: b.time, label: b.label, kind: 'block', id: -1 }));

  const restHtml = (excludeId: number) => {
    const items = [
      ...blocks,
      ...(rest || []).filter((x: any) => x.id !== excludeId).map((x: any) => ({ time: etHHMM(x.due_at), label: x.text, kind: 'rem', id: x.id })),
    ].sort((a, b) => a.time.localeCompare(b.time));
    const inner = items.length
      ? items.map((x) => `<p style="font-size:13px;margin:0 0 3px;color:#2a2e36;"><span style="display:inline-block;min-width:74px;color:#6a6e76;">${fmt12(x.time)}</span>${esc(x.label)}${x.kind === 'rem' ? ' <span style="color:#2c5080;font-size:11px;">(reminder)</span>' : ''}</p>`).join('')
      : '<p style="font-size:12px;color:#8a8f98;margin:0;">Nothing else scheduled today.</p>';
    return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e1e3e8;">
      <p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8a8f98;margin:0 0 6px;">Rest of today</p>${inner}</div>`;
  };

  let sent = 0;
  for (const r of due) {
    const when = fmtTime(r.due_at);
    const mins = Math.max(1, Math.round((new Date(r.due_at).getTime() - now.getTime()) / 60000));
    const html = `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;color:#1a1e26;">
        <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8f98;margin:0 0 4px;">Life OS · Reminder</p>
        <h1 style="font-size:20px;margin:0 0 8px;">${esc(r.text)}</h1>
        <p style="font-size:14px;color:#2a2e36;margin:0;">In ${mins} minute${mins === 1 ? '' : 's'} — ${when}.</p>
        ${restHtml(r.id)}
      </div>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Life OS <onboarding@resend.dev>',
        to: BRIEF_EMAIL,
        subject: `Reminder ${when}: ${String(r.text).slice(0, 60)}`,
        html,
      }),
    });
    if (res.ok) {
      await db.from('reminders').update({ notified: true }).eq('id', r.id);
      sent++;
    }
  }

  return json({ checked: true, sent });
});

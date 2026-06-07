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

  let sent = 0;
  for (const r of due) {
    const when = fmtTime(r.due_at);
    const mins = Math.max(1, Math.round((new Date(r.due_at).getTime() - now.getTime()) / 60000));
    const html = `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;color:#1a1e26;">
        <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8f98;margin:0 0 4px;">Life OS · Reminder</p>
        <h1 style="font-size:20px;margin:0 0 8px;">${String(r.text).replace(/[<>]/g, '')}</h1>
        <p style="font-size:14px;color:#2a2e36;margin:0;">In ${mins} minute${mins === 1 ? '' : 's'} — ${when}.</p>
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

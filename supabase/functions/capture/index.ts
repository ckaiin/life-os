// Life OS — Quick Capture Edge Function
//
// Takes a free-text (dictated) brain dump and uses Claude to split it into
// notes (for today) and dated reminders, then stores them. Returns the parse
// so the UI can confirm. Deploy with Verify JWT OFF (verifies user itself).
//
// Secrets required: ANTHROPIC_API_KEY
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500);

  // Require a logged-in user.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Not authenticated' }, 401);
  const { data: { user } } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const text = (body.text || '').toString().trim();
  if (!text) return json({ error: 'Nothing to capture' }, 400);

  const tz = 'America/New_York';
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now);

  // Ask Claude to structure the dump.
  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You organize a person's spoken brain-dump into structured data for their personal dashboard. ` +
        `Today is ${weekday}, ${today} (timezone America/New_York). ` +
        `NOTES are observations, things that happened, or thoughts about today. ` +
        `REMINDERS are things to do or remember on a specific day; resolve relative dates ("tomorrow", "Friday", "next week") to an absolute YYYY-MM-DD based on today. ` +
        `If a reminder has no clear day, use today's date. Keep each item concise and first-person. Split distinct items apart.`,
      tools: [{
        name: 'save_capture',
        description: 'Save the parsed notes and reminders.',
        input_schema: {
          type: 'object',
          properties: {
            notes: { type: 'array', items: { type: 'string' }, description: 'Notes for today.' },
            reminders: {
              type: 'array',
              items: {
                type: 'object',
                properties: { date: { type: 'string', description: 'YYYY-MM-DD' }, text: { type: 'string' } },
                required: ['date', 'text'],
              },
            },
          },
          required: ['notes', 'reminders'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_capture' },
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!aiRes.ok) return json({ error: 'AI parse failed', detail: await aiRes.text() }, 502);
  const ai = await aiRes.json();
  const toolUse = (ai.content || []).find((c: any) => c.type === 'tool_use');
  const parsed = toolUse?.input || { notes: [], reminders: [] };
  const notes: string[] = Array.isArray(parsed.notes) ? parsed.notes : [];
  const reminders: any[] = Array.isArray(parsed.reminders) ? parsed.reminders : [];

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  if (notes.length) {
    await db.from('daily_notes').insert(notes.map((t) => ({ date: today, text: String(t) })));
  }
  const remRows = reminders
    .filter((r) => r && r.text)
    .map((r) => ({ date: isDate(r.date) ? r.date : today, text: String(r.text) }));
  if (remRows.length) {
    await db.from('reminders').insert(remRows);
  }

  return json({ notes: notes.length, reminders: remRows.length, parsed: { notes, reminders: remRows } });
});

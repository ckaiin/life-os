// Life OS — Quote Edge Function
//
// Returns latest prices for a list of symbols (Yahoo Finance, no key).
// Server-side to avoid browser CORS + Yahoo bot-blocking. User-auth.
// Deploy with Verify JWT OFF (verifies the user itself).
//
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY

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

  // Require a logged-in user.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Not authenticated' }, 401);
  const { data: { user } } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const symbols: string[] = Array.isArray(body.symbols)
    ? body.symbols.map((s: any) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 25)
    : [];
  if (!symbols.length) return json({ prices: {}, at: new Date().toISOString() });

  const prices: Record<string, { price: number | null; name: string | null }> = {};
  await Promise.all(symbols.map(async (sym) => {
    try {
      const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym), {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });
      if (!r.ok) { prices[sym] = { price: null, name: null }; return; }
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      prices[sym] = { price: meta?.regularMarketPrice ?? null, name: meta?.longName ?? meta?.shortName ?? null };
    } catch (_) {
      prices[sym] = { price: null, name: null };
    }
  }));

  return json({ prices, at: new Date().toISOString() });
});

// Life OS — Whoop OAuth handshake Edge Function
//
// Two roles, both on this one URL:
//   1. action=start (POST, authenticated) -> returns the Whoop authorize URL.
//   2. OAuth callback (GET with ?code&state) -> Whoop redirects the browser
//      here; we exchange the code for tokens, store them, then redirect back
//      to the app.
//
// The Client Secret never leaves the server. Deploy with "Verify JWT" OFF
// (this is a public OAuth callback); the start action verifies the user itself.
//
// Secrets required:
//   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, WHOOP_REDIRECT_URI, APP_URL
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const SCOPES = 'read:recovery read:cycles read:sleep read:profile offline';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
  const REDIRECT_URI = Deno.env.get('WHOOP_REDIRECT_URI');
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://ckaiin.github.io/life-os/';

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return json({ error: 'Whoop secrets not set (WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET / WHOOP_REDIRECT_URI)' }, 500);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // ---- OAuth callback: Whoop redirected the browser back here ----
  if (code) {
    // Validate the state nonce we stored when the handshake started.
    const { data: row } = await db.from('whoop_tokens').select('oauth_state').eq('id', 1).maybeSingle();
    if (!row || !row.oauth_state || row.oauth_state !== state) {
      return new Response('Invalid OAuth state', { status: 400 });
    }
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const txt = await res.text();
      return new Response('Token exchange failed: ' + txt, { status: 502 });
    }
    const tok = await res.json();
    const expiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString();
    await db.from('whoop_tokens').upsert({
      id: 1,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: expiresAt,
      oauth_state: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // Back to the app.
    return new Response(null, { status: 302, headers: { Location: APP_URL + '?whoop=connected' } });
  }

  // ---- Start: authenticated app asks for the authorize URL ----
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Not authenticated' }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Not authenticated' }, 401);

  const nonce = crypto.randomUUID();
  await db.from('whoop_tokens').upsert({ id: 1, oauth_state: nonce, updated_at: new Date().toISOString() }, { onConflict: 'id' });

  const authorize = `${AUTH_URL}?${new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: nonce,
  })}`;
  return json({ url: authorize });
});

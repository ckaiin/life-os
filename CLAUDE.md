# Life OS — working context for Claude

This repo IS the single source of truth. Edit files here, commit, push to `main` →
GitHub Pages auto-deploys to https://ckaiin.github.io/life-os/ in ~1 min. No build step.
Read `README.md` for full architecture; this file is the operating cheat-sheet.

## Who this is for
Conor — 22, starting as a Sales Associate at Chef's Warehouse (Westchester) on June 29, 2026.
Uses Life OS daily. **Writing style:** no em-dashes; no AI filler ("furthermore", "delve",
"it's worth noting"); direct, grounded; evaluate ideas before agreeing and call out
comfort-driven choices. Don't lead with praise.

## Golden rules
- **Bump the footer version on every change to `index.html`** — two `.version-tag` lines
  (main "Version X.Y" + a one-line changelog). Currently **2.19**; next is 2.20.
- **Never commit secrets.** API keys/tokens live only in Supabase Edge Function secrets.
  Committed files use placeholders (e.g. `<YOUR_CRON_SECRET>` in `supabase/sql/06-cron.sql`).
- **All Edge Functions must have Verify JWT OFF** (they auth internally; on = broken CORS preflight).
- Push needs a GitHub fine-grained PAT (Contents R/W on `ckaiin/life-os`) that Conor pastes in-chat.
  Use it inline for the push; don't store it in the repo or git config.
- Do not rewrite working code or restart from scratch. Migrate incrementally; design/UX stay.

## Layout
- `index.html` — the entire app.
- `supabase/functions/<fn>/index.ts` — Edge Function sources (deploy via Supabase dashboard).
  Functions: hevy-sync, whoop-sync, whoop-auth, morning-brief, capture-function.
- `supabase/sql/0N-*.sql` — run in Supabase SQL Editor, in order.
- `docs/HANDOFF.md` — original architecture handoff (historical).

## Backend (Supabase project bvecxrwdmddaduwxynfe)
- `kv_store` mirrors localStorage 1:1 via a JS Proxy. Auth: password (sign-ups disabled).
- Tables: kv_store, hevy_workouts, whoop_tokens, whoop_data, whoop_workouts, daily_notes, reminders.
- Daily `__backup_<date>` snapshots in kv_store; "Download Backup" button for off-site copies.
- Integrations: Hevy (lifting + PRs), Whoop (recovery/sleep/strain + detected activities).
- Proactive: pg_cron runs 3h syncs + 6 AM ET morning brief (emailed via Resend).
- Quick capture: dictate/type → capture-function → Claude Haiku → notes + dated reminders.
- Secrets needed (Supabase only): HEVY_API_KEY, WHOOP_CLIENT_ID/SECRET, WHOOP_REDIRECT_URI,
  APP_URL, RESEND_API_KEY, BRIEF_EMAIL (= conorkain76@gmail.com), ANTHROPIC_API_KEY, CRON_SECRET.

## Status & next
All planned features built through v2.19. **Next: Finance module** (budget/paycheck planner,
Roth IRA + net-worth tracking, draw-structure modeling) — start once Conor has his official
offer letter with definitive salary/draw numbers.

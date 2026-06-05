# Life OS

Conor's personal daily-use dashboard. Single-file web app (`index.html`) hosted on
GitHub Pages, backed by Supabase (auth, Postgres, Edge Functions) and connected to
Whoop and Hevy. **Live:** https://ckaiin.github.io/life-os/

---

## How it works

- **Frontend:** one `index.html` (~300KB). No build step. Pushing to `main` auto-deploys via GitHub Pages.
- **Backend:** Supabase project `bvecxrwdmddaduwxynfe`.
  - `kv_store` table mirrors localStorage 1:1 via a JS `Proxy`, so all existing client code syncs to the cloud with no changes.
  - Magic-link / password auth; sign-ups disabled (single-user). Data tables use permissive RLS (`authenticated` only).
  - Daily `__backup_<date>` snapshots in `kv_store` + a "Download Backup" button.
- **Integrations:** Hevy (lifting), Whoop (recovery/sleep/strain + detected activities). API keys live only as Supabase secrets, never in this repo; browser talks to Edge Functions, which talk to the vendor APIs.
- **Proactive layer:** pg_cron calls the sync functions every 3h and the morning brief daily; the brief is emailed via Resend.
- **Quick capture:** dictated/typed brain-dump → `capture-function` → Claude (Haiku) splits it into notes + dated reminders.

## Repo layout

```
index.html                      # the whole app
privacy.html                    # privacy policy (required by Whoop app)
audio/                          # greeting mp3s
docs/HANDOFF.md                 # original architecture handoff (historical)
supabase/
  functions/                    # Edge Function sources (deploy via Supabase dashboard)
    hevy-sync/                   #   pulls Hevy workouts -> hevy_workouts
    whoop-auth/                  #   Whoop OAuth handshake
    whoop-sync/                  #   pulls Whoop recovery/sleep/cycle/workouts
    morning-brief/               #   composes + emails the daily brief (Resend)
    capture-function/            #   LLM-parses captures -> daily_notes + reminders
  sql/                          # run in Supabase SQL Editor, in order
    01-kv-store.sql  02-hevy.sql  03-whoop.sql
    04-whoop-workouts.sql  05-notes.sql  06-cron.sql
```

## Edge Functions

Deploy each via the Supabase dashboard. **Turn Verify JWT OFF on all of them** — they
verify the user (or the cron secret) internally; leaving it on breaks the CORS preflight.

| Function | Purpose |
|---|---|
| hevy-sync | Sync Hevy workouts |
| whoop-auth | Whoop OAuth (start + callback) |
| whoop-sync | Sync Whoop recovery/sleep/cycle/activities |
| morning-brief | Compose + email daily brief |
| capture-function | Parse a brain-dump into notes/reminders |

## Required Supabase secrets

```
HEVY_API_KEY          # Hevy Pro API key
WHOOP_CLIENT_ID
WHOOP_CLIENT_SECRET
WHOOP_REDIRECT_URI    # https://bvecxrwdmddaduwxynfe.supabase.co/functions/v1/whoop-auth
APP_URL               # https://ckaiin.github.io/life-os/
RESEND_API_KEY        # for the morning brief
BRIEF_EMAIL           # recipient (must match Resend account email)
ANTHROPIC_API_KEY     # for quick-capture parsing
CRON_SECRET           # shared secret for the pg_cron jobs (see 06-cron.sql)
```
The publishable Supabase key is safe in `index.html` (RLS-protected). Everything above is server-side only.

## Deploy / workflow

- Edit `index.html` here, commit, push to `main` → GitHub Pages updates in ~1 min.
- Bump the footer version on every change (two `.version-tag` lines).
- SQL/function changes: run the SQL file / redeploy the function in the Supabase dashboard.

## Project memory & sessions

Claude Code project memory lives under `~/.claude/projects/-Users-conorkain-Desktop-Main/memory/`,
which is keyed to the launch directory **`~/Desktop/Main`**. Start Claude Code sessions
from `~/Desktop/Main` so the project history loads; edit this repo by absolute path.
`memory/project_life_os.md` holds the current architecture, version, and status.

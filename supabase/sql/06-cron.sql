-- Life OS — scheduled server-side sync (runs even when the app is closed)
-- Prereqs:
--   1. Set an Edge Function secret  CRON_SECRET = <YOUR_CRON_SECRET>
--      (same value used in the headers below)
--   2. Redeploy hevy-sync and whoop-sync (they now accept the cron secret).
-- Run this whole file in Supabase → SQL Editor.

-- Extensions (Supabase ships these; safe to run if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Hevy sync every 3 hours
select cron.schedule('life-os-hevy-sync', '0 */3 * * *', $$
  select net.http_post(
    url := 'https://bvecxrwdmddaduwxynfe.supabase.co/functions/v1/hevy-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CRON_SECRET>'
    )
  );
$$);

-- Whoop sync every 3 hours (offset 5 min so they don't fire simultaneously)
select cron.schedule('life-os-whoop-sync', '5 */3 * * *', $$
  select net.http_post(
    url := 'https://bvecxrwdmddaduwxynfe.supabase.co/functions/v1/whoop-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CRON_SECRET>'
    )
  );
$$);

-- Morning brief: daily at 10:00 UTC (6:00 AM Eastern during EDT)
select cron.schedule('life-os-morning-brief', '0 10 * * *', $$
  select net.http_post(
    url := 'https://bvecxrwdmddaduwxynfe.supabase.co/functions/v1/morning-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CRON_SECRET>'
    )
  );
$$);

-- Timed reminder check every 5 minutes (emails ~15 min before a due reminder)
select cron.schedule('life-os-reminder-check', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://bvecxrwdmddaduwxynfe.supabase.co/functions/v1/reminder-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CRON_SECRET>'
    )
  );
$$);

-- Useful management queries:
--   select * from cron.job;                        -- list jobs
--   select * from cron.job_run_details order by start_time desc limit 10;  -- recent runs
--   select cron.unschedule('life-os-hevy-sync');   -- remove a job

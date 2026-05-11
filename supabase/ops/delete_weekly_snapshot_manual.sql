-- Run in Supabase Dashboard → SQL Editor (postgres role bypasses RLS).
-- Step 1: List all snapshots (confirm the row to remove).
select id, label, report_date, created_at
from public.weekly_snapshots
order by report_date desc;

-- Step 2: Delete ONE snapshot after confirming id or unique report_date.
-- Example: report tied to 2026-04-22 (adjust id/date to match your row from Step 1).
delete from public.weekly_snapshots
where id = '00000000-0000-0000-0000-000000000000';  -- replace with real uuid

-- OR, only if exactly one row has this date:
-- delete from public.weekly_snapshots
-- where report_date = '2026-04-22';

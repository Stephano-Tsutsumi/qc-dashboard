-- Allow any signed-in user to delete weekly snapshots (small team / triage tool).
-- Previously only imported_by could delete, which blocked cleanup if uids differed.
drop policy if exists "Importers can delete their own snapshots" on public.weekly_snapshots;

create policy "Authenticated users can delete weekly snapshots"
  on public.weekly_snapshots for delete
  to authenticated
  using (true);

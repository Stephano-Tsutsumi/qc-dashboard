alter table public.issues           enable row level security;
alter table public.issue_states     enable row level security;
alter table public.comments         enable row level security;
alter table public.activity_log     enable row level security;
alter table public.weekly_snapshots enable row level security;

create policy "Authenticated users can read issues"
  on public.issues for select
  to authenticated
  using (true);

create policy "Authenticated users can read issue states"
  on public.issue_states for select
  to authenticated
  using (true);

create policy "Authenticated users can insert issue states"
  on public.issue_states for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update issue states"
  on public.issue_states for update
  to authenticated
  using (true);

create policy "Authenticated users can read comments"
  on public.comments for select
  to authenticated
  using (true);

create policy "Authenticated users can post comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "Authenticated users can read activity log"
  on public.activity_log for select
  to authenticated
  using (true);

create policy "Authenticated users can insert activity log"
  on public.activity_log for insert
  to authenticated
  with check (true);

create policy "Authenticated users can read weekly snapshots"
  on public.weekly_snapshots for select
  to authenticated
  using (true);

create policy "Authenticated users can insert weekly snapshots"
  on public.weekly_snapshots for insert
  to authenticated
  with check (true);

create policy "Importers can delete their own snapshots"
  on public.weekly_snapshots for delete
  to authenticated
  using (auth.uid() = imported_by);

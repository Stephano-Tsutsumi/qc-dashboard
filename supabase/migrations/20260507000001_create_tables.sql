-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── issues ───────────────────────────────────────────────────────────────────
create table public.issues (
  id          text        primary key,
  priority    text        not null
                          check (priority in ('p0','p1','p2','p3')),
  title       text        not null,
  description text,
  created_at  timestamptz not null default now()
);

comment on table public.issues is
  'The 32 hardcoded AVA failure modes. Seeded once, never modified at runtime.';

-- ─── issue_states ─────────────────────────────────────────────────────────────
create table public.issue_states (
  issue_id     text        primary key references public.issues(id) on delete cascade,
  status       text        not null default 'open'
                           check (status in ('open','in-progress','resolved','blocked')),
  jira_ticket  text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid        references auth.users(id) on delete set null
);

comment on table public.issue_states is
  'Collaborative state for each issue: status, Jira ticket link.';

-- ─── comments ─────────────────────────────────────────────────────────────────
create table public.comments (
  id          uuid        primary key default gen_random_uuid(),
  issue_id    text        not null references public.issues(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete set null,
  user_name   text        not null,
  user_initials text      not null,
  user_color  text        not null default '#4a47e0',
  body        text        not null,
  created_at  timestamptz not null default now()
);

comment on table public.comments is 'Team comments on individual issues.';

create index comments_issue_id_idx on public.comments (issue_id);
create index comments_created_at_idx on public.comments (created_at desc);

-- ─── activity_log ─────────────────────────────────────────────────────────────
create table public.activity_log (
  id          uuid        primary key default gen_random_uuid(),
  issue_id    text        not null references public.issues(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete set null,
  user_name   text        not null,
  type        text        not null
                          check (type in ('status','jira','comment')),
  description text        not null,
  created_at  timestamptz not null default now()
);

create index activity_log_issue_id_idx on public.activity_log (issue_id);

-- ─── weekly_snapshots ─────────────────────────────────────────────────────────
create table public.weekly_snapshots (
  id                uuid        primary key default gen_random_uuid(),
  label             text        not null,
  report_date       date        not null,
  call_count        integer,
  low_score_count   integer,
  avg_score         numeric(5,2),
  issues_detected   integer,
  ai_summary        text,
  ai_recommendations text,
  stats_json        jsonb       not null default '{}',
  csv_filename      text,
  imported_by       uuid        references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table public.weekly_snapshots is
  'One row per imported CSV. Stores aggregate stats and AI analysis.';

create index weekly_snapshots_report_date_idx on public.weekly_snapshots (report_date desc);

-- ─── Automatic updated_at trigger ─────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_issue_states_updated_at
  before update on public.issue_states
  for each row execute function update_updated_at_column();

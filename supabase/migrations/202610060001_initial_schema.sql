create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  institution text,
  program text,
  account_role text not null default 'student' check (account_role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.career_roles (
  id text primary key,
  title text not null,
  summary text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.skills (
  id text primary key,
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.skill_aliases (
  alias text primary key,
  skill_id text not null references public.skills (id) on delete cascade
);

create table public.role_skill_requirements (
  role_id text not null references public.career_roles (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete cascade,
  required_level smallint not null check (required_level between 1 and 5),
  importance_weight smallint not null check (importance_weight between 1 and 5),
  why_it_matters text not null,
  suggested_next_step text not null,
  primary key (role_id, skill_id)
);

create table public.user_role_targets (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id text not null references public.career_roles (id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create unique index user_one_primary_role_idx
  on public.user_role_targets (user_id)
  where is_primary;

create table public.skill_assessments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  skill_id text not null references public.skills (id) on delete restrict,
  proficiency smallint not null check (proficiency between 0 and 5),
  validation_status text not null default 'self_reported'
    check (validation_status in ('self_reported', 'evidence_submitted', 'verified')),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  assessed_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  primary key (user_id, skill_id),
  check ((validation_status <> 'verified') or (reviewed_by is not null and reviewed_at is not null))
);

create table public.readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id text not null references public.career_roles (id) on delete restrict,
  readiness_score smallint not null check (readiness_score between 0 and 100),
  skills_met smallint not null check (skills_met >= 0),
  skills_total smallint not null check (skills_total >= skills_met),
  engine_version text not null,
  analysis_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index readiness_snapshots_user_role_time_idx
  on public.readiness_snapshots (user_id, role_id, created_at desc);
create index skill_assessments_skill_idx on public.skill_assessments (skill_id);
create index user_role_targets_role_idx on public.user_role_targets (role_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and account_role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.career_roles enable row level security;
alter table public.skills enable row level security;
alter table public.skill_aliases enable row level security;
alter table public.role_skill_requirements enable row level security;
alter table public.user_role_targets enable row level security;
alter table public.skill_assessments enable row level security;
alter table public.readiness_snapshots enable row level security;

create policy "Users read own profile or admins read all"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));
create policy "Users update own non-admin profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()))
  with check ((select public.is_admin()) or ((select auth.uid()) = id and account_role = 'student'));

create policy "Authenticated users read active roles"
  on public.career_roles for select to authenticated using (is_active or (select public.is_admin()));
create policy "Admins manage roles"
  on public.career_roles for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Authenticated users read skills"
  on public.skills for select to authenticated using (true);
create policy "Admins manage skills"
  on public.skills for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Authenticated users read aliases"
  on public.skill_aliases for select to authenticated using (true);
create policy "Admins manage aliases"
  on public.skill_aliases for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Authenticated users read role requirements"
  on public.role_skill_requirements for select to authenticated using (true);
create policy "Admins manage role requirements"
  on public.role_skill_requirements for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Users manage own role targets"
  on public.user_role_targets for all to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()))
  with check ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "Users read own skill assessments or admins read all"
  on public.skill_assessments for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "Users manage own unverified assessments"
  on public.skill_assessments for insert to authenticated
  with check ((select auth.uid()) = user_id and validation_status <> 'verified');
create policy "Users update own unverified assessments"
  on public.skill_assessments for update to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()))
  with check ((select public.is_admin()) or ((select auth.uid()) = user_id and validation_status <> 'verified'));
create policy "Users delete own unverified assessments"
  on public.skill_assessments for delete to authenticated
  using ((select auth.uid()) = user_id and validation_status <> 'verified');

create policy "Users read own readiness history or admins read all"
  on public.readiness_snapshots for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

insert into public.career_roles (id, title, summary) values
  ('data-analyst', 'Data Analyst', 'Turn raw data into clear decisions through analysis and communication.'),
  ('software-engineer', 'Software Engineer', 'Design, build, and verify software that solves practical problems.'),
  ('product-designer', 'Product Designer', 'Shape useful digital experiences through research, interaction, and iteration.')
on conflict (id) do update set title = excluded.title, summary = excluded.summary;

insert into public.skills (id, name) values
  ('sql', 'SQL'), ('spreadsheets', 'Spreadsheets'), ('python', 'Python'),
  ('statistics', 'Statistics'), ('data-storytelling', 'Data storytelling'),
  ('git', 'Git'), ('apis', 'API design'), ('databases', 'Databases'), ('testing', 'Testing'),
  ('user-research', 'User research'), ('interaction-design', 'Interaction design'),
  ('visual-design', 'Visual design'), ('prototyping', 'Prototyping'), ('accessibility', 'Accessibility')
on conflict (id) do update set name = excluded.name;

insert into public.skill_aliases (alias, skill_id) values
  ('excel', 'spreadsheets'), ('spreadsheet', 'spreadsheets'),
  ('storytelling', 'data-storytelling'), ('data storytelling', 'data-storytelling'),
  ('api', 'apis'), ('rest apis', 'apis'), ('ux research', 'user-research')
on conflict (alias) do update set skill_id = excluded.skill_id;

insert into public.role_skill_requirements
  (role_id, skill_id, required_level, importance_weight, why_it_matters, suggested_next_step)
values
  ('data-analyst', 'sql', 4, 5, 'Most analyst roles depend on querying reliable data from relational sources.', 'Write joins, window functions, and a short query for a real dataset.'),
  ('data-analyst', 'spreadsheets', 3, 3, 'Spreadsheets remain a common tool for quick analysis and stakeholder handoffs.', 'Build a pivot-table report with documented assumptions.'),
  ('data-analyst', 'python', 3, 4, 'Python helps automate repeatable analysis and work with larger datasets.', 'Clean and explore a public dataset with pandas.'),
  ('data-analyst', 'statistics', 3, 4, 'Sound statistical reasoning prevents misleading conclusions from noisy data.', 'Explain a confidence interval and test one hypothesis with data.'),
  ('data-analyst', 'data-storytelling', 2, 3, 'Analysis is useful when people can understand the finding and act on it.', 'Present one chart with a finding, evidence, and a decision.'),
  ('software-engineer', 'python', 4, 5, 'Strong programming fundamentals support implementation and debugging work.', 'Build a small typed service and document its design decisions.'),
  ('software-engineer', 'git', 3, 3, 'Version control is essential for collaborating safely on shared code.', 'Practice a feature branch, reviewable commits, and a merge conflict.'),
  ('software-engineer', 'apis', 3, 4, 'Most software products rely on stable interfaces between components.', 'Design and test a REST endpoint with input validation.'),
  ('software-engineer', 'databases', 3, 3, 'Applications need reliable data models, queries, and persistence.', 'Model a relational feature and add constraints and indexes.'),
  ('software-engineer', 'testing', 3, 4, 'Tests catch regressions and make changes safer to review and ship.', 'Add unit and integration tests for a feature''s edge cases.'),
  ('product-designer', 'user-research', 4, 5, 'Research grounds design choices in real user needs and constraints.', 'Run three structured interviews and synthesize recurring needs.'),
  ('product-designer', 'interaction-design', 4, 5, 'Clear interaction patterns make complex workflows understandable.', 'Prototype one end-to-end workflow and test it with a user.'),
  ('product-designer', 'visual-design', 3, 3, 'Visual hierarchy helps people scan, understand, and trust an interface.', 'Create a responsive screen with a consistent type and spacing system.'),
  ('product-designer', 'prototyping', 3, 4, 'Prototypes make ideas testable before expensive implementation begins.', 'Prototype a high-risk interaction and observe a usability session.'),
  ('product-designer', 'accessibility', 3, 4, 'Accessible products work for more people and meet essential quality standards.', 'Audit keyboard access, contrast, and screen-reader labels on a flow.')
on conflict (role_id, skill_id) do update set
  required_level = excluded.required_level,
  importance_weight = excluded.importance_weight,
  why_it_matters = excluded.why_it_matters,
  suggested_next_step = excluded.suggested_next_step;
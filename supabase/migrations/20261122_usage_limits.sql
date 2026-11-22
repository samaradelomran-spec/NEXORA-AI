-- NEXORA AI daily generation limits.
-- Default starting limits: Free 10 jobs/day, Pro 100 jobs/day.
-- Values can be changed in this table or overridden by server environment variables.

create table if not exists public.plan_limits (
  plan text primary key,
  daily_generation_limit integer not null check (daily_generation_limit > 0)
);

insert into public.plan_limits (plan, daily_generation_limit)
values ('free', 10), ('pro', 100)
on conflict (plan) do nothing;

alter table public.plan_limits enable row level security;

drop policy if exists "Authenticated users can read plan limits" on public.plan_limits;
create policy "Authenticated users can read plan limits"
on public.plan_limits
for select
to authenticated
using (true);

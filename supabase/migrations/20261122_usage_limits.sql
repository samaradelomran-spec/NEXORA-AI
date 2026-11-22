-- NEXORA AI daily generation limits by plan and service type.
-- Conservative starting limits; adjust after reviewing each provider's real costs.

create table if not exists public.plan_limits (
  plan text not null check (plan in ('free', 'pro')),
  service_type text not null,
  daily_generation_limit integer not null check (daily_generation_limit >= 0),
  primary key (plan, service_type)
);

insert into public.plan_limits (plan, service_type, daily_generation_limit) values
  ('free','assistant',10), ('free','web',3), ('free','games',3), ('free','cinema',3), ('free','series',3),
  ('free','image',1), ('free','video',1), ('free','audio',2), ('free','music',1), ('free','sound_effect',2),
  ('pro','assistant',40), ('pro','web',15), ('pro','games',15), ('pro','cinema',15), ('pro','series',15),
  ('pro','image',2), ('pro','video',1), ('pro','audio',5), ('pro','music',1), ('pro','sound_effect',5)
on conflict (plan, service_type) do nothing;

alter table public.plan_limits enable row level security;

drop policy if exists "Authenticated users can read plan limits" on public.plan_limits;
create policy "Authenticated users can read plan limits"
on public.plan_limits
for select
to authenticated
using (true);

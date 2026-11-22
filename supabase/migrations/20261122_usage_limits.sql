-- NEXORA AI daily generation limits and atomic job reservation.
-- Default starting limits: Free 10 jobs/day, Pro 100 jobs/day.
-- Change these values here or in the database before launch if required.

create table if not exists public.plan_limits (
  plan text primary key,
  daily_generation_limit integer not null check (daily_generation_limit > 0)
);

insert into public.plan_limits (plan, daily_generation_limit)
values ('free', 10), ('pro', 100)
on conflict (plan) do nothing;

alter table public.plan_limits enable row level security;

create or replace function public.reserve_generation_job(
  p_service_type text,
  p_prompt text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_limit integer := 10;
  v_used integer := 0;
  v_job_id uuid;
  v_today timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select s.plan
    into v_plan
    from public.subscriptions s
   where s.owner_id = v_user_id
     and s.status in ('active', 'trialing')
   limit 1;

  if v_plan is distinct from 'pro' then
    v_plan := 'free';
  end if;

  select pl.daily_generation_limit
    into v_limit
    from public.plan_limits pl
   where pl.plan = v_plan;

  if v_limit is null then
    v_limit := case when v_plan = 'pro' then 100 else 10 end;
  end if;

  select count(*)
    into v_used
    from public.generation_jobs j
   where j.owner_id = v_user_id
     and j.created_at >= v_today
     and j.status in ('processing', 'queued', 'completed');

  if v_used >= v_limit then
    raise exception 'DAILY_LIMIT_REACHED:%', v_limit;
  end if;

  insert into public.generation_jobs (owner_id, service_type, prompt, status, result)
  values (v_user_id, p_service_type, p_prompt, 'processing', '{}'::jsonb)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke all on function public.reserve_generation_job(text, text) from public;
grant execute on function public.reserve_generation_job(text, text) to authenticated;

-- NEXORA AI prepaid credits ledger.
-- Apply in Supabase SQL Editor. All balance mutations are server-side RPCs only.

create table if not exists public.credit_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('purchase','usage','admin_adjustment','refund')),
  description text not null,
  idempotency_key text unique,
  created_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_owner_created_idx
  on public.credit_transactions(owner_id, created_at desc);

alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Users can read their own credit account" on public.credit_accounts;
create policy "Users can read their own credit account"
  on public.credit_accounts for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Users can read their own credit transactions" on public.credit_transactions;
create policy "Users can read their own credit transactions"
  on public.credit_transactions for select to authenticated
  using (owner_id = auth.uid());

revoke insert, update, delete on public.credit_accounts from anon, authenticated;
revoke insert, update, delete on public.credit_transactions from anon, authenticated;

create or replace function public.nexora_adjust_credits(
  p_owner_id uuid,
  p_amount bigint,
  p_description text,
  p_created_by uuid default null,
  p_transaction_type text default 'admin_adjustment',
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  if p_amount = 0 then raise exception 'Credit adjustment cannot be zero'; end if;
  if p_transaction_type not in ('purchase','admin_adjustment','refund') then
    raise exception 'Invalid credit transaction type';
  end if;
  if p_idempotency_key is not null and exists (
    select 1 from public.credit_transactions where idempotency_key = p_idempotency_key
  ) then
    select balance into new_balance from public.credit_accounts where owner_id = p_owner_id;
    return coalesce(new_balance, 0);
  end if;

  insert into public.credit_accounts(owner_id, balance)
  values (p_owner_id, 0)
  on conflict (owner_id) do nothing;

  update public.credit_accounts
    set balance = balance + p_amount, updated_at = now()
    where owner_id = p_owner_id and balance + p_amount >= 0
    returning balance into new_balance;

  if new_balance is null then raise exception 'Insufficient credits or account update failed'; end if;

  insert into public.credit_transactions(
    owner_id, amount, transaction_type, description, idempotency_key, created_by, metadata
  ) values (
    p_owner_id, p_amount, p_transaction_type, left(p_description, 240),
    p_idempotency_key, p_created_by, coalesce(p_metadata, '{}'::jsonb)
  );

  return new_balance;
end;
$$;

create or replace function public.nexora_spend_credits(
  p_owner_id uuid,
  p_amount bigint,
  p_description text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  if p_amount <= 0 then raise exception 'Spend amount must be positive'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;

  if exists (select 1 from public.credit_transactions where idempotency_key = p_idempotency_key) then
    select balance into new_balance from public.credit_accounts where owner_id = p_owner_id;
    return coalesce(new_balance, 0);
  end if;

  update public.credit_accounts
    set balance = balance - p_amount, updated_at = now()
    where owner_id = p_owner_id and balance >= p_amount
    returning balance into new_balance;

  if new_balance is null then raise exception 'Insufficient credits'; end if;

  insert into public.credit_transactions(
    owner_id, amount, transaction_type, description, idempotency_key, metadata
  ) values (
    p_owner_id, -p_amount, 'usage', left(p_description, 240), p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return new_balance;
end;
$$;

revoke all on function public.nexora_adjust_credits(uuid,bigint,text,uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.nexora_spend_credits(uuid,bigint,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.nexora_adjust_credits(uuid,bigint,text,uuid,text,text,jsonb) to service_role;
grant execute on function public.nexora_spend_credits(uuid,bigint,text,text,jsonb) to service_role;

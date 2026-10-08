-- Kharcha Book: database schema for Supabase.
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- Every table is locked to its owner with row level security, so each person
-- who signs up can only ever read and write their own rows.

create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type          text not null check (type in ('expense', 'income')),
  amount_paise  bigint not null check (amount_paise > 0 and amount_paise <= 10000000000),
  category      text not null,
  date          date not null,
  note          text not null default '',
  method        text not null default '',
  recurring_id  uuid,
  created_at    timestamptz not null default now(),
  -- stops the same recurring rule from creating two entries on the same day
  unique (user_id, recurring_id, date)
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);

create table if not exists public.budgets (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category      text not null,            -- a category id, or '_total' for the overall monthly budget
  amount_paise  bigint not null check (amount_paise > 0),
  primary key (user_id, category)
);

create table if not exists public.recurring (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type          text not null check (type in ('expense', 'income')),
  amount_paise  bigint not null check (amount_paise > 0),
  category      text not null,
  note          text not null default '',
  method        text not null default '',
  day_of_month  int  not null check (day_of_month between 1 and 31),
  start_date    date not null,
  end_date      date,
  active        boolean not null default true,
  -- last day the app created entries for this rule; keeps a deleted entry from coming back
  generated_through date,
  created_at    timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;
alter table public.recurring    enable row level security;

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own recurring" on public.recurring;
create policy "own recurring" on public.recurring
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

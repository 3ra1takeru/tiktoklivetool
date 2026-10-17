-- Run once in your Supabase project's SQL Editor. No public data policies.
create table if not exists public.listeners (
  customer_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tiktok_id text not null,
  profile jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  unique (owner_id, tiktok_id)
);
create table if not exists public.listener_chats (
  owner_id uuid not null references auth.users(id) on delete cascade,
  tiktok_id text not null,
  message_id text not null,
  message jsonb not null,
  sent_at bigint not null,
  primary key (owner_id, tiktok_id, message_id),
  foreign key (owner_id, tiktok_id) references public.listeners(owner_id, tiktok_id)
);
create index if not exists listener_chat_timeline on public.listener_chats(owner_id, tiktok_id, sent_at);
alter table public.listeners enable row level security;
alter table public.listener_chats enable row level security;
drop policy if exists own_listeners on public.listeners;
create policy own_listeners on public.listeners for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists own_chats on public.listener_chats;
create policy own_chats on public.listener_chats for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.listeners, public.listener_chats from anon, authenticated;
grant select, insert, update on public.listeners, public.listener_chats to authenticated;
-- Future channel links use customer_id. TikTok and LINE display names must never be used to infer identity.

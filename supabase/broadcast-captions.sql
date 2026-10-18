-- Separate broadcast subtitles from listener chats and customer records.
create table if not exists public.broadcast_captions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id text not null,
  caption_id text not null,
  broadcaster text not null,
  text text not null check (char_length(text) between 1 and 10000),
  language text not null,
  source_timestamp_ms text not null,
  captured_at bigint not null,
  source text not null default 'tiktok_caption' check (source = 'tiktok_caption'),
  primary key (owner_id, room_id, caption_id)
);
create index if not exists broadcast_caption_timeline on public.broadcast_captions(owner_id, broadcaster, captured_at desc);
alter table public.broadcast_captions enable row level security;
drop policy if exists own_broadcast_captions on public.broadcast_captions;
create policy own_broadcast_captions on public.broadcast_captions for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.broadcast_captions from anon, authenticated;
grant select, insert on public.broadcast_captions to authenticated;

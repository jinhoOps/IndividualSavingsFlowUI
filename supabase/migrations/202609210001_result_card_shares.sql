begin;

create table public.result_card_shares (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  object_path text not null unique check (object_path ~ '^shares/[0-9a-f-]{36}\\.png$'),
  state text not null check (state in ('pending','ready')),
  created_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  expires_at timestamptz,
  check ((state = 'pending' and published_at is null and expires_at is null) or
         (state = 'ready' and published_at is not null and expires_at is not null and expires_at > published_at)),
  unique (owner_id, request_id)
);

alter table public.result_card_shares enable row level security;
revoke all on table public.result_card_shares from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('result-card-shares', 'result-card-shares', false, 5242880, array['image/png'])
  on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/png'];

commit;

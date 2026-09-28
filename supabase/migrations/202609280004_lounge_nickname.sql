-- One immutable, explicitly confirmed Lounge nickname per account.
begin;
create function private.valid_lounge_nickname(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value is not null and length(value) between 2 and 20
    and value collate "C" !~ '[^A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ.@-]'
    and value collate "C" ~ '[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]'
    and value = normalize(value,NFC)
$$;
revoke all on function private.valid_lounge_nickname(text) from public,anon,authenticated,service_role;
grant execute on function private.valid_lounge_nickname(text) to lounge_rpc_owner;

create table public.lounge_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (private.valid_lounge_nickname(nickname)),
  created_at timestamptz not null default clock_timestamp()
);
create unique index lounge_nickname_unique on public.lounge_profiles(lower(nickname collate "C"));
alter table public.lounge_profiles enable row level security;
alter table public.lounge_profiles force row level security;
revoke all on public.lounge_profiles from public,anon,authenticated,service_role;
grant select,insert on public.lounge_profiles to lounge_rpc_owner;
-- The RPC role counts rows for the global cap; only the own-profile RPC exposes a row.
create policy lounge_profile_read on public.lounge_profiles for select to lounge_rpc_owner using ((select private.request_uid()) is not null);
create policy lounge_profile_insert on public.lounge_profiles for insert to lounge_rpc_owner with check (user_id=(select private.request_uid()));

create function private.freeze_lounge_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new is distinct from old then raise exception 'lounge nickname is immutable'; end if;
  return old;
end $$;
revoke all on function private.freeze_lounge_profile() from public,anon,authenticated,service_role;
create trigger lounge_profile_immutable before update on public.lounge_profiles for each row execute function private.freeze_lounge_profile();

create function private.enforce_lounge_nickname() returns trigger
language plpgsql set search_path = '' as $$
declare fixed_name text;
begin
  select nickname into fixed_name from public.lounge_profiles where user_id=new.owner_id;
  if fixed_name is null then raise exception 'lounge nickname required'; end if;
  new.alias := fixed_name;
  return new;
end $$;
revoke all on function private.enforce_lounge_nickname() from public,anon,authenticated,service_role;
grant execute on function private.enforce_lounge_nickname() to lounge_rpc_owner;
create trigger publication_fixed_nickname before insert or update on public.portfolio_publications for each row execute function private.enforce_lounge_nickname();

create function public.get_lounge_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.request_uid();
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  return (select jsonb_build_object('nickname',nickname) from public.lounge_profiles where user_id=uid);
end $$;

create function public.register_lounge_nickname(p_nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.request_uid(); current_name text; canonical text := normalize(p_nickname,NFC);
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,928));
  select nickname into current_name from public.lounge_profiles where user_id=uid;
  if found then return jsonb_build_object('status','exists','profile',jsonb_build_object('nickname',current_name)); end if;
  if not private.valid_lounge_nickname(canonical) then return jsonb_build_object('status','invalid'); end if;
  perform pg_advisory_xact_lock(928,3);
  if exists(select 1 from public.lounge_profiles where lower(nickname collate "C")=lower(canonical collate "C")) then return jsonb_build_object('status','taken'); end if;
  if (select count(*) from public.lounge_profiles)>=5000 then return jsonb_build_object('status','full'); end if;
  begin
    insert into public.lounge_profiles(user_id,nickname) values(uid,canonical);
  exception when unique_violation then return jsonb_build_object('status','taken'); end;
  -- Existing aliases become fixed only after the owner explicitly confirms a nickname.
  update public.portfolio_publications set alias=canonical,version=version+1 where owner_id=uid and alias is distinct from canonical;
  return jsonb_build_object('status','saved','profile',jsonb_build_object('nickname',canonical));
end $$;

create function public.publish_lounge_portfolio_v3(p_title text,p_note text,p_allocation jsonb,p_expected_version bigint default null,p_asset_band text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.request_uid(); fixed_name text;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  select nickname into fixed_name from public.lounge_profiles where user_id=uid;
  if not found then return jsonb_build_object('status','profile-required'); end if;
  return public.publish_lounge_portfolio_v2(p_title,fixed_name,p_note,p_allocation,p_expected_version,p_asset_band);
end $$;

grant create on schema public to lounge_rpc_owner;
alter function public.get_lounge_profile() owner to lounge_rpc_owner;
alter function public.register_lounge_nickname(text) owner to lounge_rpc_owner;
alter function public.publish_lounge_portfolio_v3(text,text,jsonb,bigint,text) owner to lounge_rpc_owner;
revoke all on function public.get_lounge_profile(),public.register_lounge_nickname(text),public.publish_lounge_portfolio_v3(text,text,jsonb,bigint,text) from public,anon,service_role;
grant execute on function public.get_lounge_profile(),public.register_lounge_nickname(text),public.publish_lounge_portfolio_v3(text,text,jsonb,bigint,text) to authenticated;
revoke create on schema public from lounge_rpc_owner;
commit;

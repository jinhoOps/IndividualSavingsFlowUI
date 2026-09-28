-- Account-owned nickname changes, serialized with publication writes.
begin;
alter table public.lounge_profiles
  add column nickname_changed_at timestamptz,
  add column nickname_version bigint not null default 1 check (nickname_version between 1 and 9007199254740991);

create function private.guard_lounge_profile_change() returns trigger
language plpgsql set search_path = '' as $$
declare changed_at timestamptz := clock_timestamp();
begin
  if new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at
    or new.user_id is distinct from private.request_uid() then raise exception 'profile ownership is immutable'; end if;
  if new.nickname is not distinct from old.nickname then
    if new is distinct from old then raise exception 'nickname metadata is server owned'; end if;
    return old;
  end if;
  if old.nickname_changed_at is not null and changed_at < old.nickname_changed_at + interval '48 hours' then
    raise exception 'nickname cooldown';
  end if;
  if not private.valid_lounge_nickname(new.nickname) then raise exception 'invalid nickname'; end if;
  new.nickname_changed_at := changed_at;
  new.nickname_version := old.nickname_version + 1;
  return new;
end $$;
revoke all on function private.guard_lounge_profile_change() from public,anon,authenticated,service_role;
grant execute on function private.guard_lounge_profile_change() to lounge_rpc_owner;
drop trigger lounge_profile_immutable on public.lounge_profiles;
drop function private.freeze_lounge_profile();
create trigger lounge_profile_change_guard before update on public.lounge_profiles for each row execute function private.guard_lounge_profile_change();
grant update(nickname) on public.lounge_profiles to lounge_rpc_owner;
create policy lounge_profile_update on public.lounge_profiles for update to lounge_rpc_owner
  using (user_id=(select private.request_uid())) with check (user_id=(select private.request_uid()));

create function public.get_lounge_profile_v2() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.request_uid();
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  return (select jsonb_build_object('nickname',nickname,'version',nickname_version,
    'nextChangeAt',nickname_changed_at + interval '48 hours','serverNow',clock_timestamp())
    from public.lounge_profiles where user_id=uid);
end $$;

create function public.change_lounge_nickname(p_nickname text,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.request_uid(); canonical text; profile public.lounge_profiles%rowtype;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  -- Bound normalization/regex work before accepting arbitrary client input.
  if p_nickname is null or octet_length(p_nickname)>240 or p_expected_version is null or p_expected_version<1 then
    return jsonb_build_object('status','invalid');
  end if;
  canonical := normalize(p_nickname,NFC);
  if not private.valid_lounge_nickname(canonical) then return jsonb_build_object('status','invalid'); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,928));
  select * into profile from public.lounge_profiles where user_id=uid for update;
  if not found then return jsonb_build_object('status','profile-required'); end if;
  -- A lost-response retry never extends the cooldown or increments versions twice.
  if canonical=profile.nickname then return jsonb_build_object('status','unchanged','profile',public.get_lounge_profile_v2()); end if;
  if p_expected_version<>profile.nickname_version then
    return jsonb_build_object('status','conflict','profile',public.get_lounge_profile_v2());
  end if;
  if profile.nickname_changed_at is not null and clock_timestamp()<profile.nickname_changed_at+interval '48 hours' then
    return jsonb_build_object('status','cooldown','profile',public.get_lounge_profile_v2());
  end if;
  begin
    update public.lounge_profiles set nickname=canonical where user_id=uid;
  exception when unique_violation then return jsonb_build_object('status','taken'); end;
  update public.portfolio_publications set alias=canonical,version=version+1 where owner_id=uid and alias is distinct from canonical;
  return jsonb_build_object('status','saved','profile',public.get_lounge_profile_v2());
end $$;

-- Preserve the original registration DTO for deployed clients; registration cannot rename.
create or replace function public.register_lounge_nickname(p_nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.request_uid(); current_name text; canonical text;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_nickname is null or octet_length(p_nickname)>240 then return jsonb_build_object('status','invalid'); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,928));
  select nickname into current_name from public.lounge_profiles where user_id=uid;
  if found then return jsonb_build_object('status','exists','profile',jsonb_build_object('nickname',current_name)); end if;
  canonical := normalize(p_nickname,NFC);
  if not private.valid_lounge_nickname(canonical) then return jsonb_build_object('status','invalid'); end if;
  perform pg_advisory_xact_lock(928,3);
  if exists(select 1 from public.lounge_profiles where lower(nickname collate "C")=lower(canonical collate "C")) then return jsonb_build_object('status','taken'); end if;
  if (select count(*) from public.lounge_profiles)>=5000 then return jsonb_build_object('status','full'); end if;
  begin
    insert into public.lounge_profiles(user_id,nickname) values(uid,canonical);
  exception when unique_violation then return jsonb_build_object('status','taken'); end;
  update public.portfolio_publications set alias=canonical,version=version+1 where owner_id=uid and alias is distinct from canonical;
  return jsonb_build_object('status','saved','profile',jsonb_build_object('nickname',canonical));
end $$;

grant create on schema public to lounge_rpc_owner;
alter function public.get_lounge_profile_v2() owner to lounge_rpc_owner;
alter function public.change_lounge_nickname(text,bigint) owner to lounge_rpc_owner;
revoke all on function public.get_lounge_profile_v2(),public.change_lounge_nickname(text,bigint) from public,anon,service_role;
grant execute on function public.get_lounge_profile_v2(),public.change_lounge_nickname(text,bigint) to authenticated;
revoke create on schema public from lounge_rpc_owner;
commit;

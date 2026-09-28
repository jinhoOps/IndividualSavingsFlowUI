begin;
create role lounge_rpc_owner nologin noinherit nobypassrls;
do $$ begin execute format('grant lounge_rpc_owner to %I', current_user); end $$;
grant usage on schema public, private to lounge_rpc_owner;
grant create on schema public to lounge_rpc_owner;
grant execute on function private.request_uid() to lounge_rpc_owner;

create function private.valid_lounge_allocation(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; total bigint; names text[] := '{}'; normalized text;
begin
  if jsonb_typeof(value) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(value) k) <> array['cashShareUnits','items']
    or octet_length(value::text) > 4096 or jsonb_typeof(value->'items') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value->'items') > 10 or jsonb_typeof(value->'cashShareUnits') is distinct from 'number'
    or (value->>'cashShareUnits')::numeric < 0 or (value->>'cashShareUnits')::numeric > 1000000
    or trunc((value->>'cashShareUnits')::numeric) <> (value->>'cashShareUnits')::numeric then return false; end if;
  total := (value->>'cashShareUnits')::bigint;
  for item in select * from jsonb_array_elements(value->'items') loop
    if jsonb_typeof(item) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(item) k) <> array['name','shareUnits']
      or jsonb_typeof(item->'name') is distinct from 'string' or length(btrim(item->>'name')) = 0 or length(item->>'name') > 40
      or (item->>'name') ~ '[[:cntrl:]]' or jsonb_typeof(item->'shareUnits') is distinct from 'number'
      or (item->>'shareUnits')::numeric <= 0 or (item->>'shareUnits')::numeric > 1000000
      or trunc((item->>'shareUnits')::numeric) <> (item->>'shareUnits')::numeric then return false; end if;
    normalized := lower(regexp_replace(btrim(item->>'name'),'\s+',' ','g'));
    if normalized = any(names) then return false; end if;
    names := array_append(names, normalized); total := total + (item->>'shareUnits')::bigint;
  end loop;
  return total = 1000000;
exception when others then return false;
end $$;
revoke all on function private.valid_lounge_allocation(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.valid_lounge_allocation(jsonb) to lounge_rpc_owner;

create table public.portfolio_publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 40 and title !~ '[[:cntrl:]]'),
  alias text not null check (length(btrim(alias)) between 1 and 20 and alias !~ '[[:cntrl:]]'),
  note text not null check (length(note) <= 160 and note !~ '[[:cntrl:]]'),
  allocation jsonb not null check (private.valid_lounge_allocation(allocation)),
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  updated_at timestamptz not null default clock_timestamp()
);
create index portfolio_publications_recent on public.portfolio_publications(updated_at desc, id desc);
alter table public.portfolio_publications enable row level security;
alter table public.portfolio_publications force row level security;
revoke all on public.portfolio_publications from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.portfolio_publications to lounge_rpc_owner;
create policy lounge_read on public.portfolio_publications for select to lounge_rpc_owner using ((select private.request_uid()) is not null);
create policy lounge_insert on public.portfolio_publications for insert to lounge_rpc_owner with check (owner_id = (select private.request_uid()));
create policy lounge_update on public.portfolio_publications for update to lounge_rpc_owner using (owner_id = (select private.request_uid())) with check (owner_id = (select private.request_uid()));
create policy lounge_delete on public.portfolio_publications for delete to lounge_rpc_owner using (owner_id = (select private.request_uid()));

create function private.lounge_post(p_row public.portfolio_publications) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id',p_row.id,'title',p_row.title,'alias',p_row.alias,'note',p_row.note,'allocation',p_row.allocation,
    'version',p_row.version,'updatedAt',p_row.updated_at,'isMine',p_row.owner_id = private.request_uid())
$$;
revoke all on function private.lounge_post(public.portfolio_publications) from public, anon, authenticated, service_role;
grant execute on function private.lounge_post(public.portfolio_publications) to lounge_rpc_owner;

create function public.list_lounge_portfolios(p_mine boolean default false, p_before_time timestamptz default null, p_before_id uuid default null, p_limit integer default 12)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if (p_before_time is null) <> (p_before_id is null) then raise exception 'invalid cursor'; end if;
  return (select coalesce(jsonb_agg(private.lounge_post(p) order by p.updated_at desc,p.id desc),'[]'::jsonb)
    from (select * from public.portfolio_publications where (not coalesce(p_mine,false) or owner_id = private.request_uid())
      and (p_before_time is null or (updated_at,id) < (p_before_time,p_before_id))
      order by updated_at desc,id desc limit greatest(1,least(coalesce(p_limit,12),24))) p);
end $$;
create function public.get_lounge_portfolio(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  return (select private.lounge_post(p) from public.portfolio_publications p where id=p_id);
end $$;
create function public.publish_lounge_portfolio(p_title text,p_alias text,p_note text,p_allocation jsonb,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.request_uid(); current_row public.portfolio_publications;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 40 or p_title ~ '[[:cntrl:]]'
    or p_alias is null or length(btrim(p_alias)) not between 1 and 20 or p_alias ~ '[[:cntrl:]]'
    or p_note is null or length(p_note)>160 or p_note ~ '[[:cntrl:]]'
    or not private.valid_lounge_allocation(p_allocation)
    or (p_expected_version is not null and p_expected_version not between 1 and 9007199254740990) then return jsonb_build_object('status','invalid'); end if;
  -- Serialize account creation and updates, including a retry after a lost response.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 928));
  select * into current_row from public.portfolio_publications where owner_id=uid for update;
  if found then
    if current_row.title=p_title and current_row.alias=p_alias and current_row.note=p_note and current_row.allocation=p_allocation then
      return jsonb_build_object('status','saved','post',private.lounge_post(current_row)); end if;
    if p_expected_version is null or current_row.version <> p_expected_version then return jsonb_build_object('status','conflict'); end if;
    update public.portfolio_publications set title=p_title,alias=p_alias,note=p_note,allocation=p_allocation,version=version+1,updated_at=clock_timestamp()
      where owner_id=uid returning * into current_row;
  else
    if p_expected_version is not null then return jsonb_build_object('status','conflict'); end if;
    -- Small JSON records only; cap new records before growth can consume the DB budget.
    perform pg_advisory_xact_lock(928, 1);
    if (select count(*) from public.portfolio_publications) >= 5000 then return jsonb_build_object('status','full'); end if;
    insert into public.portfolio_publications(owner_id,title,alias,note,allocation) values(uid,p_title,p_alias,p_note,p_allocation) returning * into current_row;
  end if;
  return jsonb_build_object('status','saved','post',private.lounge_post(current_row));
end $$;
create function public.delete_lounge_portfolio(p_id uuid,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_row public.portfolio_publications; uid uuid := private.request_uid();
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,928));
  select * into current_row from public.portfolio_publications where id=p_id and owner_id=uid for update;
  if not found then return jsonb_build_object('status','deleted'); end if;
  if p_expected_version is null or current_row.version <> p_expected_version then return jsonb_build_object('status','conflict'); end if;
  delete from public.portfolio_publications where id=p_id and owner_id=uid;
  return jsonb_build_object('status','deleted');
end $$;

alter function public.list_lounge_portfolios(boolean,timestamptz,uuid,integer) owner to lounge_rpc_owner;
alter function public.get_lounge_portfolio(uuid) owner to lounge_rpc_owner;
alter function public.publish_lounge_portfolio(text,text,text,jsonb,bigint) owner to lounge_rpc_owner;
alter function public.delete_lounge_portfolio(uuid,bigint) owner to lounge_rpc_owner;
revoke all on function public.list_lounge_portfolios(boolean,timestamptz,uuid,integer), public.get_lounge_portfolio(uuid),
  public.publish_lounge_portfolio(text,text,text,jsonb,bigint),public.delete_lounge_portfolio(uuid,bigint) from public, anon, service_role;
grant execute on function public.list_lounge_portfolios(boolean,timestamptz,uuid,integer), public.get_lounge_portfolio(uuid),
  public.publish_lounge_portfolio(text,text,text,jsonb,bigint),public.delete_lounge_portfolio(uuid,bigint) to authenticated;
revoke create on schema public from lounge_rpc_owner;
commit;

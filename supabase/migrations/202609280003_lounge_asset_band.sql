-- Optional coarse bands only. Existing publications remain hidden; v1 clients stay compatible.
begin;
alter table individualsavingflow.portfolio_publications add column asset_band text
  check (asset_band in ('under_10m','10m','20m','30m','40m','50m','60m','70m','80m','90m','100m','200m','300m','400m','500m','600m','700m','800m','900m','1b_plus'));

create function individualsavingflow_private.lounge_post_v2(p_row individualsavingflow.portfolio_publications) returns jsonb
language sql stable set search_path = '' as $$
  select individualsavingflow_private.lounge_post(p_row) || jsonb_build_object('assetBand',p_row.asset_band)
$$;
revoke all on function individualsavingflow_private.lounge_post_v2(individualsavingflow.portfolio_publications) from public, anon, authenticated, service_role;
grant execute on function individualsavingflow_private.lounge_post_v2(individualsavingflow.portfolio_publications) to isf_lounge_rpc_owner;

create function individualsavingflow.list_lounge_portfolios_v2(p_mine boolean default false, p_before_time timestamptz default null, p_before_id uuid default null, p_limit integer default 12)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if individualsavingflow_private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if (p_before_time is null) <> (p_before_id is null) then raise exception 'invalid cursor'; end if;
  return (select coalesce(jsonb_agg(individualsavingflow_private.lounge_post_v2(p) order by p.updated_at desc,p.id desc),'[]'::jsonb)
    from (select * from individualsavingflow.portfolio_publications where (not coalesce(p_mine,false) or owner_id = individualsavingflow_private.request_uid())
      and (p_before_time is null or (updated_at,id) < (p_before_time,p_before_id))
      order by updated_at desc,id desc limit greatest(1,least(coalesce(p_limit,12),24))) p);
end $$;
create function individualsavingflow.get_lounge_portfolio_v2(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if individualsavingflow_private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  return (select individualsavingflow_private.lounge_post_v2(p) from individualsavingflow.portfolio_publications p where id=p_id);
end $$;
create function individualsavingflow.publish_lounge_portfolio_v2(p_title text,p_alias text,p_note text,p_allocation jsonb,p_expected_version bigint default null,p_asset_band text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := individualsavingflow_private.request_uid(); current_row individualsavingflow.portfolio_publications;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 40 or p_title ~ '[[:cntrl:]]'
    or p_alias is null or length(btrim(p_alias)) not between 1 and 20 or p_alias ~ '[[:cntrl:]]'
    or p_note is null or length(p_note)>160 or p_note ~ '[[:cntrl:]]'
    or (p_asset_band is not null and p_asset_band not in ('under_10m','10m','20m','30m','40m','50m','60m','70m','80m','90m','100m','200m','300m','400m','500m','600m','700m','800m','900m','1b_plus'))
    or not individualsavingflow_private.valid_lounge_allocation(p_allocation)
    or (p_expected_version is not null and p_expected_version not between 1 and 9007199254740990) then return jsonb_build_object('status','invalid'); end if;
  -- Serialize account creation and updates, including a retry after a lost response.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 928));
  select * into current_row from individualsavingflow.portfolio_publications where owner_id=uid for update;
  if found then
    if current_row.title=p_title and current_row.alias=p_alias and current_row.note=p_note and current_row.allocation=p_allocation and current_row.asset_band is not distinct from p_asset_band then
      return jsonb_build_object('status','saved','post',individualsavingflow_private.lounge_post_v2(current_row)); end if;
    if p_expected_version is null or current_row.version <> p_expected_version then return jsonb_build_object('status','conflict'); end if;
    update individualsavingflow.portfolio_publications set title=p_title,alias=p_alias,note=p_note,allocation=p_allocation,asset_band=p_asset_band,version=version+1,updated_at=clock_timestamp()
      where owner_id=uid returning * into current_row;
  else
    if p_expected_version is not null then return jsonb_build_object('status','conflict'); end if;
    -- Small JSON records only; cap new records before growth can consume the DB budget.
    perform pg_advisory_xact_lock(928, 1);
    if (select count(*) from individualsavingflow.portfolio_publications) >= 5000 then return jsonb_build_object('status','full'); end if;
    insert into individualsavingflow.portfolio_publications(owner_id,title,alias,note,allocation,asset_band) values(uid,p_title,p_alias,p_note,p_allocation,p_asset_band) returning * into current_row;
  end if;
  return jsonb_build_object('status','saved','post',individualsavingflow_private.lounge_post_v2(current_row));
end $$;

grant create on schema individualsavingflow to isf_lounge_rpc_owner;
alter function individualsavingflow.list_lounge_portfolios_v2(boolean,timestamptz,uuid,integer) owner to isf_lounge_rpc_owner;
revoke all on function individualsavingflow.list_lounge_portfolios_v2(boolean,timestamptz,uuid,integer) from public, anon, service_role;
grant execute on function individualsavingflow.list_lounge_portfolios_v2(boolean,timestamptz,uuid,integer) to authenticated;
alter function individualsavingflow.get_lounge_portfolio_v2(uuid) owner to isf_lounge_rpc_owner;
revoke all on function individualsavingflow.get_lounge_portfolio_v2(uuid) from public, anon, service_role;
grant execute on function individualsavingflow.get_lounge_portfolio_v2(uuid) to authenticated;
alter function individualsavingflow.publish_lounge_portfolio_v2(text,text,text,jsonb,bigint,text) owner to isf_lounge_rpc_owner;
revoke all on function individualsavingflow.publish_lounge_portfolio_v2(text,text,text,jsonb,bigint,text) from public, anon, service_role;
grant execute on function individualsavingflow.publish_lounge_portfolio_v2(text,text,text,jsonb,bigint,text) to authenticated;
revoke create on schema individualsavingflow from isf_lounge_rpc_owner;
commit;

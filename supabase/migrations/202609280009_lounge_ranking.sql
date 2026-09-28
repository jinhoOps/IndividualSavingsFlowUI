-- Two shared ranking generations; no per-user result or search history is stored.
begin;
create table private.lounge_rank_epochs(epoch timestamptz primary key);
create table private.lounge_rankings(
  epoch timestamptz not null references private.lounge_rank_epochs(epoch) on delete cascade,
  post_id uuid not null references public.portfolio_publications(id) on delete cascade,
  updated_at timestamptz not null,
  unique_reactors integer not null check(unique_reactors between 0 and 5000),
  live_comment_count integer not null check(live_comment_count between 0 and 500),
  primary key(epoch,post_id)
);
create index lounge_rank_reactions on private.lounge_rankings(epoch,unique_reactors desc,updated_at desc,post_id desc);
create index lounge_rank_comments on private.lounge_rankings(epoch,live_comment_count desc,updated_at desc,post_id desc);
create index lounge_rank_post on private.lounge_rankings(post_id);
alter table private.lounge_rank_epochs enable row level security;
alter table private.lounge_rank_epochs force row level security;
alter table private.lounge_rankings enable row level security;
alter table private.lounge_rankings force row level security;
revoke all on private.lounge_rank_epochs,private.lounge_rankings from public,anon,authenticated,service_role;
grant select on private.lounge_rank_epochs,private.lounge_rankings to lounge_rpc_owner;
grant select,insert,delete on private.lounge_rank_epochs,private.lounge_rankings to lounge_maintenance_owner;
create policy rank_epoch_read on private.lounge_rank_epochs for select to lounge_rpc_owner using((select private.request_uid()) is not null);
create policy rank_read on private.lounge_rankings for select to lounge_rpc_owner using((select private.request_uid()) is not null);
create policy rank_epoch_maintenance on private.lounge_rank_epochs to lounge_maintenance_owner using(true) with check(true);
create policy rank_maintenance on private.lounge_rankings to lounge_maintenance_owner using(true) with check(true);
grant select on public.lounge_reactions to lounge_maintenance_owner;
create policy lounge_maintenance_reactions on public.lounge_reactions for select to lounge_maintenance_owner using(true);

create function private.refresh_lounge_ranking() returns jsonb
language plpgsql security definer set search_path='' as $$
declare generation timestamptz; total integer;
begin
  perform pg_advisory_xact_lock(928,9);
  if pg_database_size(current_database())>=419430400 or (select count(*) from public.portfolio_publications)>5000 then
    return jsonb_build_object('status','full');
  end if;
  generation:=clock_timestamp();
  delete from private.lounge_rank_epochs where epoch<>(select max(epoch) from private.lounge_rank_epochs);
  insert into private.lounge_rank_epochs values(generation);
  insert into private.lounge_rankings(epoch,post_id,updated_at,unique_reactors,live_comment_count)
    select generation,p.id,p.updated_at,coalesce(r.total,0),coalesce(c.total,0) from public.portfolio_publications p
    left join (select post_id,count(distinct user_id) total from public.lounge_reactions group by post_id) r on r.post_id=p.id
    left join (select post_id,count(*) total from public.lounge_comments where deleted_at is null group by post_id) c on c.post_id=p.id;
  get diagnostics total=row_count;
  return jsonb_build_object('status','refreshed','epoch',generation,'rows',total);
end $$;
revoke all on function private.refresh_lounge_ranking() from public,anon,authenticated,service_role;
grant create on schema private to lounge_maintenance_owner;
alter function private.refresh_lounge_ranking() owner to lounge_maintenance_owner;
revoke create on schema private from lounge_maintenance_owner;

create function private.lounge_ranked_feed(q jsonb,query_key text,as_of timestamptz,cursor_value jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare generation timestamptz; result jsonb;
begin
  if cursor_value is null then
    select max(epoch) into generation from private.lounge_rank_epochs where epoch<=as_of;
    if generation is null then return jsonb_build_object('status','ranking-unavailable');end if;
  else
    generation:=(cursor_value->>'epoch')::timestamptz;
    if not exists(select 1 from private.lounge_rank_epochs where epoch=generation) then return jsonb_build_object('status','cursor-expired');end if;
  end if;
  with scored as (
    select p, r.updated_at,r.post_id,case when q->>'sort'='reactions' then r.unique_reactors else r.live_comment_count end score
    from private.lounge_rankings r join private.lounge_feed_rows(q,as_of) p on p.id=r.post_id and p.updated_at=r.updated_at
    where r.epoch=generation
  ), page as (
    select * from scored where cursor_value is null or (score,updated_at,post_id)<
      ((cursor_value->'last'->>'score')::integer,(cursor_value->'last'->>'updatedAt')::timestamptz,(cursor_value->'last'->>'id')::uuid)
    order by score desc,updated_at desc,post_id desc limit 13
  ), visible as(select * from page order by score desc,updated_at desc,post_id desc limit 12)
  select jsonb_build_object('status','ok','items',coalesce((select jsonb_agg(private.lounge_post_v2(p) order by score desc,updated_at desc,post_id desc) from visible),'[]'),
    'asOf',as_of,'rankedAt',generation,'nextCursor',case when (select count(*) from page)>12 then
    (select jsonb_build_object('v',1,'queryKey',query_key,'asOf',as_of,'epoch',generation,'last',jsonb_build_object('id',post_id,'updatedAt',updated_at,'score',score))
      from visible order by score,updated_at,post_id limit 1) else null end) into result;
  return result;
end $$;
revoke all on function private.lounge_ranked_feed(jsonb,text,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.lounge_ranked_feed(jsonb,text,timestamptz,jsonb) to lounge_rpc_owner;
create or replace function public.search_lounge_portfolios(p_query jsonb,p_cursor jsonb default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q jsonb; as_of timestamptz:=statement_timestamp(); query_key text; result jsonb;
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000';end if;
  q:=private.parse_lounge_feed_query(p_query);if q is null then raise exception 'invalid query';end if;
  query_key:=private.lounge_feed_query_key(q);
  if not private.valid_lounge_feed_cursor(p_cursor) then raise exception 'invalid cursor';end if;
  if p_cursor is not null then
    if p_cursor->>'queryKey'<>query_key or (p_cursor->>'asOf')::timestamptz>as_of
      or (q->>'sort'='updated')<>(p_cursor->'epoch'='null'::jsonb) then raise exception 'invalid cursor';end if;
    as_of:=(p_cursor->>'asOf')::timestamptz;
    if as_of<statement_timestamp()-interval '24 hours' then return jsonb_build_object('status','cursor-expired');end if;
  end if;
  if q->>'sort'<>'updated' then return private.lounge_ranked_feed(q,query_key,as_of,p_cursor);end if;
  with page as (select * from private.lounge_feed_rows(q,as_of) p
    where p_cursor is null or (p.updated_at,p.id)<((p_cursor->'last'->>'updatedAt')::timestamptz,(p_cursor->'last'->>'id')::uuid)
    order by p.updated_at desc,p.id desc limit 13),
  visible as(select * from page order by updated_at desc,id desc limit 12)
  select jsonb_build_object('status','ok','items',coalesce((select jsonb_agg(private.lounge_post_v2(v::public.portfolio_publications) order by updated_at desc,id desc) from visible v),'[]'),
    'asOf',as_of,'rankedAt',null,'nextCursor',case when (select count(*) from page)>12 then
      (select jsonb_build_object('v',1,'queryKey',query_key,'asOf',as_of,'epoch',null,'last',jsonb_build_object('id',id,'updatedAt',updated_at,'score',null)) from visible order by updated_at,id limit 1) else null end) into result;
  return result;
end $$;
notify pgrst,'reload schema';
commit;

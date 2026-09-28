-- Bounded server-side discovery. Existing publication list RPCs and stored documents stay intact.
begin;
create function private.normalize_lounge_search(value text) returns text
language sql immutable set search_path='' as $$
  select btrim(regexp_replace(lower(normalize(value,NFC)), '[[:space:]   -     　﻿]+', ' ', 'g'))
$$;
create function private.parse_lounge_feed_query(value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare term text; bands jsonb;
begin
  if value is null or jsonb_typeof(value)<>'object' or not value ?& array['q','scope','period','hasCash','assetBands','sort']
    or (select count(*) from jsonb_object_keys(value))<>6 or jsonb_typeof(value->'q')<>'string'
    or length(value->>'q')>400 or value->>'q' ~ '[[:cntrl:]‪-‮⁦-⁩]'
    or jsonb_typeof(value->'scope')<>'string' or jsonb_typeof(value->'period')<>'string' or jsonb_typeof(value->'sort')<>'string'
    or value->>'scope' not in ('all','mine') or value->>'period' not in ('all','7d','30d')
    or jsonb_typeof(value->'hasCash')<>'boolean' or value->>'sort' not in ('updated','reactions','comments')
    or jsonb_typeof(value->'assetBands')<>'array' or jsonb_array_length(value->'assetBands')>21 then return null; end if;
  if exists(select 1 from jsonb_array_elements(value->'assetBands') b where jsonb_typeof(b)<>'string' or b#>>'{}' not in
    ('under_10m','10m','20m','30m','40m','50m','60m','70m','80m','90m','100m','200m','300m','400m','500m','600m','700m','800m','900m','1b_plus','hidden'))
    or (select count(distinct b) from jsonb_array_elements(value->'assetBands') b)<>jsonb_array_length(value->'assetBands') then return null; end if;
  term:=private.normalize_lounge_search(value->>'q');if length(term)>80 then return null;end if;
  select coalesce(jsonb_agg(b order by b#>>'{}'),'[]') into bands from jsonb_array_elements(value->'assetBands') b;
  return value||jsonb_build_object('q',term,'assetBands',bands);
exception when others then return null;
end $$;
create function private.lounge_feed_query_key(q jsonb) returns text
language sql immutable set search_path='' as $$
  select '1:'||length(q->>'q')||':'||(q->>'q')||'|'||(q->>'scope')||'|'||(q->>'period')||'|'||
    case when (q->>'hasCash')::boolean then '1' else '0' end||'|'||
    coalesce((select string_agg(b,',' order by b) from jsonb_array_elements_text(q->'assetBands') b),'')||'|'||(q->>'sort')
$$;
create function private.valid_lounge_feed_cursor(c jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare at_time timestamptz; last_time timestamptz; epoch_time timestamptz;
begin
  if c is null then return true; end if;
  if jsonb_typeof(c)<>'object' or not c ?& array['v','queryKey','asOf','epoch','last'] or (select count(*) from jsonb_object_keys(c))<>5
    or c->'v'<>'1'::jsonb or jsonb_typeof(c->'queryKey')<>'string' or length(c->>'queryKey')>1000
    or jsonb_typeof(c->'asOf')<>'string' or jsonb_typeof(c->'epoch') not in ('null','string')
    or jsonb_typeof(c->'last')<>'object' or not (c->'last') ?& array['id','updatedAt','score'] or (select count(*) from jsonb_object_keys(c->'last'))<>3
    or jsonb_typeof(c->'last'->'id')<>'string' or c->'last'->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(c->'last'->'updatedAt')<>'string' then return false;end if;
  at_time:=(c->>'asOf')::timestamptz;last_time:=(c->'last'->>'updatedAt')::timestamptz;epoch_time:=(c->>'epoch')::timestamptz;
  if not isfinite(at_time) or not isfinite(last_time) or last_time>at_time then return false;end if;
  if epoch_time is null then return c->'last'->'score'='null'::jsonb;end if;
  return isfinite(epoch_time) and epoch_time<=at_time and jsonb_typeof(c->'last'->'score')='number'
    and (c->'last'->>'score')::numeric between 0 and 100000 and trunc((c->'last'->>'score')::numeric)=(c->'last'->>'score')::numeric;
exception when others then return false;
end $$;
create function private.lounge_feed_rows(q jsonb,as_of timestamptz) returns setof public.portfolio_publications
language sql stable set search_path='' as $$
  select p.* from public.portfolio_publications p
  where p.updated_at<=as_of and (q->>'scope'='all' or p.owner_id=private.request_uid())
    and (q->>'period'='all' or p.updated_at>=as_of-case when q->>'period'='7d' then interval '7 days' else interval '30 days' end)
    and (not (q->>'hasCash')::boolean or (p.allocation->>'cashShareUnits')::integer>0)
    and (jsonb_array_length(q->'assetBands')=0 or (q->'assetBands') ? coalesce(p.asset_band,'hidden'))
    and (q->>'q'='' or strpos(private.normalize_lounge_search(p.title),q->>'q')>0
      or strpos(private.normalize_lounge_search(p.note),q->>'q')>0
      or strpos(private.normalize_lounge_search(p.alias),q->>'q')>0
      or exists(select 1 from jsonb_array_elements(p.allocation->'items') item where strpos(private.normalize_lounge_search(item->>'name'),q->>'q')>0))
$$;
create function public.search_lounge_portfolios(p_query jsonb,p_cursor jsonb default null) returns jsonb
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
  if q->>'sort'<>'updated' then return jsonb_build_object('status','ranking-unavailable');end if;
  with page as (select * from private.lounge_feed_rows(q,as_of) p
    where p_cursor is null or (p.updated_at,p.id)<((p_cursor->'last'->>'updatedAt')::timestamptz,(p_cursor->'last'->>'id')::uuid)
    order by p.updated_at desc,p.id desc limit 13),
  visible as(select * from page order by updated_at desc,id desc limit 12)
  select jsonb_build_object('status','ok','items',coalesce((select jsonb_agg(private.lounge_post_v2(v::public.portfolio_publications) order by updated_at desc,id desc) from visible v),'[]'),
    'asOf',as_of,'rankedAt',null,'nextCursor',case when (select count(*) from page)>12 then
      (select jsonb_build_object('v',1,'queryKey',query_key,'asOf',as_of,'epoch',null,'last',jsonb_build_object('id',id,'updatedAt',updated_at,'score',null)) from visible order by updated_at,id limit 1) else null end) into result;
  return result;
end $$;
revoke all on function private.normalize_lounge_search(text),private.parse_lounge_feed_query(jsonb),private.lounge_feed_query_key(jsonb),
  private.valid_lounge_feed_cursor(jsonb),private.lounge_feed_rows(jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function private.normalize_lounge_search(text),private.parse_lounge_feed_query(jsonb),private.lounge_feed_query_key(jsonb),
  private.valid_lounge_feed_cursor(jsonb),private.lounge_feed_rows(jsonb,timestamptz) to lounge_rpc_owner;
grant create on schema public to lounge_rpc_owner;
alter function public.search_lounge_portfolios(jsonb,jsonb) owner to lounge_rpc_owner;
revoke create on schema public from lounge_rpc_owner;
revoke all on function public.search_lounge_portfolios(jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.search_lounge_portfolios(jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

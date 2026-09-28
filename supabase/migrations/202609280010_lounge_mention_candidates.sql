begin;

-- Keep the plan author and conversation participants first, then fill the
-- bounded picker with other registered users, including on someone else's plan.
create or replace function public.find_lounge_mention_targets(p_post_id uuid,p_query text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_uid(); query text; activity private.lounge_community_activity; now_at timestamptz:=clock_timestamp(); result jsonb;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_query is null or length(p_query)>20 or p_query~'[[:cntrl:]]' or p_post_id is null then raise exception 'invalid query'; end if;
  if not exists(select 1 from public.lounge_profiles where user_id=uid) then raise exception 'profile required'; end if;
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return '[]'; end if;
  insert into private.lounge_community_activity(user_id) values(uid) on conflict do nothing;
  select * into activity from private.lounge_community_activity where user_id=uid for update;
  if now_at>=activity.mention_window_at+interval '1 minute' then activity.mention_window_at:=now_at;activity.mention_count:=0; end if;
  if activity.mention_count>=60 then raise exception 'rate limited'; end if;
  update private.lounge_community_activity set mention_count=activity.mention_count+1,mention_window_at=activity.mention_window_at where user_id=uid;
  query:=lower(normalize(btrim(p_query),NFC) collate "C");
  select coalesce(jsonb_agg(jsonb_build_object('publicId',p.public_id,'nickname',p.nickname)
    order by p.priority,lower(p.nickname collate "C"),p.public_id),'[]') into result from (
    select p.public_id,p.nickname,case
      when query<>'' then 0
      when p.user_id=(select owner_id from public.portfolio_publications where id=p_post_id) then 0
      when exists(select 1 from public.lounge_comments c where c.post_id=p_post_id and c.user_id=p.user_id and c.deleted_at is null) then 1
      else 2 end as priority
    from public.lounge_profiles p where p.user_id<>uid and
      (query='' or (length(query)>=2 and starts_with(lower(p.nickname collate "C"),query)))
    order by priority,lower(p.nickname collate "C"),p.public_id limit 5) p;
  return result;
end $$;

commit;

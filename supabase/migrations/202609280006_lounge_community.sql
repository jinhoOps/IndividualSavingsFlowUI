begin;

create function private.valid_lounge_emoji(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value is not null and value = any(array['like','heart','fire','clap','idea','think','wow','target',
    'rocket','strong','thanks','smile','check','eyes','diamond','seed'])
$$;
create function private.valid_lounge_comment(value text) returns boolean
language sql immutable set search_path = '' as $$
  select value is not null and length(value) between 1 and 500 and octet_length(value) <= 2000
    and value ~ '[^[:space:]]' and replace(value,chr(10),'') !~ '[[:cntrl:]]'
    and value !~ ('^[[:space:]'||chr(160)||chr(5760)||chr(8192)||'-'||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)||']*$')
    and value !~ ('['||chr(8234)||'-'||chr(8238)||chr(8294)||'-'||chr(8297)||']')
$$;
revoke all on function private.valid_lounge_emoji(text),private.valid_lounge_comment(text) from public,anon,authenticated,service_role;
grant execute on function private.valid_lounge_emoji(text),private.valid_lounge_comment(text) to lounge_rpc_owner;

create table public.lounge_reactions (
  post_id uuid not null references public.portfolio_publications(id) on delete cascade,
  user_id uuid not null references public.lounge_profiles(user_id) on delete cascade,
  emoji text not null check (private.valid_lounge_emoji(emoji)),
  primary key(post_id,user_id,emoji)
);
create index lounge_reactions_user on public.lounge_reactions(user_id);
create table public.lounge_comments (
  id uuid primary key,
  post_id uuid not null references public.portfolio_publications(id) on delete cascade,
  user_id uuid not null references public.lounge_profiles(user_id) on delete cascade,
  body text not null check (private.valid_lounge_comment(body)),
  created_at timestamptz not null default clock_timestamp()
);
create index lounge_comments_page on public.lounge_comments(post_id,created_at desc,id desc);
create index lounge_comments_user on public.lounge_comments(user_id);
create table private.lounge_community_activity (
  user_id uuid primary key references public.lounge_profiles(user_id) on delete cascade,
  comment_window_at timestamptz not null default clock_timestamp(),
  comment_count integer not null default 0 check (comment_count between 0 and 40),
  last_comment_at timestamptz,
  reaction_window_at timestamptz not null default clock_timestamp(),
  reaction_count integer not null default 0 check (reaction_count between 0 and 60)
);

alter table public.lounge_reactions enable row level security;
alter table public.lounge_reactions force row level security;
alter table public.lounge_comments enable row level security;
alter table public.lounge_comments force row level security;
alter table private.lounge_community_activity enable row level security;
alter table private.lounge_community_activity force row level security;
revoke all on public.lounge_reactions,public.lounge_comments,private.lounge_community_activity from public,anon,authenticated,service_role;
grant select,insert,delete on public.lounge_reactions,public.lounge_comments to lounge_rpc_owner;
grant select,insert,update on private.lounge_community_activity to lounge_rpc_owner;
create policy lounge_reaction_read on public.lounge_reactions for select to lounge_rpc_owner using ((select private.request_uid()) is not null);
create policy lounge_reaction_insert on public.lounge_reactions for insert to lounge_rpc_owner with check (user_id=(select private.request_uid()));
create policy lounge_reaction_delete on public.lounge_reactions for delete to lounge_rpc_owner using (user_id=(select private.request_uid()));
create policy lounge_comment_read on public.lounge_comments for select to lounge_rpc_owner using ((select private.request_uid()) is not null);
create policy lounge_comment_insert on public.lounge_comments for insert to lounge_rpc_owner with check (user_id=(select private.request_uid()));
create policy lounge_comment_delete on public.lounge_comments for delete to lounge_rpc_owner using (user_id=(select private.request_uid()));
create policy lounge_activity_own on private.lounge_community_activity to lounge_rpc_owner
  using (user_id=(select private.request_uid())) with check (user_id=(select private.request_uid()));

-- Invoker helpers run with the existing, non-bypass RLS RPC role.
create function private.lounge_community_summary(p_post_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('postId',p_post_id,
    'reactions',coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'count',r.total,'mine',r.mine) order by r.emoji)
      from (select emoji,count(*) total,bool_or(user_id=private.request_uid()) mine
        from public.lounge_reactions where post_id=p_post_id group by emoji) r),'[]'::jsonb),
    'uniqueReactors',(select count(distinct user_id) from public.lounge_reactions where post_id=p_post_id),
    'commentCount',(select count(*) from public.lounge_comments where post_id=p_post_id))
  where exists(select 1 from public.portfolio_publications where id=p_post_id)
$$;
create function private.lounge_comment(p_row public.lounge_comments) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id',p_row.id,'nickname',p.nickname,'body',p_row.body,
    'createdAt',p_row.created_at,'isMine',p_row.user_id=private.request_uid())
  from public.lounge_profiles p where p.user_id=p_row.user_id
$$;
create function private.consume_lounge_action(p_kind text) returns boolean
language plpgsql set search_path = '' as $$
declare uid uuid := private.request_uid(); activity private.lounge_community_activity; now_at timestamptz := clock_timestamp();
begin
  insert into private.lounge_community_activity(user_id) values(uid) on conflict do nothing;
  select * into activity from private.lounge_community_activity where user_id=uid for update;
  if p_kind='comment' then
    if now_at >= activity.comment_window_at+interval '24 hours' then activity.comment_count:=0; activity.comment_window_at:=now_at; end if;
    if activity.comment_count>=40 or now_at < activity.last_comment_at+interval '10 seconds' then return false; end if;
    update private.lounge_community_activity set comment_count=activity.comment_count+1,comment_window_at=activity.comment_window_at,last_comment_at=now_at where user_id=uid;
  elsif p_kind='reaction' then
    if now_at >= activity.reaction_window_at+interval '1 minute' then activity.reaction_count:=0; activity.reaction_window_at:=now_at; end if;
    if activity.reaction_count>=60 then return false; end if;
    update private.lounge_community_activity set reaction_count=activity.reaction_count+1,reaction_window_at=activity.reaction_window_at where user_id=uid;
  else raise exception 'invalid action'; end if;
  return true;
end $$;
revoke all on function private.lounge_community_summary(uuid),private.lounge_comment(public.lounge_comments),private.consume_lounge_action(text) from public,anon,authenticated,service_role;
grant execute on function private.lounge_community_summary(uuid),private.lounge_comment(public.lounge_comments),private.consume_lounge_action(text) to lounge_rpc_owner;

create function public.get_lounge_community(p_post_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_ids is null or cardinality(p_post_ids)>24 or array_position(p_post_ids,null) is not null then raise exception 'invalid post ids'; end if;
  return (select coalesce(jsonb_agg(private.lounge_community_summary(id) order by id),'[]'::jsonb)
    from public.portfolio_publications where id=any(p_post_ids));
end $$;

create function public.set_lounge_reaction(p_post_id uuid,p_emoji text,p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=private.request_uid(); active_now boolean;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or not private.valid_lounge_emoji(p_emoji) or p_active is null then return jsonb_build_object('status','invalid'); end if;
  if not exists(select 1 from public.lounge_profiles where user_id=uid) then return jsonb_build_object('status','profile-required'); end if;
  -- One short community write at a time makes both per-post and global caps atomic.
  perform pg_advisory_xact_lock(928,6);
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return jsonb_build_object('status','missing'); end if;
  select exists(select 1 from public.lounge_reactions where post_id=p_post_id and user_id=uid and emoji=p_emoji) into active_now;
  if active_now=p_active then return jsonb_build_object('status','saved','summary',private.lounge_community_summary(p_post_id)); end if;
  if p_active then
    if not exists(select 1 from public.lounge_reactions where post_id=p_post_id and emoji=p_emoji)
      and (select count(distinct emoji) from public.lounge_reactions where post_id=p_post_id)>=8 then
      return jsonb_build_object('status','reaction-limit','summary',private.lounge_community_summary(p_post_id)); end if;
    if (select count(*) from public.lounge_reactions)>=100000 or pg_database_size(current_database())>=419430400 then return jsonb_build_object('status','full'); end if;
  end if;
  if not private.consume_lounge_action('reaction') then return jsonb_build_object('status','rate-limited'); end if;
  if p_active then insert into public.lounge_reactions(post_id,user_id,emoji) values(p_post_id,uid,p_emoji);
  else delete from public.lounge_reactions where post_id=p_post_id and user_id=uid and emoji=p_emoji; end if;
  return jsonb_build_object('status','saved','summary',private.lounge_community_summary(p_post_id));
exception when foreign_key_violation then return jsonb_build_object('status','missing');
end $$;

create function public.list_lounge_comments(p_post_id uuid,p_before_time timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or (p_before_time is null)<>(p_before_id is null) then raise exception 'invalid cursor'; end if;
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return null; end if;
  with page as (select * from public.lounge_comments where post_id=p_post_id
    and (p_before_time is null or (created_at,id)<(p_before_time,p_before_id)) order by created_at desc,id desc limit 21),
  visible as (select * from page order by created_at desc,id desc limit 20)
  select jsonb_build_object('comments',coalesce((select jsonb_agg(private.lounge_comment(v::public.lounge_comments) order by v.created_at desc,v.id desc) from visible v),'[]'::jsonb),
    'hasMore',(select count(*)>20 from page)) into result;
  return result;
end $$;

create function public.add_lounge_comment(p_post_id uuid,p_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=private.request_uid(); saved public.lounge_comments;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or p_id is null or not private.valid_lounge_comment(p_body) then return jsonb_build_object('status','invalid'); end if;
  if not exists(select 1 from public.lounge_profiles where user_id=uid) then return jsonb_build_object('status','profile-required'); end if;
  perform pg_advisory_xact_lock(928,6);
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return jsonb_build_object('status','missing'); end if;
  select * into saved from public.lounge_comments where id=p_id;
  if found then
    if saved.user_id<>uid or saved.post_id<>p_post_id or saved.body<>p_body then return jsonb_build_object('status','conflict'); end if;
    return jsonb_build_object('status','saved','comment',private.lounge_comment(saved),'summary',private.lounge_community_summary(p_post_id));
  end if;
  if (select count(*) from public.lounge_comments where post_id=p_post_id)>=500 then return jsonb_build_object('status','comment-limit'); end if;
  if (select count(*) from public.lounge_comments)>=20000 or pg_database_size(current_database())>=419430400 then return jsonb_build_object('status','full'); end if;
  if not private.consume_lounge_action('comment') then return jsonb_build_object('status','rate-limited'); end if;
  insert into public.lounge_comments(id,post_id,user_id,body) values(p_id,p_post_id,uid,p_body) returning * into saved;
  return jsonb_build_object('status','saved','comment',private.lounge_comment(saved),'summary',private.lounge_community_summary(p_post_id));
exception when foreign_key_violation then return jsonb_build_object('status','missing');
end $$;

create function public.delete_lounge_comment(p_post_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or p_id is null then return jsonb_build_object('status','invalid'); end if;
  perform pg_advisory_xact_lock(928,6);
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return jsonb_build_object('status','missing'); end if;
  if exists(select 1 from public.lounge_comments where id=p_id and (user_id<>private.request_uid() or post_id<>p_post_id)) then
    return jsonb_build_object('status','forbidden'); end if;
  delete from public.lounge_comments where id=p_id and post_id=p_post_id and user_id=private.request_uid();
  return jsonb_build_object('status','deleted','summary',private.lounge_community_summary(p_post_id));
end $$;

grant create on schema public to lounge_rpc_owner;
alter function public.get_lounge_community(uuid[]) owner to lounge_rpc_owner;
alter function public.set_lounge_reaction(uuid,text,boolean) owner to lounge_rpc_owner;
alter function public.list_lounge_comments(uuid,timestamptz,uuid) owner to lounge_rpc_owner;
alter function public.add_lounge_comment(uuid,uuid,text) owner to lounge_rpc_owner;
alter function public.delete_lounge_comment(uuid,uuid) owner to lounge_rpc_owner;
revoke all on function public.get_lounge_community(uuid[]),public.set_lounge_reaction(uuid,text,boolean),public.list_lounge_comments(uuid,timestamptz,uuid),
  public.add_lounge_comment(uuid,uuid,text),public.delete_lounge_comment(uuid,uuid) from public,anon,service_role;
grant execute on function public.get_lounge_community(uuid[]),public.set_lounge_reaction(uuid,text,boolean),public.list_lounge_comments(uuid,timestamptz,uuid),
  public.add_lounge_comment(uuid,uuid,text),public.delete_lounge_comment(uuid,uuid) to authenticated;
revoke create on schema public from lounge_rpc_owner;
commit;

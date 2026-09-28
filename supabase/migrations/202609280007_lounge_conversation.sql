begin;

alter table public.lounge_profiles add column public_id uuid not null default gen_random_uuid();
create unique index lounge_profile_public_id on public.lounge_profiles(public_id);
create function private.guard_lounge_public_id() returns trigger language plpgsql set search_path='' as $$
begin
  if new.public_id is distinct from old.public_id then raise exception 'public identity is immutable'; end if;
  return new;
end $$;
create trigger lounge_public_id_immutable before update on public.lounge_profiles
  for each row execute function private.guard_lounge_public_id();

alter table public.lounge_comments
  add column root_id uuid references public.lounge_comments(id) on delete cascade,
  add column reply_to_id uuid references public.lounge_comments(id) deferrable initially deferred,
  add column deleted_at timestamptz,
  add column mentions jsonb not null default '[]',
  add column request_hash text,
  alter column user_id drop not null,
  drop constraint lounge_comments_user_id_fkey,
  drop constraint lounge_comments_body_check;
alter table public.lounge_comments add constraint lounge_comment_author
  foreign key(user_id) references public.lounge_profiles(user_id) on delete set null;
alter table public.lounge_comments add constraint lounge_comment_shape check (
  ((root_id is null and reply_to_id is null) or (root_id is not null and reply_to_id is not null and root_id<>id and reply_to_id<>id))
  and ((deleted_at is null and user_id is not null and private.valid_lounge_comment(body))
    or (deleted_at is not null and user_id is null and body='' and mentions='[]'::jsonb))
  and jsonb_typeof(mentions)='array' and jsonb_array_length(mentions)<=3 and octet_length(mentions::text)<=1024
);
create index lounge_threads_page on public.lounge_comments(post_id,created_at desc,id desc) where root_id is null;
create index lounge_replies_page on public.lounge_comments(root_id,created_at,id) where root_id is not null;
create index lounge_reply_target on public.lounge_comments(reply_to_id) where reply_to_id is not null;
alter table private.lounge_community_activity add column mention_window_at timestamptz not null default clock_timestamp(),
  add column mention_count integer not null default 0 check(mention_count between 0 and 60);

create table public.lounge_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.lounge_profiles(user_id) on delete cascade,
  actor_id uuid not null references public.lounge_profiles(user_id) on delete cascade,
  post_id uuid not null references public.portfolio_publications(id) on delete cascade,
  comment_id uuid not null references public.lounge_comments(id) on delete cascade,
  kind text not null check(kind in ('reply','mention')),
  created_at timestamptz not null default clock_timestamp(), read_at timestamptz,
  unique(recipient_id,comment_id), check(recipient_id<>actor_id)
);
create index lounge_notifications_page on public.lounge_notifications(recipient_id,created_at desc,id desc);
create index lounge_notifications_comment on public.lounge_notifications(comment_id);
create index lounge_notifications_actor on public.lounge_notifications(actor_id);
create index lounge_notifications_age on public.lounge_notifications(created_at,id);
alter table public.lounge_notifications enable row level security;
alter table public.lounge_notifications force row level security;
revoke all on public.lounge_notifications from public,anon,authenticated,service_role;
grant select,update(read_at) on public.lounge_notifications to lounge_rpc_owner;
create policy lounge_notification_read on public.lounge_notifications for select to lounge_rpc_owner using(recipient_id=private.request_uid());
create policy lounge_notification_read_state on public.lounge_notifications for update to lounge_rpc_owner
  using(recipient_id=private.request_uid()) with check(recipient_id=private.request_uid());

-- Only revoked, fixed-purpose functions and triggers use this role. It is not a client role.
create role lounge_maintenance_owner nologin noinherit nobypassrls;
do $$ begin execute format('grant lounge_maintenance_owner to %I',current_user); end $$;
grant usage on schema public,private to lounge_maintenance_owner;
grant select on public.lounge_profiles,public.portfolio_publications to lounge_maintenance_owner;
grant select,update,delete on public.lounge_comments to lounge_maintenance_owner;
grant select,insert,delete on public.lounge_notifications to lounge_maintenance_owner;
grant execute on function private.request_uid(),private.valid_lounge_comment(text) to lounge_maintenance_owner;
create policy lounge_maintenance_profiles on public.lounge_profiles for select to lounge_maintenance_owner using(true);
create policy lounge_maintenance_posts on public.portfolio_publications for select to lounge_maintenance_owner using(true);
create policy lounge_maintenance_comments on public.lounge_comments to lounge_maintenance_owner using(true) with check(true);
create policy lounge_maintenance_notifications on public.lounge_notifications to lounge_maintenance_owner using(true) with check(true);

create function private.valid_lounge_mentions(p_body text,p_mentions jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare m jsonb; starts integer[]:='{}'; ends integer[]:='{}'; ids text[]:='{}'; a integer; b integer; i integer;
begin
  if p_mentions is null or jsonb_typeof(p_mentions)<>'array' or jsonb_array_length(p_mentions)>3
    or octet_length(p_mentions::text)>1024 then return false; end if;
  for m in select value from jsonb_array_elements(p_mentions) loop
    if jsonb_typeof(m)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(m) k)<>array['end','label','publicId','start']
      or jsonb_typeof(m->'start')<>'number' or jsonb_typeof(m->'end')<>'number'
      or (m->>'start') !~ '^[0-9]{1,3}$' or (m->>'end') !~ '^[0-9]{1,3}$'
      or jsonb_typeof(m->'label')<>'string' or not private.valid_lounge_nickname(m->>'label')
      or jsonb_typeof(m->'publicId')<>'string' or (m->>'publicId') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or (m->>'publicId')=any(ids) then return false; end if;
    a:=(m->>'start')::integer; b:=(m->>'end')::integer;
    if b<=a or b>length(p_body) or substring(p_body from a+1 for b-a)<>'@'||(m->>'label') then return false; end if;
    for i in 1..coalesce(cardinality(starts),0) loop
      if a<ends[i] and b>starts[i] then return false; end if;
    end loop;
    starts:=array_append(starts,a);ends:=array_append(ends,b);ids:=array_append(ids,m->>'publicId');
  end loop;
  return true;
end $$;
alter table public.lounge_comments add constraint lounge_mentions_valid check(private.valid_lounge_mentions(body,mentions));
grant execute on function private.valid_lounge_nickname(text),private.valid_lounge_mentions(text,jsonb) to lounge_maintenance_owner,lounge_rpc_owner;

create function private.guard_lounge_thread() returns trigger language plpgsql set search_path='' as $$
declare parent public.lounge_comments; target public.lounge_comments;
begin
  if new.root_id is not null then
    select * into parent from public.lounge_comments where id=new.root_id;
    select * into target from public.lounge_comments where id=new.reply_to_id;
    if parent.id is null or parent.root_id is not null or parent.post_id<>new.post_id
      or target.id is null or target.post_id<>new.post_id or coalesce(target.root_id,target.id)<>new.root_id then raise exception 'invalid thread'; end if;
  end if;
  if tg_op='UPDATE' and (new.id,new.post_id,new.root_id,new.reply_to_id,new.created_at) is distinct from
    (old.id,old.post_id,old.root_id,old.reply_to_id,old.created_at) then raise exception 'thread identity is immutable'; end if;
  return new;
end $$;
create trigger lounge_thread_guard before insert or update on public.lounge_comments for each row execute function private.guard_lounge_thread();

create or replace function private.lounge_community_summary(p_post_id uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('postId',p_post_id,
    'reactions',coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'count',r.total,'mine',r.mine) order by r.emoji)
      from (select emoji,count(*) total,bool_or(user_id=private.request_uid()) mine from public.lounge_reactions where post_id=p_post_id group by emoji) r),'[]'::jsonb),
    'uniqueReactors',(select count(distinct user_id) from public.lounge_reactions where post_id=p_post_id),
    'commentCount',(select count(*) from public.lounge_comments where post_id=p_post_id and deleted_at is null))
  where exists(select 1 from public.portfolio_publications where id=p_post_id)
$$;
create function private.lounge_conversation_comment(c public.lounge_comments) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',c.id,'rootId',c.root_id,'replyToId',c.reply_to_id,
    'replyToAuthor',case when c.deleted_at is null then (select jsonb_build_object('publicId',p.public_id,'nickname',p.nickname)
      from public.lounge_comments target join public.lounge_profiles p on p.user_id=target.user_id
      where target.id=c.reply_to_id and target.deleted_at is null) else null end,
    'author',case when c.deleted_at is null then (select jsonb_build_object('publicId',p.public_id,'nickname',p.nickname) from public.lounge_profiles p where p.user_id=c.user_id) else null end,
    'body',c.body,'mentions',coalesce((select jsonb_agg(m.value||jsonb_build_object('currentNickname',p.nickname) order by m.ordinality)
      from jsonb_array_elements(c.mentions) with ordinality m join public.lounge_profiles p on p.public_id=(m.value->>'publicId')::uuid),'[]'::jsonb),
    'createdAt',c.created_at,'deleted',c.deleted_at is not null,'isMine',coalesce(c.user_id=private.request_uid(),false),
    'replyCount',case when c.root_id is null then (select count(*) from public.lounge_comments where root_id=c.id and deleted_at is null) else 0 end)
$$;
create function private.lounge_cursor(c public.lounge_comments) returns jsonb language sql stable set search_path='' as $$
  select case when c.id is null then null else jsonb_build_object('id',c.id,'createdAt',c.created_at) end
$$;
create function private.valid_lounge_cursor(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
  if value is null then return true; end if;
  if jsonb_typeof(value)<>'object' or not coalesce((select array_agg(k order by k) from jsonb_object_keys(value) k)=array['createdAt','id'],false)
    or jsonb_typeof(value->'createdAt')<>'string' or jsonb_typeof(value->'id')<>'string'
    or (value->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or length(value->>'createdAt')>40 then return false; end if;
  return isfinite((value->>'createdAt')::timestamptz);
exception when others then return false;
end $$;

create function private.prune_lounge_conversation() returns void language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
  perform pg_advisory_xact_lock(928,6);
  delete from public.lounge_notifications where created_at<clock_timestamp()-interval '30 days'
    or comment_id in(select id from public.lounge_comments where deleted_at is not null);
  delete from public.lounge_notifications where id in(select id from (
    select id,row_number() over(partition by recipient_id order by created_at desc,id desc) n from public.lounge_notifications) r where n>100);
  delete from public.lounge_notifications where id in(select id from public.lounge_notifications order by created_at desc,id desc offset 20000);
  loop
    delete from public.lounge_comments c where c.deleted_at is not null
      and not exists(select 1 from public.lounge_comments r where r.root_id=c.id or r.reply_to_id=c.id);
    get diagnostics removed=row_count;exit when removed=0;
  end loop;
end $$;
create function private.emit_lounge_notifications(p_comment_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.lounge_comments;
begin
  select * into c from public.lounge_comments where id=p_comment_id;
  if c.user_id is distinct from private.request_uid() or c.deleted_at is not null then raise exception 'invalid notification source'; end if;
  insert into public.lounge_notifications(recipient_id,actor_id,post_id,comment_id,kind)
    select recipient,c.user_id,c.post_id,c.id,case when bool_or(kind='mention') then 'mention' else 'reply' end from (
      select t.user_id recipient,'reply' kind from public.lounge_comments t where t.id=c.reply_to_id and t.deleted_at is null
      union all select p.user_id,'mention' from jsonb_array_elements(c.mentions) m
        join public.lounge_profiles p on p.public_id=(m->>'publicId')::uuid
    ) targets where recipient is not null and recipient<>c.user_id group by recipient on conflict do nothing;
  perform private.prune_lounge_conversation();
end $$;
create function private.delete_lounge_comment_content(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.lounge_comments set deleted_at=clock_timestamp(),user_id=null,body='',mentions='[]',request_hash=null
    where id=p_id and user_id=private.request_uid();
  perform private.prune_lounge_conversation();
end $$;
create function private.scrub_lounge_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.lounge_comments; m jsonb; remaining jsonb; delta integer; a integer; b integer;
begin
  perform pg_advisory_xact_lock(928,6);
  update public.lounge_comments set deleted_at=clock_timestamp(),user_id=null,body='',mentions='[]',request_hash=null where user_id=old.user_id;
  for c in select * from public.lounge_comments where mentions @> jsonb_build_array(jsonb_build_object('publicId',old.public_id::text)) for update loop
    for m in select value from jsonb_array_elements(c.mentions) where value->>'publicId'=old.public_id::text order by (value->>'start')::integer desc loop
      a:=(m->>'start')::integer;b:=(m->>'end')::integer;delta:=3-(b-a);
      c.body:=substring(c.body from 1 for a)||'@탈퇴'||substring(c.body from b+1);
      select coalesce(jsonb_agg(case when (v->>'start')::integer>=b then
        v||jsonb_build_object('start',(v->>'start')::integer+delta,'end',(v->>'end')::integer+delta) else v end),'[]') into remaining
        from jsonb_array_elements(c.mentions) v where v->>'publicId'<>old.public_id::text;
      c.mentions:=remaining;
    end loop;
    update public.lounge_comments set body=c.body,mentions=c.mentions where id=c.id;
  end loop;
  delete from public.lounge_notifications where recipient_id=old.user_id or actor_id=old.user_id;
  perform private.prune_lounge_conversation();return old;
end $$;
create trigger lounge_profile_conversation_cleanup before delete on public.lounge_profiles for each row execute function private.scrub_lounge_profile();

create function public.list_lounge_threads_v2(p_post_id uuid,p_cursor jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or not private.valid_lounge_cursor(p_cursor) then raise exception 'invalid cursor'; end if;
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return null; end if;
  with page as(select * from public.lounge_comments where post_id=p_post_id and root_id is null
    and (p_cursor is null or (created_at,id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid))
    order by created_at desc,id desc limit 21), visible as(select * from page order by created_at desc,id desc limit 20)
  select jsonb_build_object('comments',coalesce((select jsonb_agg(private.lounge_conversation_comment(v::public.lounge_comments) order by v.created_at desc,v.id desc) from visible v),'[]'),
    'nextCursor',case when (select count(*) from page)>20 then (select private.lounge_cursor(v::public.lounge_comments) from visible v order by created_at,id limit 1) else null end) into result;
  return result;
end $$;
create function public.list_lounge_replies_v2(p_post_id uuid,p_root_id uuid,p_cursor jsonb default null,p_direction text default 'newer') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or p_root_id is null or not private.valid_lounge_cursor(p_cursor) or p_direction is null or p_direction not in ('older','newer') then raise exception 'invalid cursor'; end if;
  if not exists(select 1 from public.lounge_comments where id=p_root_id and post_id=p_post_id and root_id is null) then return null; end if;
  with page as(select * from public.lounge_comments where root_id=p_root_id and post_id=p_post_id
    and (p_cursor is null or case when p_direction='newer' then (created_at,id)>((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid)
      else (created_at,id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid) end)
    order by case when p_direction='newer' then created_at end,case when p_direction='newer' then id end,
      case when p_direction='older' then created_at end desc,case when p_direction='older' then id end desc limit 11),
  visible as(select * from page order by case when p_direction='newer' then created_at end,case when p_direction='newer' then id end,
      case when p_direction='older' then created_at end desc,case when p_direction='older' then id end desc limit 10)
  select jsonb_build_object('comments',coalesce((select jsonb_agg(private.lounge_conversation_comment(v::public.lounge_comments) order by v.created_at,v.id) from visible v),'[]'),
    'nextCursor',case when (select count(*) from page)>10 then (select private.lounge_cursor(v::public.lounge_comments) from visible v
      order by case when p_direction='newer' then created_at end desc,case when p_direction='newer' then id end desc,
        case when p_direction='older' then created_at end,case when p_direction='older' then id end limit 1) else null end) into result;
  return result;
end $$;
create function public.get_lounge_comment_context(p_post_id uuid,p_comment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target public.lounge_comments; root public.lounge_comments; result jsonb;
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into target from public.lounge_comments where id=p_comment_id and post_id=p_post_id and deleted_at is null;
  if not found then return null; end if;
  select * into root from public.lounge_comments where id=coalesce(target.root_id,target.id);
  if target.root_id is null then return jsonb_build_object('postId',p_post_id,'root',private.lounge_conversation_comment(root),
    'page',public.list_lounge_replies_v2(p_post_id,root.id,null,'newer'),'targetId',target.id,'previousCursor',null); end if;
  with visible as(select * from public.lounge_comments where root_id=root.id and (created_at,id)<=(target.created_at,target.id) order by created_at desc,id desc limit 10),
  first_row as(select * from visible order by created_at,id limit 1)
  select jsonb_build_object('postId',p_post_id,'root',private.lounge_conversation_comment(root),'targetId',target.id,
    'page',jsonb_build_object('comments',(select jsonb_agg(private.lounge_conversation_comment(v::public.lounge_comments) order by v.created_at,v.id) from visible v),
      'nextCursor',case when exists(select 1 from public.lounge_comments where root_id=root.id and (created_at,id)>(target.created_at,target.id)) then private.lounge_cursor(target) else null end),
    'previousCursor',case when exists(select 1 from public.lounge_comments c,first_row f where c.root_id=root.id and (c.created_at,c.id)<(f.created_at,f.id))
      then (select private.lounge_cursor(f::public.lounge_comments) from first_row f) else null end) into result;
  return result;
end $$;
create function public.add_lounge_comment_v2(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.request_uid(); saved public.lounge_comments; parent public.lounge_comments; target public.lounge_comments;
  v_post_id uuid; v_comment_id uuid; v_root_id uuid; v_reply_id uuid; m jsonb; v_request_hash text;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>6144 then return jsonb_build_object('status','invalid'); end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p_input) k)<>array['body','id','mentions','postId','replyToId','rootId']
    or jsonb_typeof(p_input->'body')<>'string' or not private.valid_lounge_comment(p_input->>'body')
    or not private.valid_lounge_mentions(p_input->>'body',p_input->'mentions')
    or jsonb_typeof(p_input->'id')<>'string' or jsonb_typeof(p_input->'postId')<>'string'
    or jsonb_typeof(p_input->'rootId') not in ('null','string') or jsonb_typeof(p_input->'replyToId') not in ('null','string') then return jsonb_build_object('status','invalid'); end if;
  v_comment_id:=(p_input->>'id')::uuid;v_post_id:=(p_input->>'postId')::uuid;v_root_id:=(p_input->>'rootId')::uuid;v_reply_id:=(p_input->>'replyToId')::uuid;
  if v_comment_id is null or v_post_id is null or (v_root_id is null)<>(v_reply_id is null) or v_comment_id=v_root_id or v_comment_id=v_reply_id then return jsonb_build_object('status','invalid'); end if;
  if not exists(select 1 from public.lounge_profiles where user_id=uid) then return jsonb_build_object('status','profile-required'); end if;
  perform pg_advisory_xact_lock(928,6);
  perform 1 from public.portfolio_publications p where p.id=v_post_id;
  if not found then return jsonb_build_object('status','missing'); end if;
  v_request_hash:=md5(p_input::text);
  select * into saved from public.lounge_comments c where c.id=v_comment_id;
  if found then
    if saved.deleted_at is not null or saved.user_id is distinct from uid or saved.post_id<>v_post_id
      or (saved.request_hash is not null and saved.request_hash<>v_request_hash)
      or (saved.request_hash is null and (saved.body<>p_input->>'body' or saved.root_id is distinct from v_root_id or saved.reply_to_id is distinct from v_reply_id or saved.mentions<>p_input->'mentions')) then return jsonb_build_object('status','conflict'); end if;
    return jsonb_build_object('status','saved','comment',private.lounge_conversation_comment(saved),
      'summary',private.lounge_community_summary(v_post_id),'context',public.get_lounge_comment_context(v_post_id,v_comment_id));
  end if;
  if v_root_id is not null then
    select * into parent from public.lounge_comments c where c.id=v_root_id;
    select * into target from public.lounge_comments c where c.id=v_reply_id;
    if parent.id is null or target.id is null then return jsonb_build_object('status','missing'); end if;
    if parent.root_id is not null or parent.post_id<>v_post_id
      or target.post_id<>v_post_id or coalesce(target.root_id,target.id)<>v_root_id then return jsonb_build_object('status','invalid'); end if;
    if target.deleted_at is not null then return jsonb_build_object('status','missing'); end if;
  end if;
  for m in select value from jsonb_array_elements(p_input->'mentions') loop
    if not exists(select 1 from public.lounge_profiles p where p.public_id=(m->>'publicId')::uuid and p.nickname=m->>'label' and p.user_id<>uid) then return jsonb_build_object('status','mention-changed'); end if;
  end loop;
  if (select count(*) from public.lounge_comments c where c.post_id=v_post_id)>=500 then return jsonb_build_object('status','comment-limit'); end if;
  if (select count(*) from public.lounge_comments)>=20000 or pg_database_size(current_database())>=419430400 then return jsonb_build_object('status','full'); end if;
  if not private.consume_lounge_action('comment') then return jsonb_build_object('status','rate-limited'); end if;
  insert into public.lounge_comments(id,post_id,user_id,body,root_id,reply_to_id,mentions,request_hash)
    values(v_comment_id,v_post_id,uid,p_input->>'body',v_root_id,v_reply_id,p_input->'mentions',v_request_hash) returning * into saved;
  perform private.emit_lounge_notifications(v_comment_id);
  return jsonb_build_object('status','saved','comment',private.lounge_conversation_comment(saved),
    'summary',private.lounge_community_summary(v_post_id),'context',public.get_lounge_comment_context(v_post_id,v_comment_id));
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','invalid');
  when foreign_key_violation then return jsonb_build_object('status','missing');
end $$;
create function public.delete_lounge_comment_v2(p_post_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or p_id is null then return jsonb_build_object('status','invalid'); end if;
  perform pg_advisory_xact_lock(928,6);
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return jsonb_build_object('status','missing'); end if;
  if exists(select 1 from public.lounge_comments where id=p_id and (post_id<>p_post_id or (deleted_at is null and user_id is distinct from private.request_uid()))) then return jsonb_build_object('status','forbidden'); end if;
  perform private.delete_lounge_comment_content(p_id);
  return jsonb_build_object('status','deleted','summary',private.lounge_community_summary(p_post_id));
end $$;

create function public.find_lounge_mention_targets(p_post_id uuid,p_query text) returns jsonb
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
  select coalesce(jsonb_agg(jsonb_build_object('publicId',p.public_id,'nickname',p.nickname) order by lower(p.nickname collate "C")),'[]') into result from (
    select public_id,nickname from public.lounge_profiles p where user_id<>uid and (
      (query='' and (user_id=(select owner_id from public.portfolio_publications where id=p_post_id)
        or exists(select 1 from public.lounge_comments c where c.post_id=p_post_id and c.user_id=p.user_id and c.deleted_at is null)))
      or (length(query)>=2 and starts_with(lower(p.nickname collate "C"),query))) order by lower(nickname collate "C") limit 5) p;
  return result;
end $$;

create function public.get_lounge_unread_count() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  return jsonb_build_object('unreadCount',(select count(*) from public.lounge_notifications where recipient_id=private.request_uid() and read_at is null and created_at>=clock_timestamp()-interval '30 days'),'readCutoff',clock_timestamp());
end $$;
create function public.list_lounge_notifications(p_unread_only boolean default false,p_cursor jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cutoff timestamptz:=clock_timestamp();
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_unread_only is null or not private.valid_lounge_cursor(p_cursor) then raise exception 'invalid cursor'; end if;
  with unread as(select id from public.lounge_notifications where recipient_id=private.request_uid() and read_at is null and created_at>=cutoff-interval '30 days'),
  page as(select * from public.lounge_notifications where recipient_id=private.request_uid() and created_at>=cutoff-interval '30 days'
    and (not p_unread_only or read_at is null) and (p_cursor is null or (created_at,id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid)) order by created_at desc,id desc limit 21),
  visible as(select * from page order by created_at desc,id desc limit 20)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'postId',n.post_id,'commentId',n.comment_id,'kind',n.kind,
      'actor',jsonb_build_object('publicId',p.public_id,'nickname',p.nickname),'preview',left(c.body,80),'createdAt',n.created_at,'read',n.read_at is not null) order by n.created_at desc,n.id desc)
      from visible n join public.lounge_comments c on c.id=n.comment_id join public.lounge_profiles p on p.user_id=n.actor_id),'[]'),
    'nextCursor',case when (select count(*) from page)>20 then (select jsonb_build_object('id',id,'createdAt',created_at) from visible order by created_at,id limit 1) else null end,
    'unreadCount',(select count(*) from unread),'readIds',coalesce((select jsonb_agg(id order by id) from unread),'[]'),'readCutoff',cutoff) into result;
  return result;
end $$;
create function public.read_lounge_notifications(p_ids jsonb,p_cutoff timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_ids is null or jsonb_typeof(p_ids)<>'array' or jsonb_array_length(p_ids)>100 then raise exception 'invalid ids'; end if;
  if exists(select 1 from jsonb_array_elements(p_ids) v where jsonb_typeof(v)<>'string' or (v#>>'{}') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') then raise exception 'invalid ids'; end if;
  update public.lounge_notifications set read_at=clock_timestamp() where recipient_id=private.request_uid() and read_at is null
    and id in(select value::uuid from jsonb_array_elements_text(p_ids)) and (p_cutoff is null or created_at<=p_cutoff);
  return public.get_lounge_unread_count();
end $$;

-- Keep deployed v1 clients' strict response shape and root-only list intact.
create or replace function public.list_lounge_comments(p_post_id uuid,p_before_time timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_post_id is null or (p_before_time is null)<>(p_before_id is null) then raise exception 'invalid cursor'; end if;
  if not exists(select 1 from public.portfolio_publications where id=p_post_id) then return null; end if;
  with page as(select * from public.lounge_comments where post_id=p_post_id and root_id is null and deleted_at is null
    and (p_before_time is null or (created_at,id)<(p_before_time,p_before_id)) order by created_at desc,id desc limit 21),
  visible as(select * from page order by created_at desc,id desc limit 20)
  select jsonb_build_object('comments',coalesce((select jsonb_agg(private.lounge_comment(v::public.lounge_comments) order by v.created_at desc,v.id desc) from visible v),'[]'),'hasMore',(select count(*)>20 from page)) into result;
  return result;
end $$;
create or replace function public.add_lounge_comment(p_post_id uuid,p_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; saved public.lounge_comments;
begin
  result:=public.add_lounge_comment_v2(jsonb_build_object('id',p_id,'postId',p_post_id,'body',p_body,'rootId',null,'replyToId',null,'mentions','[]'::jsonb));
  if result->>'status'<>'saved' then return result; end if;
  select * into saved from public.lounge_comments where id=p_id;
  return jsonb_build_object('status','saved','comment',private.lounge_comment(saved),'summary',result->'summary');
end $$;
create or replace function public.delete_lounge_comment(p_post_id uuid,p_id uuid) returns jsonb
language sql security definer set search_path='' as $$select public.delete_lounge_comment_v2(p_post_id,p_id)$$;

revoke all on function private.guard_lounge_public_id(),private.valid_lounge_mentions(text,jsonb),private.guard_lounge_thread(),
  private.lounge_conversation_comment(public.lounge_comments),private.lounge_cursor(public.lounge_comments),private.valid_lounge_cursor(jsonb),
  private.prune_lounge_conversation(),private.emit_lounge_notifications(uuid),private.delete_lounge_comment_content(uuid),private.scrub_lounge_profile()
  from public,anon,authenticated,service_role;
grant execute on function private.valid_lounge_mentions(text,jsonb),private.guard_lounge_thread(),private.lounge_conversation_comment(public.lounge_comments),
  private.lounge_cursor(public.lounge_comments),private.valid_lounge_cursor(jsonb),private.emit_lounge_notifications(uuid),private.delete_lounge_comment_content(uuid) to lounge_rpc_owner;
grant execute on function private.valid_lounge_mentions(text,jsonb),private.guard_lounge_thread(),private.prune_lounge_conversation() to lounge_maintenance_owner;
grant create on schema private to lounge_maintenance_owner;
alter function private.prune_lounge_conversation() owner to lounge_maintenance_owner;
alter function private.emit_lounge_notifications(uuid) owner to lounge_maintenance_owner;
alter function private.delete_lounge_comment_content(uuid) owner to lounge_maintenance_owner;
alter function private.scrub_lounge_profile() owner to lounge_maintenance_owner;
revoke create on schema private from lounge_maintenance_owner;

grant create on schema public to lounge_rpc_owner;
alter function public.list_lounge_threads_v2(uuid,jsonb) owner to lounge_rpc_owner;
alter function public.list_lounge_replies_v2(uuid,uuid,jsonb,text) owner to lounge_rpc_owner;
alter function public.get_lounge_comment_context(uuid,uuid) owner to lounge_rpc_owner;
alter function public.add_lounge_comment_v2(jsonb) owner to lounge_rpc_owner;
alter function public.delete_lounge_comment_v2(uuid,uuid) owner to lounge_rpc_owner;
alter function public.find_lounge_mention_targets(uuid,text) owner to lounge_rpc_owner;
alter function public.get_lounge_unread_count() owner to lounge_rpc_owner;
alter function public.list_lounge_notifications(boolean,jsonb) owner to lounge_rpc_owner;
alter function public.read_lounge_notifications(jsonb,timestamptz) owner to lounge_rpc_owner;
revoke create on schema public from lounge_rpc_owner;
revoke all on function public.list_lounge_threads_v2(uuid,jsonb),public.list_lounge_replies_v2(uuid,uuid,jsonb,text),public.get_lounge_comment_context(uuid,uuid),
  public.add_lounge_comment_v2(jsonb),public.delete_lounge_comment_v2(uuid,uuid),public.find_lounge_mention_targets(uuid,text),public.get_lounge_unread_count(),
  public.list_lounge_notifications(boolean,jsonb),public.read_lounge_notifications(jsonb,timestamptz) from public,anon,service_role;
grant execute on function public.list_lounge_threads_v2(uuid,jsonb),public.list_lounge_replies_v2(uuid,uuid,jsonb,text),public.get_lounge_comment_context(uuid,uuid),
  public.add_lounge_comment_v2(jsonb),public.delete_lounge_comment_v2(uuid,uuid),public.find_lounge_mention_targets(uuid,text),public.get_lounge_unread_count(),
  public.list_lounge_notifications(boolean,jsonb),public.read_lounge_notifications(jsonb,timestamptz) to authenticated;
commit;

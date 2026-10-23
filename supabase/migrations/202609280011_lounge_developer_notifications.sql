begin;

-- Provisioned by the operator, never by a client. One bounded test event per
-- developer keeps tests private and independent of published plans/comments.
create table individualsavingflow_private.lounge_developers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  test_id uuid unique, test_created_at timestamptz, test_read_at timestamptz,
  check ((test_id is null)=(test_created_at is null)),
  check (test_read_at is null or test_created_at is not null)
);
alter table individualsavingflow_private.lounge_developers enable row level security;
alter table individualsavingflow_private.lounge_developers force row level security;
revoke all on individualsavingflow_private.lounge_developers from public,anon,authenticated,service_role;
grant select,update(test_id,test_created_at,test_read_at) on individualsavingflow_private.lounge_developers to isf_lounge_rpc_owner;
create policy lounge_developer_own on individualsavingflow_private.lounge_developers to isf_lounge_rpc_owner
  using(user_id=(select individualsavingflow_private.request_uid())) with check(user_id=(select individualsavingflow_private.request_uid()));
do $$ begin
  execute format('create policy lounge_developer_operator on individualsavingflow_private.lounge_developers to %I using(true) with check(true)',current_user);
end $$;

create function individualsavingflow_private.lounge_notification_feed_v2() returns table (
  id uuid,post_id uuid,comment_id uuid,kind text,actor jsonb,preview text,created_at timestamptz,read_at timestamptz
) language sql stable set search_path='' as $$
  select * from (
    select n.id,n.post_id,n.comment_id,n.kind,
      jsonb_build_object('publicId',p.public_id,'nickname',p.nickname) actor,
      left(c.body,80) preview,n.created_at,n.read_at
    from individualsavingflow.lounge_notifications n join individualsavingflow.lounge_comments c on c.id=n.comment_id
      join individualsavingflow.lounge_profiles p on p.user_id=n.actor_id
    where n.recipient_id=individualsavingflow_private.request_uid() and n.created_at>=statement_timestamp()-interval '30 days'
    union all
    select d.test_id,null::uuid,null::uuid,'test',jsonb_build_object('publicId',p.public_id,'nickname',p.nickname),
      '본인에게만 보이는 개발자 테스트 알림이에요.',d.test_created_at,d.test_read_at
    from individualsavingflow_private.lounge_developers d join individualsavingflow.lounge_profiles p on p.user_id=d.user_id
    where d.user_id=individualsavingflow_private.request_uid() and d.test_created_at>=statement_timestamp()-interval '30 days'
  ) events order by created_at desc,id desc limit 100
$$;
create function individualsavingflow.get_lounge_developer_access() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if individualsavingflow_private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  return exists(select 1 from individualsavingflow_private.lounge_developers where user_id=individualsavingflow_private.request_uid());
end $$;
create function individualsavingflow.get_lounge_unread_count_v2() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if individualsavingflow_private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  return jsonb_build_object('unreadCount',(select count(*) from individualsavingflow_private.lounge_notification_feed_v2() where read_at is null),'readCutoff',clock_timestamp());
end $$;
create function individualsavingflow.list_lounge_notifications_v2(p_unread_only boolean default false,p_cursor jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cutoff timestamptz:=clock_timestamp();
begin
  if individualsavingflow_private.request_uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_unread_only is null or not individualsavingflow_private.valid_lounge_cursor(p_cursor) then raise exception 'invalid cursor'; end if;
  with feed as materialized(select * from individualsavingflow_private.lounge_notification_feed_v2()),
  unread as(select id from feed where read_at is null and created_at<=cutoff),
  page as(select * from feed where (not p_unread_only or read_at is null)
    and (p_cursor is null or (created_at,id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid))
    order by created_at desc,id desc limit 21),
  visible as(select * from page order by created_at desc,id desc limit 20)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'postId',n.post_id,'commentId',n.comment_id,'kind',n.kind,
      'actor',n.actor,'preview',n.preview,'createdAt',n.created_at,'read',n.read_at is not null) order by n.created_at desc,n.id desc) from visible n),'[]'),
    'nextCursor',case when (select count(*) from page)>20 then (select jsonb_build_object('id',id,'createdAt',created_at) from visible order by created_at,id limit 1) else null end,
    'unreadCount',(select count(*) from unread),'readIds',coalesce((select jsonb_agg(id order by id) from unread),'[]'),'readCutoff',cutoff) into result;
  return result;
end $$;
create function individualsavingflow.read_lounge_notifications_v2(p_ids jsonb,p_cutoff timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  -- The deployed reader validates the bounded ID list and handles real events.
  perform individualsavingflow.read_lounge_notifications(p_ids,p_cutoff);
  update individualsavingflow_private.lounge_developers set test_read_at=clock_timestamp()
    where user_id=individualsavingflow_private.request_uid() and test_read_at is null
      and test_id in(select value::uuid from jsonb_array_elements_text(p_ids))
      and (p_cutoff is null or test_created_at<=p_cutoff);
  return individualsavingflow.get_lounge_unread_count_v2();
end $$;
create function individualsavingflow.create_lounge_test_notification(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=individualsavingflow_private.request_uid(); developer individualsavingflow_private.lounge_developers;
begin
  if uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_id is null then return jsonb_build_object('status','invalid'); end if;
  select * into developer from individualsavingflow_private.lounge_developers where user_id=uid for update;
  if not found then return jsonb_build_object('status','forbidden'); end if;
  if not exists(select 1 from individualsavingflow.lounge_profiles where user_id=uid) then return jsonb_build_object('status','profile-required'); end if;
  if developer.test_id=p_id then return jsonb_build_object('status','saved','state',individualsavingflow.get_lounge_unread_count_v2()); end if;
  if developer.test_created_at>clock_timestamp()-interval '10 seconds' then return jsonb_build_object('status','rate-limited'); end if;
  if pg_database_size(current_database())>=419430400 then return jsonb_build_object('status','full'); end if;
  update individualsavingflow_private.lounge_developers set test_id=p_id,test_created_at=clock_timestamp(),test_read_at=null where user_id=uid;
  return jsonb_build_object('status','saved','state',individualsavingflow.get_lounge_unread_count_v2());
end $$;

revoke all on function individualsavingflow_private.lounge_notification_feed_v2() from public,anon,authenticated,service_role;
grant execute on function individualsavingflow_private.lounge_notification_feed_v2() to isf_lounge_rpc_owner;
grant create on schema individualsavingflow to isf_lounge_rpc_owner;
alter function individualsavingflow.get_lounge_developer_access() owner to isf_lounge_rpc_owner;
alter function individualsavingflow.get_lounge_unread_count_v2() owner to isf_lounge_rpc_owner;
alter function individualsavingflow.list_lounge_notifications_v2(boolean,jsonb) owner to isf_lounge_rpc_owner;
alter function individualsavingflow.read_lounge_notifications_v2(jsonb,timestamptz) owner to isf_lounge_rpc_owner;
alter function individualsavingflow.create_lounge_test_notification(uuid) owner to isf_lounge_rpc_owner;
revoke create on schema individualsavingflow from isf_lounge_rpc_owner;
revoke all on function individualsavingflow.get_lounge_developer_access(),individualsavingflow.get_lounge_unread_count_v2(),individualsavingflow.list_lounge_notifications_v2(boolean,jsonb),
  individualsavingflow.read_lounge_notifications_v2(jsonb,timestamptz),individualsavingflow.create_lounge_test_notification(uuid) from public,anon,service_role;
grant execute on function individualsavingflow.get_lounge_developer_access(),individualsavingflow.get_lounge_unread_count_v2(),individualsavingflow.list_lounge_notifications_v2(boolean,jsonb),
  individualsavingflow.read_lounge_notifications_v2(jsonb,timestamptz),individualsavingflow.create_lounge_test_notification(uuid) to authenticated;
commit;

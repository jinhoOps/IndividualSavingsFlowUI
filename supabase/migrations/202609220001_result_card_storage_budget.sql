begin;

alter table public.result_card_shares drop constraint result_card_shares_owner_id_fkey;
alter table public.result_card_shares alter column owner_id drop not null;
alter table public.result_card_shares add constraint result_card_shares_owner_id_fkey foreign key(owner_id) references auth.users(id) on delete set null;
alter table public.result_card_shares drop constraint result_card_shares_state_check;
alter table public.result_card_shares drop constraint result_card_shares_check;
alter table public.result_card_shares drop constraint result_card_shares_object_path_check;
alter table public.result_card_shares add constraint result_card_shares_object_path_check check(object_path ~ '^shares/[0-9a-f-]{36}[.]png$');
alter table public.result_card_shares add column byte_size bigint check(byte_size > 0);
alter table public.result_card_shares add column content_sha256 text check(content_sha256 ~ '^[0-9a-f]{64}$');
alter table public.result_card_shares add column upload_settled_at timestamptz;
alter table public.result_card_shares add column deleted_at timestamptz;
alter table public.result_card_shares add constraint result_card_shares_state_check check(state in ('pending','ready','deleting','deleted'));
update public.result_card_shares set upload_settled_at=published_at where state='ready';
alter table public.result_card_shares add constraint result_card_shares_ready_check check(state <> 'ready' or (published_at is not null and expires_at is not null and expires_at > published_at and upload_settled_at is not null));
-- Existing ready rows completed an upload under the previous contract.
-- Add ready constraint after setting their settlement marker.
create index result_card_shares_owner_created on public.result_card_shares(owner_id,created_at);
create index result_card_shares_cleanup on public.result_card_shares(state,expires_at,created_at,id);

create table public.result_card_share_policy (
 id integer primary key check(id=1),
 capacity_bytes bigint not null default 400000000 check(capacity_bytes between 0 and 400000000),
 retention_hours integer not null default 48 check(retention_hours in (24,48)),
 creation_enabled boolean not null default false,
 inventory_valid boolean not null default false,
 last_cleanup_success_at timestamptz,
 last_inventory_success_at timestamptz,
 cleanup_cursor uuid,
 cleanup_failed boolean not null default false,
 cleanup_lease_until timestamptz,
 cleanup_generation uuid
);
insert into public.result_card_share_policy(id) values(1);
alter table public.result_card_share_policy enable row level security;
revoke all on public.result_card_share_policy,public.result_card_shares from public,anon,authenticated;
grant select,insert,update,delete on public.result_card_share_policy,public.result_card_shares to service_role;
update storage.buckets set file_size_limit=1000000 where id='result-card-shares';

create function public.reserve_result_card_share(p_owner_id uuid,p_request_id uuid,p_token_hash text,p_content_sha256 text,p_byte_size bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare policy public.result_card_share_policy; existing public.result_card_shares; charged bigint; uid uuid; now_at timestamptz:=clock_timestamp(); retry_at timestamptz;
begin
 if p_owner_id is null or p_request_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size is null or p_byte_size not between 1 and 1000000 then
  raise exception 'invalid share reservation';
 end if;
 select * into policy from public.result_card_share_policy where id=1 for update;
 select * into existing from public.result_card_shares where owner_id=p_owner_id and request_id=p_request_id;
 if found then
  if existing.token_hash<>p_token_hash or existing.content_sha256 is distinct from p_content_sha256 or existing.byte_size is distinct from p_byte_size then return jsonb_build_object('status','conflict'); end if;
  if existing.state='ready' and existing.expires_at>now_at then return jsonb_build_object('status','ready','expiresAt',existing.expires_at); end if;
  if existing.state='pending' and existing.created_at>now_at-interval '15 minutes' then return jsonb_build_object('status','pending'); end if;
  return jsonb_build_object('status','expired');
 end if;
 if exists(select 1 from public.result_card_shares where token_hash=p_token_hash) then return jsonb_build_object('status','conflict'); end if;
 if not policy.creation_enabled or not policy.inventory_valid or policy.last_cleanup_success_at is null or policy.last_cleanup_success_at<=now_at-interval '15 minutes' or policy.last_inventory_success_at is null or policy.last_inventory_success_at<=now_at-interval '24 hours' or exists(select 1 from public.result_card_shares where state<>'deleted' and byte_size is null) then
  return jsonb_build_object('status','cleanup_unhealthy');
 end if;
 select min(created_at)+interval '24 hours' into retry_at from public.result_card_shares where owner_id=p_owner_id and created_at>now_at-interval '24 hours' having count(*)>=20;
 if retry_at is not null then return jsonb_build_object('status','daily_limit','retryAt',retry_at); end if;
 select coalesce(sum(byte_size),0) into charged from public.result_card_shares where state<>'deleted';
 if charged+p_byte_size>policy.capacity_bytes then return jsonb_build_object('status','capacity_reached'); end if;
 uid:=gen_random_uuid();
 insert into public.result_card_shares(id,owner_id,request_id,token_hash,object_path,state,byte_size,content_sha256) values(uid,p_owner_id,p_request_id,p_token_hash,'shares/'||uid||'.png','pending',p_byte_size,p_content_sha256);
 return jsonb_build_object('status','reserved','id',uid,'objectPath','shares/'||uid||'.png');
end $$;

create function public.publish_result_card_share(p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare policy public.result_card_share_policy; record public.result_card_shares; now_at timestamptz:=clock_timestamp();
begin
 select * into policy from public.result_card_share_policy where id=1 for update;
 select * into record from public.result_card_shares where id=p_id for update;
 if not found or record.owner_id is null then return jsonb_build_object('status','expired'); end if;
 if record.state='ready' and record.expires_at>now_at then return jsonb_build_object('status','ready','expiresAt',record.expires_at); end if;
 if record.state<>'pending' or record.created_at<=now_at-interval '15 minutes' then return jsonb_build_object('status','expired'); end if;
 update public.result_card_shares set state='ready',upload_settled_at=now_at,published_at=now_at,expires_at=now_at+make_interval(hours=>policy.retention_hours) where id=p_id returning * into record;
 return jsonb_build_object('status','ready','expiresAt',record.expires_at);
end $$;

create function public.finish_result_card_delete(p_id uuid) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform 1 from public.result_card_share_policy where id=1 for update;
 update public.result_card_shares set state='deleted',deleted_at=clock_timestamp() where id=p_id and state='deleting' and upload_settled_at is not null;
 return found;
end $$;

-- A lease prevents overlapping runs from overwriting progress or health evidence.
create function public.claim_result_card_cleanup() returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare run_id uuid:=gen_random_uuid();
begin
 update public.result_card_share_policy set cleanup_generation=run_id,cleanup_lease_until=clock_timestamp()+interval '2 minutes'
 where id=1 and (cleanup_lease_until is null or cleanup_lease_until<clock_timestamp());
 if found then return run_id; end if;
 return null;
end $$;

revoke all on function public.reserve_result_card_share(uuid,uuid,text,text,bigint),public.publish_result_card_share(uuid),public.finish_result_card_delete(uuid),public.claim_result_card_cleanup() from public,anon,authenticated;
grant execute on function public.reserve_result_card_share(uuid,uuid,text,text,bigint),public.publish_result_card_share(uuid),public.finish_result_card_delete(uuid),public.claim_result_card_cleanup() to service_role;

create table public.result_card_share_runs (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default clock_timestamp(),
 mode text not null check(mode in ('cleanup','inventory')),
 summary jsonb not null
);
alter table public.result_card_share_runs enable row level security;
revoke all on public.result_card_share_runs from public,anon,authenticated;
grant select,insert,delete on public.result_card_share_runs to service_role;
grant usage on sequence public.result_card_share_runs_id_seq to service_role;

-- Read-only Storage metadata reconciliation, in one locked DB transaction.
-- Actual file removal must always use the Storage API.
create function public.reconcile_result_card_storage() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare invalid boolean; actual_bytes bigint; other_bytes bigint; charged bigint; result jsonb;
begin
 perform 1 from public.result_card_share_policy where id=1 for update;
 update public.result_card_shares r set byte_size=(o.metadata->>'size')::bigint
 from storage.objects o where o.bucket_id='result-card-shares' and o.name=r.object_path and r.byte_size is null and (o.metadata->>'size') ~ '^[1-9][0-9]*$';
 select exists(select 1 from storage.objects o left join public.result_card_shares r on r.object_path=o.name
 where o.bucket_id='result-card-shares' and (r.id is null or r.state='deleted' or o.metadata->>'size' is null or not ((o.metadata->>'size') ~ '^[1-9][0-9]*$') or (case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint end) is distinct from r.byte_size))
 or exists(select 1 from public.result_card_shares r where r.state<>'deleted' and (r.byte_size is null or (r.state='ready' and not exists(select 1 from storage.objects o where o.bucket_id='result-card-shares' and o.name=r.object_path))))
 or exists(select 1 from storage.objects where metadata->>'size' is null or not ((metadata->>'size') ~ '^[0-9]+$')) into invalid;
 select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end) filter(where bucket_id='result-card-shares'),0),
 coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end) filter(where bucket_id<>'result-card-shares'),0) into actual_bytes,other_bytes from storage.objects;
 select coalesce(sum(byte_size),0) into charged from public.result_card_shares where state<>'deleted';
 update public.result_card_share_policy set inventory_valid=not invalid,
 last_inventory_success_at=case when not invalid then clock_timestamp() else last_inventory_success_at end,
 capacity_bytes=least(capacity_bytes,greatest(0,400000000-other_bytes)) where id=1;
 result:=jsonb_build_object('valid',not invalid,'actualBytes',actual_bytes,'otherBytes',other_bytes,'chargedBytes',charged);
 insert into public.result_card_share_runs(mode,summary) values('inventory',result);
 delete from public.result_card_share_runs where created_at<clock_timestamp()-interval '7 days';
 return result;
end $$;
revoke all on function public.reconcile_result_card_storage() from public,anon,authenticated;
grant execute on function public.reconcile_result_card_storage() to service_role;
commit;

-- Main-owned expense answers. Historical validators and migrations remain unchanged.
begin;
lock table public.user_workspaces in access exclusive mode;
alter table public.user_workspaces no force row level security;
do $$ begin
  if exists (select 1 from public.user_workspaces where schema_version <> 4 or private.normalize_workspace_v4(payload) is null) then
    raise exception 'workspace v5 upgrade requires valid v4 rows';
  end if;
end $$;
alter table private.workspace_schema_backups no force row level security;
alter table private.workspace_schema_backups drop constraint workspace_schema_backups_schema_version_check;
alter table private.workspace_schema_backups add constraint workspace_schema_backups_schema_version_check check (schema_version in (3,4));
insert into private.workspace_schema_backups(user_id,schema_version,row_snapshot)
  select user_id,schema_version,to_jsonb(w) from public.user_workspaces w;
alter table private.workspace_schema_backups force row level security;
alter table public.user_workspaces drop constraint user_workspaces_schema_version_check;
update public.user_workspaces set schema_version=5, payload=jsonb_set(payload,'{main,expenseAssistant}','null'::jsonb);
alter table public.user_workspaces alter column schema_version set default 5;
alter table public.user_workspaces add constraint user_workspaces_schema_version_check check (schema_version=5);
alter table public.user_workspaces force row level security;

create function private.expense_item_ids() returns text[] language sql immutable set search_path='' as $$
 select array['rent','housingInterest','maintenance','insurance','telecom','subscriptions','utilities','food','transport','occasions','leisure','otherHousing','otherLiving']::text[]
$$;
create function private.expense_totals(answers jsonb, complete boolean default false) returns jsonb
language plpgsql immutable set search_path='' as $$
declare k text; a jsonb; amount numeric; housing numeric:=0; living numeric:=0;
begin
 if not private.exact_keys(answers,private.expense_item_ids()) then return null; end if;
 foreach k in array private.expense_item_ids() loop
   a:=answers->k;
   if a='null'::jsonb then if complete then return null; else continue; end if; end if;
   if not private.exact_keys(a,array['amountWon','period']) or not private.integer_value(a->'amountWon')
     or not private.enum_value(a->'period',array['month','year']) then return null; end if;
   amount:=(a->>'amountWon')::numeric * case when a->>'period'='month' then 12 else 1 end;
   if k=any(array['rent','housingInterest','maintenance','utilities','otherHousing']) then housing:=housing+amount; else living:=living+amount; end if;
 end loop;
 housing:=round(housing/12); living:=round(living/12);
 if housing+living>9007199254740991 then return null; end if;
 return jsonb_build_object('housingWon',housing,'livingWon',living,'totalWon',housing+living);
end $$;
create function private.valid_expense_draft(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select private.exact_keys(v,array['answers','step','updatedAt']) and private.timestamp_value(v->'updatedAt')
   and private.enum_value(v->'step',private.expense_item_ids() || array['review']) and private.expense_totals(v->'answers') is not null
$$;
create function private.valid_expense_assistant(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select v='null'::jsonb or (private.exact_keys(v,array['schemaVersion','draft','lastApplied']) and v->'schemaVersion'='1'::jsonb
   and private.valid_expense_draft(v->'draft') and (v->'lastApplied'='null'::jsonb or
   (private.exact_keys(v->'lastApplied',array['answers','appliedAt']) and private.timestamp_value(v#>'{lastApplied,appliedAt}')
     and private.expense_totals(v#>'{lastApplied,answers}',true) is not null)))
$$;
create function private.normalize_workspace_v5(v jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare base jsonb;
begin
 if not private.exact_keys(v->'main',array['applied','setupProgress','expenseAssistant'])
   or not coalesce(private.valid_expense_assistant(v#>'{main,expenseAssistant}'),false) then return null; end if;
 base:=private.normalize_workspace_v4(jsonb_set(v,'{main}',(v->'main')-'expenseAssistant'));
 if base is null then return null; end if;
 return jsonb_set(base,'{main,expenseAssistant}',v#>'{main,expenseAssistant}');
end $$;

-- Dedicated operations preserve the latest income/saving/investment and setup state.
-- CAS is still checked before these transformations. Only completion changes totals.
create function private.expense_main(current_main jsonb, requested_main jsonb, complete boolean) returns jsonb
language plpgsql volatile set search_path='' as $$
declare draft jsonb:=requested_main#>'{expenseAssistant,draft}'; totals jsonb; applied jsonb:=current_main->'applied'; assistant jsonb; stamp numeric;
begin
 if applied='null'::jsonb or not coalesce(private.valid_expense_draft(draft),false) then return null; end if;
 totals:=private.expense_totals(draft->'answers',complete); if totals is null then return null; end if;
 assistant:=jsonb_build_object('schemaVersion',1,'draft',draft,'lastApplied',coalesce(current_main#>'{expenseAssistant,lastApplied}','null'::jsonb));
 if complete then
   stamp:=greatest(floor(extract(epoch from clock_timestamp())*1000),(applied->>'updatedAt')::numeric+1);
   if stamp>8640000000000000 then return null; end if;
   assistant:=jsonb_set(assistant,'{draft,step}','"review"'::jsonb) || jsonb_build_object('lastApplied',jsonb_build_object('answers',draft->'answers','appliedAt',stamp));
   if applied->'monthlyHousingWon' <> totals->'housingWon' or applied->'monthlyLivingWon' <> totals->'livingWon' then
     applied:=applied || jsonb_build_object('monthlyHousingWon',totals->'housingWon','monthlyLivingWon',totals->'livingWon','updatedAt',stamp);
   end if;
 end if;
 return current_main || jsonb_build_object('applied',applied,'expenseAssistant',assistant);
end $$;
create or replace function private.mutate_workspace(operation text, p_payload jsonb, p_expected_revision bigint, p_mutation_id uuid, p_schema_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := private.request_uid(); current_row public.user_workspaces; receipt private.workspace_mutations;
  request_hash bytea; candidate jsonb; allowed text[]; inserted boolean := false;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_schema_version is distinct from 5 or p_mutation_id is null or p_payload is null or octet_length(p_payload::text) > 1048576 then
    return jsonb_build_object('status','invalid'); end if;
  if operation <> 'initialize' and (p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740991) then
    return jsonb_build_object('status','invalid'); end if;
  allowed := case operation when 'main' then array['main'] when 'expense_draft' then array['main'] when 'expense_apply' then array['main'] when 'simulation' then array['simulation']
    when 'portfolio' then array['portfolio'] when 'account_map' then array['locations','accountMap']
    when 'initialize' then array['main','simulation','portfolio','locations','accountMap']
    when 'restore' then array['main','simulation','portfolio','locations','accountMap'] else null end;
  if allowed is null or not private.exact_keys(p_payload,allowed) then return jsonb_build_object('status','invalid'); end if;
  request_hash := sha256(convert_to(jsonb_build_array(p_schema_version,operation,p_expected_revision,p_payload)::text,'UTF8'));

  if operation = 'initialize' then
    select * into current_row from public.user_workspaces where user_id = uid for update;
    if not found then
      candidate := private.normalize_workspace_v5(p_payload);
      if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
      insert into public.user_workspaces(user_id,payload) values(uid,candidate)
        on conflict (user_id) do nothing returning * into current_row;
      inserted := found;
      if not inserted then select * into current_row from public.user_workspaces where user_id = uid for update; end if;
    end if;
  else
    select * into current_row from public.user_workspaces where user_id = uid for update;
    if not found then return jsonb_build_object('status','conflict'); end if;
  end if;
  if current_row.schema_version <> 5 then return jsonb_build_object('status','invalid'); end if;
  select * into receipt from private.workspace_mutations where user_id = uid and mutation_id = p_mutation_id;
  if found then
    if receipt.request_hash <> request_hash then return jsonb_build_object('status','invalid'); end if;
    return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',receipt.committed_revision);
  end if;
  if operation = 'initialize' then
    if not inserted then return jsonb_build_object('status','exists','workspace',to_jsonb(current_row)); end if;
  else
    if current_row.revision <> p_expected_revision then return jsonb_build_object('status','conflict','workspace',to_jsonb(current_row)); end if;
    if current_row.revision = 9007199254740991 then return jsonb_build_object('status','invalid'); end if;
    if operation in ('expense_draft','expense_apply') then
      candidate:=private.expense_main(current_row.payload->'main',p_payload->'main',operation='expense_apply');
      if candidate is null then return jsonb_build_object('status','invalid'); end if;
      candidate:=private.normalize_workspace_v5(current_row.payload || jsonb_build_object('main',candidate));
    elsif operation='main' then
      -- Ordinary Main editing cannot change or remove remembered expense answers.
      if p_payload#>'{main,expenseAssistant}' is distinct from current_row.payload#>'{main,expenseAssistant}' then return jsonb_build_object('status','invalid'); end if;
      candidate:=private.normalize_workspace_v5(current_row.payload || p_payload);
    else
      candidate:=private.normalize_workspace_v5(case when operation='restore' then p_payload else current_row.payload || p_payload end);
    end if;
    if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
    update public.user_workspaces set payload = candidate, revision = revision + 1, updated_at = clock_timestamp()
      where user_id = uid returning * into current_row;
  end if;
  insert into private.workspace_mutations(user_id,mutation_id,request_hash,committed_revision)
    values(uid,p_mutation_id,request_hash,current_row.revision);
  return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',current_row.revision);
end $$;

revoke all on function private.expense_item_ids(), private.expense_totals(jsonb,boolean), private.valid_expense_draft(jsonb),
 private.valid_expense_assistant(jsonb), private.normalize_workspace_v5(jsonb), private.expense_main(jsonb,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function private.expense_item_ids(), private.expense_totals(jsonb,boolean), private.valid_expense_draft(jsonb),
 private.valid_expense_assistant(jsonb), private.normalize_workspace_v5(jsonb), private.expense_main(jsonb,jsonb,boolean) to workspace_rpc_owner;
create function public.save_expense_draft(p_payload jsonb,p_mutation_id uuid,p_expected_revision bigint,p_schema_version integer) returns jsonb
language sql security definer set search_path='' as $$ select private.mutate_workspace('expense_draft',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
create function public.apply_expense(p_payload jsonb,p_mutation_id uuid,p_expected_revision bigint,p_schema_version integer) returns jsonb
language sql security definer set search_path='' as $$ select private.mutate_workspace('expense_apply',p_payload,p_expected_revision,p_mutation_id,p_schema_version) $$;
grant create on schema public to workspace_rpc_owner;
alter function public.save_expense_draft(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
alter function public.apply_expense(jsonb,uuid,bigint,integer) owner to workspace_rpc_owner;
revoke create on schema public from workspace_rpc_owner;
revoke all on function public.save_expense_draft(jsonb,uuid,bigint,integer), public.apply_expense(jsonb,uuid,bigint,integer) from public,anon,service_role;
grant execute on function public.save_expense_draft(jsonb,uuid,bigint,integer), public.apply_expense(jsonb,uuid,bigint,integer) to authenticated;
notify pgrst,'reload schema';
commit;

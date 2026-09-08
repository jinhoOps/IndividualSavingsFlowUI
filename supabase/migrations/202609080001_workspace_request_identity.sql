-- Hosted postgres cannot delegate USAGE on the Supabase-managed auth schema.
-- Read the same verified PostgREST claims as auth.uid(), without granting the
-- RPC role auth access, inherited application roles, or BYPASSRLS privileges.
create function private.request_uid() returns uuid
language sql stable security invoker set search_path = '' as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
revoke all on function private.request_uid() from public, anon, authenticated, service_role;
grant execute on function private.request_uid() to workspace_rpc_owner;

alter policy workspace_rpc_access on public.user_workspaces
  using ((select private.request_uid()) = user_id)
  with check ((select private.request_uid()) = user_id);
alter policy workspace_receipt_access on private.workspace_mutations
  using ((select private.request_uid()) = user_id)
  with check ((select private.request_uid()) = user_id);

-- Only the UID reader changes; mutation signatures, validation, transaction
-- boundaries, locks, revisions and receipts are unchanged from 202609070002.
create or replace function private.mutate_workspace(operation text, p_payload jsonb, p_expected_revision bigint, p_mutation_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := private.request_uid(); current_row public.user_workspaces; receipt private.workspace_mutations;
  request_hash bytea; candidate jsonb; allowed text[]; inserted boolean := false;
begin
  if uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_mutation_id is null or p_payload is null or octet_length(p_payload::text) > 1048576 then
    return jsonb_build_object('status','invalid'); end if;
  if operation <> 'initialize' and (p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740991) then
    return jsonb_build_object('status','invalid'); end if;
  allowed := case operation when 'main' then array['main'] when 'simulation' then array['simulation']
    when 'portfolio' then array['portfolio'] when 'account_map' then array['locations','accountMap']
    when 'initialize' then array['main','simulation','portfolio','locations','accountMap']
    when 'restore' then array['main','simulation','portfolio','locations','accountMap'] else null end;
  if allowed is null or not private.exact_keys(p_payload,allowed) then return jsonb_build_object('status','invalid'); end if;
  request_hash := sha256(convert_to(jsonb_build_array(operation,p_expected_revision,p_payload)::text,'UTF8'));

  -- Uniqueness serializes first creation without relying on a pre-existing row lock.
  if operation = 'initialize' then
    select * into current_row from public.user_workspaces where user_id = uid for update;
    if not found then
      candidate := private.normalize_workspace(p_payload);
      if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
      insert into public.user_workspaces(user_id,payload) values(uid,candidate)
        on conflict (user_id) do nothing returning * into current_row;
      inserted := found;
      if not inserted then
        select * into current_row from public.user_workspaces where user_id = uid for update;
      end if;
    end if;
  else
    select * into current_row from public.user_workspaces where user_id = uid for update;
    if not found then return jsonb_build_object('status','conflict'); end if;
  end if;

  select * into receipt from private.workspace_mutations where user_id = uid and mutation_id = p_mutation_id;
  if found then
    if receipt.request_hash <> request_hash then return jsonb_build_object('status','invalid'); end if;
    return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',receipt.committed_revision);
  end if;
  if operation = 'initialize' then
    if not inserted then return jsonb_build_object('status','exists','workspace',to_jsonb(current_row)); end if;
  else
    if current_row.schema_version <> 3 then return jsonb_build_object('status','invalid'); end if;
    if current_row.revision <> p_expected_revision then return jsonb_build_object('status','conflict','workspace',to_jsonb(current_row)); end if;
    if current_row.revision = 9007199254740991 then return jsonb_build_object('status','invalid'); end if;
    candidate := private.normalize_workspace(case when operation = 'restore' then p_payload else current_row.payload || p_payload end);
    if candidate is null or octet_length(candidate::text) > 1048576 then return jsonb_build_object('status','invalid'); end if;
    update public.user_workspaces set payload = candidate, revision = revision + 1, updated_at = clock_timestamp()
      where user_id = uid returning * into current_row;
  end if;
  insert into private.workspace_mutations(user_id,mutation_id,request_hash,committed_revision)
    values(uid,p_mutation_id,request_hash,current_row.revision);
  return jsonb_build_object('status','saved','workspace',to_jsonb(current_row),'committed_revision',current_row.revision);
end $$;

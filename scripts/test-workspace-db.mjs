import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import { empty, full, fixtures } from '../supabase/tests/workspace-fixtures.mjs';

// A disposable local database only. No connection string or remote database is accepted.
const container = `isf-workspace-test-${randomUUID()}`;
const exec = promisify(execFile);
const docker = args => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sql = statement => docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', statement]);
const quote = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const userC = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const asUser = (statement, user = userA, role = 'authenticated') => `set role ${role}; set request.jwt.claim.sub = '${user}'; ${statement}`;
const call = (name, payload, revision, mutation = randomUUID(), user = userA) => asUser(`select public.${name}(p_payload => ${quote(payload)}, p_mutation_id => '${mutation}'::uuid${revision === undefined ? '' : `, p_expected_revision => ${revision}`});`, user);
const rpc = (...args) => JSON.parse(sql(call(...args)));
let vite;
try {
  docker(['run', '-d', '--rm', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
  for (let attempt = 0; attempt < 100; attempt++) {
    try { docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  sql(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${userA}'), ('${userB}'), ('${userC}');
    create role migration_admin nologin createrole createdb;
    grant create on database postgres to migration_admin;
    grant all on schema public to migration_admin with grant option;
    grant usage on schema auth to migration_admin with grant option;
    grant execute on function auth.uid() to migration_admin with grant option;
    grant references on auth.users to migration_admin;`);
  const migrations = await readdir(new URL('../supabase/migrations/', import.meta.url)).catch(() => []);
  for (const file of migrations.filter(f => f.endsWith('.sql')).sort()) sql(`set role migration_admin; ${await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8')}`);
  assert.equal(sql("select to_regclass('public.user_workspaces') is not null"), 't', 'workspace persistence migration must create storage');
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const { parseWorkspaceDocument } = await vite.ssrLoadModule('/src/workspace/domain/validation.ts');
  for (const fixture of fixtures) {
    const parsed = parseWorkspaceDocument({ schemaVersion: 3, revision: 0, updatedAt: 0, ...fixture.payload });
    assert.equal(parsed !== null, fixture.valid, `TS expected verdict: ${fixture.name}`);
    const normalized = JSON.parse(sql(`select coalesce(private.normalize_workspace(${quote(fixture.payload)}), 'null'::jsonb)`));
    assert.equal(normalized !== null, fixture.valid, `SQL verdict: ${fixture.name}`);
    if (parsed) { const { schemaVersion, revision, updatedAt, ...payload } = parsed; assert.deepEqual(normalized, payload, `normalization: ${fixture.name}`); }
  }
  const initialId = randomUUID();
  const initial = rpc('initialize_workspace', empty, undefined, initialId);
  assert.equal(initial.status, 'saved'); assert.equal(initial.workspace.revision, 0);
  assert.equal(rpc('initialize_workspace', empty, undefined, initialId).committed_revision, 0);
  assert.equal(rpc('initialize_workspace', full).status, 'exists');
  assert.equal(sql(asUser('select count(*) from public.user_workspaces;', userB)), '0');
  assert.equal(sql(asUser('select count(*) from public.user_workspaces;')), '1');
  for (const command of ["select * from public.user_workspaces", "select public.initialize_workspace('{}', gen_random_uuid())"]) {
    assert.throws(() => sql(asUser(command, '', 'anon')), /permission denied/);
  }
  for (const command of ['delete from public.user_workspaces', 'update public.user_workspaces set revision=2', "insert into public.user_workspaces(user_id,payload) values (auth.uid(),'{}')", 'select * from private.workspace_mutations', "select private.normalize_workspace('{}')"]) {
    assert.throws(() => sql(asUser(command)), /permission denied/);
  }
  assert.throws(() => sql(asUser("select public.initialize_workspace('{}', gen_random_uuid())", '')), /authentication required/);
  assert.equal(rpc('restore_workspace', full, 0).status, 'saved');
  const beforeInvalid = sql(asUser('select row_to_json(w) from public.user_workspaces w'));
  const invalid = structuredClone(full); invalid.accountMap.applied.links[0].locationId = 'absent';
  const invalidId = randomUUID();
  assert.equal(rpc('restore_workspace', invalid, 1, invalidId).status, 'invalid');
  assert.equal(sql(asUser('select row_to_json(w) from public.user_workspaces w')), beforeInvalid);
  assert.equal(sql(`select count(*) from private.workspace_mutations where mutation_id='${invalidId}'`), '0');
  assert.equal(rpc('save_main', { main: empty.main, simulation: empty.simulation }, 1).status, 'invalid');
  const main = structuredClone(full.main); main.applied.updatedAt = 101; main.applied.monthlySavingWon = 1;
  const mutation = randomUUID();
  const saved = rpc('save_main', { main }, 1, mutation);
  assert.equal(saved.status, 'saved'); assert.equal(saved.workspace.revision, 2);
  assert.deepEqual(saved.workspace.payload.simulation, full.simulation);
  assert.equal(rpc('save_simulation', { simulation: empty.simulation }, 1).status, 'conflict');
  assert.equal(rpc('save_simulation', { simulation: empty.simulation }, 2).workspace.revision, 3);
  const repeated = rpc('save_main', { main }, 1, mutation);
  assert.equal(repeated.status, 'saved'); assert.equal(repeated.committed_revision, 2); assert.equal(repeated.workspace.revision, 3);
  assert.equal(rpc('save_main', { main: empty.main }, 1, mutation).status, 'invalid');
  assert.equal(rpc('save_main', { main }, 3, mutation).status, 'invalid');
  const parallelSql = statement => exec('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', statement]).then(r => JSON.parse(r.stdout.trim()));
  const race = await Promise.all([parallelSql(call('save_portfolio', { portfolio: empty.portfolio }, 3)), parallelSql(call('save_portfolio', { portfolio: full.portfolio }, 3))]);
  assert.deepEqual(race.map(r => r.status).sort(), ['conflict', 'saved']);
  const retryId = randomUUID();
  const retry = await Promise.all([parallelSql(call('save_simulation', { simulation: full.simulation }, 4, retryId)), parallelSql(call('save_simulation', { simulation: full.simulation }, 4, retryId))]);
  assert.deepEqual(retry.map(r => r.committed_revision), [5, 5]);
  const initializeRace = await Promise.all([parallelSql(call('initialize_workspace', empty, undefined, randomUUID(), userC)), parallelSql(call('initialize_workspace', full, undefined, randomUUID(), userC))]);
  assert.deepEqual(initializeRace.map(r => r.status).sort(), ['exists', 'saved']);
  const account = rpc('save_account_map', { locations: [], accountMap: empty.accountMap }, 5);
  assert.equal(account.workspace.revision, 6); assert.deepEqual(account.workspace.payload.main, main);
  assert.deepEqual(account.workspace.payload.locations, []);
  const aSnapshot = sql(asUser('select row_to_json(w) from public.user_workspaces w'));
  assert.equal(rpc('initialize_workspace', empty, undefined, randomUUID(), userB).status, 'saved');
  assert.equal(rpc('restore_workspace', full, 0, randomUUID(), userB).workspace.user_id, userB);
  assert.equal(sql(asUser('select row_to_json(w) from public.user_workspaces w')), aSnapshot);
  assert.equal(sql(asUser(`select count(*) from public.user_workspaces where user_id='${userA}';`, userB)), '0');
  assert.equal(rpc('save_main', { main, user_id: userB }, 6).status, 'invalid');
  assert.equal(JSON.parse(sql(asUser(`select public.restore_workspace(jsonb_build_object('oversize',repeat('x',1048577)), gen_random_uuid(), 6)`))).status, 'invalid');
  assert.equal(JSON.parse(sql(asUser(`select public.save_main(${quote({ main })}, null, 6)`))).status, 'invalid');
  assert.equal(JSON.parse(sql(asUser(`select public.save_main(${quote({ main })}, gen_random_uuid(), null)`))).status, 'invalid');

  // A receipt failure must roll back the preceding workspace UPDATE too.
  const failedReceipt = randomUUID();
  sql(`create function private.reject_test_receipt() returns trigger language plpgsql as $$ begin raise exception 'test receipt failure'; end $$;
    create trigger reject_test_receipt before insert on private.workspace_mutations for each row execute function private.reject_test_receipt();`);
  assert.throws(() => rpc('save_main', { main }, 6, failedReceipt), /test receipt failure/);
  assert.equal(sql(asUser('select row_to_json(w) from public.user_workspaces w')), aSnapshot);
  assert.equal(sql(`select count(*) from private.workspace_mutations where mutation_id='${failedReceipt}'`), '0');
  sql('drop trigger reject_test_receipt on private.workspace_mutations; drop function private.reject_test_receipt()');
  sql(`delete from private.workspace_mutations where user_id='${userA}' and mutation_id='${mutation}'`);
  assert.equal(rpc('save_main', { main }, 1, mutation).status, 'conflict');
  sql(`update public.user_workspaces set revision=9007199254740991 where user_id='${userB}'`);
  assert.equal(rpc('restore_workspace', full, 9007199254740991, randomUUID(), userB).status, 'invalid');
  assert.equal(sql(asUser('select revision from public.user_workspaces', userB)), '9007199254740991');
  sql(`delete from auth.users where id='${userB}'`);
  assert.equal(sql(`select count(*) from public.user_workspaces where user_id='${userB}'`), '0');
  assert.equal(sql(`select count(*) from private.workspace_mutations where user_id='${userB}'`), '0');
  assert.equal(sql("select rolcanlogin or rolbypassrls from pg_roles where rolname='workspace_rpc_owner'"), 'f');
  assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('initialize_workspace','save_main','save_simulation','save_portfolio','save_account_map','restore_workspace') and p.prosecdef and p.proowner = 'workspace_rpc_owner'::regrole and p.proconfig @> array['search_path=\"\"']"), '6');
  console.log(`PASS: ${fixtures.length} shared TS/SQL fixtures; PostgreSQL RLS, narrow RPCs, rollback, revisions, receipts, concurrent writes/retries/initialization.`);
} finally {
  await vite?.close();
  try { docker(['rm', '-f', container]); } catch { /* Container may not have started. */ }
}

// Fast conversation/discovery checks in a disposable local PostgreSQL only.
// The full test-workspace-db.mjs remains the release compatibility gate.
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createServer} from 'vite';
import {verifyLoungeDiscovery} from './verify-lounge-discovery-db.mjs';
import {verifyLoungeConversation} from './verify-lounge-conversation-db.mjs';
const container=`isf-lounge-test-${randomUUID()}`;
const exec=promisify(execFile);
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const sql=statement=>docker(['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq','-c',statement]);
const userA='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',userC='cccccccc-cccc-cccc-cccc-cccccccccccc';
const asUser=(statement,user=userA,role='authenticated')=>`set role ${role}; set request.jwt.claims='${JSON.stringify({...user?{sub:user}:{},role})}'; ${statement}`;
const parallelSql=statement=>exec('docker',['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq','-c',statement]).then(r=>JSON.parse(r.stdout.trim()));
let vite;
try {
  docker(['run','-d','--rm','--name',container,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
  for(let n=0;n<100;n++){try{docker(['exec',container,'pg_isready','-h','127.0.0.1']);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth;
    create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as
      $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create role migration_admin nologin createrole createdb; grant create on database postgres to migration_admin;
    grant all on schema public to migration_admin with grant option; grant usage on schema auth to migration_admin;
    grant execute on function auth.uid() to migration_admin; grant references on auth.users to migration_admin;
    alter default privileges for role migration_admin grant execute on functions to anon,authenticated,service_role;
    insert into auth.users values('${userA}');`);
  for(const file of ['202609070001_workspace_validation','202609070002_account_workspaces','202609080001_workspace_request_identity','202609280002_portfolio_lounge',
    '202609280003_lounge_asset_band','202609280004_lounge_nickname','202609280005_lounge_nickname_change','202609280006_lounge_community'])
    sql(`set role migration_admin; ${await readFile(new URL(`../supabase/migrations/${file}.sql`,import.meta.url),'utf8')}`);
  sql(asUser("select public.register_lounge_nickname('원래투자자')"));
  vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  if(process.argv.includes('--benchmark')){
    for(const file of ['202609280007_lounge_conversation','202609280008_lounge_discovery','202609280009_lounge_ranking'])
      sql(`set role migration_admin; ${await readFile(new URL(`../supabase/migrations/${file}.sql`,import.meta.url),'utf8')}`);
    const {benchmarkLoungeDiscovery}=await import('./benchmark-lounge-discovery-db.mjs');
    await benchmarkLoungeDiscovery({sql,asUser,userA,vite});
  }else{
  await verifyLoungeConversation({sql,asUser,userA,userC,parallelSql,vite});
  await verifyLoungeDiscovery({sql,asUser,userA,vite});
  const {verifyLoungeRanking}=await import('./verify-lounge-ranking-db.mjs');
  await verifyLoungeRanking({sql,asUser,userA,vite,parallelSql});
  }
} finally {await vite?.close();try{docker(['rm','-f',container]);}catch{}}

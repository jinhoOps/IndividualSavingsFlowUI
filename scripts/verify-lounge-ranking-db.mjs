import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function verifyLoungeRanking({sql,asUser,userA,vite,parallelSql}) {
  const json=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
  const {parseFeedPage,DEFAULT_FEED_QUERY}=await vite.ssrLoadModule('/src/lounge/domain/discovery.ts');
  sql(`set role migration_admin; ${await readFile(new URL('../supabase/migrations/202609280009_lounge_ranking.sql',import.meta.url),'utf8')}`);
  const query={...DEFAULT_FEED_QUERY,q:'집계검증',sort:'reactions'};
  const read=(q=query,cursor=null)=>JSON.parse(sql(asUser(`select public.search_lounge_portfolios(${json(q)},${cursor===null?'null':json(cursor)})`)));
  const refresh=()=>JSON.parse(sql('select private.refresh_lounge_ranking()'));
  assert.equal(read().status,'ranking-unavailable');
  sql(`create table public.ranking_fixture as select n,gen_random_uuid() owner_id,('dddddddd-dddd-4ddd-8ddd-'||lpad(n::text,12,'0'))::uuid post_id from generate_series(1,25) n;
    insert into auth.users select owner_id from ranking_fixture;
    insert into public.lounge_profiles(user_id,nickname) select owner_id,'집계.'||n from ranking_fixture;
    insert into public.portfolio_publications(id,owner_id,title,alias,note,allocation,updated_at)
      select post_id,owner_id,'집계검증 '||n,'집계.'||n,'','{"items":[],"cashShareUnits":1000000}'::jsonb,statement_timestamp()-interval '1 hour' from ranking_fixture;
    insert into public.lounge_reactions select post_id,'${userA}',e from ranking_fixture cross join unnest(array['like','heart']) e where n=1;
    insert into public.lounge_reactions select p.post_id,u.owner_id,'like' from ranking_fixture p cross join ranking_fixture u where p.n=2 and u.n in (1,2);
    insert into public.lounge_comments(id,post_id,user_id,body) select post_id,post_id,owner_id,'root' from ranking_fixture where n=1;
    insert into public.lounge_comments(id,post_id,user_id,body,root_id,reply_to_id) select gen_random_uuid(),post_id,owner_id,'reply',post_id,post_id from ranking_fixture cross join generate_series(1,2) where n=1;
    update public.lounge_comments set body='',user_id=null,deleted_at=clock_timestamp() where id=(select post_id from ranking_fixture where n=1);`);
  const firstEpoch=refresh();assert.equal(firstEpoch.status,'refreshed');
  let first=read();assert.ok(parseFeedPage(first));assert.equal(first.items[0].title,'집계검증 2');assert.equal(first.items[1].title,'집계검증 1');
  assert.equal(read({...query,sort:'comments'}).items[0].title,'집계검증 1');
  assert.equal(sql("select live_comment_count from private.lounge_rankings where post_id=(select post_id from ranking_fixture where n=1)"),'2');
  const second=read(query,first.nextCursor),third=read(query,second.nextCursor);
  assert.deepEqual([first.items.length,second.items.length,third.items.length],[12,12,1]);assert.equal(new Set([...first.items,...second.items,...third.items].map(p=>p.id)).size,25);
  sql('delete from public.lounge_reactions where post_id in(select post_id from ranking_fixture)');
  assert.equal(read().items[0].title,'집계검증 2','scores are fixed until the next epoch');
  refresh();assert.equal(read(query,first.nextCursor).rankedAt,first.rankedAt,'one newer epoch retains previous cursors');
  const previous=sql('select jsonb_agg(t order by epoch)::text from private.lounge_rank_epochs t');
  assert.throws(()=>sql(`begin;create function private.reject_ranking() returns trigger language plpgsql as $$begin raise exception 'injected job failure';end$$;
    create trigger fail_rank before insert on private.lounge_rankings for each row execute function private.reject_ranking();select private.refresh_lounge_ranking();commit;`),/injected job failure/);
  assert.equal(sql('select jsonb_agg(t order by epoch)::text from private.lounge_rank_epochs t'),previous,'failed transaction keeps prior epochs');
  const source=sql("select pg_get_functiondef('private.refresh_lounge_ranking()'::regprocedure)");
  assert.equal(JSON.parse(sql(`begin;${source.replace('419430400','0')};select private.refresh_lounge_ranking();rollback;`)).status,'full');
  assert.equal(sql('select jsonb_agg(t order by epoch)::text from private.lounge_rank_epochs t'),previous);
  await Promise.all([parallelSql('select private.refresh_lounge_ranking()'),parallelSql('select private.refresh_lounge_ranking()')]);
  assert.equal(sql('select count(*) from private.lounge_rank_epochs'),'2');assert.equal(read(query,first.nextCursor).status,'cursor-expired');
  first=read();assert.equal(first.items[0].title,'집계검증 25','ties fall back to timestamp and ID');
  sql("update public.portfolio_publications set updated_at=clock_timestamp() where id=(select post_id from ranking_fixture where n=25)");
  assert.ok(!read().items.some(p=>p.title==='집계검증 25'),'edited rows wait for the next epoch');
  for(const role of ['anon','authenticated','service_role']){
    assert.equal(sql(`select has_function_privilege('${role}','private.refresh_lounge_ranking()','execute')`),'f');
    assert.equal(sql(`select has_table_privilege('${role}','private.lounge_rankings','select')`),'f');
  }
  sql('delete from auth.users where id in(select owner_id from ranking_fixture);drop table public.ranking_fixture');
  assert.equal(sql("select count(*) from private.lounge_rankings where post_id::text like 'dddddddd-dddd-4ddd-8ddd-%'"),'0');
  console.log('PASS: ranking distinct users, live replies, ties, two epochs, concurrent refresh, rollback, space guard, RLS and deletion.');
}

// Disposable PostgreSQL only; called by test-lounge-db.mjs --benchmark.
import assert from 'node:assert/strict';
export async function benchmarkLoungeDiscovery({sql,asUser,userA,vite}) {
  const json=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
  const {DEFAULT_FEED_QUERY,feedQueryKey}=await vite.ssrLoadModule('/src/lounge/domain/discovery.ts');
  sql(`create table public.benchmark_users as select n,case when n=1 then '${userA}'::uuid else gen_random_uuid() end owner_id,
      ('eeeeeeee-eeee-4eee-8eee-'||lpad(n::text,12,'0'))::uuid post_id from generate_series(1,5000) n;
    insert into auth.users select owner_id from benchmark_users where n>1;
    insert into public.lounge_profiles(user_id,nickname) select owner_id,'규모.'||n from benchmark_users where n>1;
    insert into public.portfolio_publications(id,owner_id,title,alias,note,allocation,asset_band,updated_at)
      select post_id,owner_id,'포트폴리오 '||n,'규모.'||n,case when n%3=0 then '금과 주식' else '장기 계획' end,
      jsonb_build_object('items',jsonb_build_array(jsonb_build_object('name',case when n%2=0 then 'VOO' else 'SCHD' end,'shareUnits',900000)),
        'cashShareUnits',100000),case when n%3=0 then null else '20m' end,statement_timestamp()-interval '1 hour' from benchmark_users;
    insert into public.lounge_comments(id,post_id,user_id,body) select gen_random_uuid(),post_id,owner_id,repeat('댓글본문',100) from benchmark_users cross join generate_series(1,4);
    insert into public.lounge_reactions(post_id,user_id,emoji) select p.post_id,u.owner_id,'like' from benchmark_users p cross join generate_series(1,20) k
      join benchmark_users u on u.n=(p.n+k-1)%5000+1;
    analyze public.portfolio_publications;analyze public.lounge_comments;analyze public.lounge_reactions;`);
  const before=Number(sql('select pg_database_size(current_database())'));
  const job=JSON.parse(sql(`do $$declare started timestamptz:=clock_timestamp();begin perform private.refresh_lounge_ranking();
    perform set_config('isf.job_ms',(extract(epoch from clock_timestamp()-started)*1000)::text,false);end$$;
    select json_build_object('durationMs',current_setting('isf.job_ms')::numeric,'rows',(select count(*) from private.lounge_rankings));`));
  sql('select private.refresh_lounge_ranking();analyze private.lounge_rankings');
  const sizes=JSON.parse(sql(`select json_build_object('databaseBeforeBytes',${before},'databaseAfterBytes',pg_database_size(current_database()),
    'rankTableBytes',pg_total_relation_size('private.lounge_rankings'),'rankIndexBytes',pg_indexes_size('private.lounge_rankings'),
    'publicationIndexBytes',pg_indexes_size('public.portfolio_publications'),'rankRows',(select count(*) from private.lounge_rankings),
    'comments',(select count(*) from public.lounge_comments),'reactions',(select count(*) from public.lounge_reactions));`));
  assert.equal(sizes.rankRows,10000);assert.ok(sizes.databaseAfterBytes<419430400);
  const cases=[['recent',{}],['one-character',{q:'금'}],['ticker',{q:'VOO'}],['hidden-band',{assetBands:['hidden']}],
    ['combined',{q:'VOO',hasCash:true,assetBands:['20m'],period:'7d'}],['late-reactions',{sort:'reactions'}],['late-comments',{sort:'comments'}]];
  const results=[];
  for(const [name,patch] of cases){
    const q={...DEFAULT_FEED_QUERY,...patch};let cursor=null;
    if(name.startsWith('late-')){
      const first=JSON.parse(sql(asUser(`select public.search_lounge_portfolios(${json(q)},null)`)));
      cursor={...first.nextCursor,queryKey:feedQueryKey(q),last:{...first.nextCursor.last,id:'eeeeeeee-eeee-4eee-8eee-000000001001'}};
    }
    const expression=`public.search_lounge_portfolios(${json(q)},${cursor?json(cursor):'null'})`;
    const times=JSON.parse(sql(asUser(`do $$declare start_at timestamptz; timings jsonb:='[]';begin
      for n in 1..3 loop perform ${expression};end loop;
      for n in 1..20 loop start_at:=clock_timestamp();perform ${expression};timings:=timings||to_jsonb(extract(epoch from clock_timestamp()-start_at)*1000);end loop;
      perform set_config('isf.benchmark',timings::text,false);end$$; select current_setting('isf.benchmark');`))).sort((a,b)=>a-b);
    const plan=JSON.parse(sql(asUser(`explain(analyze,buffers,format json) select ${expression}`)))[0];
    const result={name,p95Ms:times[18],medianMs:(times[9]+times[10])/2,executionMs:plan['Execution Time'],buffers:plan.Plan};
    results.push(result);assert.ok(result.p95Ms<=200,`${name} p95 ${result.p95Ms}ms exceeds 200ms`);
  }
  const rawPlan=sql(`set role lounge_rpc_owner;set request.jwt.claims='${JSON.stringify({sub:userA,role:'authenticated'})}';
    explain(analyze,buffers) select p.id from private.lounge_feed_rows(${json({...DEFAULT_FEED_QUERY,q:'금'})},statement_timestamp()) p order by p.updated_at desc,p.id desc limit 13;`);
  console.log(JSON.stringify({environment:sql('select version()'),job,sizes,results},null,2));
  console.log('ONE-CHARACTER SQL PLAN\n'+rawPlan);
  console.log('PASS: 5000 publications / 20000 comments / 100000 reactions / 10000 ranking rows; 20 warm runs for seven queries.');
}

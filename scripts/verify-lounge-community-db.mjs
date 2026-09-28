import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export async function verifyLoungeCommunity({sql,asUser,userA,userC,parallelSql,vite}) {
  const literal = value => value===null ? 'null' : `'${value.replaceAll("'","''")}'`;
  const call = (name,args='',user=userA) => JSON.parse(sql(asUser(`select public.${name}(${args})`,user))||'null');
  const before = table => sql(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.${table} t`);
  const retained = Object.fromEntries(['user_workspaces','portfolio_publications','lounge_profiles'].map(t=>[t,before(t)]));
  sql(`set role migration_admin; ${await readFile(new URL('../supabase/migrations/202609280006_lounge_community.sql',import.meta.url),'utf8')}`);
  for(const [table,value] of Object.entries(retained)) assert.equal(before(table),value,`${table} migration retention`);
  const {EMOJIS,parseCommunitySummary,parseCommentPage,parseCommentBody} = await vite.ssrLoadModule('/src/lounge/domain/community.ts');
  const post=call('list_lounge_portfolios_v2','true')[0];
  const summary=(user=userA)=>call('get_lounge_community',`array['${post.id}']::uuid[]`,user)[0];
  const react=(emoji,active=true,user=userA)=>call('set_lounge_reaction',`'${post.id}',${literal(emoji)},${active}`,user);
  const add=(body='댓글',id=randomUUID(),user=userA)=>call('add_lounge_comment',`'${post.id}','${id}',${literal(body)}`,user);
  const comments=(cursor=null,user=userA)=>call('list_lounge_comments',`'${post.id}'${cursor?`,${literal(cursor.createdAt)},'${cursor.id}'`:''}`,user);
  const remove=(id,user=userA)=>call('delete_lounge_comment',`'${post.id}','${id}'`,user);
  const age=()=>sql("update private.lounge_community_activity set last_comment_at=clock_timestamp()-interval '11 seconds',reaction_window_at=clock_timestamp()-interval '2 minutes'");
  assert.deepEqual(summary(),{postId:post.id,reactions:[],uniqueReactors:0,commentCount:0});
  assert.equal(react('like').status,'saved'); assert.equal(react('like').summary.reactions[0].count,1,'same target state is idempotent');
  assert.equal(react('heart').summary.uniqueReactors,1,'multiple emojis count as one person internally');
  assert.equal(react('like',true,userC).summary.uniqueReactors,2);
  assert.equal(summary().reactions.find(r=>r.emoji==='like').count,2);
  assert.equal(summary(userC).reactions.find(r=>r.emoji==='heart').mine,false);
  const concurrent=await Promise.all(Array.from({length:4},()=>parallelSql(asUser(`select public.set_lounge_reaction('${post.id}','fire',true)`,userC))));
  assert.ok(concurrent.every(r=>r.status==='saved')); assert.equal(summary().reactions.find(r=>r.emoji==='fire').count,1);
  for(const emoji of ['clap','idea','think','wow']) assert.equal(react(emoji).status,'saved');
  const race=await Promise.all(['target','rocket'].map(emoji=>parallelSql(asUser(`select public.set_lounge_reaction('${post.id}','${emoji}',true)`,userA))));
  assert.deepEqual(race.map(r=>r.status).sort(),['reaction-limit','saved']);
  assert.equal(summary().reactions.length,8); assert.equal(react('seed').status,'reaction-limit');
  assert.equal(react('like',false).summary.reactions.find(r=>r.emoji==='like').count,1);
  assert.equal(react('like',false,userC).summary.reactions.length,7);
  assert.equal(react('seed').summary.reactions.length,8,'zero count frees the type slot');
  assert.ok(parseCommunitySummary(summary()));
  for(const emoji of [null,'','LIKE','😀',"like');drop table x;--",'x'.repeat(50000)]) assert.equal(react(emoji).status,'invalid');
  assert.equal(sql(`select count(*) from public.lounge_reactions where post_id='${post.id}' and user_id='${userA}' and emoji='heart'`),'1');

  const dangerous="<img src=x onerror=alert(1)> '; DROP TABLE public.lounge_comments; --\n한글 😀";
  const commentId=randomUUID(); const first=add(dangerous,commentId);
  assert.equal(first.status,'saved'); assert.equal(first.comment.body,dangerous); assert.equal(first.summary.commentCount,1);
  assert.deepEqual(add(dangerous,commentId),first,'lost response retry keeps id/time/count');
  assert.equal(add('새 내용',commentId).status,'conflict'); assert.equal(add(dangerous,commentId,userC).status,'conflict');
  assert.equal(add('너무 빠른 댓글').status,'rate-limited');
  assert.equal(comments(null,userC).comments[0].isMine,false); assert.ok(parseCommentPage(comments()));
  assert.ok(!JSON.stringify(comments(null,userC)).includes(userA),'UID excluded');
  assert.equal(remove(commentId,userC).status,'forbidden'); assert.equal(comments().comments.length,1);
  assert.equal(remove(commentId).status,'deleted'); assert.equal(remove(commentId).status,'deleted');
  assert.equal(add('삭제로 제한 우회').status,'rate-limited');
  for(const body of [null,'',' \n ','\u00a0\ufeff','a'.repeat(501),'a\tb','a\rb','a\u202eb']) assert.equal(add(body).status,'invalid');
  age(); assert.equal(add('😀'.repeat(500)).status,'saved');
  for(const body of ['한글\n😀','😀'.repeat(500),'x'.repeat(501),'a\tb','a\u202eb','\u00a0\ufeff']) {
    assert.equal(sql(`select private.valid_lounge_comment(${literal(body)})`),parseCommentBody(body)?'t':'f');
  }
  // Server time windows cannot be supplied by callers; fixtures alone age them.
  sql(`update private.lounge_community_activity set comment_count=40,last_comment_at=clock_timestamp()-interval '11 seconds' where user_id='${userA}'`);
  assert.equal(add('하루 한도').status,'rate-limited');
  sql(`update private.lounge_community_activity set comment_window_at=clock_timestamp()-interval '24 hours' where user_id='${userA}'`);
  assert.equal(add('다음 구간').status,'saved');
  sql(`update private.lounge_community_activity set reaction_count=60,reaction_window_at=clock_timestamp() where user_id='${userA}'`);
  assert.equal(react('heart',false).status,'rate-limited'); assert.equal(react('heart',true).status,'saved','no-op does not consume a limit');
  age(); assert.equal(react('heart',false).status,'saved');

  for(const table of ['public.lounge_reactions','public.lounge_comments','private.lounge_community_activity']) {
    assert.equal(sql(`select relrowsecurity and relforcerowsecurity from pg_class where oid='${table}'::regclass`),'t');
    for(const role of ['anon','authenticated','service_role']) for(const verb of ['select * from','delete from']) {
      assert.throws(()=>sql(asUser(`${verb} ${table}`,userA,role)),/permission denied/);
    }
    assert.equal(sql(`select has_table_privilege('authenticated','${table}','INSERT') or has_table_privilege('authenticated','${table}','UPDATE')`),'f');
  }
  for(const [name,args] of [['get_lounge_community',`array['${post.id}']::uuid[]`],['set_lounge_reaction',`'${post.id}','like',true`],
    ['list_lounge_comments',`'${post.id}'`],['add_lounge_comment',`'${post.id}','${randomUUID()}','본문'`],['delete_lounge_comment',`'${post.id}','${randomUUID()}'`]]) {
    assert.throws(()=>sql(asUser(`select public.${name}(${args})`,null,'anon')),/permission denied/);
    assert.throws(()=>sql(asUser(`select public.${name}(${args})`,null)),/authentication required/);
  }
  assert.throws(()=>call('get_lounge_community',`array_fill('${post.id}'::uuid,array[25])`),/invalid post ids/);
  assert.throws(()=>call('list_lounge_comments',`'${post.id}',now(),null`),/invalid cursor/);
  assert.throws(()=>call('add_lounge_comment',`p_post_id=>'${post.id}',p_id=>'${randomUUID()}',p_body=>'x',p_user_id=>'${userC}'`),/does not exist/);
  const notOwner=comments().comments[0];
  sql(asUser(`delete from public.lounge_comments where id='${notOwner.id}'`,userC,'lounge_rpc_owner'));
  assert.ok(comments().comments.some(c=>c.id===notOwner.id),'RLS also protects the invoker role');
  age();const sameCommentId=randomUUID();const countBeforeRetry=summary().commentCount;
  const retries=await Promise.all(Array.from({length:2},()=>parallelSql(asUser(`select public.add_lounge_comment('${post.id}','${sameCommentId}','동시 재시도')`,userA))));
  assert.ok(retries.every(r=>r.status==='saved'));assert.equal(summary().commentCount,countBeforeRetry+1);
  assert.equal(retries[0].comment.createdAt,retries[1].comment.createdAt);

  // Equal timestamps still page by UUID, without skips or repetitions.
  sql(`delete from public.lounge_comments; insert into public.lounge_comments(id,post_id,user_id,body,created_at)
    select gen_random_uuid(),'${post.id}','${userA}','페이지 '||n,'2026-09-28T00:00:00Z' from generate_series(1,45) n`);
  const p1=comments(),p2=comments(p1.comments.at(-1)),p3=comments(p2.comments.at(-1));
  assert.equal(p1.comments.length,20);assert.equal(p2.comments.length,20);assert.equal(p3.comments.length,5);
  assert.equal(p1.hasMore,true);assert.equal(p3.hasMore,false);
  assert.equal(new Set([...p1.comments,...p2.comments,...p3.comments].map(c=>c.id)).size,45);
  sql(`begin; alter table public.lounge_profiles disable trigger lounge_profile_change_guard;
    update public.lounge_profiles set nickname_changed_at=clock_timestamp()-interval '49 hours' where user_id='${userA}';
    alter table public.lounge_profiles enable trigger lounge_profile_change_guard; commit;`);
  const current=call('get_lounge_profile_v2');assert.equal(call('change_lounge_nickname',`'댓글작성자',${current.version}`).status,'saved');
  assert.equal(comments().comments[0].nickname,'댓글작성자','comments follow current nickname');

  // Near-cap fixtures exercise the same atomic path with enough room for one winner.
  sql(`insert into public.lounge_comments(id,post_id,user_id,body) select gen_random_uuid(),'${post.id}','${userA}','한도' from generate_series(1,454)`);
  age();
  const lastComment=await Promise.all([userA,userC].map(user=>parallelSql(asUser(`select public.add_lounge_comment('${post.id}','${randomUUID()}','마지막 자리')`,user))));
  assert.deepEqual(lastComment.map(r=>r.status).sort(),['comment-limit','saved']);
  assert.equal(summary().commentCount,500);

  // Bounded maximal fixtures: measure their real relation/index footprint.
  sql(`delete from public.lounge_comments; delete from public.lounge_reactions;
    alter table public.lounge_comments alter column body set storage external;
    create temp table community_users as select gen_random_uuid() id,n from generate_series(1,4000) n;
    insert into auth.users select id from community_users;
    insert into public.lounge_profiles(user_id,nickname) select id,'community.'||n from community_users;
    insert into public.portfolio_publications(owner_id,title,alias,note,allocation)
      select id,'예산검증','community.'||n,'','{"items":[],"cashShareUnits":1000000}' from community_users where n<=40;
    insert into public.lounge_comments(id,post_id,user_id,body)
      select gen_random_uuid(),p.id,'${userA}',repeat('😀',500) from public.portfolio_publications p cross join generate_series(1,500)
      where p.title='예산검증';
    insert into public.lounge_reactions(post_id,user_id,emoji)
      select p.id,u.id,'like' from (select id from public.portfolio_publications where title='예산검증' order by id limit 25) p cross join community_users u;`);
  const bytes=Number(sql("select sum(pg_total_relation_size(t)) from unnest(array['public.lounge_comments','public.lounge_reactions','private.lounge_community_activity']) t"));
  assert.ok(bytes<100*1024*1024,`bounded community tables ${bytes} bytes`);
  assert.equal(add('전역 한도').status,'full');assert.equal(react('like').status,'full');
  sql('delete from public.lounge_comments where id=(select id from public.lounge_comments limit 1); delete from public.lounge_reactions where ctid=(select ctid from public.lounge_reactions limit 1)');
  age();
  const globalComments=await Promise.all([userA,userC].map(user=>parallelSql(asUser(`select public.add_lounge_comment('${post.id}','${randomUUID()}','전역 마지막 자리')`,user))));
  assert.deepEqual(globalComments.map(r=>r.status).sort(),['full','saved']);
  const globalReactions=await Promise.all([userA,userC].map(user=>parallelSql(asUser(`select public.set_lounge_reaction('${post.id}','fire',true)`,user))));
  assert.deepEqual(globalReactions.map(r=>r.status).sort(),['full','saved']);
  console.log(`PASS: community maximal 20,000 comments / 100,000 reactions footprint ${bytes} bytes including indexes.`);
  sql('truncate public.lounge_comments,public.lounge_reactions');
  age(); const canDelete=add('예산이 차도 삭제 가능').comment;
  sql(`create table public.community_budget_pad(body text); alter table public.community_budget_pad alter column body set storage plain;
    insert into public.community_budget_pad select repeat(md5(n::text),220) from generate_series(1,60000) n`);
  assert.ok(Number(sql('select pg_database_size(current_database())'))>=419430400);
  assert.equal(react('like').status,'full'); assert.equal(add('DB 용량 한도').status,'full');
  assert.equal(remove(canDelete.id).status,'deleted');
  sql('drop table public.community_budget_pad');

  // Publication and profile/account deletion remove their community content.
  age(); const remaining=add('cascade').comment;react('like');
  const currentPost=call('get_lounge_portfolio_v2',`'${post.id}'`);
  call('delete_lounge_portfolio',`'${post.id}',${currentPost.version}`);
  assert.equal(comments(),null);assert.equal(react('like').status,'missing');
  assert.equal(sql(`select count(*) from public.lounge_comments where id='${remaining.id}'`),'0');
  assert.equal(sql(`select count(*) from public.lounge_reactions where post_id='${post.id}'`),'0');
  sql(`delete from auth.users where id in(select user_id from public.lounge_profiles where nickname like 'community.%')`);
  const cPost=call('list_lounge_portfolios_v2','true',userC)[0];
  age();call('add_lounge_comment',`'${cPost.id}','${randomUUID()}','계정 삭제'`,userC);call('set_lounge_reaction',`'${cPost.id}','like',true`,userC);
  sql(`delete from auth.users where id='${userC}'`);
  for(const table of ['public.lounge_comments','public.lounge_reactions','private.lounge_community_activity']) assert.equal(sql(`select count(*) from ${table} where user_id='${userC}'`),'0');
  // Account C's intentional deletion aside, financial payloads are untouched.
  const retainedRows=JSON.parse(retained.user_workspaces).filter(w=>w.user_id!==userC);
  assert.deepEqual(JSON.parse(before('user_workspaces')),retainedRows);
  console.log('PASS: community migration retention, 8-type/deduplicated counts and races, idempotent replies, paging, nickname joins, RLS/IDOR, literal text, rate/row/DB caps and cascade.');
}

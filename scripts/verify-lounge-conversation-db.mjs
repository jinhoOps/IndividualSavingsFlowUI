import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export async function verifyLoungeConversation({sql,asUser,userA,userC,parallelSql,vite}) {
  const json=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
  const lit=v=>v===null?'null':`'${v.replaceAll("'","''")}'`;
  const call=(name,args='',user=userA)=>JSON.parse(sql(asUser(`select public.${name}(${args})`,user))||'null');
  const before=sql('select md5(string_agg(payload::text,\'\' order by user_id)) from public.user_workspaces');
  await assert.doesNotReject(async()=>sql(`set role migration_admin; ${await readFile(new URL('../supabase/migrations/202609280007_lounge_conversation.sql',import.meta.url),'utf8')}`));
  assert.equal(sql('select md5(string_agg(payload::text,\'\' order by user_id)) from public.user_workspaces'),before);
  const userD=randomUUID();
  sql(`insert into auth.users(id) values('${userC}'),('${userD}') on conflict do nothing`);
  call('register_lounge_nickname',"'대화.B'",userC);call('register_lounge_nickname',"'a@b'",userD);
  const profiles=JSON.parse(sql('select json_agg(json_build_object(\'userId\',user_id,\'publicId\',public_id,\'nickname\',nickname)) from public.lounge_profiles'));
  const a=profiles.find(p=>p.userId===userA),b=profiles.find(p=>p.userId===userC),d=profiles.find(p=>p.userId===userD);
  assert.notEqual(a.publicId,userA);
  const post=call('publish_lounge_portfolio_v3',`'대화 테스트','',${json({items:[],cashShareUnits:1000000})},null,null`).post;
  const age=()=>sql("update private.lounge_community_activity set last_comment_at=clock_timestamp()-interval '11 seconds'");
  const input=(body,extra={})=>({id:randomUUID(),postId:post.id,rootId:null,replyToId:null,body,mentions:[],...extra});
  const add=(value,user=userA)=>call('add_lounge_comment_v2',json(value),user);
  const inbox=(user=userA)=>call('list_lounge_notifications','false,null',user);
  const {parseConversationPage,parseCommentContext}=await vite.ssrLoadModule('/src/lounge/domain/conversation.ts');
  const {parseNotificationPage}=await vite.ssrLoadModule('/src/lounge/domain/notifications.ts');
  for(const malformed of [[{}],[{start:0,end:2}],null,{body:'wrong'}])
    assert.equal(sql(`select private.valid_lounge_mentions('내용',${json(malformed)})`),'f','incomplete mention shape is rejected');
  assert.equal(sql("select private.valid_lounge_cursor('{}'::jsonb)"),'f');
  const root=add(input('원댓글')).comment;assert.ok(root);
  const body=`😀 @${a.nickname} 질문 있어요`;
  const replyInput=input(body,{rootId:root.id,replyToId:root.id,mentions:[{start:2,end:3+[...a.nickname].length,publicId:a.publicId,label:a.nickname}]});
  age();const reply=add(replyInput,userC);assert.equal(reply.status,'saved');assert.ok(parseCommentContext(reply.context));
  const first=inbox();assert.ok(parseNotificationPage(first));assert.equal(first.items.length,1);assert.equal(first.items[0].kind,'mention');
  assert.equal(add(replyInput,userC).comment.id,reply.comment.id);assert.equal(inbox().items.length,1);
  assert.equal(add({...replyInput,body:'다른 내용',mentions:[]},userC).status,'conflict');
  assert.equal(add({...replyInput,id:randomUUID(),rootId:reply.comment.id},userC).status,'invalid');
  assert.equal(add({...replyInput,id:randomUUID(),mentions:[...replyInput.mentions,...replyInput.mentions]},userC).status,'invalid');
  assert.ok(parseConversationPage(call('list_lounge_threads_v2',`'${post.id}',null`)));
  assert.ok(parseConversationPage(call('list_lounge_replies_v2',`'${post.id}','${root.id}',null,'newer'`),10));
  assert.equal(call('list_lounge_comments',`'${post.id}'`).comments.length,1,'v1 excludes replies');
  const target=call('find_lounge_mention_targets',`'${post.id}','a@'`)[0];assert.equal(target.publicId,d.publicId);assert.deepEqual(Object.keys(target).sort(),['nickname','publicId']);
  call('read_lounge_notifications',`${json(first.readIds)},${lit(first.readCutoff)}`,userC);
  assert.equal(inbox().unreadCount,1,'other recipient cannot mark read');
  age();const next=add(input('다음 답글',{rootId:root.id,replyToId:root.id}),userC);assert.equal(next.status,'saved');
  call('read_lounge_notifications',`${json(first.readIds)},${lit(first.readCutoff)}`);
  assert.equal(inbox().unreadCount,1,'read snapshot leaves new notification unread');
  const removal=call('delete_lounge_comment_v2',`'${post.id}','${root.id}'`);assert.equal(removal.status,'deleted');assert.equal(removal.summary.commentCount,2);
  const threads=call('list_lounge_threads_v2',`'${post.id}',null`);assert.equal(threads.comments[0].body,'');assert.equal(threads.comments[0].author,null);
  assert.equal(call('delete_lounge_comment_v2',`'${post.id}','${reply.comment.id}'`).status,'forbidden');
  const snapshot=call('get_lounge_comment_context',`'${post.id}','${reply.comment.id}'`);assert.ok(parseCommentContext(snapshot));
  for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_table_privilege('${role}','public.lounge_notifications','select,insert,update,delete')`),'f');
  assert.throws(()=>call('list_lounge_notifications','false,null',null),/authentication/);
  const tombstoneId=root.id;
  sql(`delete from auth.users where id='${userC}'`);
  assert.equal(call('get_lounge_comment_context',`'${post.id}','${reply.comment.id}'`),null);
  assert.equal(inbox().items.length,0);assert.equal(sql(`select count(*) from public.lounge_comments where id='${tombstoneId}'`),'0');
  age();const legacy=call('add_lounge_comment',`'${post.id}','${randomUUID()}','구버전 작성'`);assert.equal(legacy.status,'saved');
  assert.equal(call('delete_lounge_comment',`'${post.id}','${legacy.comment.id}'`).status,'deleted');
  // Selected identity survives renaming and reuse of the old nickname.
  age();const mentionInput=input('😀 @a@b 남기기',{mentions:[{start:2,end:6,publicId:d.publicId,label:'a@b'}]});
  const mentioned=add(mentionInput);assert.equal(mentioned.status,'saved');
  assert.equal(call('change_lounge_nickname',"'새대상',1",userD).status,'saved');
  sql(`insert into auth.users values('${userC}')`);call('register_lounge_nickname',"'a@b'",userC);
  const renamed=add(mentionInput);assert.equal(renamed.status,'saved');
  assert.equal(renamed.comment.mentions[0].publicId,d.publicId);assert.equal(renamed.comment.mentions[0].currentNickname,'새대상');
  assert.equal(inbox(userC).items.length,0,'nickname reuse never steals a mention');
  sql(`delete from auth.users where id='${userD}'`);
  const scrubbed=call('get_lounge_comment_context',`'${post.id}','${mentioned.comment.id}'`).root;
  assert.equal(scrubbed.body,'😀 @탈퇴 남기기');assert.deepEqual(scrubbed.mentions,[]);
  // Equal timestamps still have a deterministic cursor; deep links load a bounded window.
  const thread=mentioned.comment;
  sql(`insert into public.lounge_comments(id,post_id,user_id,body,created_at)
    select gen_random_uuid(),'${post.id}','${userA}','페이지',clock_timestamp()-interval '1 day' from generate_series(1,25);
    insert into public.lounge_comments(id,post_id,user_id,body,root_id,reply_to_id,created_at)
    select gen_random_uuid(),'${post.id}','${userC}','답글 페이지','${thread.id}','${thread.id}',date_trunc('second',clock_timestamp()) from generate_series(1,25);`);
  const p1=call('list_lounge_threads_v2',`'${post.id}',null`);assert.equal(p1.comments.length,20);assert.ok(p1.nextCursor);
  const p2=call('list_lounge_threads_v2',`'${post.id}',${json(p1.nextCursor)}`);assert.equal(p2.comments.length,6);assert.equal(new Set([...p1.comments,...p2.comments].map(c=>c.id)).size,26);
  const r1=call('list_lounge_replies_v2',`'${post.id}','${thread.id}',null,'newer'`);
  const r2=call('list_lounge_replies_v2',`'${post.id}','${thread.id}',${json(r1.nextCursor)},'newer'`);
  const r3=call('list_lounge_replies_v2',`'${post.id}','${thread.id}',${json(r2.nextCursor)},'newer'`);
  assert.deepEqual([r1.comments.length,r2.comments.length,r3.comments.length],[10,10,5]);
  assert.equal(new Set([...r1.comments,...r2.comments,...r3.comments].map(c=>c.id)).size,25);
  const middle=call('get_lounge_comment_context',`'${post.id}','${r2.comments[5].id}'`);assert.ok(parseCommentContext(middle));assert.ok(middle.previousCursor);assert.ok(middle.page.nextCursor);
  const previous=call('list_lounge_replies_v2',`'${post.id}','${thread.id}',${json(middle.previousCursor)},'older'`);assert.ok(parseConversationPage(previous,10));
  const offWindow=input('이전 페이지 대상에게 답글',{rootId:thread.id,replyToId:r1.comments[0].id});
  age();const offWindowSaved=add(offWindow);assert.equal(offWindowSaved.status,'saved');
  assert.ok(!offWindowSaved.context.page.comments.some(c=>c.id===r1.comments[0].id));
  assert.equal(offWindowSaved.comment.replyToAuthor.publicId,r1.comments[0].author.publicId);
  call('delete_lounge_comment_v2',`'${post.id}','${r1.comments[0].id}'`,userC);
  assert.equal(call('get_lounge_comment_context',`'${post.id}','${offWindow.id}'`).page.comments.find(c=>c.id===offWindow.id).replyToAuthor,null);
  assert.equal(sql("select private.valid_lounge_cursor('{\"id\":\"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\",\"createdAt\":\"infinity\"}'::jsonb)"),'f');
  age();const retryInput=input('한 번만 저장',{rootId:thread.id,replyToId:thread.id});
  const retries=await Promise.all(Array.from({length:3},()=>parallelSql(asUser(`select public.add_lounge_comment_v2(${json(retryInput)})`,userC))));
  assert.ok(retries.every(r=>r.status==='saved'));assert.equal(inbox().items.filter(n=>n.commentId===retryInput.id).length,1);
  age();const rootForRace=add(input('삭제 경쟁'));assert.equal(rootForRace.status,'saved');age();
  const raceInput=input('동시 답글',{rootId:rootForRace.comment.id,replyToId:rootForRace.comment.id});
  const raced=await Promise.all([
    parallelSql(asUser(`select public.add_lounge_comment_v2(${json(raceInput)})`,userC)),
    parallelSql(asUser(`select public.delete_lounge_comment_v2('${post.id}','${rootForRace.comment.id}')`)),
  ]);
  assert.ok(['saved','missing'].includes(raced[0].status),JSON.stringify(raced));assert.equal(raced[1].status,'deleted');
  if(raced[0].status==='saved')assert.ok(parseCommentContext(call('get_lounge_comment_context',`'${post.id}','${raceInput.id}'`)));
  // Maximum payload / notification footprint: real rows and indexes, no external DB.
  sql(`truncate public.lounge_notifications,public.lounge_comments;
    create table public.conversation_capacity_users as select n,gen_random_uuid() id from generate_series(1,200) n;
    insert into auth.users select id from conversation_capacity_users;
    insert into public.lounge_profiles(user_id,nickname) select id,'quota.'||n from conversation_capacity_users;
    create table public.conversation_capacity_comments as select n,gen_random_uuid() id from generate_series(1,20000) n;
    alter table public.lounge_comments alter column body set storage plain;`);
  const targets=JSON.parse(sql("select json_agg(json_build_object('publicId',public_id,'label',nickname) order by nickname) from public.lounge_profiles where nickname in ('quota.1','quota.2','quota.3')"));
  const capacityMentions=targets.map((t,n)=>({...t,start:471+n*9,end:479+n*9}));
  sql(`insert into public.lounge_comments(id,post_id,user_id,body,mentions)
      select id,'${post.id}','${userC}',repeat('😀',470)||' @quota.1 @quota.2 @quota.3',${json(capacityMentions)} from conversation_capacity_comments;
    insert into public.lounge_notifications(recipient_id,actor_id,post_id,comment_id,kind)
      select u.id,'${userC}','${post.id}',c.id,'reply' from conversation_capacity_comments c
      join conversation_capacity_users u on u.n=(c.n-1)/100+1;`);
  const bytes=Number(sql("select sum(pg_total_relation_size(t)) from unnest(array['public.lounge_comments','public.lounge_notifications']) t"));
  assert.ok(bytes<128*1024*1024,`bounded conversation footprint ${bytes}`);
  const otherPost=call('publish_lounge_portfolio_v3',`'한도 테스트','',${json({items:[],cashShareUnits:1000000})},null,null`,userC).post;
  age();assert.equal(add(input('전역 한도',{postId:otherPost.id}),userC).status,'full');
  sql(`insert into public.lounge_notifications(recipient_id,actor_id,post_id,comment_id,kind)
    select '${userA}','${userC}','${post.id}',id,'mention' from conversation_capacity_comments order by n limit 101;
    select private.prune_lounge_conversation();`);
  assert.equal(sql('select count(*) from public.lounge_notifications'),'20000');
  const bounded=inbox();assert.equal(bounded.unreadCount,100);assert.ok(parseNotificationPage(bounded));assert.equal(bounded.items.length,20);
  call('read_lounge_notifications',`${json(bounded.readIds)},${lit(bounded.readCutoff)}`);assert.equal(inbox().unreadCount,0);
  sql("update public.lounge_notifications set created_at=clock_timestamp()-interval '31 days'; select private.prune_lounge_conversation()");
  assert.equal(sql('select count(*) from public.lounge_notifications'),'0');
  console.log(`PASS: conversation max 20,000 rich comments / 20,000 notifications footprint ${bytes} bytes including indexes; 100/20,000/30d retention.`);
  sql('truncate public.lounge_comments,public.lounge_notifications');
  age();const budgetInput=input('공간이 차도 성공 재시도와 삭제');const budgetSaved=add(budgetInput);assert.equal(budgetSaved.status,'saved');
  sql(`create table public.conversation_budget_pad(body text); alter table public.conversation_budget_pad alter column body set storage plain;
    insert into public.conversation_budget_pad select repeat(md5(n::text),220) from generate_series(1,60000) n`);
  assert.ok(Number(sql('select pg_database_size(current_database())'))>=419430400);
  assert.equal(add(input('신규 용량 차단')).status,'full');assert.equal(add(budgetInput).status,'saved');
  assert.equal(call('delete_lounge_comment_v2',`'${post.id}','${budgetSaved.comment.id}'`).status,'deleted');
  sql('drop table public.conversation_budget_pad');
  sql("delete from auth.users where id in(select id from conversation_capacity_users)");
  sql('drop table public.conversation_capacity_comments,public.conversation_capacity_users');
  assert.equal(sql('select md5(string_agg(payload::text,\'\' order by user_id)) from public.user_workspaces'),before);
  console.log('PASS: conversation migration, bounded replies, selected mentions, retry/dedup notifications, read snapshot, tombstones/account removal, v1 compatibility and RLS.');
}

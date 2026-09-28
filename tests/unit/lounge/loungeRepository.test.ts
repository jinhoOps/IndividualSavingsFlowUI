import {describe, expect, it, vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createLoungeRepository} from '../../../src/lounge/infrastructure/loungeRepository';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const post={id,title:'배분',alias:'투자자',note:'',allocation:{items:[],cashShareUnits:1000000},version:1,updatedAt:'2026-09-28T00:00:00Z',isMine:true};
function fixture() {
  let account='A';let response:unknown=post;
  const headers:string[]=[];
  const rpc=vi.fn(()=>({setHeader: (_key:string,value:string)=>{headers.push(value);return {retry:async()=>({data:response,error:null})};}}));
  const client={auth:{getSession:async()=>({data:{session:{user:{id:account},access_token:account+'-token'}},error:null})},rpc} as unknown as SupabaseClient;
  return {client,headers,rpc,setAccount:(value:string)=>{account=value;},setResponse:(value:unknown)=>{response=value;}};
}
describe('Lounge authenticated transport',()=>{
  it('sends idempotent community intent with no account, nickname or client time fields',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    const summary={postId:id,reactions:[{emoji:'like',count:1,mine:true}],commentCount:1,uniqueReactors:1};
    f.setResponse([summary]);expect(await repo.getCommunity([id])).toEqual([summary]);
    expect(f.rpc).toHaveBeenLastCalledWith('get_lounge_community',{p_post_ids:[id]});
    f.setResponse({status:'saved',summary});await repo.setReaction(id,'like',true);
    expect(f.rpc).toHaveBeenLastCalledWith('set_lounge_reaction',{p_post_id:id,p_emoji:'like',p_active:true});
    f.setResponse({status:'reaction-limit',summary});expect((await repo.setReaction(id,'heart',true)).status).toBe('reaction-limit');
    const comment={id,nickname:'나의이름',body:"<b>문자</b>\n'; DROP TABLE x; --",createdAt:'2026-09-28T01:00:00Z',isMine:true};
    f.setResponse({status:'saved',comment,summary});expect(await repo.addComment(id,id,comment.body)).toEqual({comment,summary});
    expect(f.rpc).toHaveBeenLastCalledWith('add_lounge_comment',{p_post_id:id,p_id:id,p_body:comment.body});
    f.setResponse({comments:[comment],hasMore:false});await repo.listComments(id,comment);
    expect(f.rpc).toHaveBeenLastCalledWith('list_lounge_comments',{p_post_id:id,p_before_id:id,p_before_time:comment.createdAt});
    f.setResponse({status:'deleted',summary});expect(await repo.removeComment(id,id)).toEqual(summary);
  });
  it('fails closed on unsafe community inputs, malformed responses and account changes',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    await expect(repo.getCommunity(Array(25).fill(id))).rejects.toMatchObject({code:'invalid'});
    await expect(repo.setReaction(id,'<img>' as never,true)).rejects.toMatchObject({code:'invalid'});
    await expect(repo.addComment(id,id,'a'.repeat(501))).rejects.toMatchObject({code:'invalid'});
    expect(f.rpc).not.toHaveBeenCalled();
    f.setResponse(null);await expect(repo.listComments(id)).rejects.toMatchObject({code:'missing'});
    for(const status of ['rate-limited','full','forbidden','comment-limit','profile-required']){
      f.setResponse({status});await expect(repo.addComment(id,id,'내용')).rejects.toMatchObject({code:status});
    }
    f.setResponse([{postId:id,reactions:[],commentCount:0,uniqueReactors:0,user_id:id}]);await expect(repo.getCommunity([id])).rejects.toMatchObject({code:'invalid'});
    f.setAccount('B');const count=f.rpc.mock.calls.length;await expect(repo.setReaction(id,'like',true)).rejects.toMatchObject({code:'account'});expect(f.rpc).toHaveBeenCalledTimes(count);
  });
  it('distinguishes a missing profile from a malformed or private response',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    f.setResponse(null);expect(await repo.getProfile()).toBeNull();
    expect(f.rpc).toHaveBeenLastCalledWith('get_lounge_profile',{});
    f.setResponse({nickname:'나의이름'});expect(await repo.getProfile()).toEqual({nickname:'나의이름'});
    f.setResponse({nickname:'나의이름',user_id:id});await expect(repo.getProfile()).rejects.toMatchObject({code:'invalid'});
    f.setResponse(undefined);await expect(repo.getProfile()).rejects.toMatchObject({code:'invalid'});
  });
  it('normalizes registration and uses the immutable server name on retry',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    f.setResponse({status:'saved',profile:{nickname:'가나'}});
    expect(await repo.registerNickname('가나'.normalize('NFD'))).toEqual({nickname:'가나'});
    expect(f.rpc).toHaveBeenLastCalledWith('register_lounge_nickname',{p_nickname:'가나'});
    f.setResponse({status:'exists',profile:{nickname:'먼저등록'}});
    expect(await repo.registerNickname('다른이름')).toEqual({nickname:'먼저등록'});
  });
  it('rejects invalid names locally and surfaces duplicate or missing-profile results',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    await expect(repo.registerNickname('공 백')).rejects.toMatchObject({code:'invalid'});expect(f.rpc).not.toHaveBeenCalled();
    f.setResponse({status:'taken'});await expect(repo.registerNickname('Valid')).rejects.toMatchObject({code:'nickname-taken'});
    f.setResponse({status:'profile-required'});
    await expect(repo.publish({title:post.title,note:'',allocation:post.allocation},null)).rejects.toMatchObject({code:'profile-required'});
  });
  it('loads server time and changes through parameter-only RPC without client identity or clock',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    const profile={nickname:'새닉네임',version:2,nextChangeAt:'2026-09-30T12:00:00Z',serverNow:'2026-09-28T12:00:00Z'};
    f.setResponse(profile);expect(await repo.getNicknameSettings()).toEqual(profile);
    expect(f.rpc).toHaveBeenLastCalledWith('get_lounge_profile_v2',{});
    for(const status of ['saved','unchanged','cooldown','conflict']) {
      f.setResponse({status,profile});expect(await repo.changeNickname('새닉네임',1)).toEqual({status,profile});
      expect(f.rpc).toHaveBeenLastCalledWith('change_lounge_nickname',{p_nickname:'새닉네임',p_expected_version:1});
    }
    f.setResponse({status:'taken'});await expect(repo.changeNickname('다른이름',2)).rejects.toMatchObject({code:'nickname-taken'});
    f.setResponse({status:'saved',profile:{...profile,user_id:id}});await expect(repo.changeNickname('다른이름',2)).rejects.toMatchObject({code:'invalid'});
  });
  it('rejects malformed change inputs and account switching before sending a request',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    await expect(repo.changeNickname("x';drop table x--",1)).rejects.toMatchObject({code:'invalid'});
    await expect(repo.changeNickname('닉네임',NaN)).rejects.toMatchObject({code:'invalid'});expect(f.rpc).not.toHaveBeenCalled();
    f.setResponse(null);await expect(repo.getNicknameSettings()).rejects.toMatchObject({code:'profile-required'});
    f.setAccount('B');await expect(repo.changeNickname('새이름',1)).rejects.toMatchObject({code:'account'});expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it('pins the account token and refuses a different account on subsequent requests',async()=>{
    const f=fixture();const repository=createLoungeRepository(f.client);
    expect(await repository.get(id)).toEqual(post);expect(f.headers).toEqual(['Bearer A-token']);
    f.setAccount('B');await expect(repository.get(id)).rejects.toMatchObject({code:'account'});expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it('validates remote responses rather than exposing additional private fields',async()=>{
    const f=fixture();f.setResponse({...post,owner_id:'private'});
    await expect(createLoungeRepository(f.client).get(id)).rejects.toMatchObject({code:'invalid'});
  });
  it('does not send invalid IDs or privately enriched publication payloads',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    await expect(repo.get('invalid')).rejects.toMatchObject({code:'invalid'});
    await expect(repo.publish({...post,allocation:{...post.allocation,money:10}} as never,null)).rejects.toMatchObject({code:'invalid'});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('sends a band code or explicit null through v3, with no source amount',async()=>{
    const f=fixture();const repo=createLoungeRepository(f.client);
    const input={title:post.title,note:post.note,allocation:post.allocation};
    f.setResponse({status:'saved',post:{...post,assetBand:'20m'}});
    await repo.publish({...input,assetBand:'20m'},null);
    expect(f.rpc).toHaveBeenLastCalledWith('publish_lounge_portfolio_v3',{p_title:post.title,p_note:'',p_allocation:post.allocation,p_asset_band:'20m',p_expected_version:null});
    f.setResponse({status:'saved',post:{...post,assetBand:null}});
    await repo.publish(input,1);
    expect(f.rpc).toHaveBeenLastCalledWith('publish_lounge_portfolio_v3',expect.objectContaining({p_asset_band:null}));
  });
});

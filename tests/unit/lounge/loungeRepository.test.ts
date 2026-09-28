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
});

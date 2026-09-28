import {act,renderHook,waitFor} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {useLoungeCommunity} from '../../../src/lounge/ui/useLoungeCommunity';
import type {LoungeRepository} from '../../../src/lounge/infrastructure/loungeRepository';
import type {CommunitySummary} from '../../../src/lounge/domain/community';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empty:CommunitySummary={postId:id,reactions:[],commentCount:0,uniqueReactors:0};
const selected:CommunitySummary={...empty,reactions:[{emoji:'like',count:1,mine:true}],uniqueReactors:1};
describe('Lounge summary request ordering',()=>{
  for(const olderReactionResponse of [false,true]) it(`reconciles overlapping comment and reaction mutations, older response: ${olderReactionResponse}`,async()=>{
    let resolve!:(value:{status:'saved';summary:CommunitySummary})=>void;
    const final={...selected,commentCount:1};
    const read=vi.fn().mockResolvedValueOnce([empty]).mockResolvedValue([final]);
    const repository={getCommunity:read,setReaction:vi.fn(()=>new Promise(r=>{resolve=r;}))} as unknown as LoungeRepository;
    const {result}=renderHook(()=>useLoungeCommunity(repository));
    await act(async()=>{await result.current.load([id]);});
    let reaction!:Promise<boolean>;
    act(()=>{reaction=result.current.react(id,'like',true);});
    act(()=>result.current.accept(olderReactionResponse?final:{...empty,commentCount:1}));
    expect(result.current.entries[id].pending).toBe(true);
    await act(async()=>{resolve({status:'saved',summary:olderReactionResponse?selected:final});await reaction;});
    expect(result.current.entries[id].summary).toEqual(final);
    expect(result.current.entries[id].pending).not.toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('never lets an older read erase a completed reaction or comment update',async()=>{
    const resolves:Array<(value:CommunitySummary[])=>void>=[];
    const repository={getCommunity:vi.fn(()=>new Promise<CommunitySummary[]>(r=>{resolves.push(r);})),
      setReaction:vi.fn(async()=>({status:'saved' as const,summary:selected}))} as unknown as LoungeRepository;
    const {result}=renderHook(()=>useLoungeCommunity(repository));
    act(()=>{void result.current.load([id]);});
    await act(async()=>{await result.current.react(id,'like',true);});
    await act(async()=>{resolves[0]([empty]);});
    expect(result.current.entries[id].summary).toEqual(selected);
    act(()=>{void result.current.load([id]);});
    act(()=>result.current.accept({...selected,commentCount:1}));
    await act(async()=>{resolves[1]([empty]);});
    expect(result.current.entries[id].summary?.commentCount).toBe(1);
    await act(async()=>{resolves[2]([{...selected,commentCount:1}]);});
    expect(result.current.entries[id].summary?.commentCount).toBe(1);
  });
  it('reconciles a delayed comment response received after the reaction is complete',async()=>{
    const final={...selected,commentCount:1};
    const repository={getCommunity:vi.fn().mockResolvedValueOnce([empty]).mockResolvedValue([final]),
      setReaction:vi.fn(async()=>({status:'saved',summary:final}))} as unknown as LoungeRepository;
    const {result}=renderHook(()=>useLoungeCommunity(repository));
    await act(async()=>{await result.current.load([id]);await result.current.react(id,'like',true);});
    await act(async()=>{result.current.accept({...empty,commentCount:1});});
    expect(result.current.entries[id].summary).toEqual(final);
  });
  it('locks a post during a pending reaction and keeps the old summary on failure',async()=>{
    let reject!:(error:Error)=>void;
    const repository={getCommunity:vi.fn(async()=>[empty]),setReaction:vi.fn(()=>new Promise((_,r)=>{reject=r;}))} as unknown as LoungeRepository;
    const {result}=renderHook(()=>useLoungeCommunity(repository));
    await act(async()=>{await result.current.load([id]);});
    act(()=>{void result.current.react(id,'like',true);});
    await act(async()=>{expect(await result.current.react(id,'like',true)).toBe(false);});
    expect(repository.setReaction).toHaveBeenCalledTimes(1);
    await act(async()=>reject(new Error('offline')));
    await waitFor(()=>expect(result.current.entries[id].pending).toBe(false));
    expect(result.current.entries[id].summary).toEqual(empty);
    expect(result.current.entries[id].error).toBeTruthy();
  });
});

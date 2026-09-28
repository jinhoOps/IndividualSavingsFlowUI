import {describe,expect,it} from 'vitest';
import type {Publication} from '../../../src/lounge/domain/publication';
import {refreshPublications} from '../../../src/lounge/ui/refreshPublications';
const posts=Array.from({length:24},(_,i)=>({id:String(100-i).padStart(3,'0'),updatedAt:'2026-09-28T01:00:00Z'} as Publication));
describe('Lounge latest-page reconciliation',()=>{
  it('retains loaded older pages and de-duplicates a post moved to the latest page',()=>{
    const moved={...posts[20],updatedAt:'2026-09-28T02:00:00Z'};
    const latest=[moved,...posts.slice(0,11)];
    const next=refreshPublications(posts,latest);
    expect(next).toHaveLength(24);expect(next[0]).toEqual(moved);expect(new Set(next.map(p=>p.id)).size).toBe(24);
  });
  it('drops deleted latest rows and replaces a now-complete short feed',()=>{
    const latest=posts.slice(1,13);
    expect(refreshPublications(posts,latest)).toEqual(posts.slice(1));
    expect(refreshPublications(posts,[posts[2]])).toEqual([posts[2]]);
    expect(refreshPublications(posts,[])).toEqual([]);
  });
  it('keeps a large burst pageable instead of joining across an unseen gap',()=>{
    const latest=posts.slice(0,12).map(post=>({...post,id:`new-${post.id}`,updatedAt:'2026-09-28T02:00:00Z'}));
    expect(refreshPublications(posts,latest)).toEqual(latest);
  });
});

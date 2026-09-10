import {describe,expect,it} from 'vitest';
import {createEmptyWorkspace,WORKSPACE_STORAGE_KEY,WORKSPACE_V4_STORAGE_KEY} from '../../../src/workspace/domain/model';
import {convertWorkspaceV4Document} from '../../../src/workspace/infrastructure/workspaceV4Migration';
import {BrowserWorkspaceRepository} from '../../../src/workspace/infrastructure/workspaceRepository';
import {exportWorkspaceBackup,importWorkspaceBackup} from '../../../src/workspace/infrastructure/workspaceBackup';
import {AccountWorkspaceCache} from '../../../src/workspace/infrastructure/accountWorkspaceCache';
import {createExpenseDraft} from '../../../src/main/domain/expenseAssistant';

function v4(){const source=createEmptyWorkspace(1000);return {...source,schemaVersion:4,main:{applied:null,setupProgress:null}};}
function memory(){const values=new Map<string,string>();return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
describe('workspace v5 compatibility',()=>{
  it('converts exact v4 without inventing answers or accepting unknown source fields',()=>{
    const source=v4();const result=convertWorkspaceV4Document(source);
    expect(result).toEqual({status:'converted',workspace:{...source,schemaVersion:5,main:{...source.main,expenseAssistant:null}}});
    expect(convertWorkspaceV4Document({...source,main:{...source.main,expenseAssistant:null}}).status).toBe('invalid');
  });
  it('migrates under source and destination locks, keeps original bytes, and never falls back from invalid v5',async()=>{
    const storage=memory();const raw=JSON.stringify(v4(),null,2);storage.setItem(WORKSPACE_V4_STORAGE_KEY,raw);
    const events:string[]=[];const lock=(name:string)=>({runExclusive:async <T,>(task:(guard:{assertOwned():void})=>Promise<T>)=>{events.push(name);return task({assertOwned(){}});}});
    const repository=new BrowserWorkspaceRepository(storage as unknown as Storage,{now:()=>2000,v4SaveLock:lock('v4'),saveLock:lock('v5')});
    expect(repository.load()).toMatchObject({status:'found',needsMigration:true,workspace:{schemaVersion:5}});
    expect((await repository.migrate(0)).status).toBe('saved');expect(events).toEqual(['v4','v5']);
    expect(storage.getItem(WORKSPACE_V4_STORAGE_KEY)).toBe(raw);
    storage.setItem(WORKSPACE_STORAGE_KEY,'{broken');expect(repository.load().status).toBe('invalid');
  });
  it.each(['isf-workspace-v3', 'isf-workspace-v1'])('does not reset %s over a newly appeared v4 source', async sourceKey => {
    const storage = memory(); storage.setItem(sourceKey, '{broken');
    const raw = JSON.stringify(v4());
    const v4SaveLock = {runExclusive: async <T,>(task: (guard: {assertOwned(): void}) => Promise<T>) => {
      storage.setItem(WORKSPACE_V4_STORAGE_KEY, raw); return task({assertOwned() {}});
    }};
    const repository = new BrowserWorkspaceRepository(storage as unknown as Storage, {now: () => 2000, v4SaveLock});
    expect(repository.load().status).toBe('invalid');
    expect(await repository.resetInvalid('{broken')).toEqual({status: 'changed'});
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(WORKSPACE_V4_STORAGE_KEY)).toBe(raw);
  });
  it('imports old backups and includes remembered answers in a current round trip',()=>{
    const migrated=importWorkspaceBackup(JSON.stringify({format:'isf-workspace-backup',formatVersion:3,exportedAt:2000,workspace:v4()}));
    migrated.main.expenseAssistant={schemaVersion:1,draft:createExpenseDraft(2000),lastApplied:null};
    const backup=exportWorkspaceBackup(migrated,3000);expect(JSON.parse(backup).formatVersion).toBe(4);
    expect(importWorkspaceBackup(backup)).toEqual(migrated);
  });
  it('quarantines v4 pending writes as raw recovery instead of replaying them through v5',()=>{
    const storage=memory();const key='isf-account-workspace-v2:project:user:tab';
    const raw=JSON.stringify({version:2,snapshot:v4(),pending:{operation:'save_main'},recoveryDrafts:{}});storage.setItem(key,raw);
    const cache=new AccountWorkspaceCache('project:user:tab',storage);const read=cache.read()!;
    expect(read.snapshot?.schemaVersion).toBe(5);expect(read.pending).toBeNull();
    expect(read.recoveryDrafts['__legacy-v4-cache__'].value).toEqual({key,raw});
    cache.save(read.snapshot,null,read.recoveryDrafts);expect(storage.getItem(key)).toBe(raw);
  });
});

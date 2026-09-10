import {describe,expect,it} from 'vitest';
import {createExpenseDraft,expenseTotals,expenseAnswersComplete,parseExpenseAssistant,parseExpenseDraft,EXPENSE_ITEMS} from '../../../src/main/domain/expenseAssistant';
import {withExpenseDraft,createExpenseAssistantRepository} from '../../../src/main/infrastructure/expenseAssistantRepository';
import {BrowserMainRepository} from '../../../src/main/infrastructure/mainRepository';
import {BrowserWorkspaceRepository} from '../../../src/workspace/infrastructure/workspaceRepository';
import {createEmptyWorkspace,WORKSPACE_STORAGE_KEY} from '../../../src/workspace/domain/model';

function completed() {
  const draft=createExpenseDraft(1000);
  for(const {id} of EXPENSE_ITEMS) draft.answers[id]={amountWon:0,period:'month'};
  draft.answers.rent={amountWon:800000,period:'month'};
  draft.answers.food={amountWon:600000,period:'month'};
  draft.answers.leisure={amountWon:1200000,period:'year'};
  draft.step='review';return draft;
}
function workspace() {
  const current=createEmptyWorkspace(1000);
  current.main.applied={schemaVersion:2,updatedAt:1000,monthlyNetIncomeWon:3200000,monthlyHousingWon:800000,monthlyLivingWon:1000000,monthlySavingWon:300000,monthlyInvestmentWon:200000};
  return current;
}
describe('expense answers and Main replacement',()=>{
  it('distinguishes unanswered from zero and rounds yearly sums once per destination',()=>{
    const draft=createExpenseDraft(1000);
    expect(expenseAnswersComplete(draft.answers)).toBe(false);
    for(const {id}of EXPENSE_ITEMS)draft.answers[id]={amountWon:0,period:'month'};
    draft.answers.rent={amountWon:5,period:'year'};
    draft.answers.utilities={amountWon:5,period:'year'};
    draft.answers.food={amountWon:6,period:'year'};
    expect(expenseAnswersComplete(draft.answers)).toBe(true);
    expect(expenseTotals(draft.answers)).toEqual({housingWon:1,livingWon:1,totalWon:2});
  });
  it('rejects extra fields, unknown questions, unsafe aggregate and incomplete applied answers',()=>{
    const draft=createExpenseDraft(1000);
    expect(parseExpenseDraft({...draft,extra:true})).toBeNull();
    expect(parseExpenseDraft({...draft,answers:{...draft.answers,unknown:null}})).toBeNull();
    expect(parseExpenseAssistant({schemaVersion:1,draft,lastApplied:{answers:draft.answers,appliedAt:1000}})).toBeNull();
    const unsafe=completed();unsafe.answers.rent!.amountWon=Number.MAX_SAFE_INTEGER;
    expect(parseExpenseDraft(unsafe)).toBeNull();
    expect(()=>withExpenseDraft(workspace(),draft,true,2000)).toThrow();
  });
  it('saves progress without changing applied Main and replaces estimates exactly on completion',()=>{
    const original=workspace();const draft=completed();
    const saved=withExpenseDraft(original,draft,false,2000);
    expect(saved.main.applied).toEqual(original.main.applied);
    const boundary = workspace(); boundary.main.applied!.updatedAt = 8_640_000_000_000_000;
    expect(withExpenseDraft(boundary, draft, false, 2000).main.applied).toEqual(boundary.main.applied);
    const applied=withExpenseDraft(saved,draft,true,3000);
    expect(applied.main.applied).toEqual({...original.main.applied,monthlyHousingWon:800000,monthlyLivingWon:700000,updatedAt:3000});
    const repeat=withExpenseDraft(applied,draft,true,4000);
    expect(repeat.main.applied).toEqual(applied.main.applied);
    for(const key of ['simulation','portfolio','locations','accountMap'] as const)expect(repeat[key]).toEqual(original[key]);
  });
  it('persists answers across repository instances, remembers direct edits and refuses stale answer replacement',async()=>{
    const values=new Map<string,string>([[WORKSPACE_STORAGE_KEY,JSON.stringify(workspace())]]);
    const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)} as unknown as Storage;
    const port=new BrowserWorkspaceRepository(storage,{now:()=>2000,saveLock:{runExclusive:async task=>task({assertOwned(){}})}});
    const first=new BrowserMainRepository(port,()=>2000);await first.load();first.expenseAssistant.load();
    await first.expenseAssistant.save(completed(),true);
    const loaded=await first.load();if(loaded.status!=='current')throw new Error('expected Main');
    await first.save({...loaded.data,monthlyLivingWon:999999});
    const second=createExpenseAssistantRepository(port,()=>3000);
    expect(second.load()?.draft.answers.leisure).toEqual({amountWon:1200000,period:'year'});
    expect((await second.save(completed(),true)).data.monthlyLivingWon).toBe(700000);
    const changed=completed();changed.answers.food!.amountWon=500000;
    await expect(first.expenseAssistant.save(changed,true)).rejects.toThrow('다른 곳');
  });
});

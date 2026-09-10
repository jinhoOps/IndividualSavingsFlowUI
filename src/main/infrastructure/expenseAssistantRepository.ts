import type { MainData } from '../domain/model';
import { expenseAnswersComplete, expenseTotals, parseExpenseDraft, type ExpenseAssistant, type ExpenseAssistantDraft } from '../domain/expenseAssistant';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { WorkspaceRepository } from '../../workspace/infrastructure/workspaceRepository';

export interface ExpenseAssistantRepository {
  load(): ExpenseAssistant | null;
  save(draft: ExpenseAssistantDraft, complete: boolean): Promise<{ assistant: ExpenseAssistant; data: MainData }>;
}

/** Shared pure operation for local persistence and the authenticated scope adapter. */
export function withExpenseDraft(current: WorkspaceDocument, draft: ExpenseAssistantDraft, complete: boolean, now: number): WorkspaceDocument {
  const validated = parseExpenseDraft(draft);
  const applied = current.main.applied;
  if (!validated || !applied || (complete && !expenseAnswersComplete(validated.answers))) throw new Error('Invalid expense answers.');
  const totals = expenseTotals(validated.answers)!;
  const updatedAt = complete ? Math.max(now, applied.updatedAt + 1) : applied.updatedAt;
  if (!Number.isSafeInteger(updatedAt) || updatedAt > 8_640_000_000_000_000) throw new Error('Invalid expense timestamp.');
  return { ...current, main: { ...current.main,
    applied: complete && (applied.monthlyHousingWon !== totals.housingWon || applied.monthlyLivingWon !== totals.livingWon) ? { ...applied, monthlyHousingWon: totals.housingWon, monthlyLivingWon: totals.livingWon, updatedAt } : applied,
    expenseAssistant: { schemaVersion: 1, draft: { ...validated, step: complete ? 'review' : validated.step },
      lastApplied: complete ? { answers: structuredClone(validated.answers), appliedAt: updatedAt } : current.main.expenseAssistant?.lastApplied ?? null },
  } };
}

export function createExpenseAssistantRepository(repository: WorkspaceRepository, now = Date.now): ExpenseAssistantRepository {
  let base: ExpenseAssistant | null | undefined;
  return {
    load() {
      const loaded = repository.load();
      if (loaded.status !== 'found') throw new Error('Could not load expense answers.');
      base = structuredClone(loaded.workspace.main.expenseAssistant);
      return structuredClone(base);
    },
    async save(draft, complete) {
      const loaded = repository.load();
      if (loaded.status !== 'found' || base === undefined) throw new Error('Could not load expense answers.');
      if (JSON.stringify(base) !== JSON.stringify(loaded.workspace.main.expenseAssistant)) throw new Error('다른 곳에서 지출 내역이 변경되었습니다. 최신 내역을 확인해주세요.');
      const result = repository.saveExpense
        ? await repository.saveExpense(loaded.workspace.revision, draft, complete)
        : await repository.update(loaded.workspace.revision, current => withExpenseDraft(current, draft, complete, now()));
      if (result.status !== 'saved' || !result.workspace.main.applied || !result.workspace.main.expenseAssistant) {
        throw new Error('답변을 저장하지 못했습니다. 입력은 그대로 유지돼요. 연결 상태를 확인하고 다시 시도해주세요.');
      }
      base = structuredClone(result.workspace.main.expenseAssistant);
      return { assistant: structuredClone(base), data: structuredClone(result.workspace.main.applied) };
    },
  };
}

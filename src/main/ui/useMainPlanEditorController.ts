import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccountRecovery, useInitialRecovery } from '../../auth/AccountDraftContext';
import { saveMainDraft, type SaveMainDraftResult, type ValidationIssue } from '../application/mainSetupCommands';
import type { MainState } from '../application/mainReducer';
import type { MainData } from '../domain/model';
import { isMainDataShape } from '../domain/validation';
import type { MainRepository } from '../infrastructure/mainRepository';

export type MainPlanEditorControllerStatus = 'loading' | 'ready' | 'error';

export interface MainPlanEditorController {
  status: MainPlanEditorControllerStatus;
  draft: MainData | null;
  issues: ValidationIssue[];
  saving: boolean;
  dirty: boolean;
  error: string | null;
  changeDraft(draft: MainData): void;
  save(): Promise<SaveMainDraftResult | { status: 'unavailable' }>;
  cancel(): void;
}

export function useMainPlanEditorController({ repository, recoveryKey }: {
  repository: MainRepository;
  recoveryKey?: string;
}): MainPlanEditorController {
  const [status, setStatus] = useState<MainPlanEditorControllerStatus>('loading');
  const [applied, setApplied] = useState<MainData | null>(null);
  const [draft, setDraft] = useState<MainData | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<{ repository: MainRepository; promise: ReturnType<MainRepository['load']> } | null>(null);
  const draftRef = useRef<MainData | null>(null);
  const appliedRef = useRef<MainData | null>(null);
  const savingRef = useRef(false);
  const recovered = useInitialRecovery(
    recoveryKey ?? '',
    (value) => isMainDataShape(value) ? structuredClone(value) : null,
  );
  draftRef.current = draft;
  appliedRef.current = applied;
  savingRef.current = saving;
  useAccountRecovery(
    recoveryKey ?? '',
    draft,
    applied === null || draft === null ? false : !samePlanAmounts(applied, draft),
    recoveryKey !== undefined && status === 'ready',
  );

  useEffect(() => {
    let active = true;
    let request = requestRef.current;
    if (request === null || request.repository !== repository) {
      request = { repository, promise: repository.load() };
      requestRef.current = request;
    }
    void request.promise.then((result) => {
      if (!active) return;
      if (result.status === 'current' || result.status === 'recovery') {
        const data = structuredClone(result.data);
        setApplied(data);
        setDraft(recovered ?? structuredClone(data));
        setIssues([]);
        setError(null);
        setStatus('ready');
        return;
      }
      setError('현재 Main 월 자금 계획을 불러올 수 없습니다.');
      setStatus('error');
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : '현재 Main 월 자금 계획을 불러올 수 없습니다.');
      setStatus('error');
    });
    return () => { active = false; };
  }, [recovered, repository]);

  const changeDraft = useCallback((next: MainData) => {
    if (savingRef.current) return;
    setIssues([]);
    setError(null);
    setDraft(structuredClone(next));
  }, []);

  const cancel = useCallback(() => {
    if (savingRef.current || appliedRef.current === null) return;
    setDraft(structuredClone(appliedRef.current));
    setIssues([]);
    setError(null);
  }, []);

  const save = useCallback(async (): Promise<SaveMainDraftResult | { status: 'unavailable' }> => {
    const currentDraft = draftRef.current;
    const currentApplied = appliedRef.current;
    if (savingRef.current || currentDraft === null || currentApplied === null) return { status: 'unavailable' };
    savingRef.current = true;
    setSaving(true);
    const state: MainState = {
      mode: 'dashboard',
      applied: structuredClone(currentApplied),
      draft: structuredClone(currentDraft),
      setupStep: null,
      dirty: !samePlanAmounts(currentApplied, currentDraft),
      saveStatus: 'saving',
      loadError: null,
    };
    try {
      const result = await saveMainDraft(state, repository);
      if (result.status === 'saved') {
        const saved = structuredClone(result.data);
        setApplied(saved);
        setDraft(structuredClone(saved));
        setIssues([]);
        setError(null);
      } else if (result.status === 'validation-failed') {
        setIssues(result.issues);
      } else {
        setError('저장하지 못했습니다. 초안은 그대로 보존되어 있습니다.');
      }
      return result;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [repository]);

  return {
    status,
    draft,
    issues,
    saving,
    dirty: applied === null || draft === null ? false : !samePlanAmounts(applied, draft),
    error,
    changeDraft,
    save,
    cancel,
  };
}

function samePlanAmounts(left: MainData, right: MainData): boolean {
  return left.monthlyNetIncomeWon === right.monthlyNetIncomeWon
    && left.monthlyHousingWon === right.monthlyHousingWon
    && left.monthlyLivingWon === right.monthlyLivingWon
    && left.monthlySavingWon === right.monthlySavingWon
    && left.monthlyInvestmentWon === right.monthlyInvestmentWon;
}

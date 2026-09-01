import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  bootstrapMain,
  type MainBootstrapResult,
} from '../application/bootstrap';
import { mainReducer, type MainAction, type MainState } from '../application/mainReducer';
import type { MainIntroEntryReason } from '../application/mainViewModel';
import {
  resetInvalidMainWorkspace,
  saveMainDraft,
  setupStepForIssue,
  type ValidationIssue,
} from '../application/mainSetupCommands';
import { createSetupProgressQueue } from '../application/setupProgressQueue';
import { createEmptyMainData, type MainData, type SetupStep } from '../domain/model';
import type { MainRepository, SetupProgressKind } from '../infrastructure/mainRepository';
import type { MainOperationGate } from './mainOperationGate';

export interface UseMainPlanControllerOptions {
  repository: MainRepository;
  operationGate: MainOperationGate;
  reducedMotion: boolean;
}

export interface MainIntroEntry {
  id: number;
  reason: MainIntroEntryReason;
}

export interface MainPlanController {
  state: MainState | null;
  issues: ValidationIssue[];
  validationAttempt: number;
  progressWarning: string | null;
  introEntry: MainIntroEntry;
  acceptBootstrapResult(result: MainBootstrapResult): void;
  completeWelcomeIntro(entryId: number): void;
  changeDraft(draft: MainData): void;
  changeSetupStep(step: SetupStep): void;
  apply(): Promise<void>;
  cancelDraft(): Promise<void>;
  restartSetup(): void;
  startEmptySetup(): Promise<void>;
  discardRecoveryCandidate(): Promise<void>;
  returnToCurrentPlan(): Promise<void>;
}

const progressMessages = {
  save: '설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.',
  clear: '설정 진행 상황을 정리하지 못했습니다. 저장된 계획에는 영향이 없습니다.',
} as const;

export function useMainPlanController({
  repository,
  operationGate,
  reducedMotion,
}: UseMainPlanControllerOptions): MainPlanController {
  const [state, setState] = useState<MainState | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);
  const [introEntry, setIntroEntry] = useState<MainIntroEntry>({ id: 0, reason: 'none' });
  const initialBootstrapRequestRef = useRef<{
    repository: MainRepository;
    promise: Promise<MainBootstrapResult>;
  } | null>(null);
  const introEntryIdRef = useRef(0);
  const persistedFreshIntroEntryIdsRef = useRef(new Set<number>());
  const progressQueue = useMemo(() => createSetupProgressQueue(repository), [repository]);

  const nextIntroEntry = useCallback((reason: MainIntroEntryReason): MainIntroEntry => {
    introEntryIdRef.current += 1;
    return { id: introEntryIdRef.current, reason };
  }, []);

  const acceptBootstrapResult = useCallback((result: MainBootstrapResult) => {
    setIssues([]);
    setProgressWarning(null);
    setState(result.state);
    setIntroEntry(nextIntroEntry(result.introEntryReason));
  }, [nextIntroEntry]);

  const completeWelcomeIntro = useCallback((entryId: number) => {
    setIntroEntry((current) => current.id !== entryId
      ? current
      : { ...current, reason: 'none' });
  }, []);

  const dispatch = useCallback((action: MainAction) => {
    setState((current) => current === null ? current : mainReducer(current, action));
  }, []);

  const persistSetupProgress = useCallback((
    step: SetupStep,
    draft: MainData,
    kind: SetupProgressKind,
  ): Promise<boolean> => {
    return progressQueue.save(step, draft, kind).then((result) => {
      if (result.status === 'saved') {
        setProgressWarning(null);
        return true;
      }
      setProgressWarning(progressMessages.save);
      return false;
    });
  }, [progressQueue]);

  const clearSetupProgress = useCallback((): Promise<boolean> => {
    return progressQueue.clear().then((result) => {
      if (result.status === 'saved') {
        setProgressWarning(null);
        return true;
      }
      setProgressWarning(progressMessages.clear);
      return false;
    });
  }, [progressQueue]);

  useEffect(() => {
    let active = true;
    let request = initialBootstrapRequestRef.current;
    if (request === null || request.repository !== repository) {
      request = { repository, promise: bootstrapMain(repository) };
      initialBootstrapRequestRef.current = request;
    }
    void request.promise.then((result) => {
      if (active) acceptBootstrapResult(result);
    });
    return () => {
      active = false;
    };
  }, [acceptBootstrapResult, repository]);

  useEffect(() => {
    if (
      introEntry.reason === 'fresh'
      && state?.mode === 'setup'
      && state.setupStep === 'welcome'
      && !persistedFreshIntroEntryIdsRef.current.has(introEntry.id)
    ) {
      persistedFreshIntroEntryIdsRef.current.add(introEntry.id);
      void persistSetupProgress('welcome', state.draft, 'initial');
    }
  }, [introEntry, persistSetupProgress, state]);

  useEffect(() => {
    if (
      reducedMotion
      && state?.mode === 'setup'
      && state.setupStep === 'welcome'
      && (introEntry.reason === 'fresh' || introEntry.reason === 'restart')
    ) {
      completeWelcomeIntro(introEntry.id);
    }
  }, [completeWelcomeIntro, introEntry, reducedMotion, state]);

  const changeDraft = useCallback((draft: MainData) => {
    if (operationGate.busy) return;
    if (state?.mode === 'setup' && state.setupStep !== null) {
      void persistSetupProgress(
        state.setupStep,
        draft,
        state.applied === null ? 'initial' : 'restart',
      );
    }
    setIssues([]);
    dispatch({ type: 'replace-draft', draft });
  }, [dispatch, operationGate, persistSetupProgress, state]);

  const changeSetupStep = useCallback((step: SetupStep) => {
    if (operationGate.busy) return;
    if (state !== null) {
      void persistSetupProgress(
        step,
        state.draft,
        state.applied === null ? 'initial' : 'restart',
      );
    }
    setIssues([]);
    dispatch({ type: 'set-setup-step', step });
  }, [dispatch, operationGate, persistSetupProgress, state]);

  const apply = useCallback(async () => {
    if (state === null || operationGate.busy) return;
    operationGate.busy = true;
    try {
      dispatch({ type: 'save-started' });
      await progressQueue.waitForIdle();
      const result = await saveMainDraft(state, repository);
      if (result.status === 'saved') {
        await clearSetupProgress();
        setIssues([]);
        dispatch({ type: 'save-succeeded', data: result.data });
        return;
      }

      if (result.status === 'validation-failed') {
        setIssues(result.issues);
        setValidationAttempt((attempt) => attempt + 1);
        if (state.mode === 'setup') {
          const step = setupStepForIssue(result.issues[0]?.path);
          if (step !== null) {
            void persistSetupProgress(
              step,
              state.draft,
              state.applied === null ? 'initial' : 'restart',
            );
            dispatch({ type: 'set-setup-step', step });
          }
        }
      }
      dispatch({ type: 'save-failed' });
    } finally {
      operationGate.busy = false;
    }
  }, [
    clearSetupProgress,
    dispatch,
    operationGate,
    persistSetupProgress,
    progressQueue,
    repository,
    state,
  ]);

  const cancelDraft = useCallback(async () => {
    if (operationGate.busy) return;
    operationGate.busy = true;
    try {
      if (!await clearSetupProgress()) return;
      setIssues([]);
      dispatch({ type: 'cancel-draft' });
    } finally {
      operationGate.busy = false;
    }
  }, [clearSetupProgress, dispatch, operationGate]);

  const restartSetup = useCallback(() => {
    if (state === null || state.applied === null || operationGate.busy) return;
    void persistSetupProgress('welcome', state.applied, 'restart');
    setIntroEntry(nextIntroEntry('restart'));
    setIssues([]);
    dispatch({ type: 'restart-setup' });
  }, [dispatch, nextIntroEntry, operationGate, persistSetupProgress, state]);

  const startEmptySetup = useCallback(async () => {
    if (state === null || operationGate.busy) return;
    operationGate.busy = true;
    try {
      dispatch({ type: 'save-started' });
      if (state.mode === 'recovery' && state.loadError?.raw !== undefined) {
        const result = await resetInvalidMainWorkspace(state.loadError.raw, repository);
        if (result.status !== 'reset') {
          dispatch({ type: 'save-failed' });
          return;
        }
      }
      setIssues([]);
      setState(emptySetupState());
    } catch {
      dispatch({ type: 'save-failed' });
    } finally {
      operationGate.busy = false;
    }
  }, [dispatch, operationGate, repository, state]);

  const discardRecoveryCandidate = useCallback(async () => {
    if (state === null || state.mode !== 'recovery' || operationGate.busy) return;
    operationGate.busy = true;
    try {
      if (!await clearSetupProgress()) return;
      setIssues([]);
      setState(emptySetupState());
    } finally {
      operationGate.busy = false;
    }
  }, [clearSetupProgress, operationGate, state]);

  const returnToCurrentPlan = useCallback(async () => {
    if (
      state === null
      || state.mode !== 'recovery'
      || state.applied === null
      || operationGate.busy
    ) return;
    operationGate.busy = true;
    try {
      if (!await clearSetupProgress()) return;
      setIssues([]);
      dispatch({ type: 'cancel-draft' });
    } finally {
      operationGate.busy = false;
    }
  }, [clearSetupProgress, dispatch, operationGate, state]);

  return {
    state,
    issues,
    validationAttempt,
    progressWarning,
    introEntry,
    acceptBootstrapResult,
    completeWelcomeIntro,
    changeDraft,
    changeSetupStep,
    apply,
    cancelDraft,
    restartSetup,
    startEmptySetup,
    discardRecoveryCandidate,
    returnToCurrentPlan,
  };
}

function emptySetupState(): MainState {
  return {
    mode: 'setup',
    applied: null,
    draft: createEmptyMainData(),
    setupStep: 'welcome',
    dirty: false,
    saveStatus: 'idle',
    loadError: null,
  };
}

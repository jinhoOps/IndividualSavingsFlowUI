import { animate } from 'animejs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApplyBar } from '../../main/ui/editor/ApplyBar';
import { Button } from '../../components/common/Button';
import { MainPlanEditor } from '../../main/ui/dashboard/MainPlanEditor';
import { useMainPlanEditorController } from '../../main/ui/useMainPlanEditorController';
import type { MainRepository } from '../../main/infrastructure/mainRepository';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import {
  ensureMainPlanOverlayHistoryMarker,
  hasCurrentMainPlanOverlayMarker,
} from './mainPlanOverlayHistory';
import type { MainPlanEditTarget } from '../../account-map/ui/setup/AccountMapBasisStep';
import { AccountProductBoundary } from '../../auth/AccountManagementContext';

export type MainPlanOverlayCloseResult = { status: 'saved' } | { status: 'cancelled' };

export interface MainPlanEditOverlayProps {
  repository: MainRepository;
  target: MainPlanEditTarget;
  returnFocusElement: HTMLElement | null;
  onActivated(): void;
  onClosed(result: MainPlanOverlayCloseResult): void;
  onBeforeFocusRestore?(): void;
}

/**
 * Journey-owned modal behavior around a Main-owned editor controller. The
 * Account Map is intentionally absent from this API and cannot receive a
 * Main draft or persistence callback.
 */
export function MainPlanEditOverlay({
  repository,
  target,
  returnFocusElement,
  onActivated,
  onClosed,
  onBeforeFocusRestore,
}: MainPlanEditOverlayProps) {
  const editor = useMainPlanEditorController({
    repository,
    recoveryKey: 'account-map-main-overlay',
  });
  const tokenRef = useRef<string | null>(null);
  const resultRef = useRef<MainPlanOverlayCloseResult>({ status: 'cancelled' });
  const editorRef = useRef(editor);
  const onClosedRef = useRef(onClosed);
  const onActivatedRef = useRef(onActivated);
  const onBeforeFocusRestoreRef = useRef(onBeforeFocusRestore);
  const closeAfterHistoryPopRef = useRef<() => void>(() => undefined);
  const activatedRef = useRef(false);
  const finishedRef = useRef(false);
  const closeAlreadyConfirmedRef = useRef(false);
  const [closing, setClosing] = useState(false);
  editorRef.current = editor;
  onClosedRef.current = onClosed;
  onActivatedRef.current = onActivated;
  onBeforeFocusRestoreRef.current = onBeforeFocusRestore;

  const finishClose = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onBeforeFocusRestoreRef.current?.();
    returnFocusElement?.focus();
    onClosedRef.current(resultRef.current);
  }, [returnFocusElement]);

  const sheetRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    if (!closing) {
      setOverlayOpenFinalState(root);
      if (reducedMotion) return;
      try {
        const animation = animate(root, {
          opacity: [0, 1],
          translateY: [MOTION_DISTANCE_PX.reveal, 0],
          duration: MOTION_DURATION.normal,
          ease: MOTION_EASE.enter,
          onComplete: () => setOverlayOpenFinalState(root),
        });
        return () => {
          try { animation.cancel(); } catch { /* Final state is still readable. */ }
          setOverlayOpenFinalState(root);
        };
      } catch {
        setOverlayOpenFinalState(root);
      }
      return;
    }

    const complete = () => {
      setOverlayClosedFinalState(root);
      finishClose();
    };
    if (reducedMotion) {
      complete();
      return;
    }
    try {
      const animation = animate(root, {
        opacity: [1, 0],
        translateY: [0, MOTION_DISTANCE_PX.reveal],
        duration: MOTION_DURATION.fast,
        ease: MOTION_EASE.update,
        onComplete: complete,
      });
      return () => {
        try { animation.cancel(); } catch { /* Final state wins on cancellation. */ }
        setOverlayClosedFinalState(root);
      };
    } catch {
      complete();
    }
  }, [closing, finishClose]);

  const startClose = useCallback((result: MainPlanOverlayCloseResult) => {
    if (closing) return;
    resultRef.current = result;
    setClosing(true);
  }, [closing]);

  const closeAfterHistoryPop = useCallback(() => {
    if (closing) return;
    const current = editorRef.current;
    if (current.saving) {
      tokenRef.current = ensureMainPlanOverlayHistoryMarker(tokenRef.current ?? undefined);
      return;
    }
    if (current.dirty && !closeAlreadyConfirmedRef.current && !window.confirm('저장하지 않은 변경사항을 버릴까요?')) {
      tokenRef.current = ensureMainPlanOverlayHistoryMarker(tokenRef.current ?? undefined);
      return;
    }
    closeAlreadyConfirmedRef.current = true;
    if (current.dirty) current.cancel();
    startClose(resultRef.current);
  }, [closing, startClose]);
  closeAfterHistoryPopRef.current = closeAfterHistoryPop;

  const requestHistoryClose = useCallback((result: MainPlanOverlayCloseResult) => {
    if (closing || editorRef.current.saving) return;
    if (result.status === 'cancelled' && editorRef.current.dirty) {
      if (!window.confirm('저장하지 않은 변경사항을 버릴까요?')) return;
      closeAlreadyConfirmedRef.current = true;
      editorRef.current.cancel();
    }
    resultRef.current = result;
    const token = tokenRef.current;
    if (token !== null && hasCurrentMainPlanOverlayMarker(token)) {
      window.history.back();
      return;
    }
    startClose(result);
  }, [closing, startClose]);

  useEffect(() => {
    tokenRef.current = ensureMainPlanOverlayHistoryMarker();
    const onPopState = () => {
      const token = tokenRef.current;
      if (token !== null && hasCurrentMainPlanOverlayMarker(token)) return;
      closeAfterHistoryPopRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (activatedRef.current || closing) return;
    if (sheetRef.current === null) return;
    if (!sheetRef.current.contains(document.activeElement)) sheetRef.current.focus();
    activatedRef.current = true;
    onActivatedRef.current();
  }, [closing, editor.status, sheetRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      requestHistoryClose({ status: 'cancelled' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestHistoryClose]);

  async function save(): Promise<void> {
    const result = await editor.save();
    if (result.status !== 'saved') return;
    const saved: MainPlanOverlayCloseResult = { status: 'saved' };
    resultRef.current = saved;
    closeAlreadyConfirmedRef.current = true;
    const token = tokenRef.current;
    if (token !== null && hasCurrentMainPlanOverlayMarker(token)) {
      window.history.back();
      return;
    }
    startClose(saved);
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Tab') return;
    const root = sheetRef.current;
    if (root === null) return;
    const focusable = getFocusableElements(root);
    if (focusable.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const saveStatus = editor.saving ? 'saving' : editor.error === null ? 'idle' : 'error';
  return (
    <AccountProductBoundary>
    <div className="main-plan-overlay" data-closing={closing ? 'true' : undefined}>
      <button className="main-plan-overlay__backdrop" type="button" aria-label="Main 편집기 닫기" tabIndex={-1} onClick={() => requestHistoryClose({ status: 'cancelled' })} />
      <div
        ref={sheetRef}
        className="main-plan-overlay__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={editor.status === 'ready' ? 'cashflow-editor-title' : undefined}
        aria-label={editor.status === 'ready' ? undefined : '월 자금 계획 편집'}
        aria-busy={editor.status === 'loading' || editor.saving ? 'true' : undefined}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        {editor.status === 'ready' ? null : (
          <Button type="button" variant="secondary" aria-label="편집기 닫기" onClick={() => requestHistoryClose({ status: 'cancelled' })}>닫기</Button>
        )}
        {editor.status === 'loading' ? <p className="main-plan-overlay__loading" role="status">Main 월 자금 계획을 불러오는 중입니다.</p> : null}
        {editor.status === 'error' ? <p className="main-plan-overlay__error" role="alert">{editor.error}</p> : null}
        {editor.status !== 'ready' || editor.draft === null ? null : (
          <>
            <MainPlanEditor
              draft={editor.draft}
              issues={editor.issues}
              saving={editor.saving}
              initialFocusPath={focusPathForTarget(target)}
              onChange={editor.changeDraft}
              onRequestClose={() => requestHistoryClose({ status: 'cancelled' })}
            />
            {editor.error === null ? null : <p className="main-plan-overlay__error" role="alert">{editor.error}</p>}
            <ApplyBar dirty={editor.dirty} saveStatus={saveStatus} onApply={() => void save()} onCancel={() => requestHistoryClose({ status: 'cancelled' })} />
          </>
        )}
      </div>
    </div>
    </AccountProductBoundary>
  );
}

function focusPathForTarget(target: MainPlanEditTarget): 'monthlyNetIncomeWon' | 'monthlyHousingWon' | 'monthlyLivingWon' | 'monthlySavingWon' | 'monthlyInvestmentWon' {
  switch (target) {
    case 'income': return 'monthlyNetIncomeWon';
    case 'housing': return 'monthlyHousingWon';
    case 'living': return 'monthlyLivingWon';
    case 'saving': return 'monthlySavingWon';
    case 'investing': return 'monthlyInvestmentWon';
  }
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hasAttribute('aria-hidden'));
}

function setOverlayOpenFinalState(root: HTMLElement): void {
  root.style.opacity = '1';
  root.style.transform = 'translateY(0px)';
  root.style.removeProperty('will-change');
}

function setOverlayClosedFinalState(root: HTMLElement): void {
  root.style.opacity = '0';
  root.style.transform = `translateY(${MOTION_DISTANCE_PX.reveal}px)`;
  root.style.removeProperty('will-change');
}

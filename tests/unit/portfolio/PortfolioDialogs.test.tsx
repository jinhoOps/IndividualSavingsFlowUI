// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../../src/components/motion/tokens';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import { PortfolioApplyBar } from '../../../src/portfolio/ui/PortfolioApplyBar';
import { PortfolioDialog } from '../../../src/portfolio/ui/PortfolioDialog';
import { PortfolioEditSurface } from '../../../src/portfolio/ui/PortfolioEditSurface';
import { AccountManagementContext, AccountProductBoundary } from '../../../src/auth/AccountManagementContext';
import { PortfolioManagementMenu } from '../../../src/portfolio/ui/PortfolioManagementMenu';

const animeMocks = vi.hoisted(() => {
  const state = { reducedMotion: false };
  return {
    animate: vi.fn((target: unknown, options: Record<string, unknown>) => {
      applyFinalAnimationStyles(target, options);
      return { cancel: vi.fn() };
    }),
    createScope: vi.fn(() => ({
      add: (setup: () => void) => setup(),
      matches: { reducedMotion: state.reducedMotion },
      revert: vi.fn(),
    })),
    state,
  };
});

function applyFinalAnimationStyles(target: unknown, options: Record<string, unknown>): void {
  if (!(target instanceof HTMLElement)) return;
  if (Array.isArray(options.opacity)) target.style.opacity = String(options.opacity.at(-1));
  if (Array.isArray(options.y)) target.style.transform = `translateY(${String(options.y.at(-1))}px)`;
  if (Array.isArray(options.x)) target.style.transform = `translateX(${String(options.x.at(-1))}px)`;
  if (Array.isArray(options.bottom)) target.style.bottom = `${String(options.bottom.at(-1))}px`;
  if (Array.isArray(options.right)) target.style.right = `${String(options.right.at(-1))}px`;
}

vi.mock('animejs', () => ({
  animate: animeMocks.animate,
  createScope: animeMocks.createScope,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  animeMocks.state.reducedMotion = false;
});

describe('Portfolio confirmation dialogs', () => {
  it('edits an item inside one shared surface with a back action', () => {
    const draft = {
      ...createCashOnlyDraft(200_000, 1),
      items: [{
        id: 'index', name: '미국 인덱스', order: 0, shareUnits: 600_000,
        classification: 'growth' as const, classificationOrigin: 'automatic' as const,
      }],
      cashShareUnits: 400_000,
    };

    render(<PortfolioEditSurface
      draft={draft}
      investmentWon={200_000}
      dirty={false}
      saveError={false}
      applying={false}
      showSaving={false}
      fieldError={null}
      returnFocusRef={{ current: null }}
      onAction={vi.fn()}
      onCancel={vi.fn()}
      onApply={vi.fn()}
      showAmounts
      now={() => 2}
    />);

    const dialog = screen.getByRole('dialog', { name: '투자 배분 수정' });
    expect(dialog.querySelector('[data-surface-layout="edit"]')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /미국 인덱스 편집/ }));

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '뒤로' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: '투자 대상 이름' })).toHaveValue('미국 인덱스');
  });

  it('preserves the account offline lock when a dialog escapes its parent DOM', () => {
    const content = <AccountProductBoundary><PortfolioDialog labelledBy="offline-title" onClose={vi.fn()} returnFocusRef={{ current: null }}>
      <h2 id="offline-title">계정 편집</h2><input aria-label="입력" /><button>완료</button>
    </PortfolioDialog></AccountProductBoundary>;
    const { rerender } = render(<AccountManagementContext.Provider value={{ items: [], readOnly: false }}>{content}</AccountManagementContext.Provider>);
    expect(screen.getByLabelText('입력')).toBeEnabled();
    rerender(<AccountManagementContext.Provider value={{ items: [], readOnly: true }}>{content}</AccountManagementContext.Provider>);
    expect(screen.getByLabelText('입력')).toBeDisabled();
    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
  });

  it('keeps dialog focus inside during Strict Mode preflight and restores it on actual close', async () => {
    function Harness() {
      const triggerRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Strict Portfolio 열기</button>
          {open ? (
            <PortfolioDialog
              labelledBy="strict-portfolio-title"
              onClose={() => setOpen(false)}
              returnFocusRef={triggerRef}
            >
              <h2 id="strict-portfolio-title">Strict Portfolio</h2>
              <button type="button" data-dialog-initial-focus>취소</button>
            </PortfolioDialog>
          ) : null}
        </>
      );
    }

    render(<StrictMode><Harness /></StrictMode>);
    const trigger = screen.getByRole('button', { name: 'Strict Portfolio 열기' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Strict Portfolio' });
    const cancel = within(dialog).getByRole('button', { name: '취소' });
    await act(async () => undefined);
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Strict Portfolio' })).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(trigger).toHaveFocus();
  });

  it('closes on the backdrop only when a caller opts in', () => {
    const regularClose = vi.fn();
    const sheetClose = vi.fn();
    const returnFocusRef = { current: null };
    const { rerender } = render(
      <PortfolioDialog labelledBy="dialog-title" onClose={regularClose} returnFocusRef={returnFocusRef}>
        <h2 id="dialog-title">일반 확인</h2>
      </PortfolioDialog>,
    );
    fireEvent.click(screen.getByRole('dialog', { name: '일반 확인' }));
    expect(regularClose).not.toHaveBeenCalled();

    rerender(
      <PortfolioDialog labelledBy="sheet-title" onClose={sheetClose} returnFocusRef={returnFocusRef} closeOnBackdrop>
        <h2 id="sheet-title">대상 입력</h2>
      </PortfolioDialog>,
    );
    fireEvent.click(screen.getByRole('dialog', { name: '대상 입력' }));
    expect(sheetClose).toHaveBeenCalledTimes(1);
  });

  it('closes an opted-in mobile sheet from a downward header drag', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <PortfolioDialog
        labelledBy="drag-sheet-title"
        onClose={onClose}
        onSheetDismiss={() => true}
        onSheetDismissed={onClose}
        returnFocusRef={{ current: null }}
        dataPresentation="sheet"
        enableSheetDismiss
      >
        <header data-sheet-drag-handle><h2 id="drag-sheet-title">드래그 시트</h2></header>
      </PortfolioDialog>,
    );
    const handle = screen.getByRole('heading', { name: '드래그 시트' }).parentElement!;
    act(() => {
      dispatchPointer(handle, 'pointerdown', { clientY: 0 });
      dispatchPointer(handle, 'pointermove', { clientY: 100 });
      dispatchPointer(handle, 'pointerup', { clientY: 100 });
    });
    expect(screen.getByRole('dialog', { name: '드래그 시트' })).toHaveAttribute('data-sheet-exiting', 'true');
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the apply cancel action, traps Tab, closes on Escape, and restores the trigger', async () => {
    render(
      <PortfolioApplyBar
        dirty
        draft={createCashOnlyDraft(200_000, 1)}
        investmentWon={200_000}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: '적용' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    expect(screen.getByRole('complementary', { name: '배분 변경' })).toHaveClass('ui-surface');
    expect(dialog).toHaveClass('responsive-dialog');
    expect(dialog.querySelector('[data-surface-layout="confirm"]')).toBeTruthy();
    const cancel = within(dialog).getByRole('button', { name: '계속 수정' });
    const confirm = within(dialog).getByRole('button', { name: '배분 적용' });
    expect(cancel).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '투자 배분을 적용할까요?' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('blocks an already open apply confirmation when a field error arrives', () => {
    const onApply = vi.fn();
    const props = { dirty: true, draft: createCashOnlyDraft(200_000, 1), investmentWon: 200_000,
      onCancel: vi.fn(), onApply };
    const { rerender } = render(<PortfolioApplyBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    rerender(<PortfolioApplyBar {...props} fieldError="allocation-exceeds-investment" />);
    const confirmation = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    const confirm = within(confirmation).getByRole('button', { name: '배분 적용' });
    expect(confirm).toBeDisabled();
    expect(within(confirmation).getByRole('alert')).toHaveTextContent('입력 오류를 수정한 뒤 적용해 주세요.');
    fireEvent.click(confirm);
    expect(onApply).not.toHaveBeenCalled();
    expect(within(confirmation).getByRole('button', { name: '계속 수정' })).toBeEnabled();
  });

  it('disables apply, cancel, and confirmation close paths while explicit apply is pending', () => {
    const onCancel = vi.fn();
    const onApply = vi.fn();
    const props = {
      dirty: true,
      draft: createCashOnlyDraft(200_000, 1),
      investmentWon: 200_000,
      onCancel,
      onApply,
    };
    const { rerender } = render(
      <PortfolioApplyBar
        {...props}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    rerender(<PortfolioApplyBar {...props} applying />);

    const bar = screen.getByRole('complementary', { name: '배분 변경' });
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    expect(bar).toHaveAttribute('aria-busy', 'true');
    expect(within(bar).getByRole('button', { name: '취소' })).toBeDisabled();
    expect(within(bar).getByRole('button', { name: '적용' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '계속 수정' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '배분 적용' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('reveals centered modals and bottom sheets with normal shared motion', () => {
    const returnFocusRef = { current: null };
    const { rerender } = render(
      <PortfolioDialog labelledBy="modal-title" onClose={vi.fn()} returnFocusRef={returnFocusRef}>
        <h2 id="modal-title">중앙 확인</h2>
      </PortfolioDialog>,
    );
    const modal = screen.getByRole('dialog', { name: '중앙 확인' });
    const modalContent = modal.querySelector<HTMLElement>('[data-dialog-motion]');
    expect(modalContent).not.toBeNull();
    expect(animationOptionsFor(modalContent!)).toMatchObject({
      opacity: [0, 1],
      y: [MOTION_DISTANCE_PX.subtle, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });

    const measuredOpenStates: boolean[] = [];
    vi.spyOn(HTMLDialogElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLDialogElement) {
      measuredOpenStates.push(this.open);
      return { height: 640 } as DOMRect;
    });
    rerender(
      <PortfolioDialog
        labelledBy="sheet-title"
        onClose={vi.fn()}
        returnFocusRef={returnFocusRef}
        dataPresentation="sheet"
      >
        <h2 id="sheet-title">하단 편집</h2>
      </PortfolioDialog>,
    );
    const sheet = screen.getByRole('dialog', { name: '하단 편집' });
    const sheetOptions = animationOptionsFor(sheet);
    expect(sheetOptions).toMatchObject({
      opacity: [0, 1],
      bottom: [-640, 0],
      duration: MOTION_DURATION.emphasis,
      ease: MOTION_EASE.enter,
      onComplete: expect.any(Function),
    });
    expect(measuredOpenStates).toEqual([true]);
    expect(sheetOptions).not.toHaveProperty('y');
    expect(sheet.style.transform).toBe('');
    expect(sheet.style.bottom).toBe('0px');

    (sheetOptions?.onComplete as (() => void) | undefined)?.();
    expect(sheet.style.opacity).toBe('');
    expect(sheet.style.bottom).toBe('');
    expect(sheet.style.transform).toBe('');
  });

  it('commits reduced-motion sheets immediately', () => {
    animeMocks.state.reducedMotion = true;
    render(
      <PortfolioDialog
        labelledBy="reduced-sheet-title"
        onClose={vi.fn()}
        returnFocusRef={{ current: null }}
        dataPresentation="sheet"
      >
        <h2 id="reduced-sheet-title">즉시 하단 편집</h2>
      </PortfolioDialog>,
    );
    const reducedSheet = screen.getByRole('dialog', { name: '즉시 하단 편집' });
    expect(reducedSheet).toHaveStyle({ opacity: '1' });
    expect(reducedSheet.style.transform).toBe('');
    expect(reducedSheet.style.bottom).toBe('');
    expect(animationOptionsFor(reducedSheet)).toBeUndefined();
  });

  it('keeps the sheet open and usable if animation initialization fails', () => {
    animeMocks.animate.mockImplementationOnce(() => { throw new Error('motion unavailable'); });
    render(
      <PortfolioDialog labelledBy="failed-sheet-title" dataPresentation="sheet" onClose={vi.fn()} returnFocusRef={{ current: null }}>
        <h2 id="failed-sheet-title">하단 편집 복구</h2>
        <button data-dialog-initial-focus>닫기</button>
      </PortfolioDialog>,
    );
    const sheet = screen.getByRole('dialog', { name: '하단 편집 복구' });
    expect(sheet).toHaveAttribute('open');
    expect(sheet).toHaveStyle({ opacity: '1' });
    expect(sheet.style.bottom).toBe('');
    expect(within(sheet).getByRole('button', { name: '닫기' })).toHaveFocus();
  });

  it('focuses reset cancel and restores its trigger after Escape', async () => {
    render(<PortfolioManagementMenu onReset={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '투자 배분 처음부터 다시' }));
    const dialog = await screen.findByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' });
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('changes view preferences without closing the management menu', () => {
    const onPreferencesChange = vi.fn();
    render(
      <PortfolioManagementMenu
        onReset={vi.fn()}
        preferences={{ showAmounts: false, sortMode: 'ratio' }}
        onPreferencesChange={onPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByRole('switch', { name: '금액 보기' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '비율순' })).toBeChecked();
    expect(screen.getByRole('group', { name: '보기 설정' })).toHaveClass('portfolio-view-preferences');
    expect(screen.getByRole('switch', { name: '금액 보기' }))
      .toHaveClass('portfolio-view-preferences__choice-input');
    expect(screen.getByRole('switch', { name: '금액 보기' }).closest('label'))
      .toHaveClass('portfolio-view-preferences__choice');
    expect(screen.getByRole('radio', { name: '비율순' }).closest('label'))
      .toHaveClass('portfolio-view-preferences__choice');

    fireEvent.click(screen.getByRole('radio', { name: '입력순' }));

    expect(onPreferencesChange).toHaveBeenCalledWith({ showAmounts: false, sortMode: 'input' });
    expect(screen.getByRole('group', { name: '보기 설정' })).toBeVisible();
    expect(screen.getByRole('button', { name: '투자 배분 처음부터 다시' })).toBeVisible();
  });
});

function animationOptionsFor(target: Element): Record<string, unknown> | undefined {
  return animeMocks.animate.mock.calls.find(([candidate]) => candidate === target)?.[1] as
    | Record<string, unknown>
    | undefined;
}

function dispatchPointer(target: HTMLElement, type: string, properties: Record<string, unknown>): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries({
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 0,
    clientY: 0,
    ...properties,
  })) Object.defineProperty(event, key, { configurable: true, value });
  target.dispatchEvent(event);
}

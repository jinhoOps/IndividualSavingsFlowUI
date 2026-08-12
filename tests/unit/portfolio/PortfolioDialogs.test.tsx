// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../../src/components/motion/tokens';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import { PortfolioApplyBar } from '../../../src/portfolio/ui/PortfolioApplyBar';
import { PortfolioDialog } from '../../../src/portfolio/ui/PortfolioDialog';
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
}

vi.mock('animejs', () => ({
  animate: animeMocks.animate,
  createScope: animeMocks.createScope,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  animeMocks.state.reducedMotion = false;
});

describe('Portfolio confirmation dialogs', () => {
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
    expect(dialog).toHaveClass('ui-surface');
    const cancel = within(dialog).getByRole('button', { name: '계속 수정' });
    const confirm = within(dialog).getByRole('button', { name: '배분 적용' });
    expect(cancel).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '투자 배분을 적용할까요?' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
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
    expect(animationOptionsFor(sheet)).toMatchObject({
      opacity: [0, 1],
      y: [MOTION_DISTANCE_PX.reveal, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });
  });

  it('reveals side panels horizontally and commits reduced motion immediately', () => {
    const returnFocusRef = { current: null };
    const { unmount } = render(
      <PortfolioDialog
        labelledBy="panel-title"
        onClose={vi.fn()}
        returnFocusRef={returnFocusRef}
        dataPresentation="panel"
      >
        <h2 id="panel-title">측면 편집</h2>
      </PortfolioDialog>,
    );
    const panel = screen.getByRole('dialog', { name: '측면 편집' });
    expect(animationOptionsFor(panel)).toMatchObject({
      opacity: [0, 1],
      x: [MOTION_DISTANCE_PX.reveal, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
    });

    unmount();
    animeMocks.animate.mockClear();
    animeMocks.state.reducedMotion = true;
    render(
      <PortfolioDialog
        labelledBy="reduced-sheet-title"
        onClose={vi.fn()}
        returnFocusRef={returnFocusRef}
        dataPresentation="sheet"
      >
        <h2 id="reduced-sheet-title">즉시 하단 편집</h2>
      </PortfolioDialog>,
    );
    const reducedSheet = screen.getByRole('dialog', { name: '즉시 하단 편집' });
    expect(reducedSheet).toHaveStyle({ opacity: '1', transform: 'translateY(0px)' });
    expect(animationOptionsFor(reducedSheet)).toBeUndefined();
  });

  it('focuses reset cancel and restores its trigger after Escape', async () => {
    render(<PortfolioManagementMenu onReset={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }));
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' });
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
    expect(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' })).toBeVisible();
  });
});

function animationOptionsFor(target: Element): Record<string, unknown> | undefined {
  return animeMocks.animate.mock.calls.find(([candidate]) => candidate === target)?.[1] as
    | Record<string, unknown>
    | undefined;
}

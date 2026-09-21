// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountManagementContext } from '../../../src/auth/AccountManagementContext';
import { AppManagementMenu, type AppManagementItem } from '../../../src/journey/ui/AppManagementMenu';

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

function buildItems(overrides: {
  onAction?: () => void;
  onReset?: () => void | boolean | Promise<void | boolean>;
} = {}): AppManagementItem[] {
  return [
    { kind: 'action', id: 'settings', label: '설정 적용', onSelect: overrides.onAction ?? vi.fn() },
    { kind: 'separator', id: 'split' },
    {
      kind: 'action', id: 'reset', label: '처음부터 다시', tone: 'danger', onSelect: overrides.onReset ?? vi.fn(),
      confirmation: {
        title: '처음부터 다시 할까요?',
        description: '현재 설정을 다시 확인합니다.',
        confirmLabel: '다시 시작',
        failureMessage: '다시 시작하지 못했습니다.',
      },
    },
  ];
}

describe('AppManagementMenu', () => {
  it('opens settings in a modal dialog so its controls do not follow the gear position', () => {
    render(<AppManagementMenu items={buildItems()} />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));

    expect(screen.getByRole('dialog', { name: '관리 메뉴' })).toHaveAttribute('aria-modal', 'true');
  });

  it('closes the settings dialog with Escape and returns focus to the gear', async () => {
    render(<AppManagementMenu items={buildItems()} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(screen.getByRole('dialog', { name: '관리 메뉴' }), { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: '관리 메뉴' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('declares the gear as a dialog launcher while settings are open', () => {
    render(<AppManagementMenu items={buildItems()} />);

    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('omits obsolete help, empty groups, and edge separators', () => {
    render(<AppManagementMenu items={[
      { kind: 'separator', id: 'leading' }, ...buildItems(),
      { kind: 'separator', id: 'trailing' },
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.queryByText('앱 아이콘 안내')).not.toBeInTheDocument();
    expect(screen.queryByText(/백업/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('menu')).toHaveLength(0);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('shows account-only actions without an empty product menu or leading divider', () => {
    const logout = vi.fn();
    render(<AccountManagementContext.Provider value={{ readOnly: true, items: [
      { kind: 'action', id: 'logout', label: '이 브라우저에서 로그아웃', onSelect: logout },
    ] }}><AppManagementMenu items={[]} /></AccountManagementContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByRole('dialog', { name: '관리 메뉴' })).toBeVisible();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    const action = screen.getByRole('button', { name: '이 브라우저에서 로그아웃' });
    expect(action).toBeEnabled();
    fireEvent.click(action);
    expect(logout).toHaveBeenCalledOnce();
  });

  it('omits the gear when there are no settings or account actions', () => {
    render(<AppManagementMenu items={[]} />);
    expect(screen.queryByRole('button', { name: '관리 메뉴' })).not.toBeInTheDocument();
  });

  it('executes an action, closes the settings dialog, and restores trigger focus', async () => {
    const onAction = vi.fn();
    render(<AppManagementMenu items={buildItems({ onAction })} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '설정 적용' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: '관리 메뉴' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on its backdrop and Escape and restores trigger focus', async () => {
    render(<AppManagementMenu items={buildItems()} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('dialog', { name: '관리 메뉴' }));
    expect(screen.queryByRole('dialog', { name: '관리 메뉴' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog', { name: '관리 메뉴' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '관리 메뉴' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps an internal label activation open until the browser resolves its focus target', async () => {
    render(<AppManagementMenu items={[{
      kind: 'control',
      id: 'view-toggle',
      content: <label><input type="checkbox" role="switch" />금액 보기</label>,
    }]} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    const label = screen.getByText('금액 보기').closest('label')!;
    const toggle = screen.getByRole('switch', { name: '금액 보기' });

    fireEvent.click(label);
    toggle.focus();

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(toggle).toBeChecked();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('confirms danger actions with trapped focus and restores the gear', async () => {
    const onReset = vi.fn();
    render(<AppManagementMenu items={buildItems({ onReset })} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시' }));
    const dialog = await screen.findByRole('dialog', { name: '처음부터 다시 할까요?' });
    const cancel = within(dialog).getByRole('button', { name: '취소' });
    const confirm = within(dialog).getByRole('button', { name: '다시 시작' });
    expect(cancel).toHaveFocus();
    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시' }));
    fireEvent.click(await screen.findByRole('button', { name: '다시 시작' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('uses a neutral presentation while the delayed reset action is disabled', async () => {
    vi.useFakeTimers();
    try {
      render(<AppManagementMenu items={[{
        kind: 'action',
        id: 'main-reset',
        label: '처음부터 다시',
        tone: 'danger',
        onSelect: vi.fn(),
        confirmation: {
          title: '초기화할까요?',
          description: '입력한 내용을 지웁니다.',
          confirmLabel: '다시 시작',
          alternateAction: { label: '초기화', delayMs: 2_500, onSelect: vi.fn() },
        },
      }]} />);

      fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
      fireEvent.click(screen.getByRole('button', { name: '처음부터 다시' }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const reset = screen.getByRole('button', { name: '초기화' });
      expect(reset).toBeDisabled();
      expect(reset).toHaveClass('journey-management__dialog-alternate--disabled');

      act(() => vi.advanceTimersByTime(2_500));
      expect(reset).toBeEnabled();
      expect(reset).not.toHaveClass('journey-management__dialog-alternate--disabled');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps an async confirmation pending, blocks duplicates, and shows failure in place', async () => {
    let settle: ((result: boolean) => void) | undefined;
    const firstResult = new Promise<boolean>((resolve) => { settle = resolve; });
    const onReset = vi.fn()
      .mockReturnValueOnce(firstResult)
      .mockResolvedValueOnce(true);
    render(<AppManagementMenu items={buildItems({ onReset })} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시' }));
    const dialog = await screen.findByRole('dialog', { name: '처음부터 다시 할까요?' });
    const confirm = within(dialog).getByRole('button', { name: '다시 시작' });
    const cancel = within(dialog).getByRole('button', { name: '취소' });

    fireEvent.click(confirm);

    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();
    fireEvent.click(confirm);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.pointerDown(dialog);
    expect(onReset).toHaveBeenCalledOnce();
    expect(dialog).toBeVisible();

    settle?.(false);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('다시 시작하지 못했습니다.');
    expect(dialog).toHaveAttribute('aria-busy', 'false');
    expect(confirm).toBeEnabled();
    expect(cancel).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it('keeps Tab and Shift+Tab focus inside an async confirmation while pending', async () => {
    let settle: ((result: boolean) => void) | undefined;
    const onReset = vi.fn(() => new Promise<boolean>((resolve) => { settle = resolve; }));
    render(<><AppManagementMenu items={buildItems({ onReset })} /><button type="button">바깥</button></>);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시' }));
    const dialog = await screen.findByRole('dialog', { name: '처음부터 다시 할까요?' });
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 시작' }));

    expect(dialog).toHaveFocus();
    for (const shiftKey of [false, true]) {
      const defaultAllowed = fireEvent.keyDown(dialog, { key: 'Tab', shiftKey });
      if (defaultAllowed) screen.getByRole('button', { name: '바깥' }).focus();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    settle?.(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders an informational empty state without an action', () => {
    render(<AppManagementMenu items={[{ kind: 'message', id: 'empty', text: '아직 관리할 설정이 없습니다' }]} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByText('아직 관리할 설정이 없습니다')).toBeVisible();
    expect(screen.queryAllByRole('menu')).toHaveLength(0);
  });

  it('keeps the settings dialog open while interacting with a control group', () => {
    render(
      <AppManagementMenu
        items={[{
          kind: 'control',
          id: 'view-preferences',
          content: (
            <fieldset>
              <legend>보기 설정</legend>
              <label><input type="checkbox" role="switch" />금액 보기</label>
            </fieldset>
          ),
        }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('switch', { name: '금액 보기' }));

    expect(screen.getByRole('group', { name: '보기 설정' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: '관리 메뉴' })).toBeVisible();
    expect(screen.getByRole('switch', { name: '금액 보기' })).toBeChecked();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppManagementMenu, type AppManagementItem } from '../../../src/journey/ui/AppManagementMenu';

afterEach(cleanup);

function buildItems(overrides: {
  onExport?: () => void;
  onFile?: (file: File) => void;
  onReset?: () => void;
} = {}): AppManagementItem[] {
  return [
    { kind: 'action', id: 'export', label: '백업 내보내기', onSelect: overrides.onExport ?? vi.fn() },
    { kind: 'file', id: 'import', label: '백업 가져오기', accept: 'application/json,.json', onFile: overrides.onFile ?? vi.fn() },
    { kind: 'separator', id: 'split' },
    {
      kind: 'action', id: 'reset', label: '처음부터 다시', tone: 'danger', onSelect: overrides.onReset ?? vi.fn(),
      confirmation: { title: '처음부터 다시 할까요?', description: '현재 설정을 다시 확인합니다.', confirmLabel: '다시 시작' },
    },
  ];
}

describe('AppManagementMenu', () => {
  it('opens actions, executes a row, and handles file selection and cancellation', () => {
    const onExport = vi.fn();
    const onFile = vi.fn();
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    render(<AppManagementMenu items={buildItems({ onExport, onFile })} />);

    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: '관리 메뉴' });
    expect(menu).toBeVisible();
    fireEvent.click(within(menu).getByRole('menuitem', { name: '백업 내보내기' }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const input = screen.getByLabelText('백업 가져오기');
    fireEvent.change(input, { target: { files: [] } });
    expect(onFile).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(input).toHaveValue('');
  });

  it('closes on outside pointer and Escape and restores trigger focus', async () => {
    render(<><AppManagementMenu items={buildItems()} /><button type="button">바깥</button></>);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: '바깥' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('confirms danger actions with trapped focus and restores the gear', async () => {
    const onReset = vi.fn();
    render(<AppManagementMenu items={buildItems({ onReset })} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: '처음부터 다시' }));
    const dialog = screen.getByRole('dialog', { name: '처음부터 다시 할까요?' });
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
    fireEvent.click(screen.getByRole('menuitem', { name: '처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 시작' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('renders an informational empty state without an action', () => {
    render(<AppManagementMenu items={[{ kind: 'message', id: 'empty', text: '아직 관리할 설정이 없습니다' }]} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByText('아직 관리할 설정이 없습니다')).toBeVisible();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});

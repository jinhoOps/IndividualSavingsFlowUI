import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapModal } from '../../../src/account-map/ui/AccountMapModal';
import type { RecoveryState } from '../../../src/account-map/application/reducer';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

vi.mock('../../../src/account-map/ui/motion', () => ({
  animateNodeToModal: (_rect: DOMRect, _modal: HTMLElement, options: { onComplete(): void }) => { options.onComplete(); return { cancel() {} }; },
  animateModalToNode: (_modal: HTMLElement, _rect: DOMRect, options: { onComplete(): void }) => { options.onComplete(); return { cancel() {} }; },
}));

afterEach(cleanup);

describe('AccountMapModal', () => {
  it('keeps read and edit in the same modal', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: '생활비 상세' });
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    expect(screen.getByRole('dialog', { name: '생활비 편집' })).toBe(dialog);
    expect(screen.getByRole('heading', { name: '생활비 편집' })).toBeVisible();
  });

  it('submits edited link amounts instead of exposing a no-op save', async () => {
    const onSaveEdit = vi.fn(async () => true);
    renderModal({
      related: [{ label: '생활비통장', amountWon: 700_000, status: 'active', linkId: 'living', purposeId: 'system:living', remainder: true }],
      onSaveEdit,
    });
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.change(screen.getByRole('textbox', { name: '생활비통장 월 금액' }), { target: { value: '650000' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({
      links: [{ id: 'living', monthlyAmountWon: 650_000, status: 'active', remainder: true }],
    }));
  });

  it('requires and submits a replacement when editing away a location remainder', () => {
    const onSaveEdit = vi.fn(() => true);
    renderModal({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'resolved' },
      related: [
        { label: '생활비', amountWon: 700_000, status: 'active', linkId: 'old', purposeId: 'system:living', remainder: true },
        { label: '예비통장', amountWon: 300_000, status: 'active', linkId: 'next', purposeId: 'system:living', replacementCandidate: true },
      ],
      onSaveEdit,
    });
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.change(screen.getByRole('combobox', { name: '생활비 연결 상태' }), { target: { value: 'suspended' } });
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: '편집 나머지 연결' }), { target: { value: 'next' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({
      links: expect.arrayContaining([
        expect.objectContaining({ id: 'old', status: 'suspended', remainder: false }),
        expect.objectContaining({ id: 'next', status: 'active', remainder: true }),
      ]),
    }));
  });

  it('requires an excess correction before restoring selected links', () => {
    renderModal({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'suspended' },
      related: [
        { label: '생활비', amountWon: 800_000, status: 'suspended', linkId: 'old', purposeId: 'system:living', purposeTargetWon: 1_000_000 },
        { label: '기존통장', amountWon: 500_000, status: 'active', linkId: 'current', purposeId: 'system:living', purposeTargetWon: 1_000_000, replacementCandidate: true },
      ],
      onRestoreLocation: vi.fn(),
    });
    fireEvent.click(screen.getByRole('button', { name: '복원' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /생활비/ }));
    expect(screen.getByRole('combobox', { name: '복원 나머지 연결' })).toBeRequired();
    expect(screen.getByRole('button', { name: '선택 복원' })).toBeDisabled();
  });

  it('closes with Escape and restores focus to the source node', () => {
    const source = document.createElement('button');
    document.body.append(source);
    const onClose = vi.fn();
    renderModal({ sourceElement: source, onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(source).toHaveFocus();
    source.remove();
  });

  it('falls back to the map heading when the source node disappeared', () => {
    const source = document.createElement('button');
    const heading = document.createElement('h2');
    document.body.append(heading);
    const onClose = vi.fn();
    renderModal({ sourceElement: source, fallbackElement: heading, onClose });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalled();
    expect(heading).toHaveFocus();
    heading.remove();
  });

  it('shows suspended impact and requires a replacement remainder', () => {
    renderModal({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'resolved' },
      related: [
        { label: '생활비', amountWon: 700_000, status: 'active', linkId: 'old', purposeId: 'system:living', locationId: 'checking', remainder: true },
        { label: '예비통장', amountWon: 300_000, status: 'active', linkId: 'next', purposeId: 'system:living', locationId: 'backup', remainder: false, replacementCandidate: true },
      ],
      onArchiveLocation: vi.fn(),
    });
    fireEvent.click(screen.getByRole('button', { name: '보관' }));
    expect(screen.getByText('생활비 700,000원 연결이 중지됩니다')).toBeVisible();
    expect(screen.getByRole('combobox', { name: '새 나머지 계좌' })).toBeRequired();
  });

  it('restores suspended links selectively', () => {
    const onRestoreLocation = vi.fn(async () => true);
    renderModal({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'suspended' },
      related: [{ label: '생활비', amountWon: 700_000, status: 'suspended', linkId: 'old', purposeId: 'system:living', locationId: 'checking', remainder: false }],
      onRestoreLocation,
    });
    fireEvent.click(screen.getByRole('button', { name: '복원' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /생활비/ }));
    fireEvent.click(screen.getByRole('button', { name: '선택 복원' }));
    expect(onRestoreLocation).toHaveBeenCalledWith('checking', ['old'], {});
  });

  it('keeps the archive selection and offers retry after a failed command', async () => {
    const onArchiveLocation = vi.fn(async () => false);
    renderModal({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'resolved' },
      related: [
        { label: '생활비', amountWon: 700_000, status: 'active', linkId: 'old', purposeId: 'system:living', locationId: 'checking', remainder: true },
        { label: '예비통장', amountWon: 300_000, status: 'active', linkId: 'next', purposeId: 'system:living', locationId: 'backup', replacementCandidate: true },
      ],
      onArchiveLocation,
    });
    fireEvent.click(screen.getByRole('button', { name: '보관' }));
    fireEvent.change(screen.getByRole('combobox', { name: '새 나머지 계좌' }), { target: { value: 'next' } });
    fireEvent.click(screen.getByRole('button', { name: '보관하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('선택은 유지했습니다');
    expect(screen.getByRole('combobox', { name: '새 나머지 계좌' })).toHaveValue('next');
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  });

  it('preserves typed input and describes and focuses the first colliding modal field', () => {
    const source = document.createElement('button');
    document.body.append(source);
    const props = modalProps({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'resolved' },
      sourceElement: source,
    });
    const { rerender } = render(<AccountMapModal {...props} recovery={{ status: 'none' }} />);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    const nameInput = screen.getByRole('textbox', { name: '표시 이름' });
    fireEvent.change(nameInput, { target: { value: '새 생활비' } });

    rerender(<AccountMapModal {...props} recovery={collisionRecovery('shortName')} />);

    expect(nameInput).toHaveValue('새 생활비');
    expect(nameInput).toHaveFocus();
    expect(nameInput).toHaveAccessibleDescription(/표시 이름.*최신 상태에서도 변경/);
    expect(screen.getByRole('button', { name: '최신 상태에서 다시 적용' })).toBeVisible();
    expect(screen.getByRole('button', { name: '최신 값 유지' })).toBeVisible();
    source.remove();
  });

  it('describes and focuses only the colliding link input', () => {
    const props = modalProps({
      related: [
        { label: '첫 통장', amountWon: 300_000, status: 'active', linkId: 'first', purposeId: 'system:living', remainder: false },
        { label: '둘째 통장', amountWon: 700_000, status: 'active', linkId: 'second', purposeId: 'system:living', remainder: true },
      ],
    });
    const { rerender } = render(<AccountMapModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    rerender(<AccountMapModal {...props} recovery={linkCollisionRecovery('second', 'monthlyAmountWon')} />);

    const first = screen.getByRole('textbox', { name: '첫 통장 월 금액' });
    const second = screen.getByRole('textbox', { name: '둘째 통장 월 금액' });
    expect(second).toHaveFocus();
    expect(second).toHaveAccessibleDescription(/월 금액.*최신 상태에서도 변경/);
    expect(first).not.toHaveAttribute('aria-describedby');
  });

  it('shows transport failure inside a recovering modal and disables recovery while pending', () => {
    const onClose = vi.fn();
    render(<AccountMapModal {...modalProps({
      recovery: linkCollisionRecovery('second', 'monthlyAmountWon'),
      recoveryPending: true,
      saveFailed: true,
      onClose,
    })} />);
    expect(screen.getByText('저장하지 못했습니다. 편집 중인 입력은 그대로 두었습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '최신 상태에서 다시 적용' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '최신 값 유지' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(document.querySelector('.account-map-modal-backdrop')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps normal removal available as an atomic edit', () => {
    const onSaveEdit = vi.fn();
    renderModal({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'resolved' },
      related: [
        { label: '생활비', amountWon: 700_000, status: 'active', linkId: 'living', purposeId: 'system:living', remainder: true },
        { label: '저축', amountWon: 300_000, status: 'active', linkId: 'saving', purposeId: 'system:saving', remainder: true },
      ],
      onSaveEdit,
    });
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.change(screen.getByRole('combobox', { name: '생활비 연결 상태' }), { target: { value: 'removed' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({
      links: expect.arrayContaining([expect.objectContaining({ id: 'living', status: 'removed' })]),
    }));
  });

  it('keeps compound input and offers latest review without automatic replay', () => {
    const onReapply = vi.fn(async () => false);
    const props = modalProps({
      node: { id: 'location:checking', kind: 'location', label: '생활비통장', status: 'resolved' },
      onReapply,
    });
    const { rerender } = render(<AccountMapModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    const label = screen.getByRole('textbox', { name: '표시 이름' });
    fireEvent.change(label, { target: { value: '새 생활비' } });

    rerender(<AccountMapModal {...props} recovery={{
      status: 'manual', latest: createEmptyWorkspace(2), action: 'edit-node', targets: [{ kind: 'node', id: 'location:checking' }], reason: 'compound-edit',
    }} />);

    expect(label).toHaveValue('새 생활비');
    expect(screen.getByText(/자동으로 다시 적용하지 않습니다/)).toBeVisible();
    expect(screen.queryByRole('button', { name: '최신 상태에서 다시 적용' })).not.toBeInTheDocument();
    const review = screen.getByRole('button', { name: '최신 상태에서 다시 검토' });
    expect(review).toHaveFocus();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.click(review);
    expect(onReapply).toHaveBeenCalledTimes(1);
  });

  it.each(['close', 'escape', 'backdrop'] as const)('abandons settled recovery through %s without replaying', (method) => {
    const onClose = vi.fn();
    const onKeepLatest = vi.fn();
    const onReapply = vi.fn(async () => false);
    renderModal({
      recovery: { status: 'manual', latest: createEmptyWorkspace(2), action: 'edit-node', targets: [], reason: 'compound-edit' },
      onClose, onKeepLatest, onReapply,
    });

    if (method === 'close') fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    else if (method === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
    else fireEvent.pointerDown(screen.getByRole('dialog').parentElement!);

    expect(onKeepLatest).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReapply).not.toHaveBeenCalled();
  });

  it('restores focus before adopting settled recovery when reduced motion closes immediately', () => {
    const source = document.createElement('button');
    document.body.append(source);
    const sequence: string[] = [];
    const onKeepLatest = vi.fn(() => sequence.push(document.activeElement === source ? 'focus' : 'adopted-before-focus'));
    const onClose = vi.fn(() => sequence.push('close'));
    renderModal({
      sourceElement: source,
      reducedMotion: true,
      recovery: { status: 'manual', latest: createEmptyWorkspace(2), action: 'edit-node', targets: [], reason: 'compound-edit' },
      onKeepLatest,
      onClose,
    });

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(sequence).toEqual(['focus', 'close']);
    expect(onKeepLatest).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(source).toHaveFocus();
    source.remove();
  });

  it('treats edit Cancel as settled recovery abandon', () => {
    const onClose = vi.fn();
    const onKeepLatest = vi.fn();
    const props = modalProps({ onClose, onKeepLatest });
    const { rerender } = render(<AccountMapModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    rerender(<AccountMapModal {...props} recovery={{
      status: 'manual', latest: createEmptyWorkspace(2), action: 'edit-node', targets: [], reason: 'compound-edit',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(onKeepLatest).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function renderModal(overrides: Partial<React.ComponentProps<typeof AccountMapModal>> = {}) {
  const source = document.createElement('button');
  document.body.append(source);
  return render(<AccountMapModal {...modalProps({ sourceElement: source, ...overrides })} />);
}

function modalProps(overrides: Partial<React.ComponentProps<typeof AccountMapModal>> = {}): React.ComponentProps<typeof AccountMapModal> {
  return {
    node: { id: 'system:living', kind: 'purpose', label: '생활비', amountWon: 1_000_000, status: 'unassigned' },
    related: [{ label: '생활비통장', amountWon: 700_000, status: 'active' }],
    sourceElement: null,
    fallbackElement: null,
    reducedMotion: true,
    recovery: { status: 'none' },
    recoveryPending: false,
    saveFailed: false,
    onClose: () => undefined,
    onReapply: async () => false,
    onKeepLatest: () => undefined,
    ...overrides,
  };
}

function linkCollisionRecovery(id: string, field: string): RecoveryState {
  return {
    status: 'collision', latest: createEmptyWorkspace(2),
    intent: {
      kind: 'link', id,
      edit: {
        base: { monthlyAmountWon: 700_000, status: 'active', remainder: true },
        next: { monthlyAmountWon: 650_000, status: 'active', remainder: true },
      },
    },
    field, reason: 'field-conflict',
  };
}

function collisionRecovery(field: string): RecoveryState {
  return {
    status: 'collision', latest: createEmptyWorkspace(2),
    intent: {
      kind: 'location', id: 'checking',
      edit: {
        base: { shortName: '생활비통장', institution: undefined },
        next: { shortName: '새 생활비', institution: undefined },
      },
    },
    field, reason: 'field-conflict',
  };
}

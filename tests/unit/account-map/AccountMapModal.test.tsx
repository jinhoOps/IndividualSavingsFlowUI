import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapModal } from '../../../src/account-map/ui/AccountMapModal';

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
});

function renderModal(overrides: Partial<React.ComponentProps<typeof AccountMapModal>> = {}) {
  const source = document.createElement('button');
  document.body.append(source);
  return render(<AccountMapModal node={{ id: 'system:living', kind: 'purpose', label: '생활비', amountWon: 1_000_000, status: 'unassigned' }} related={[{ label: '생활비통장', amountWon: 700_000, status: 'active' }]} sourceElement={source} fallbackElement={null} reducedMotion onClose={() => undefined} {...overrides} />);
}

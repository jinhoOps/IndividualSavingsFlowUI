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
});

function renderModal(overrides: Partial<React.ComponentProps<typeof AccountMapModal>> = {}) {
  const source = document.createElement('button');
  document.body.append(source);
  return render(<AccountMapModal node={{ id: 'system:living', kind: 'purpose', label: '생활비', amountWon: 1_000_000, status: 'unassigned' }} related={[{ label: '생활비통장', amountWon: 700_000, status: 'active' }]} sourceElement={source} fallbackElement={null} reducedMotion onClose={() => undefined} {...overrides} />);
}

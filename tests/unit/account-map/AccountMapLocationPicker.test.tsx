import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountDraftContext } from '../../../src/auth/AccountDraftContext';
import type { AccountWorkspaceSession } from '../../../src/workspace/infrastructure/accountWorkspaceSession';
import { AccountMapLocationPicker } from '../../../src/account-map/ui/AccountMapLocationPicker';

afterEach(cleanup);

describe('AccountMapLocationPicker', () => {
  it('restores a purpose-scoped raw create form without creating on mount', () => {
    const onCreate = vi.fn();
    const session = recoverySession({
      'account-map-picker:system:living': {
        mode: 'create', selectedLocationId: null, locationKind: 'brokerage', institutionId: null,
        customInstitution: '  임시 증권  ', shortName: '  생활 ISA  ', amount: '12,34',
      },
    });
    render(
      <AccountDraftContext.Provider value={session}>
        <AccountMapLocationPicker
          locations={[]}
          linkedLocationIds={new Set()}
          onSelect={vi.fn()}
          onCreate={onCreate}
          amountRequired
          recoveryScope="system:living"
        />
      </AccountDraftContext.Provider>,
    );

    expect(screen.getByLabelText('기관 이름')).toHaveValue('  임시 증권  ');
    expect(screen.getByLabelText('표시 이름')).toHaveValue('  생활 ISA  ');
    expect(screen.getByPlaceholderText('0')).toHaveValue('12,34');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('keeps shared action variants while disabled completion leaves cancellation available', () => {
    const onCancel = vi.fn();
    render(
      <AccountMapLocationPicker
        locations={[{
          id: 'location:checking',
          shortName: '급여통장',
          institution: { name: '하나은행' },
          kind: 'bank',
          roles: ['income'],
          createdAt: 1,
          updatedAt: 1,
        }]}
        linkedLocationIds={new Set()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        disabled
        onCancel={onCancel}
      />,
    );

    const cancel = screen.getByRole('button', { name: '취소' });
    const complete = screen.getByRole('button', { name: '완료' });
    expect(cancel).toHaveClass('ui-button', 'ui-button--secondary');
    expect(complete).toHaveClass('ui-button', 'ui-button--primary');
    expect(cancel).toBeEnabled();
    expect(complete).toBeDisabled();

    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

function recoverySession(drafts: Record<string, unknown>): AccountWorkspaceSession {
  return {
    readRecoveryDraft: vi.fn((key: string) => drafts[key] ?? null),
    recordRecoveryDraft: vi.fn((key: string, value: unknown) => { drafts[key] = value; }),
  } as unknown as AccountWorkspaceSession;
}

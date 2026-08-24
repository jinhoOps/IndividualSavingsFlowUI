import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapLocationPicker } from '../../../src/account-map/ui/AccountMapLocationPicker';

afterEach(cleanup);

describe('AccountMapLocationPicker', () => {
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

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveDialog } from '../../../src/components/common/ResponsiveDialog';

afterEach(cleanup);

describe('ResponsiveDialog', () => {
  it('closes only after its close request is approved', async () => {
    const onRequestClose = vi.fn(() => true);
    const onClosed = vi.fn();
    render(
      <ResponsiveDialog
        open
        labelledBy="dialog-title"
        returnFocusRef={{ current: null }}
        onRequestClose={onRequestClose}
        onClosed={onClosed}
      >
        <h2 id="dialog-title" data-dialog-initial-focus>편집</h2>
      </ResponsiveDialog>,
    );

    fireEvent.keyDown(screen.getByRole('dialog', { name: '편집' }), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '편집' })).not.toBeInTheDocument());
    expect(onRequestClose).toHaveBeenCalledWith('escape');
    expect(onClosed).toHaveBeenCalledOnce();
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MainErrorBoundary } from '../../../src/main/ui/common/AppErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MainErrorBoundary', () => {
  it('keeps an app-level recovery screen available after a render failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Broken(): never {
      throw new Error('render failed');
    }

    render(
      <MainErrorBoundary>
        <Broken />
      </MainErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: '화면을 표시하지 못했습니다' })).toBeVisible();
    expect(screen.getByRole('button', { name: '페이지 다시 불러오기' })).toBeVisible();
  });
});

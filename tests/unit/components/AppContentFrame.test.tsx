import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppContentFrame } from '../../../src/components/common/AppContentFrame';

afterEach(cleanup);

describe('AppContentFrame', () => {
  it('renders a main with the shared frame class by default', () => {
    render(<AppContentFrame data-testid="frame">내용</AppContentFrame>);

    expect(screen.getByTestId('frame').tagName).toBe('MAIN');
    expect(screen.getByTestId('frame')).toHaveClass('app-content-frame');
  });

  it('preserves an explicit tag, class, and accessibility attributes', () => {
    render(
      <AppContentFrame as="section" className="account-map-page" aria-label="계좌 연결">
        내용
      </AppContentFrame>,
    );

    expect(screen.getByRole('region', { name: '계좌 연결' })).toHaveClass(
      'app-content-frame',
      'account-map-page',
    );
  });

  it('renders a div while preserving frame and native attributes', () => {
    render(
      <AppContentFrame as="div" className="dashboard-frame" data-testid="frame" data-state="ready">
        내용
      </AppContentFrame>,
    );

    const frame = screen.getByTestId('frame');
    expect(frame.tagName).toBe('DIV');
    expect(frame).toHaveClass('app-content-frame', 'dashboard-frame');
    expect(frame).toHaveAttribute('data-state', 'ready');
  });
});

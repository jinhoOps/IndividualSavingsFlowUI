import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from '../../../src/components/common/AppShell';

afterEach(cleanup);

describe('AppShell', () => {
  it('renders the shared launcher frame and content', () => {
    render(<AppShell currentApp="main"><main>내용</main></AppShell>);

    expect(screen.getByTestId('app-shell')).toHaveClass('app-shell');
    expect(screen.getByTestId('app-shell-launcher')).toHaveClass('app-shell__launcher-frame');
    expect(screen.getByRole('link', { name: /자금 흐름/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toHaveTextContent('내용');
  });

  it('omits the launcher and empty frame in focused flows', () => {
    render(<AppShell currentApp="main" showLauncher={false}><main>설정</main></AppShell>);

    expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

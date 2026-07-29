import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppLauncher } from '../../../src/journey/ui/AppLauncher';

afterEach(cleanup);

describe('AppLauncher', () => {
  it('marks Main current and every future app readying', () => {
    const { container } = render(<AppLauncher currentApp="main" />);

    expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Main.*사용 중/ })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Simulation 준비 중', 'Portfolio 준비 중', 'Account Map 준비 중']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });
});

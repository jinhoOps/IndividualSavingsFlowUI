import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { JourneyApp } from '../../../src/journey/routes';
import { AppLauncher } from '../../../src/journey/ui/AppLauncher';

afterEach(cleanup);

describe('AppLauncher', () => {
  it.each([
    ['main', 'Main'],
    ['simulation', 'Simulation'],
    ['portfolio', 'Portfolio'],
    ['account-map', 'Account Map'],
  ] satisfies ReadonlyArray<[JourneyApp, string]>)(
    'keeps availability fixed and marks %s as the current location',
    (currentApp, currentLabel) => {
      const { container } = render(<AppLauncher currentApp={currentApp} />);

      expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
      expect(screen.getByRole('link', { name: /Main.*사용 중/ })).toBeInTheDocument();
      for (const name of ['Simulation 사용 중', 'Portfolio 준비 중', 'Account Map 준비 중']) {
        expect(screen.getByText(name)).toBeInTheDocument();
      }

      const currentLink = screen.getByRole('link', {
        name: new RegExp(`${currentLabel}.*현재 위치`),
      });
      expect(currentLink).toHaveAttribute('aria-current', 'page');
      expect(currentLink).toHaveTextContent('현재 위치');
      expect(screen.getAllByText('현재 위치')).toHaveLength(1);
      expect(container.querySelector('details')).not.toHaveAttribute('open');
    },
  );
});

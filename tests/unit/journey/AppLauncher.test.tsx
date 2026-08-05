import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { JourneyApp } from '../../../src/journey/routes';
import { AppLauncher } from '../../../src/journey/ui/AppLauncher';

afterEach(cleanup);

describe('AppLauncher', () => {
  it.each([
    ['main', '자금 흐름 (Main)'],
    ['simulation', '미래 성장 (Simulation)'],
    ['portfolio', '투자 배분 (Portfolio)'],
    ['account-map', '계좌 연결 (Account Map)'],
  ] satisfies ReadonlyArray<[JourneyApp, string]>)(
    'renders icon navigation and marks %s as the current location',
    (currentApp, currentLabel) => {
      const { container } = render(<AppLauncher currentApp={currentApp} />);

      expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
      const currentLink = screen.getByRole('link', {
        name: new RegExp(`${escapeRegExp(currentLabel)}.*현재 위치`),
      });
      expect(currentLink).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: /계좌 연결 \(Account Map\).*준비 중/ })).toBeVisible();
      expect(screen.queryByText('사용 중')).not.toBeInTheDocument();
      expect(container.querySelector('details, summary')).toBeNull();
      expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4);
    },
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

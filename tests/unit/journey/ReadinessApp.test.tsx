import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { ReadinessApp } from '../../../src/journey/ui/ReadinessApp';

afterEach(cleanup);

describe('ReadinessApp', () => {
  it('shows only Account Map readiness and Main recovery', () => {
    render(<ReadinessApp />);

    expect(screen.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
    expect(screen.getByText('Account Map은 Main과 분리된 신규 앱으로 설계될 예정입니다.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Main으로 이동' }))
      .toHaveAttribute('href', expect.stringContaining('/apps/main/'));
    expect(screen.queryByText(/연결되었습니다|월 투자 가능액|Portfolio로 이어가기/))
      .not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { SaveIndicator } from '../../../src/simulation/ui/SaveIndicator';

afterEach(cleanup);

describe('SaveIndicator', () => {
  it.each([
    ['saving', '저장 중'],
    ['saved', '저장됨'],
    ['error', '자동 저장하지 못했어요'],
  ] as const)('exposes the %s state without removing its label', (state, label) => {
    render(<SaveIndicator state={state} />);
    expect(screen.getByRole('status')).toHaveTextContent(label);
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { PercentageTooltip } from '../../../src/main/ui/common/PercentageTooltip';

afterEach(cleanup);

describe('PercentageTooltip', () => {
  it('keeps its full accessible value and visual-target positioning contract', () => {
    render(
      <PercentageTooltip
        id="tip"
        open
        value="소비 · 180만 원 · 56.3%"
        position={{ xPercent: 42 }}
      />,
    );

    expect(screen.getByRole('tooltip')).toHaveAttribute('id', 'tip');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^소비 · 180만 원 · 56\.3%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '42%' });
  });

  it('uses its contained fallback alignment without changing the tooltip semantics', () => {
    render(
      <PercentageTooltip
        id="tip"
        open
        value="저축 · 100만 원 · 100.0%"
        position={{ alignment: 'end-contained', xPercent: 100 }}
      />,
    );

    expect(screen.getByRole('tooltip')).toHaveClass('flow-tooltip--end-contained');
    expect(screen.getByRole('tooltip')).toHaveAttribute('id', 'tip');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^저축 · 100만 원 · 100\.0%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ insetInlineEnd: '0' });
  });
});

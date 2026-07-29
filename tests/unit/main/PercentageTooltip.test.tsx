import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { PercentageTooltip } from '../../../src/main/ui/common/PercentageTooltip';

afterEach(cleanup);

describe('PercentageTooltip', () => {
  it('renders an open tooltip at its percentage position', () => {
    render(
      <PercentageTooltip
        id="tip"
        open
        value="56.3%"
        position={{ xPercent: 42 }}
      />,
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent(/^56\.3%$/);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '42%' });
  });
});

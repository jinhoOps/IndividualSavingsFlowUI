import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../../../src/main/ui/common/Button';

afterEach(cleanup);

describe('Button', () => {
  it('applies the requested quiet visual variant', () => {
    render(<Button variant="quiet">+10만</Button>);

    expect(screen.getByRole('button', { name: '+10만' })).toHaveClass(
      'ui-button',
      'ui-button--quiet',
    );
  });
});

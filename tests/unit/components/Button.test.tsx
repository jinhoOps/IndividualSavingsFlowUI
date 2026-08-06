import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../../../src/components/common/Button';

afterEach(cleanup);

describe('shared Button', () => {
  it('merges variant, custom class and native attributes', () => {
    render(<Button variant="primary" className="portfolio-action" disabled>적용</Button>);
    const button = screen.getByRole('button', { name: '적용' });
    expect(button).toHaveClass('ui-button', 'ui-button--primary', 'portfolio-action');
    expect(button).toBeDisabled();
  });
});

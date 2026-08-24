import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../../../src/components/common/Button';

afterEach(cleanup);

describe('shared Button', () => {
  it('merges variant, custom class and native attributes', () => {
    render(
      <Button
        variant="primary"
        className="portfolio-action"
        type="submit"
        aria-describedby="button-help"
        data-action="apply"
        disabled
      >
        적용
      </Button>,
    );

    const button = screen.getByRole('button', { name: '적용' });
    expect(button).toHaveClass('ui-button', 'ui-button--primary', 'portfolio-action');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-describedby', 'button-help');
    expect(button).toHaveAttribute('data-action', 'apply');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('적용');
  });

  it('forwards a native button ref for focus restoration', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>취소</Button>);

    expect(ref.current).toBe(screen.getByRole('button', { name: '취소' }));
  });
});

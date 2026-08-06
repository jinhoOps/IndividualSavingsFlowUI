import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Surface } from '../../../src/components/common/Surface';

afterEach(cleanup);

describe('shared Surface', () => {
  it('renders requested element and merges classes', () => {
    render(<Surface as="section" className="portfolio-summary" aria-label="배분 요약">내용</Surface>);
    expect(screen.getByRole('region', { name: '배분 요약' })).toHaveClass('ui-surface', 'portfolio-summary');
  });
});

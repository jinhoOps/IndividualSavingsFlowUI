import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Surface } from '../../../src/main/ui/common/Surface';

afterEach(cleanup);

describe('Surface', () => {
  it('renders a labelled section with the shared surface class', () => {
    render(<Surface as="section" aria-label="요약">내용</Surface>);

    expect(screen.getByRole('region', { name: '요약' })).toHaveClass('ui-surface');
  });
});

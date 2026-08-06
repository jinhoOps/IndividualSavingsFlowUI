import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Surface } from '../../../src/components/common/Surface';

afterEach(cleanup);

describe('shared Surface', () => {
  it('renders requested element and merges classes', () => {
    render(<Surface as="section" className="portfolio-summary" aria-label="배분 요약">내용</Surface>);
    expect(screen.getByRole('region', { name: '배분 요약' })).toHaveClass('ui-surface', 'portfolio-summary');
  });

  it('forwards its public ref to the selected element', () => {
    const ref = createRef<HTMLElement>();

    render(<Surface as="aside" ref={ref} aria-label="배분 변경">내용</Surface>);

    expect(ref.current).toBe(screen.getByRole('complementary', { name: '배분 변경' }));
  });

  it('keeps a stable callback ref attached across rerenders and cleans it on unmount', () => {
    const lifecycle: string[] = [];
    const stableRef = (element: HTMLElement | null) => {
      if (element === null) {
        lifecycle.push('detached');
        return;
      }
      lifecycle.push('attached');
      return () => {
        lifecycle.push('cleaned');
      };
    };
    const { rerender, unmount } = render(
      <Surface ref={stableRef}>
        내용
      </Surface>,
    );

    rerender(<Surface ref={stableRef}>수정된 내용</Surface>);

    expect(lifecycle).toEqual(['attached']);

    unmount();

    expect(lifecycle).toEqual(['attached', 'cleaned']);
  });
});

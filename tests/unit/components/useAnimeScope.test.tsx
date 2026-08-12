import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAnimeScope } from '../../../src/components/motion/useAnimeScope';

const anime = vi.hoisted(() => {
  const scope = {
    add: vi.fn((callback: () => void) => callback()),
    revert: vi.fn(),
    matches: { reducedMotion: false },
  };

  return {
    createScope: vi.fn(() => scope),
    scope,
  };
});

vi.mock('animejs', () => ({ createScope: anime.createScope }));

afterEach(() => {
  cleanup();
  anime.createScope.mockClear();
  anime.scope.add.mockClear();
  anime.scope.revert.mockClear();
  anime.scope.matches.reducedMotion = false;
});

function Probe({ onSetup }: { onSetup: (reducedMotion: boolean) => void }) {
  const root = useAnimeScope<HTMLDivElement>(({ reducedMotion }) => onSetup(reducedMotion), []);

  return <div ref={root} />;
}

describe('useAnimeScope', () => {
  it('scopes setup to its root and reverts the scope on unmount', () => {
    const onSetup = vi.fn();
    const { container, unmount } = render(<Probe onSetup={onSetup} />);

    const root = container.firstElementChild;
    expect(anime.createScope).toHaveBeenCalledWith({
      root,
      mediaQueries: { reducedMotion: '(prefers-reduced-motion: reduce)' },
    });
    expect(anime.scope.add).toHaveBeenCalledOnce();
    expect(onSetup).toHaveBeenCalledWith(false);

    unmount();

    expect(anime.scope.revert).toHaveBeenCalledOnce();
  });

  it('passes the reduced-motion media match to setup', () => {
    anime.scope.matches.reducedMotion = true;
    const onSetup = vi.fn();

    render(<Probe onSetup={onSetup} />);

    expect(onSetup).toHaveBeenCalledWith(true);
  });
});

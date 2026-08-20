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

function CleanupHarness({
  generation,
  onSetup,
  onCleanup,
}: {
  generation: number;
  onSetup(): void;
  onCleanup(): void;
}) {
  const root = useAnimeScope<HTMLDivElement>(() => {
    onSetup();
    return onCleanup;
  }, [generation]);

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

  it('falls back to the immediate final state when scope construction is unavailable', () => {
    anime.createScope.mockImplementationOnce(() => {
      throw new TypeError('window.matchMedia is unavailable');
    });
    const onSetup = vi.fn();

    expect(() => render(<Probe onSetup={onSetup} />)).not.toThrow();

    expect(onSetup).toHaveBeenCalledWith(true);
  });

  it('reverts a partial Anime scope and falls back when its setup cannot initialize', () => {
    anime.scope.add.mockImplementationOnce(() => {
      throw new TypeError('motion setup API is unavailable');
    });
    const onSetup = vi.fn();

    expect(() => render(<Probe onSetup={onSetup} />)).not.toThrow();

    expect(anime.scope.revert).toHaveBeenCalledOnce();
    expect(onSetup).toHaveBeenCalledWith(true);
  });

  it('does not treat a consumer setup failure as an Anime initialization failure', () => {
    const setupError = new Error('consumer setup failed');

    expect(() => render(<Probe onSetup={() => { throw setupError; }} />)).toThrow(setupError);
  });

  it('keeps the consumer setup error primary when partial-scope revert also fails', () => {
    const setupError = new Error('consumer setup failed');
    anime.scope.revert.mockImplementationOnce(() => {
      throw new Error('scope revert failed');
    });

    expect(() => render(<Probe onSetup={() => { throw setupError; }} />)).toThrow(setupError);
  });

  it('still commits the fallback when Anime setup and partial-scope revert both fail', () => {
    anime.scope.add.mockImplementationOnce(() => {
      throw new Error('Anime setup failed');
    });
    anime.scope.revert.mockImplementationOnce(() => {
      throw new Error('scope revert failed');
    });
    const onSetup = vi.fn();

    expect(() => render(<Probe onSetup={onSetup} />)).not.toThrow();

    expect(onSetup).toHaveBeenCalledOnce();
    expect(onSetup).toHaveBeenCalledWith(true);
  });

  it('does not surface a normal scope cleanup failure during unmount', () => {
    anime.scope.revert.mockImplementationOnce(() => {
      throw new Error('scope revert failed');
    });
    const { unmount } = render(<Probe onSetup={vi.fn()} />);

    expect(() => unmount()).not.toThrow();
    expect(anime.scope.revert).toHaveBeenCalledOnce();
  });

  it('runs consumer cleanup before scope revert on dependency change and unmount', () => {
    const order: string[] = [];
    anime.scope.revert.mockImplementation(() => order.push('revert'));
    const props = {
      generation: 1,
      onSetup: vi.fn(),
      onCleanup: vi.fn(() => order.push('consumer-cleanup')),
    };
    const { rerender, unmount } = render(<CleanupHarness {...props} />);

    rerender(<CleanupHarness {...props} generation={2} />);
    expect(order.slice(0, 2)).toEqual(['consumer-cleanup', 'revert']);

    unmount();

    expect(props.onCleanup).toHaveBeenCalledTimes(2);
  });

  it('runs fallback consumer cleanup on unmount when scope construction is unavailable', () => {
    anime.createScope.mockImplementationOnce(() => {
      throw new TypeError('window.matchMedia is unavailable');
    });
    const onCleanup = vi.fn();

    const { unmount } = render(
      <CleanupHarness generation={1} onSetup={vi.fn()} onCleanup={onCleanup} />,
    );

    unmount();

    expect(onCleanup).toHaveBeenCalledOnce();
  });
});

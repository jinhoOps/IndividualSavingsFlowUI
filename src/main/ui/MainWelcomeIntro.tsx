import { createTimeline, stagger } from 'animejs';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import { attemptMotion } from '../../components/motion/attemptMotion';
import { MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import { MainBrandIcon } from './brand/MainBrandIcon';

const AUTO_COMPLETE_MS = 2200;

export interface MainWelcomeIntroProps {
  onComplete(): void;
}

interface BrandVisualElements {
  background: SVGElement;
  baseline: SVGElement;
  bars: SVGElement[];
  trend: SVGGeometryElement;
  terminalDot: SVGElement;
}

export function MainWelcomeIntro({ onComplete }: MainWelcomeIntroProps): JSX.Element {
  const completedRef = useRef(false);
  const disposedRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const keydownListenerRef = useRef<((event: KeyboardEvent) => void) | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [motionFinished, setMotionFinished] = useState(false);

  const clearPendingCompletion = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (keydownListenerRef.current !== undefined) {
      window.removeEventListener('keydown', keydownListenerRef.current);
      keydownListenerRef.current = undefined;
    }
  }, []);

  const finish = useCallback(() => {
    if (completedRef.current || disposedRef.current) return;
    completedRef.current = true;
    clearPendingCompletion();
    setMotionFinished(true);
    onComplete();
  }, [clearPendingCompletion, onComplete]);

  const rootRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    disposedRef.current = false;
    const elements = findBrandVisualElements(root);
    if (elements === undefined) {
      finish();
      return;
    }

    if (motionFinished || reducedMotion) {
      setFinalVisualStyles(elements);
      finish();
      return;
    }

    const trendLength = getTrendLength(elements.trend);
    setInitialVisualStyles(elements, trendLength);
    if (!attemptMotion(() => {
      createTimeline({ defaults: { ease: MOTION_EASE.enter }, onComplete: finish })
        .add(elements.background, { opacity: [0, 1], duration: 180 })
        .add([elements.baseline, ...elements.bars], {
          scaleY: [0, 1],
          duration: 420,
          delay: stagger(70),
        }, '<')
        .add(elements.trend, { strokeDashoffset: [trendLength, 0], duration: 560 }, '+=40')
        .add(elements.terminalDot, {
          opacity: [0, 1],
          scale: [0.72, 1],
          duration: MOTION_DURATION.normal,
        }, '<+=360')
        .add({}, { duration: 260 });
    })) {
      setFinalVisualStyles(elements);
      finish();
    }
  }, [finish, motionFinished]);

  useLayoutEffect(() => {
    disposedRef.current = false;
    buttonRef.current?.focus();
    return () => {
      disposedRef.current = true;
      clearPendingCompletion();
    };
  }, [clearPendingCompletion]);

  useEffect(() => {
    if (completedRef.current) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    keydownListenerRef.current = handleKeyDown;
    window.addEventListener('keydown', handleKeyDown);
    timerRef.current = window.setTimeout(finish, AUTO_COMPLETE_MS);

    return clearPendingCompletion;
  }, [clearPendingCompletion, finish]);

  return (
    <section
      ref={rootRef}
      className="main-welcome-intro"
      data-testid="main-welcome-intro"
      aria-labelledby="main-welcome-intro-title"
      aria-describedby="main-welcome-intro-description"
      onPointerDown={finish}
    >
      <h1 id="main-welcome-intro-title" className="sr-only">나의 가계 흐름 시작 화면</h1>
      <p id="main-welcome-intro-description" className="sr-only">월간 돈의 흐름을 차분히 살펴보세요.</p>
      <div className="main-welcome-intro__content">
        <p className="main-welcome-intro__app-name">나의 가계 흐름</p>
        <div className="main-welcome-intro__visual">
          <MainBrandIcon />
        </div>
      </div>
      <button
        ref={buttonRef}
        className="main-welcome-intro__skip"
        type="button"
        style={{ minHeight: 44 }}
        onPointerDown={(event) => {
          event.stopPropagation();
          finish();
        }}
        onClick={finish}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            finish();
          }
        }}
      >
        화면을 눌러 건너뛰기
      </button>
    </section>
  );
}

function findBrandVisualElements(root: HTMLElement): BrandVisualElements | undefined {
  const background = root.querySelector<SVGElement>('[data-brand-background]');
  const baseline = root.querySelector<SVGElement>('[data-brand-baseline]');
  const bars = [...root.querySelectorAll<SVGElement>('[data-brand-bar]')];
  const trend = root.querySelector<SVGGeometryElement>('[data-brand-trend]');
  const terminalDot = root.querySelector<SVGElement>('[data-brand-terminal-dot]');
  if (background === null || baseline === null || bars.length === 0 || trend === null || terminalDot === null) {
    return undefined;
  }
  return { background, baseline, bars, trend, terminalDot };
}

function getTrendLength(trend: SVGGeometryElement): number {
  try {
    return trend.getTotalLength();
  } catch {
    return 1;
  }
}

function setInitialVisualStyles(elements: BrandVisualElements, trendLength: number): void {
  elements.background.style.opacity = '0';
  for (const element of [elements.baseline, ...elements.bars]) {
    element.style.transformBox = 'fill-box';
    element.style.transformOrigin = 'center bottom';
    element.style.transform = 'scaleY(0)';
  }
  elements.trend.style.strokeDasharray = String(trendLength);
  elements.trend.style.strokeDashoffset = String(trendLength);
  elements.terminalDot.style.transformBox = 'fill-box';
  elements.terminalDot.style.transformOrigin = 'center';
  elements.terminalDot.style.opacity = '0';
  elements.terminalDot.style.transform = 'scale(0.72)';
}

function setFinalVisualStyles(elements: BrandVisualElements): void {
  elements.background.style.opacity = '1';
  for (const element of [elements.baseline, ...elements.bars]) {
    element.style.transformBox = 'fill-box';
    element.style.transformOrigin = 'center bottom';
    element.style.transform = 'scaleY(1)';
  }
  elements.trend.style.strokeDashoffset = '0';
  elements.terminalDot.style.transformBox = 'fill-box';
  elements.terminalDot.style.transformOrigin = 'center';
  elements.terminalDot.style.opacity = '1';
  elements.terminalDot.style.transform = 'scale(1)';
}

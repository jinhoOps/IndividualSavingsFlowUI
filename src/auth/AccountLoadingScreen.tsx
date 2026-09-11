import { createTimeline, stagger } from 'animejs';
import { attemptMotion } from '../components/motion/attemptMotion';
import { MOTION_DURATION, MOTION_EASE } from '../components/motion/tokens';
import { useAnimeScope } from '../components/motion/useAnimeScope';
import { MainBrandIcon } from '../main/ui/brand/MainBrandIcon';

interface BrandVisualElements {
  background: SVGElement;
  baseline: SVGElement;
  bars: SVGElement[];
  trend: SVGGeometryElement;
  terminalDot: SVGElement;
}

/** Shared brand visual; the caller owns its lifetime and navigation. */
export function AccountLoadingScreen({ animate = false, message = '계정의 계획을 불러오고 있어요.' }: { animate?: boolean; message?: string }) {
  const rootRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const elements = findBrandVisualElements(root);
    if (!elements) return;
    if (!animate || reducedMotion) {
      setFinalVisualStyles(elements);
      return;
    }
    const trendLength = getTrendLength(elements.trend);
    setInitialVisualStyles(elements, trendLength);
    if (!attemptMotion(() => {
      createTimeline({ defaults: { ease: MOTION_EASE.enter } })
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
    }
  }, [animate]);

  return <main ref={rootRef} className="account-loading" data-testid="account-workspace-gate" aria-busy="true">
    <div className="account-loading__content" data-testid="account-loading" data-animated={animate}>
      <div className="account-loading__visual" aria-hidden="true"><MainBrandIcon /></div>
      <p role="status">{message}</p>
    </div>
  </main>;
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

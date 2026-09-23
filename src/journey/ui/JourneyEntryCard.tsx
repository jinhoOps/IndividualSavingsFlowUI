import { useScrollDiscovery } from './useScrollDiscovery';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/common/Button';

export interface JourneyEntryCardProps { enabled: boolean; onContinue(): void; }

/** Discoverable by another scroll at the page end, or ordinary keyboard focus. */
export function JourneyEntryCard({ enabled, onContinue }: JourneyEntryCardProps) {
  const { root, revealed, reveal } = useScrollDiscovery(enabled);
  if (!enabled) return null;
  return (
    <section ref={root} className="main-journey-entry" data-revealed={revealed}
      aria-labelledby="journey-entry-title" onFocusCapture={reveal}>
      <div className={revealed ? 'main-journey-entry__content' : 'sr-only'}>
        <h2 id="journey-entry-title">이 계획을 계속하면?</h2>
        <p>매달 모으는 돈이 만드는 미래를 살펴보세요.</p>
        <Button variant="quiet" className="journey-action" type="button" onClick={onContinue}>
          미래 성장 보기 <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

import { animate } from 'animejs';
import { useDelayedPending } from '../../../components/feedback/useDelayedPending';
import { attemptMotion } from '../../../components/motion/attemptMotion';
import { setMotionFinalState } from '../../../components/motion/setMotionFinalState';
import { createProductSpring, MOTION_DISTANCE_PX, MOTION_DURATION } from '../../../components/motion/tokens';
import { useAnimeScope } from '../../../components/motion/useAnimeScope';

/** Keep progress inside its editing context without changing the controls' geometry. */
export function SavingOverlay({ saving }: { saving: boolean }) {
  const delayedSaving = useDelayedPending(saving, 600);
  const visible = saving && delayedSaving;
  const ref = useAnimeScope<HTMLParagraphElement>(({ root, reducedMotion }) => {
    if (reducedMotion) return;
    if (!attemptMotion(() => {
      animate(root, {
        opacity: [0, 1], y: [MOTION_DISTANCE_PX.subtle, 0],
        duration: MOTION_DURATION.normal, ease: createProductSpring('surface'),
      });
    })) setMotionFinalState(root);
  }, [visible]);

  return visible ? <p ref={ref} className="main-saving-overlay" role="status">저장 중</p> : null;
}

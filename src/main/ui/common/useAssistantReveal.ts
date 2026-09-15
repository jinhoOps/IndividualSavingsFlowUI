import { animate } from 'animejs';
import { attemptMotion } from '../../../components/motion/attemptMotion';
import { setMotionFinalState } from '../../../components/motion/setMotionFinalState';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../../components/motion/tokens';
import { useAnimeScope } from '../../../components/motion/useAnimeScope';

export function useAssistantReveal() {
  return useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    if (reducedMotion) { setMotionFinalState(root); return; }
    if (!attemptMotion(() => animate(root, {
      opacity: [0, 1], y: [MOTION_DISTANCE_PX.reveal, 0],
      duration: MOTION_DURATION.normal, ease: MOTION_EASE.enter,
    }))) setMotionFinalState(root);
  }, []);
}

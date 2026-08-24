import { animate } from 'animejs';
import React, { useEffect } from 'react';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../motion/tokens';
import { setMotionFinalState } from '../motion/setMotionFinalState';
import { useAnimeScope } from '../motion/useAnimeScope';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<Props> = ({ message, type = 'success', onClose, duration = 3000 }) => {
  const motionRef = useAnimeScope<HTMLDivElement>(({ root, reducedMotion }) => {
    if (reducedMotion) {
      setMotionFinalState(root);
      return;
    }
    try {
      animate(root, {
        opacity: [0, 1],
        y: [MOTION_DISTANCE_PX.reveal, 0],
        duration: MOTION_DURATION.normal,
        ease: MOTION_EASE.enter,
      });
    } catch {
      setMotionFinalState(root);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div className="pointer-events-none fixed bottom-8 left-1/2 z-[1000] -translate-x-1/2">
      <div
        ref={motionRef}
        data-toast-motion
        className={`pointer-events-auto flex items-center gap-2 rounded-full px-6 py-3 text-white shadow-2xl ${bgColors[type]}`}
      >
        <span className="text-sm font-bold">{message}</span>
        <button type="button" aria-label="알림 닫기" onClick={onClose} className="hover:opacity-70">×</button>
      </div>
    </div>
  );
};

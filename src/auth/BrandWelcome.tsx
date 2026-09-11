import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useReducedMotion} from '../components/motion/useReducedMotion';
import {AccountLoadingScreen} from './AccountLoadingScreen';
import './account.css';

/** A short landing shared by a new app session and an explicit Main restart. */
export function BrandWelcome({onComplete, message}: {onComplete(): void; message: string}) {
  const callback = useRef(onComplete);
  const finished = useRef(false);
  const [complete, setComplete] = useState(false);
  const skip = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  useLayoutEffect(() => {callback.current = onComplete;}, [onComplete]);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setComplete(true);
    callback.current();
  }, []);
  useEffect(() => {
    if (reducedMotion) {finish(); return;}
    skip.current?.focus();
    const timer = window.setTimeout(finish, 2200);
    return () => window.clearTimeout(timer);
  }, [finish, reducedMotion]);
  return <div className="brand-welcome" data-testid="brand-welcome" onClick={finish} onKeyDown={event => {
    if (event.key === 'Escape') {event.preventDefault(); finish();}
  }}>
    <AccountLoadingScreen animate={!complete} message={message} />
    {!complete && <button ref={skip} className="brand-welcome__skip" type="button" onClick={finish}>화면을 눌러 건너뛰기</button>}
  </div>;
}

import {useContext, useEffect, useRef} from 'react';
import {AccountDraftContext} from './AccountDraftContext';

/** Protect only changed field input that has not reached the app's saved draft yet. */
export function useUncommittedInput(dirty: boolean): void {
  const session = useContext(AccountDraftContext);
  const key = useRef(Symbol('uncommitted-input'));
  useEffect(() => {
    if (!dirty) return;
    const token = key.current;
    session?.setTransientEdit(token, true);
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => {
      session?.setTransientEdit(token, false);
      window.removeEventListener('beforeunload', protect);
    };
  }, [dirty, session]);
}

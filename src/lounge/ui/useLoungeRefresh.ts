import {useEffect, useRef} from 'react';

/** Refresh visible, online Lounge views without overlapping requests or catch-up bursts. */
export function useLoungeRefresh(refresh:()=>Promise<void>) {
  const latest=useRef(refresh);
  useEffect(()=>{latest.current=refresh;});
  useEffect(()=>{
    let stopped=false, busy=false, last=Date.now();
    async function tick() {
      if(stopped || busy || document.visibilityState==='hidden' || !navigator.onLine || Date.now()-last<30_000) return;
      busy=true;last=Date.now();
      try {await latest.current();} catch { /* Background failures retry on the next interval. */ }
      finally {busy=false;}
    }
    const timer=window.setInterval(()=>void tick(),30_000);
    document.addEventListener('visibilitychange',tick);
    window.addEventListener('online',tick);
    return()=>{stopped=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('online',tick);};
  },[]);
}

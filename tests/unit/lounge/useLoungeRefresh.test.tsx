import {act,renderHook} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {useLoungeRefresh} from '../../../src/lounge/ui/useLoungeRefresh';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe('Lounge background refresh',()=>{
  it('waits 30 seconds, uses the latest callback, and stops after unmount',async()=>{
    vi.useFakeTimers();const first=vi.fn(async()=>{}),next=vi.fn(async()=>{});
    const {rerender,unmount}=renderHook(({refresh})=>useLoungeRefresh(refresh),{initialProps:{refresh:first}});
    await act(()=>vi.advanceTimersByTimeAsync(29_999));expect(first).not.toHaveBeenCalled();
    rerender({refresh:next});await act(()=>vi.advanceTimersByTimeAsync(1));expect(next).toHaveBeenCalledTimes(1);
    unmount();await act(()=>vi.advanceTimersByTimeAsync(60_000));expect(next).toHaveBeenCalledTimes(1);
  });
  it('pauses hidden/offline tabs and resumes once without catch-up bursts',async()=>{
    vi.useFakeTimers();let hidden=true,online=true;
    vi.spyOn(document,'visibilityState','get').mockImplementation(()=>hidden?'hidden':'visible');
    vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online);
    const refresh=vi.fn(async()=>{});const {unmount}=renderHook(()=>useLoungeRefresh(refresh));
    await act(()=>vi.advanceTimersByTimeAsync(90_000));expect(refresh).not.toHaveBeenCalled();
    hidden=false;await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(refresh).toHaveBeenCalledTimes(1);
    online=false;await act(()=>vi.advanceTimersByTimeAsync(60_000));expect(refresh).toHaveBeenCalledTimes(1);
    online=true;await act(async()=>window.dispatchEvent(new Event('online')));expect(refresh).toHaveBeenCalledTimes(2);
    await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(refresh).toHaveBeenCalledTimes(2);unmount();
  });
  it('does not overlap slow requests and recovers from failed refreshes',async()=>{
    vi.useFakeTimers();let finish!:()=>void;
    const refresh=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>{finish=r;})).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const {unmount}=renderHook(()=>useLoungeRefresh(refresh));
    await act(()=>vi.advanceTimersByTimeAsync(90_000));expect(refresh).toHaveBeenCalledTimes(1);
    await act(async()=>finish());await act(()=>vi.advanceTimersByTimeAsync(30_000));expect(refresh).toHaveBeenCalledTimes(2);
    await act(()=>vi.advanceTimersByTimeAsync(30_000));expect(refresh).toHaveBeenCalledTimes(3);unmount();
  });
});

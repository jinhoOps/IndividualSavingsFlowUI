import { describe, expect, it, vi } from 'vitest';
import { createSetupProgressQueue } from '../../../src/main/application/setupProgressQueue';
import { createEmptyMainData } from '../../../src/main/domain/model';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('createSetupProgressQueue', () => {
  it('runs save and clear in request order and reports idle only after both settle', async () => {
    const first = deferred<void>();
    const calls: string[] = [];
    const repository = {
      saveSetupProgress: vi.fn(async () => {
        calls.push('save:start');
        await first.promise;
        calls.push('save:end');
      }),
      clearSetupProgress: vi.fn(async () => { calls.push('clear'); }),
    } as unknown as MainRepository;
    const queue = createSetupProgressQueue(repository);

    const saved = queue.save('income', createEmptyMainData(), 'initial');
    const cleared = queue.clear();
    let idle = false;
    const waiting = queue.waitForIdle().then(() => { idle = true; });

    await Promise.resolve();
    expect(calls).toEqual(['save:start']);
    expect(idle).toBe(false);
    first.resolve();

    await expect(saved).resolves.toEqual({ status: 'saved' });
    await expect(cleared).resolves.toEqual({ status: 'saved' });
    await waiting;
    expect(calls).toEqual(['save:start', 'save:end', 'clear']);
    expect(idle).toBe(true);
  });

  it('continues with the next write after a rejected save', async () => {
    const error = new Error('save failed');
    const repository = {
      saveSetupProgress: vi.fn(async () => { throw error; }),
      clearSetupProgress: vi.fn(async () => undefined),
    } as unknown as MainRepository;
    const queue = createSetupProgressQueue(repository);

    await expect(queue.save('welcome', createEmptyMainData(), 'initial'))
      .resolves.toEqual({ status: 'failed', error });
    await expect(queue.clear()).resolves.toEqual({ status: 'saved' });
    expect(repository.clearSetupProgress).toHaveBeenCalledTimes(1);
  });
});

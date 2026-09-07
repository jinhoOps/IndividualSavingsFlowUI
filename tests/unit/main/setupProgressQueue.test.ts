import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => vi.useRealTimers());
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

  it('coalesces buffered setup saves into the latest payload and resolves every caller', async () => {
    vi.useFakeTimers();
    const firstDraft = createEmptyMainData();
    const latestDraft = { ...firstDraft, monthlyNetIncomeWon: 5_000_000 };
    const repository = {
      saveSetupProgress: vi.fn(async () => undefined),
      clearSetupProgress: vi.fn(async () => undefined),
    } as unknown as MainRepository;
    const queue = createSetupProgressQueue(repository, { debounceMs: 500 });

    const first = queue.save('income', firstDraft, 'initial');
    const latest = queue.save('housing', latestDraft, 'restart');
    await vi.advanceTimersByTimeAsync(499);
    expect(repository.saveSetupProgress).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(first).resolves.toEqual({ status: 'saved' });
    await expect(latest).resolves.toEqual({ status: 'saved' });
    expect(repository.saveSetupProgress).toHaveBeenCalledTimes(1);
    expect(repository.saveSetupProgress).toHaveBeenCalledWith('housing', latestDraft, 'restart');
  });

  it('flushes a buffered save before an explicit clear', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const repository = {
      saveSetupProgress: vi.fn(async () => { calls.push('save'); }),
      clearSetupProgress: vi.fn(async () => { calls.push('clear'); }),
    } as unknown as MainRepository;
    const queue = createSetupProgressQueue(repository, { debounceMs: 500 });

    const save = queue.save('income', createEmptyMainData(), 'initial');
    const clear = queue.clear();

    await expect(save).resolves.toEqual({ status: 'saved' });
    await expect(clear).resolves.toEqual({ status: 'saved' });
    expect(calls).toEqual(['save', 'clear']);
  });

  it('cancels buffered saves without reporting them as saved', async () => {
    vi.useFakeTimers();
    const repository = {
      saveSetupProgress: vi.fn(async () => undefined),
      clearSetupProgress: vi.fn(async () => undefined),
    } as unknown as MainRepository;
    const queue = createSetupProgressQueue(repository, { debounceMs: 500 });

    const pending = queue.save('income', createEmptyMainData(), 'initial');
    queue.cancel();

    await expect(pending).resolves.toMatchObject({ status: 'failed' });
    await vi.advanceTimersByTimeAsync(500);
    expect(repository.saveSetupProgress).not.toHaveBeenCalled();
  });
});

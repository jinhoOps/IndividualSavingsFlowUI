import type { MainData, SetupStep } from '../domain/model';
import type { MainRepository, SetupProgressKind } from '../infrastructure/mainRepository';

export type SetupProgressQueueResult =
  | { status: 'saved' }
  | { status: 'failed'; error: Error };

export interface SetupProgressQueue {
  save(
    step: SetupStep,
    draft: MainData,
    kind: SetupProgressKind,
  ): Promise<SetupProgressQueueResult>;
  clear(): Promise<SetupProgressQueueResult>;
  waitForIdle(): Promise<void>;
  cancel(): void;
}

export function createSetupProgressQueue(
  repository: MainRepository,
  { debounceMs = 0 }: { debounceMs?: number } = {},
): SetupProgressQueue {
  let tail: Promise<void> = Promise.resolve();
  let buffered: {
    step: SetupStep;
    draft: MainData;
    kind: SetupProgressKind;
    resolve: (result: SetupProgressQueueResult) => void;
  }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  function cancelledResult(): SetupProgressQueueResult {
    return { status: 'failed', error: new Error('Setup progress queue was cancelled.') };
  }

  function enqueue(operation: () => Promise<void>): Promise<SetupProgressQueueResult> {
    if (cancelled) return Promise.resolve(cancelledResult());
    const attempted = tail.then(() => {
      if (cancelled) throw new Error('Setup progress queue was cancelled.');
      return operation();
    });
    const result = attempted.then<SetupProgressQueueResult, SetupProgressQueueResult>(
      () => ({ status: 'saved' }),
      (error: unknown) => ({ status: 'failed', error: toError(error) }),
    );
    tail = result.then(() => undefined);
    return result;
  }

  function flushBuffered(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const saves = buffered;
    buffered = [];
    const latest = saves.at(-1);
    if (latest === undefined) return;
    if (cancelled) {
      const result = cancelledResult();
      saves.forEach(({ resolve }) => resolve(result));
      return;
    }
    void enqueue(() => repository.saveSetupProgress(latest.step, latest.draft, latest.kind))
      .then((result) => saves.forEach(({ resolve }) => resolve(result)));
  }

  function scheduleBufferedSave(): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flushBuffered, debounceMs);
  }

  function save(
    step: SetupStep,
    draft: MainData,
    kind: SetupProgressKind,
  ): Promise<SetupProgressQueueResult> {
    if (cancelled) return Promise.resolve(cancelledResult());
    if (debounceMs <= 0) return enqueue(() => repository.saveSetupProgress(step, draft, kind));
    return new Promise((resolve) => {
      buffered.push({ step, draft, kind, resolve });
      scheduleBufferedSave();
    });
  }

  return {
    save,
    clear: () => {
      if (cancelled) return Promise.resolve(cancelledResult());
      flushBuffered();
      return enqueue(() => repository.clearSetupProgress());
    },
    waitForIdle: async () => {
      flushBuffered();
      await tail;
    },
    cancel: () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const saves = buffered;
      buffered = [];
      const result = cancelledResult();
      saves.forEach(({ resolve }) => resolve(result));
    },
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

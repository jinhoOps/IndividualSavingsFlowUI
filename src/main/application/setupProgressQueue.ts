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
}

export function createSetupProgressQueue(
  repository: MainRepository,
): SetupProgressQueue {
  let tail: Promise<void> = Promise.resolve();

  function enqueue(operation: () => Promise<void>): Promise<SetupProgressQueueResult> {
    const attempted = tail.then(operation);
    const result = attempted.then<SetupProgressQueueResult, SetupProgressQueueResult>(
      () => ({ status: 'saved' }),
      (error: unknown) => ({ status: 'failed', error: toError(error) }),
    );
    tail = result.then(() => undefined);
    return result;
  }

  return {
    save: (step, draft, kind) => enqueue(
      () => repository.saveSetupProgress(step, draft, kind),
    ),
    clear: () => enqueue(() => repository.clearSetupProgress()),
    waitForIdle: () => tail,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

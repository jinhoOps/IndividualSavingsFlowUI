import {
  BrowserWorkspaceRepository,
  type WorkspaceLoadResult,
  type WorkspaceRepository,
  type WorkspaceWriteResult,
} from '../../workspace/infrastructure/workspaceRepository';
import type { MainData, SetupStep } from '../domain/model';
import { isMainDataShape, validateMainData, validateMainDraft } from '../domain/validation';

export { isMainDataShape } from '../domain/validation';

const setupSteps = new Set<SetupStep>([
  'welcome',
  'income',
  'housing',
  'living',
  'saving-investment',
  'review',
]);

export type MainLoadResult =
  | { status: 'empty'; data: null; original: null }
  | { status: 'current'; data: MainData; original: unknown }
  | {
    status: 'recovery';
    data: MainData;
    original: unknown;
    current: MainData | null;
    source: 'pending' | 'history';
  }
  | {
    status: 'failed';
    data: null;
    original: unknown;
    raw?: string;
    source?: 'current' | 'pending';
    reason: string;
  };

export interface MainRepository {
  load(): Promise<MainLoadResult>;
  save(data: MainData): Promise<MainData>;
  saveSetupProgress(
    step: SetupStep,
    draft: MainData,
    kind?: SetupProgressKind,
  ): Promise<void>;
  loadSetupProgress(): SetupProgress | null;
  clearSetupProgress(): Promise<void>;
  discardPending(expectedUpdatedAt?: number): void;
  discardRecovery(updatedAt: number): void;
  acknowledgeFailedCurrent(raw: string): void;
  acknowledgeFailedPending(raw: string): void;
}

export type SetupProgressKind = 'initial' | 'restart';

export interface SetupProgress {
  kind: SetupProgressKind;
  step: SetupStep;
  draft: MainData;
  savedAt: number;
}

export class BrowserMainRepository implements MainRepository {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository(),
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<MainLoadResult> {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid') {
      return {
        status: 'failed',
        data: null,
        original: loaded.raw,
        raw: loaded.raw,
        source: 'current',
        reason: 'Stored workspace data is invalid.',
      };
    }
    if (loaded.status === 'unavailable') {
      throw new Error('Workspace storage is unavailable.');
    }

    const applied = loaded.workspace.main.applied;
    if (applied === null) return { status: 'empty', data: null, original: null };
    const data = cloneMainData(applied);
    return { status: 'current', data, original: cloneMainData(data) };
  }

  async save(data: MainData): Promise<MainData> {
    assertValidAppliedMain(data);
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => {
        const applied = cloneMainData(data);
        applied.updatedAt = issueMainUpdatedAt(
          data.updatedAt,
          current.main.applied?.updatedAt ?? 0,
          this.now(),
        );
        return {
          ...current,
          main: { ...current.main, applied },
        };
      },
    );
    assertSaved(result, 'save Main data');
    const applied = result.workspace.main.applied;
    if (applied === null) throw new Error('Could not save Main data: workspace result is invalid.');
    return cloneMainData(applied);
  }

  async saveSetupProgress(
    step: SetupStep,
    draft: MainData,
    kind: SetupProgressKind = 'initial',
  ): Promise<void> {
    assertValidSetupProgress(step, draft, kind);
    const savedAt = validTimestamp(this.now(), 'setup progress');
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        main: {
          ...current.main,
          setupProgress: {
            kind,
            step,
            draft: cloneMainData(draft),
            savedAt,
          },
        },
      }),
    );
    assertSaved(result, 'save Main setup progress');
  }

  loadSetupProgress(): SetupProgress | null {
    const loaded = this.workspaceRepository.load();
    if (loaded.status !== 'found' && loaded.status !== 'empty') return null;
    const progress = loaded.workspace.main.setupProgress;
    return progress === null ? null : cloneSetupProgress(progress);
  }

  async clearSetupProgress(): Promise<void> {
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (loaded.workspace.main.setupProgress === null) return;
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        main: { ...current.main, setupProgress: null },
      }),
    );
    assertSaved(result, 'clear Main setup progress');
  }

  // Phase A never consumes or mutates retired pending, history, dismissal, or quarantine records.
  discardPending(_expectedUpdatedAt?: number): void {}

  discardRecovery(_updatedAt: number): void {}

  acknowledgeFailedCurrent(_raw: string): void {}

  acknowledgeFailedPending(_raw: string): void {}
}

function loadWritableWorkspace(repository: WorkspaceRepository): Extract<WorkspaceLoadResult, {
  status: 'found' | 'empty';
}> {
  const loaded = repository.load();
  if (loaded.status === 'invalid') {
    throw new Error('Could not update workspace: stored workspace data is invalid.');
  }
  if (loaded.status === 'unavailable') {
    throw new Error('Could not update workspace: storage is unavailable.');
  }
  return loaded;
}

function assertSaved(
  result: WorkspaceWriteResult,
  action: string,
): asserts result is Extract<WorkspaceWriteResult, { status: 'saved' }> {
  switch (result.status) {
    case 'saved':
      return;
    case 'conflict':
      throw new Error(`Could not ${action}: workspace revision conflict.`);
    case 'invalid':
      throw new Error(`Could not ${action}: workspace candidate is invalid.`);
    case 'unavailable':
      throw new Error(`Could not ${action}: workspace storage is unavailable.`);
  }
}

function assertValidAppliedMain(data: MainData): void {
  if (!isMainDataShape(data)) throw new Error('Cannot save invalid Main data shape.');
  const validation = validateMainData(data);
  if (!validation.valid) {
    throw new Error(`Cannot save invalid Main data: ${validation.issues.map(({ code }) => code).join(', ')}`);
  }
}

function assertValidSetupProgress(
  step: SetupStep,
  draft: MainData,
  kind: SetupProgressKind,
): void {
  if (!setupSteps.has(step)
    || (kind !== 'initial' && kind !== 'restart')
    || !isMainDataShape(draft)
    || !validateMainDraft(draft).valid) {
    throw new Error('Cannot save invalid Main setup progress.');
  }
}

function issueMainUpdatedAt(input: number, current: number, now: number): number {
  const timestamp = validTimestamp(now, 'Main revision');
  const ceiling = Math.max(input, current);
  if (!Number.isSafeInteger(ceiling) || ceiling < 0 || ceiling >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Cannot issue a safe Main revision.');
  }
  return Math.max(timestamp, ceiling + 1);
}

function validTimestamp(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) {
    throw new Error(`Cannot issue a safe ${label} timestamp.`);
  }
  return value;
}

function cloneMainData(data: MainData): MainData {
  return { ...data };
}

function cloneSetupProgress(progress: SetupProgress): SetupProgress {
  return { ...progress, draft: cloneMainData(progress.draft) };
}

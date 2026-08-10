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
  resetInvalidWorkspace(expectedRaw: string): Promise<void>;
}

export type SetupProgressKind = 'initial' | 'restart';

export interface SetupProgress {
  kind: SetupProgressKind;
  step: SetupStep;
  draft: MainData;
  savedAt: number;
}

export class BrowserMainRepository implements MainRepository {
  private appliedBase: MainData | null | typeof untrackedBase = untrackedBase;
  private setupProgressBase: SetupProgress | null | typeof untrackedBase = untrackedBase;

  constructor(
    private readonly workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository(),
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<MainLoadResult> {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid') {
      this.appliedBase = untrackedBase;
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
      this.appliedBase = untrackedBase;
      throw new Error('Workspace storage is unavailable.');
    }

    const applied = loaded.workspace.main.applied;
    this.appliedBase = applied === null ? null : cloneMainData(applied);
    if (applied === null) return { status: 'empty', data: null, original: null };
    const data = cloneMainData(applied);
    return { status: 'current', data, original: cloneMainData(data) };
  }

  async save(data: MainData): Promise<MainData> {
    assertValidAppliedMain(data);
    if (this.appliedBase === untrackedBase) {
      throw new Error('Could not save Main data: workspace Main base was not loaded.');
    }
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (!sameMainData(loaded.workspace.main.applied, this.appliedBase)) {
      throw new Error('Could not save Main data: workspace Main slice changed.');
    }
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
    this.appliedBase = cloneMainData(applied);
    return cloneMainData(applied);
  }

  async saveSetupProgress(
    step: SetupStep,
    draft: MainData,
    kind: SetupProgressKind = 'initial',
  ): Promise<void> {
    assertValidSetupProgress(step, draft, kind);
    if (this.setupProgressBase === untrackedBase) {
      throw new Error('Could not save Main setup progress: workspace progress base was not loaded.');
    }
    const savedAt = validTimestamp(this.now(), 'setup progress');
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (!sameSetupProgress(loaded.workspace.main.setupProgress, this.setupProgressBase)) {
      throw new Error('Could not save Main setup progress: workspace progress slice changed.');
    }
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
    const progress = result.workspace.main.setupProgress;
    if (progress === null) {
      throw new Error('Could not save Main setup progress: workspace result is invalid.');
    }
    this.setupProgressBase = cloneSetupProgress(progress);
  }

  loadSetupProgress(): SetupProgress | null {
    const loaded = this.workspaceRepository.load();
    if (loaded.status !== 'found' && loaded.status !== 'empty') {
      this.setupProgressBase = untrackedBase;
      return null;
    }
    const progress = loaded.workspace.main.setupProgress;
    this.setupProgressBase = progress === null ? null : cloneSetupProgress(progress);
    return progress === null ? null : cloneSetupProgress(progress);
  }

  async clearSetupProgress(): Promise<void> {
    if (this.setupProgressBase === untrackedBase) {
      throw new Error('Could not clear Main setup progress: workspace progress base was not loaded.');
    }
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (!sameSetupProgress(loaded.workspace.main.setupProgress, this.setupProgressBase)) {
      throw new Error('Could not clear Main setup progress: workspace progress slice changed.');
    }
    if (loaded.workspace.main.setupProgress === null) {
      this.setupProgressBase = null;
      return;
    }
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        main: { ...current.main, setupProgress: null },
      }),
    );
    assertSaved(result, 'clear Main setup progress');
    this.setupProgressBase = null;
  }

  async resetInvalidWorkspace(expectedRaw: string): Promise<void> {
    const result = await this.workspaceRepository.resetInvalid(expectedRaw);
    if (result.status === 'changed') {
      throw new Error('Could not reset workspace: stored workspace changed.');
    }
    if (result.status === 'unavailable') {
      throw new Error('Could not reset workspace: storage is unavailable.');
    }
    this.appliedBase = null;
    this.setupProgressBase = null;
  }
}

const untrackedBase = Symbol('untracked Main workspace slice');

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

function sameMainData(left: MainData | null, right: MainData | null): boolean {
  if (left === null || right === null) return left === right;
  return left.schemaVersion === right.schemaVersion
    && left.monthlyNetIncomeWon === right.monthlyNetIncomeWon
    && left.monthlyHousingWon === right.monthlyHousingWon
    && left.monthlyLivingWon === right.monthlyLivingWon
    && left.monthlySavingWon === right.monthlySavingWon
    && left.monthlyInvestmentWon === right.monthlyInvestmentWon
    && left.updatedAt === right.updatedAt;
}

function sameSetupProgress(
  left: SetupProgress | null,
  right: SetupProgress | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.kind === right.kind
    && left.step === right.step
    && left.savedAt === right.savedAt
    && sameMainData(left.draft, right.draft);
}

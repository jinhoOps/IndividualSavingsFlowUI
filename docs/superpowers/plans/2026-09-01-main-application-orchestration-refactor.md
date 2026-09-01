# Main Application Orchestration Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main의 현재 사용자 동작과 workspace 계약을 유지하면서 setup, backup/restore, 화면 파생과 UI effect 조정을 명시적인 application command, controller, browser adapter와 순수 view-model로 분리한다.

**Architecture:** `MainApp`은 하나의 shared operation gate와 두 controller를 조합하고 순수 view-model이 선택한 화면만 렌더링한다. `useMainPlanController`는 bootstrap·intro·setup/recovery 상태를, `useMainBackupController`는 whole-workspace backup/import/restore와 restore focus를 소유하며, application module은 React·DOM·한국어 UI 문구 없이 typed result만 반환한다.

**Tech Stack:** React 19, TypeScript 5.5, Vitest 4, Testing Library, Playwright, 기존 `MainRepository`와 `WorkspaceRepository`

**Spec:** [Main Application Orchestration Refactor Design](../specs/2026-09-01-main-application-orchestration-design.md)

## Global Constraints

- Main은 `monthlyNetIncomeWon`, `monthlyHousingWon`, `monthlyLivingWon`, `monthlySavingWon`, `monthlyInvestmentWon`의 유일한 편집 소유자다.
- setup 순서는 `welcome → income → housing → living → saving-investment → review`를 유지한다.
- fresh·resume·restart intro 의미, reduced-motion 처리와 restore 뒤 focus 순서를 유지한다.
- draft 입력은 즉시 화면에 반영하고 setup-progress 저장 실패가 입력을 막지 않는다.
- apply와 cancel은 먼저 시작한 setup-progress write가 끝날 때까지 기다린다.
- whole-workspace restore는 모든 slice를 검증한 뒤 하나의 revision-aware replace로 적용한다.
- MainData, workspace schema, storage key, backup envelope, URL, 문구, DOM 구조, accessible name, Anime.js choreography와 CSS는 변경하지 않는다.
- Main cashflow/donut geometry, 다른 앱 orchestration과 legacy 제거는 각각 Phase 3–4의 별도 범위다.
- 작업 시작 시 `git status --short`를 확인하고 사용자 소유 `package-lock.json` 변경을 stage하거나 수정하지 않는다.
- 각 task는 표시된 focused test와 `npm run check`가 green인 독립 커밋으로 끝낸다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `src/main/application/mainSetupCommands.ts` | draft validation/save, invalid workspace reset, validation path→setup step 변환 |
| `src/main/application/setupProgressQueue.ts` | setup-progress save/clear 직렬화와 `waitForIdle()` |
| `src/main/application/mainBackupCommands.ts` | whole-workspace parse/export/atomic restore typed result |
| `src/main/application/mainViewModel.ts` | screen kind와 management capability의 순수 파생 |
| `src/main/ui/mainOperationGate.ts` | 두 controller가 공유하는 단일 mutable gate 계약 |
| `src/main/ui/mainBrowserFiles.ts` | FileReader와 Blob URL/anchor download |
| `src/main/ui/useMainPlanController.ts` | bootstrap, intro, MainState, setup/recovery event 조정 |
| `src/main/ui/useMainBackupController.ts` | import selection, backup status, restore와 focus effect |
| `src/main/ui/MainApp.tsx` | controller/view-model 조합과 기존 markup 렌더링 |
| `tests/unit/main/*.test.ts(x)` | application boundary 단위 테스트와 MainApp 외부 동작 회귀 |

---

### Task 1: Setup commands and serial progress queue

**Files:**
- Create: `src/main/application/mainSetupCommands.ts`
- Create: `src/main/application/setupProgressQueue.ts`
- Create: `tests/unit/main/mainSetupCommands.test.ts`
- Create: `tests/unit/main/setupProgressQueue.test.ts`
- Modify: `src/main/application/bootstrap.ts:1-143`
- Modify: `src/main/ui/MainApp.tsx:1-317`
- Modify: `tests/unit/main/bootstrap.test.ts:1-310`
- Modify: `tests/unit/main/MainApp.test.tsx:1-270`

**Interfaces:**
- Consumes: `MainState`, `MainRepository`, `MainData`, `SetupStep`, `SetupProgressKind`, `ValidationIssue`.
- Produces:

```ts
export type SaveMainDraftResult =
  | { status: 'saved'; data: MainData; summary: CashflowSummary }
  | { status: 'validation-failed'; issues: ValidationIssue[] }
  | { status: 'storage-failed'; error: Error };

export type ResetInvalidMainResult =
  | { status: 'reset' }
  | { status: 'failed'; error: Error };

export type ValidationIssue = ValidationResult['issues'][number];

export function saveMainDraft(
  state: MainState,
  repository: MainRepository,
): Promise<SaveMainDraftResult>;

export function resetInvalidMainWorkspace(
  expectedRaw: string,
  repository: MainRepository,
): Promise<ResetInvalidMainResult>;

export function setupStepForIssue(path: string | undefined): SetupStep | null;

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
): SetupProgressQueue;
```

- [ ] **Step 1: Add failing command tests by moving existing public behavior to the new boundary**

Create `tests/unit/main/mainSetupCommands.test.ts`. Move the three `applyDraft` cases from `bootstrap.test.ts` and the `setupStepForIssue` cases from `MainApp.test.tsx`, then change the imports and assertions to the new result tags. Add the reset result cases:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  resetInvalidMainWorkspace,
  saveMainDraft,
  setupStepForIssue,
} from '../../../src/main/application/mainSetupCommands';

it('returns reset only after the exact invalid raw is reset', async () => {
  const resetInvalidWorkspace = vi.fn(async () => undefined);
  const repository = { resetInvalidWorkspace } as unknown as MainRepository;

  await expect(resetInvalidMainWorkspace('{broken', repository))
    .resolves.toEqual({ status: 'reset' });
  expect(resetInvalidWorkspace).toHaveBeenCalledWith('{broken');
});

it('normalizes an invalid reset rejection without widening the repository contract', async () => {
  const error = new Error('workspace changed');
  const repository = {
    resetInvalidWorkspace: vi.fn(async () => { throw error; }),
  } as unknown as MainRepository;

  await expect(resetInvalidMainWorkspace('{broken', repository))
    .resolves.toEqual({ status: 'failed', error });
});

it.each([
  ['monthlyNetIncomeWon', 'income'],
  ['monthlyHousingWon', 'housing'],
  ['monthlyLivingWon', 'living'],
  ['monthlySavingWon', 'saving-investment'],
  ['monthlyInvestmentWon', 'saving-investment'],
  [undefined, null],
  ['unknown', null],
] as const)('maps validation path %s to %s', (path, expected) => {
  expect(setupStepForIssue(path)).toBe(expected);
});
```

For the moved save cases, assert `status: 'saved'` with the persisted clone and summary, `status: 'validation-failed'` with no `repository.save`, and `status: 'storage-failed'` with the original `Error`.

- [ ] **Step 2: Add failing queue tests for ordering, failure recovery and idle waiting**

Create `tests/unit/main/setupProgressQueue.test.ts` with a local deferred helper and detached Main fixtures:

```ts
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
```

- [ ] **Step 3: Run the new tests and confirm the missing modules fail**

Run:

```bash
npx vitest run tests/unit/main/mainSetupCommands.test.ts tests/unit/main/setupProgressQueue.test.ts
```

Expected: FAIL because `mainSetupCommands.ts` and `setupProgressQueue.ts` do not exist.

- [ ] **Step 4: Implement `mainSetupCommands.ts` with typed results and no UI copy**

Move validation/save logic out of `bootstrap.ts` and the issue-path selector out of `MainApp.tsx`:

```ts
export async function saveMainDraft(
  state: MainState,
  repository: MainRepository,
): Promise<SaveMainDraftResult> {
  const validation = validateMainData(state.draft);
  if (!validation.valid) {
    return { status: 'validation-failed', issues: validation.issues };
  }
  const data = cloneMainData(state.draft);
  try {
    const persisted = await repository.save(data);
    return {
      status: 'saved',
      data: persisted,
      summary: calculateCashflow(persisted),
    };
  } catch (error) {
    return { status: 'storage-failed', error: toError(error) };
  }
}

export async function resetInvalidMainWorkspace(
  expectedRaw: string,
  repository: MainRepository,
): Promise<ResetInvalidMainResult> {
  try {
    await repository.resetInvalidWorkspace(expectedRaw);
    return { status: 'reset' };
  } catch (error) {
    return { status: 'failed', error: toError(error) };
  }
}

export function setupStepForIssue(path: string | undefined): SetupStep | null {
  if (path === 'monthlyNetIncomeWon') return 'income';
  if (path === 'monthlyHousingWon') return 'housing';
  if (path === 'monthlyLivingWon') return 'living';
  if (path === 'monthlySavingWon' || path === 'monthlyInvestmentWon') {
    return 'saving-investment';
  }
  return null;
}
```

Keep `bootstrapMain`, `MainBootstrapResult` and `MainBootstrapIntroEntryReason` in `bootstrap.ts`. Move `ValidationIssue` with the validation/save command, and remove `ApplyResult`, `applyDraft` and now-unused calculation/validation imports from `bootstrap.ts`.

- [ ] **Step 5: Implement a failure-tolerant serial queue**

Use one always-resolving tail while returning each operation's own result:

```ts
export function createSetupProgressQueue(
  repository: MainRepository,
): SetupProgressQueue {
  let tail: Promise<void> = Promise.resolve();

  function enqueue(operation: () => Promise<void>): Promise<SetupProgressQueueResult> {
    const attempted = tail.then(operation);
    const result = attempted.then<SetupProgressQueueResult>(
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
```

- [ ] **Step 6: Wire MainApp to the new command and queue without extracting controllers yet**

Create one queue per repository with `useMemo`. Keep the current Korean warning strings in `MainApp`, map `SetupProgressQueueResult.status`, and replace:

```ts
await progressWriteTailRef.current;
const result = await applyDraft(state, repository);
```

with:

```ts
await progressQueue.waitForIdle();
const result = await saveMainDraft(state, repository);
```

Dispatch `save-succeeded` for `status === 'saved'`, preserve validation routing for `validation-failed`, and dispatch `save-failed` for `storage-failed`. Replace direct invalid reset with `resetInvalidMainWorkspace`; only transition to empty setup for `status === 'reset'`. Remove `progressWriteTailRef`, the local queue implementation and exported local `setupStepForIssue`.

- [ ] **Step 7: Run focused and type verification**

Run:

```bash
npx vitest run tests/unit/main/mainSetupCommands.test.ts tests/unit/main/setupProgressQueue.test.ts tests/unit/main/bootstrap.test.ts tests/unit/main/MainApp.test.tsx
npm run check
git diff --check
```

Expected: all focused tests pass, both TypeScript checks pass, and `git diff --check` prints no errors.

- [ ] **Step 8: Commit Task 1 only**

```bash
git add src/main/application/mainSetupCommands.ts \
  src/main/application/setupProgressQueue.ts \
  src/main/application/bootstrap.ts \
  src/main/ui/MainApp.tsx \
  tests/unit/main/mainSetupCommands.test.ts \
  tests/unit/main/setupProgressQueue.test.ts \
  tests/unit/main/bootstrap.test.ts \
  tests/unit/main/MainApp.test.tsx
git diff --cached --check
git commit -m "refactor(main): extract setup application commands"
```

---

### Task 2: Backup commands, browser adapter and backup controller

**Files:**
- Create: `src/main/application/mainBackupCommands.ts`
- Create: `src/main/ui/mainOperationGate.ts`
- Create: `src/main/ui/mainBrowserFiles.ts`
- Create: `src/main/ui/useMainBackupController.ts`
- Create: `tests/unit/main/mainBackupCommands.test.ts`
- Create: `tests/unit/main/mainBrowserFiles.test.ts`
- Modify: `src/main/ui/MainApp.tsx:1-540`
- Modify: `tests/unit/main/MainApp.test.tsx:400-690`

**Interfaces:**
- Consumes: `Pick<WorkspaceRepository, 'load' | 'replace'>`, `MainRepository`, `WorkspaceDocument`, `MainBootstrapResult`, `MainState`, shared `MainOperationGate`.
- Produces:

```ts
export type WorkspaceImportFailureReason =
  | 'json' | 'format' | 'reference' | 'schema';

export type ParseWorkspaceBackupResult =
  | { status: 'ready'; candidate: WorkspaceDocument }
  | { status: 'candidate-invalid'; reason: WorkspaceImportFailureReason }
  | { status: 'failed'; error: Error };

export type WorkspaceBackupExportResult =
  | { status: 'ready'; contents: string }
  | { status: 'current-invalid' }
  | { status: 'unavailable' }
  | { status: 'failed'; error: Error };

export type RestoreWorkspaceBackupResult =
  | { status: 'restored'; bootstrap: MainBootstrapResult }
  | { status: 'conflict' }
  | { status: 'current-invalid' }
  | { status: 'candidate-invalid'; reason: 'schema' }
  | { status: 'unavailable'; stage: 'load' | 'replace' }
  | { status: 'failed'; error: Error };

export function parseWorkspaceBackupCandidate(
  text: string,
): ParseWorkspaceBackupResult;

export function createWorkspaceBackupExport(
  repository: Pick<WorkspaceRepository, 'load'>,
): WorkspaceBackupExportResult;

export function restoreWorkspaceBackup(
  candidate: WorkspaceDocument,
  workspaceRepository: Pick<WorkspaceRepository, 'load' | 'replace'>,
  mainRepository: MainRepository,
): Promise<RestoreWorkspaceBackupResult>;

export interface MainOperationGate { busy: boolean }

export function createMainOperationGate(): MainOperationGate;

export function readFileText(file: File): Promise<string>;
export function downloadJson(contents: string, filename: string): boolean;
```

`useMainBackupController` returns `backupStatus`, `pendingImport`, `restorePending`, `prepareWorkspaceImport`, `cancelWorkspaceImport`, `restorePendingImport`, `exportCurrentWorkspace` and `exportRecoveryOriginal`.

- [ ] **Step 1: Add failing application command tests**

Create `tests/unit/main/mainBackupCommands.test.ts`. Cover all result tags and assert zero replace calls for invalid input/current workspace:

```ts
it('rejects every invalid candidate before a workspace write', () => {
  expect(parseWorkspaceBackupCandidate('{')).toEqual({
    status: 'candidate-invalid',
    reason: 'json',
  });
  expect(parseWorkspaceBackupCandidate(JSON.stringify({ schemaVersion: 2 })))
    .toEqual({ status: 'candidate-invalid', reason: 'format' });
});

it('uses the loaded revision once, replaces atomically, then bootstraps Main', async () => {
  const candidate = workspace(900, 12);
  const replaced = workspace(900, 6);
  const workspaceRepository = {
    load: vi.fn(() => ({
      status: 'found' as const,
      workspace: workspace(300, 5),
      needsMigration: false as const,
    })),
    replace: vi.fn(async () => ({ status: 'saved' as const, workspace: replaced })),
  };
  const mainRepository = repository({
    status: 'current',
    data: candidate.main.applied!,
    original: candidate.main.applied!,
  });

  const result = await restoreWorkspaceBackup(
    candidate,
    workspaceRepository,
    mainRepository,
  );

  expect(workspaceRepository.replace).toHaveBeenCalledWith(5, candidate);
  expect(result.status).toBe('restored');
  if (result.status === 'restored') {
    expect(result.bootstrap.state.applied?.monthlyNetIncomeWon).toBe(900);
  }
});
```

Also add focused cases for export ready/current-invalid/unavailable/failed and restore conflict/current-invalid/replace-invalid/unavailable/unexpected rejection. Reuse the exact `workspace`, `backupEnvelope` and repository fixture semantics from `MainApp.test.tsx` rather than weakening validation.

- [ ] **Step 2: Add failing browser adapter tests**

Create `tests/unit/main/mainBrowserFiles.test.ts`:

```ts
it('reads a selected file as text', async () => {
  const file = new File(['{"ok":true}'], 'backup.json', {
    type: 'application/json',
  });
  await expect(readFileText(file)).resolves.toBe('{"ok":true}');
});

it('removes the anchor and revokes the object URL after a successful download', () => {
  vi.useFakeTimers();
  const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const append = vi.spyOn(document.body, 'append');

  expect(downloadJson('{}', 'workspace.json')).toBe(true);
  expect(append).toHaveBeenCalledTimes(1);
  expect(document.querySelector('a[download="workspace.json"]')).toBeNull();
  vi.runAllTimers();
  expect(url).toHaveBeenCalledTimes(1);
  expect(revoke).toHaveBeenCalledWith('blob:backup');
});
```

Retain the existing failure test that verifies temporary anchor cleanup when `URL.createObjectURL` or `anchor.click` throws.

- [ ] **Step 3: Run the new tests and confirm missing-module failure**

Run:

```bash
npx vitest run tests/unit/main/mainBackupCommands.test.ts tests/unit/main/mainBrowserFiles.test.ts
```

Expected: FAIL because the application command and browser adapter modules do not exist.

- [ ] **Step 4: Implement pure backup commands**

Use `importWorkspaceBackup` only inside `parseWorkspaceBackupCandidate` and map only its four stable validation messages to `candidate-invalid`. Return unexpected exceptions as `failed` so the controller preserves the existing generic file-read error. For restore, do not mutate before a valid current revision is available:

```ts
export async function restoreWorkspaceBackup(
  candidate: WorkspaceDocument,
  workspaceRepository: Pick<WorkspaceRepository, 'load' | 'replace'>,
  mainRepository: MainRepository,
): Promise<RestoreWorkspaceBackupResult> {
  try {
    const loaded = workspaceRepository.load();
    if (loaded.status === 'invalid') return { status: 'current-invalid' };
    if (loaded.status === 'unavailable') {
      return { status: 'unavailable', stage: 'load' };
    }

    const replaced = await workspaceRepository.replace(
      loaded.workspace.revision,
      candidate,
    );
    if (replaced.status === 'conflict') return { status: 'conflict' };
    if (replaced.status === 'invalid') {
      return { status: 'candidate-invalid', reason: 'schema' };
    }
    if (replaced.status === 'unavailable') {
      return { status: 'unavailable', stage: 'replace' };
    }

    return {
      status: 'restored',
      bootstrap: await bootstrapMain(mainRepository),
    };
  } catch (error) {
    return { status: 'failed', error: toError(error) };
  }
}
```

`createWorkspaceBackupExport` must call `exportWorkspaceBackup(loaded.workspace)` only for `found | empty`, and return `failed` if serialization throws.

- [ ] **Step 5: Implement the browser adapter and shared gate contract**

Move the current `readFileText` and `downloadJson` bodies byte-for-byte into `mainBrowserFiles.ts`; preserve anchor removal and deferred guarded `URL.revokeObjectURL`. Add:

```ts
export interface MainOperationGate { busy: boolean }

export function createMainOperationGate(): MainOperationGate {
  return { busy: false };
}
```

`MainApp` creates the stable object once with `useRef(createMainOperationGate()).current`. Existing setup terminal actions temporarily use `operationGate.busy` in place of `savingRef.current`; draft, step and restart check it but never set it.

- [ ] **Step 6: Implement `useMainBackupController` with latest-selection and focus guarantees**

Use this options contract:

```ts
interface UseMainBackupControllerOptions {
  state: MainState | null;
  mainRepository: MainRepository;
  workspaceRepository: Pick<WorkspaceRepository, 'load' | 'replace'>;
  operationGate: MainOperationGate;
  showIntro: boolean;
  onBootstrapAccepted(result: MainBootstrapResult): void;
}
```

The hook must:

1. Increment `selectionGenerationRef.current` before every File read.
2. Ignore both success and failure when the captured generation is stale.
3. Keep `pendingImport` until cancel or successful restore.
4. Acquire the gate only for restore; release the gate and `restorePending` in `finally`.
5. Set `restoreFocusRequestedRef` only for `restored`, call `onBootstrapAccepted`, then expose the unchanged success copy.
6. Defer focus while `showIntro` is true; afterwards focus `[aria-label="관리 메뉴"]`, then `[data-setup-heading]`, then the existing setup control selector.

Keep all exact UI mappings in this hook:

```ts
const importMessages = {
  json: '백업 JSON을 읽을 수 없습니다. 현재 데이터는 바뀌지 않았습니다.',
  format: '새 전체 workspace 백업 파일만 가져올 수 있습니다. 현재 데이터는 바뀌지 않았습니다.',
  reference: '백업의 앱 연결 정보가 올바르지 않습니다. 현재 데이터는 바뀌지 않았습니다.',
  schema: '백업의 앱 데이터가 올바르지 않습니다. 현재 데이터는 바뀌지 않았습니다.',
} satisfies Record<WorkspaceImportFailureReason, string>;

const restoreMessages = {
  conflict: '다른 탭에서 데이터가 변경되었습니다. 현재 데이터는 바뀌지 않았습니다.',
  'current-invalid': '현재 저장된 workspace를 먼저 복구해야 합니다. 현재 데이터는 바뀌지 않았습니다.',
  'candidate-invalid': '백업의 앱 데이터를 적용할 수 없습니다. 현재 데이터는 바뀌지 않았습니다.',
  'unavailable-load': '저장소를 사용할 수 없습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.',
  'unavailable-replace': '백업을 저장하지 못했습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.',
  failed: '백업을 복원하지 못했습니다. 현재 데이터는 바뀌지 않았습니다. 다시 시도해 주세요.',
} as const;
```

Preserve the distinct export messages for invalid current workspace, unavailable storage, download failure and success. `exportRecoveryOriginal` uses `raw ?? exportRecoveryData(original)` and `downloadJson` with the existing recovery filename.

- [ ] **Step 7: Replace MainApp's backup state and helpers with the hook**

Remove `backupStatus`, `pendingImport`, `restorePending`, `importSelectionRef`, `restoreFocusRequestedRef`, `prepareWorkspaceImport`, local restore/export functions, `readFileText`, `downloadJson` and `importFailureMessage` from `MainApp`. Destructure the hook and pass its callbacks to the unchanged `MainManagementMenu` props. Keep all markup and accessible names unchanged.

Extend the existing `MainApp.test.tsx` out-of-order A/B table so it still asserts that late valid or invalid A cannot replace B's candidate/status after B confirmation or successful restore. Keep the empty Main restore table unchanged; it is the integration proof that focus waits for fresh intro and the welcome write creates the additional revision.

- [ ] **Step 8: Run focused and type verification**

Run:

```bash
npx vitest run tests/unit/main/mainBackupCommands.test.ts tests/unit/main/mainBrowserFiles.test.ts tests/unit/main/MainApp.test.tsx
npm run check
git diff --check
```

Expected: all focused tests and TypeScript checks pass with no diff whitespace errors.

- [ ] **Step 9: Commit Task 2 only**

```bash
git add src/main/application/mainBackupCommands.ts \
  src/main/ui/mainOperationGate.ts \
  src/main/ui/mainBrowserFiles.ts \
  src/main/ui/useMainBackupController.ts \
  src/main/ui/MainApp.tsx \
  tests/unit/main/mainBackupCommands.test.ts \
  tests/unit/main/mainBrowserFiles.test.ts \
  tests/unit/main/MainApp.test.tsx
git diff --cached --check
git commit -m "refactor(main): isolate workspace backup orchestration"
```

---

### Task 3: Pure Main view-model

**Files:**
- Create: `src/main/application/mainViewModel.ts`
- Create: `tests/unit/main/mainViewModel.test.ts`
- Modify: `src/main/ui/MainApp.tsx:52-560`

**Interfaces:**
- Consumes: state and code/boolean values only; never callbacks, DOM, React nodes, repositories or Korean status messages.
- Produces:

```ts
export type MainScreenKind =
  | 'loading' | 'intro' | 'recovery' | 'setup' | 'dashboard';

export type MainIntroEntryReason =
  | MainBootstrapIntroEntryReason
  | 'restart';

export interface MainViewModelInput {
  state: MainState | null;
  introReason: MainIntroEntryReason;
  reducedMotion: boolean;
  validationIssueCount: number;
  hasProgressWarning: boolean;
  backupStatusKind: 'success' | 'error' | null;
  hasPendingImport: boolean;
  restorePending: boolean;
}

export interface MainViewModel {
  screen: MainScreenKind;
  showIntro: boolean;
  showBackupStatus: boolean;
  showSetupSaveError: boolean;
  management: {
    saving: boolean;
    dirty: boolean;
    canExport: boolean;
    canImport: boolean;
    canRestart: boolean;
    importConfirmationOpen: boolean;
  };
}

export function shouldShowMainIntro(
  state: MainState | null,
  introReason: MainIntroEntryReason,
  reducedMotion: boolean,
): boolean;

export function buildMainViewModel(input: MainViewModelInput): MainViewModel;
```

- [ ] **Step 1: Write the failing table-driven view-model tests**

Create `tests/unit/main/mainViewModel.test.ts`:

```ts
it.each([
  [null, 'none', false, 'loading'],
  [setupState('welcome'), 'fresh', false, 'intro'],
  [setupState('welcome'), 'fresh', true, 'setup'],
  [setupState('income'), 'resume', false, 'setup'],
  [recoveryState(), 'none', false, 'recovery'],
  [dashboardState(), 'none', false, 'dashboard'],
] as const)('selects %s/%s/reduced=%s as %s', (
  state,
  introReason,
  reducedMotion,
  screen,
) => {
  expect(buildMainViewModel({
    state,
    introReason,
    reducedMotion,
    validationIssueCount: 0,
    hasProgressWarning: false,
    backupStatusKind: null,
    hasPendingImport: false,
    restorePending: false,
  }).screen).toBe(screen);
});

it('derives management and visible status without receiving UI messages', () => {
  const view = buildMainViewModel({
    state: dashboardState({ dirty: true, saveStatus: 'saving' }),
    introReason: 'none',
    reducedMotion: false,
    validationIssueCount: 0,
    hasProgressWarning: true,
    backupStatusKind: 'error',
    hasPendingImport: false,
    restorePending: true,
  });

  expect(view.management).toEqual({
    saving: true,
    dirty: true,
    canExport: true,
    canImport: true,
    canRestart: true,
    importConfirmationOpen: false,
  });
  expect(view.showBackupStatus).toBe(true);
  expect(view.showSetupSaveError).toBe(false);
});
```

Fixture builders return complete detached `MainState` objects and accept typed overrides; do not use `as any`.

- [ ] **Step 2: Run the test and confirm missing-module failure**

Run:

```bash
npx vitest run tests/unit/main/mainViewModel.test.ts
```

Expected: FAIL because `mainViewModel.ts` does not exist.

- [ ] **Step 3: Implement the pure selectors**

```ts
export function shouldShowMainIntro(
  state: MainState | null,
  introReason: MainIntroEntryReason,
  reducedMotion: boolean,
): boolean {
  return state?.mode === 'setup'
    && state.setupStep === 'welcome'
    && (introReason === 'fresh' || introReason === 'restart')
    && !reducedMotion;
}

export function buildMainViewModel(input: MainViewModelInput): MainViewModel {
  const showIntro = shouldShowMainIntro(
    input.state,
    input.introReason,
    input.reducedMotion,
  );
  const screen: MainScreenKind = input.state === null
    ? 'loading'
    : showIntro
      ? 'intro'
      : input.state.mode === 'recovery'
        ? 'recovery'
        : input.state.mode === 'setup' && input.state.setupStep !== null
          ? 'setup'
          : 'dashboard';
  const hasApplied = input.state?.applied !== null
    && input.state?.applied !== undefined;

  return {
    screen,
    showIntro,
    showBackupStatus: !input.hasPendingImport && input.backupStatusKind !== null,
    showSetupSaveError: input.state?.saveStatus === 'error'
      && input.validationIssueCount === 0,
    management: {
      saving: input.state?.saveStatus === 'saving' || input.restorePending,
      dirty: input.state?.dirty ?? false,
      canExport: hasApplied,
      canImport: input.state?.mode === 'dashboard',
      canRestart: hasApplied,
      importConfirmationOpen: input.hasPendingImport,
    },
  };
}
```

- [ ] **Step 4: Make MainApp consume the view-model without changing markup**

Compute `showIntro` with `shouldShowMainIntro` before calling `useMainBackupController` so its focus effect receives the same value. After the backup hook returns, call `buildMainViewModel` and replace only boolean/screen condition expressions. Continue passing actual `backupStatus.message` directly from the controller to presentation; never add that message to `MainViewModelInput`.

- [ ] **Step 5: Run focused and type verification**

Run:

```bash
npx vitest run tests/unit/main/mainViewModel.test.ts tests/unit/main/MainApp.test.tsx
npm run check
git diff --check
```

Expected: all focused tests and TypeScript checks pass, and rendered Main behavior remains unchanged.

- [ ] **Step 6: Commit Task 3 only**

```bash
git add src/main/application/mainViewModel.ts \
  src/main/ui/MainApp.tsx \
  tests/unit/main/mainViewModel.test.ts
git diff --cached --check
git commit -m "refactor(main): derive screen state in view model"
```

---

### Task 4: Plan controller and final MainApp coordinator

**Files:**
- Create: `src/main/ui/useMainPlanController.ts`
- Modify: `src/main/ui/useMainBackupController.ts`
- Modify: `src/main/ui/MainApp.tsx:1-560`
- Modify: `tests/unit/main/MainApp.test.tsx:268-1238`
- Verify: `tests/main-react.spec.ts`
- Verify: `tests/main-compat.spec.ts`

**Interfaces:**
- Consumes: `MainRepository`, `MainOperationGate`, `reducedMotion` and application modules from Tasks 1–3.
- Produces:

```ts
export interface UseMainPlanControllerOptions {
  repository: MainRepository;
  operationGate: MainOperationGate;
  reducedMotion: boolean;
}

export interface MainPlanController {
  state: MainState | null;
  issues: ValidationIssue[];
  validationAttempt: number;
  progressWarning: string | null;
  introEntry: MainIntroEntry;
  acceptBootstrapResult(result: MainBootstrapResult): void;
  completeWelcomeIntro(entryId: number): void;
  changeDraft(draft: MainData): void;
  changeSetupStep(step: SetupStep): void;
  apply(): Promise<void>;
  cancelDraft(): Promise<void>;
  restartSetup(): void;
  startEmptySetup(): Promise<void>;
  discardRecoveryCandidate(): Promise<void>;
  returnToCurrentPlan(): Promise<void>;
}

export function useMainPlanController(
  options: UseMainPlanControllerOptions,
): MainPlanController;
```

Export `MainIntroEntry` from this controller module and use the canonical `MainIntroEntryReason` from `mainViewModel.ts`; do not create a UI→application type dependency. `MainApp` remains responsible for `consumeEditIntent`, URL navigation, `RecoveryView` markup, `JourneyEntryCard`, status regions and final JSX composition.

- [ ] **Step 1: Capture a fresh pre-refactor characterization baseline**

Run before moving state or effects:

```bash
npx vitest run tests/unit/main/MainApp.test.tsx tests/unit/main/bootstrap.test.ts tests/unit/main/mainReducer.test.ts
```

Expected: PASS. This task changes no behavior; the same tests are the before/after oracle rather than an invented hook-private assertion.

- [ ] **Step 2: Strengthen the shared-gate integration assertions at the MainApp boundary**

In the existing delayed restart test, keep the first setup-progress promise pending, use the mocked SetupFlow's `change-income` action, and assert the rendered draft output updates before resolving the promise. Then request cancel and assert it waits behind the queued progress clear. The relevant public assertions are:

```ts
expect(screen.getByRole('button', { name: 'change-income' })).toBeEnabled();
fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
expect(screen.getByText('4000000')).toBeVisible();
expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();

fireEvent.click(screen.getByRole('button', { name: '취소' }));
expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
```

This proves restart/draft only check the gate and enqueue progress, while cancel acquires the gate and waits for the queue. Do not assert hook call counts or internal refs.

- [ ] **Step 3: Implement the controller state, bootstrap and intro lifecycle**

Move `state`, `issues`, `validationAttempt`, `progressWarning`, `introEntry`, repository-specific bootstrap request, intro IDs and persisted fresh-entry IDs into `useMainPlanController`.

`acceptBootstrapResult` must clear issues/progress warning, set the returned state, and issue a new intro entry. This same stable callback is passed to the backup controller so restore of an empty Main naturally triggers fresh intro; the existing fresh-entry effect then queues the separate welcome progress write and revision increment.

Keep these effect guards unchanged:

```ts
if (
  introEntry.reason === 'fresh'
  && state?.mode === 'setup'
  && state.setupStep === 'welcome'
  && !persistedFreshIntroEntryIdsRef.current.has(introEntry.id)
) {
  persistedFreshIntroEntryIdsRef.current.add(introEntry.id);
  void persistSetupProgress('welcome', state.draft, 'initial');
}

if (
  reducedMotion
  && state?.mode === 'setup'
  && state.setupStep === 'welcome'
  && (introEntry.reason === 'fresh' || introEntry.reason === 'restart')
) {
  completeWelcomeIntro(introEntry.id);
}
```

Use `useCallback` for `acceptBootstrapResult` and every callback consumed by `MainApp` or the backup controller; include actual dependencies so repository replacement starts exactly one new bootstrap promise while Strict Mode replay reuses the existing promise.

- [ ] **Step 4: Move setup/recovery orchestration into the controller with exact gate scope**

Centralize warning mapping:

```ts
const progressMessages = {
  save: '설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.',
  clear: '설정 진행 상황을 정리하지 못했습니다. 저장된 계획에는 영향이 없습니다.',
} as const;
```

Implement `persistSetupProgress` and `clearSetupProgress` over Task 1's queue. `changeDraft`, `changeSetupStep` and `restartSetup` return early when `operationGate.busy`, but never set it. `apply`, `cancelDraft`, `startEmptySetup`, `discardRecoveryCandidate` and `returnToCurrentPlan` use this pattern:

```ts
if (operationGate.busy) return;
operationGate.busy = true;
try {
  // wait for queue and perform the existing terminal action
} finally {
  operationGate.busy = false;
}
```

Specific ordering remains:

- `apply`: `waitForIdle()` → `saveMainDraft()` → successful `clear()` → reducer result.
- validation failure: set issues/attempt → map first issue to a step → enqueue, but do not await, that progress save → `save-failed`.
- `cancelDraft`, discard and current-plan return: transition only after `clear().status === 'saved'`.
- invalid start-empty: `resetInvalidMainWorkspace()` must return `reset`; then set a direct setup-welcome state with intro reason unchanged/none.
- recovery discard with no applied plan also sets direct setup welcome without fresh/restart intro.

Use `finally` for every acquired gate, including clear failure and unexpected callback errors.

- [ ] **Step 5: Reduce MainApp to composition and keep presentation byte-stable**

`MainApp` should now follow this order:

```ts
const operationGate = useRef(createMainOperationGate()).current;
const reducedMotion = useReducedMotion();
const plan = useMainPlanController({ repository, operationGate, reducedMotion });
const showIntro = shouldShowMainIntro(
  plan.state,
  plan.introEntry.reason,
  reducedMotion,
);
const backup = useMainBackupController({
  state: plan.state,
  mainRepository: repository,
  workspaceRepository,
  operationGate,
  showIntro,
  onBootstrapAccepted: plan.acceptBootstrapResult,
});
const view = buildMainViewModel({
  state: plan.state,
  introReason: plan.introEntry.reason,
  reducedMotion,
  validationIssueCount: plan.issues.length,
  hasProgressWarning: plan.progressWarning !== null,
  backupStatusKind: backup.backupStatus?.kind ?? null,
  hasPendingImport: backup.pendingImport !== null,
  restorePending: backup.restorePending,
});
```

Use `view.screen` for loading/intro/recovery/setup/dashboard selection and `view.management` for the existing menu props. Keep current JSX class names, text, roles, focus selectors, setup motion preset and `SummaryDashboard` props unchanged. Do not split `RecoveryView` or presentation-only fragments merely to reduce line count.

- [ ] **Step 6: Run focused Main regression and inspect architecture boundaries**

Run:

```bash
npx vitest run tests/unit/main/MainApp.test.tsx \
  tests/unit/main/bootstrap.test.ts \
  tests/unit/main/mainReducer.test.ts \
  tests/unit/main/mainSetupCommands.test.ts \
  tests/unit/main/setupProgressQueue.test.ts \
  tests/unit/main/mainBackupCommands.test.ts \
  tests/unit/main/mainBrowserFiles.test.ts \
  tests/unit/main/mainViewModel.test.ts
npm run check
rg -n "FileReader|new Blob|createObjectURL|importWorkspaceBackup|exportWorkspaceBackup|saveSetupProgress|clearSetupProgress" src/main/ui/MainApp.tsx
rg -n "from 'react'|document\.|window\.|FileReader|Blob|사용|백업|저장" src/main/application/mainSetupCommands.ts src/main/application/setupProgressQueue.ts src/main/application/mainBackupCommands.ts src/main/application/mainViewModel.ts
git diff --check
```

Expected:

- all focused tests and TypeScript checks pass;
- first `rg` prints no matches;
- second `rg` prints no React/DOM/browser/UI-copy imports or references;
- `git diff --check` prints no errors.

- [ ] **Step 7: Run repository-wide unit and E2E verification**

Run:

```bash
npm run test:unit
npx playwright test tests/main-react.spec.ts tests/main-compat.spec.ts
npm run test:e2e
```

Expected: all unit tests pass; focused Main Playwright and the full E2E suite pass with only already-documented conditional skips.

- [ ] **Step 8: Verify the unchanged Main experience at required viewports**

Start the existing Vite app without changing package metadata:

```bash
npm run dev -- --host 127.0.0.1
```

At 390×844, 768×1024 and 1280×900 verify fresh setup, review, dashboard, recovery and whole-workspace restore:

- no body or surface horizontal overflow;
- brand intro appears only for fresh/restart and reduced motion skips interactive markup;
- restore of empty Main focuses only after fresh intro completes;
- setup/recovery focus order and accessible names match the current UI;
- visible controls remain at least 44px touch targets;
- 6/6 visualization, cashflow bar and donut remain visible and contained;
- management popover, confirmation dialog and status region remain within the viewport.

Record viewport, route/state and pass/fail evidence in the task handoff. Do not alter CSS or Anime.js to address an orchestration-only regression; first identify the state/focus ordering defect.

- [ ] **Step 9: Commit Task 4 only after all gates pass**

```bash
git add src/main/ui/useMainPlanController.ts \
  src/main/ui/useMainBackupController.ts \
  src/main/ui/MainApp.tsx \
  tests/unit/main/MainApp.test.tsx
git diff --cached --check
git commit -m "refactor(main): separate plan orchestration controller"
```

- [ ] **Step 10: Produce the completion handoff**

Report:

- every created/modified file and its responsibility;
- exact focused, type, unit, Playwright and viewport results;
- skipped checks and reasons;
- confirmation that storage schema/key, backup envelope, routes, DOM/CSS/copy and other apps did not change;
- remaining Phase 2 owners: Account Map, Portfolio and Simulation;
- remaining separate scopes: Phase 3 calculation/render boundaries and Phase 4 legacy retirement;
- untouched unrelated working-tree changes, especially `package-lock.json`.

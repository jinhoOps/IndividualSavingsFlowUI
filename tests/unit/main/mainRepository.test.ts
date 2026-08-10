import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import {
  BrowserMainRepository,
  isMainDataShape,
} from '../../../src/main/infrastructure/mainRepository';

class MemoryStorage implements Storage {
  constructor(protected readonly values = new Map<string, string>()) {}

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class HookedStorage extends MemoryStorage {
  constructor(
    values: Map<string, string>,
    private readonly setHook: (key: string, value: string, commit: () => void) => void,
    private readonly getHook?: (key: string, read: () => string | null) => string | null,
    private readonly removeHook?: (key: string, remove: () => void) => void,
  ) {
    super(values);
  }

  override getItem(key: string): string | null {
    return this.getHook?.(key, () => super.getItem(key)) ?? super.getItem(key);
  }

  override setItem(key: string, value: string): void {
    this.setHook(key, value, () => super.setItem(key, value));
  }

  override removeItem(key: string): void {
    if (this.removeHook === undefined) {
      super.removeItem(key);
      return;
    }
    this.removeHook(key, () => super.removeItem(key));
  }
}

const validData = (): MainData => ({
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 4_200_000,
  monthlyHousingWon: 900_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 600_000,
  monthlyInvestmentWon: 800_000,
});

describe('BrowserMainRepository', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty without v2 data and leaves every legacy key untouched', async () => {
    const v1Raw = JSON.stringify({ schemaVersion: 1, updatedAt: 10 });
    const legacyRaw = JSON.stringify({ modelVersion: 10, monthlyIncome: 4_200_000 });
    const activeRaw = JSON.stringify({ modelVersion: 10, monthlyIncome: 5_000_000 });
    window.localStorage.setItem('isf-main-v1', v1Raw);
    window.localStorage.setItem('isf-rebuild-v1', legacyRaw);
    window.localStorage.setItem('isf-step1-active', activeRaw);

    const result = await new BrowserMainRepository({ saveMainV2: vi.fn() }).load();

    expect(result).toEqual({ status: 'empty', data: null, original: null });
    expect(window.localStorage.getItem('isf-main-v1')).toBe(v1Raw);
    expect(window.localStorage.getItem('isf-rebuild-v1')).toBe(legacyRaw);
    expect(window.localStorage.getItem('isf-step1-active')).toBe(activeRaw);
  });

  it('loads valid v2 data without changing the stored value', async () => {
    const current = validData();
    current.updatedAt = 10;
    const raw = JSON.stringify(current);
    window.localStorage.setItem('isf-main-v2', raw);

    const result = await new BrowserMainRepository({ saveMainV2: vi.fn() }).load();

    expect(result).toEqual({ status: 'current', data: current, original: current });
    expect(window.localStorage.getItem('isf-main-v2')).toBe(raw);
  });

  it('returns a failed load for malformed v2 JSON instead of reading legacy data', async () => {
    window.localStorage.setItem('isf-main-v2', '{malformed-v2');
    window.localStorage.setItem('isf-main-v1', JSON.stringify({ schemaVersion: 1, updatedAt: 10 }));
    window.localStorage.setItem('isf-rebuild-v1', JSON.stringify({ modelVersion: 10, monthlyIncome: 4_200_000 }));

    const result = await new BrowserMainRepository({ saveMainV2: vi.fn() }).load();

    expect(result).toMatchObject({
      status: 'failed',
      data: null,
      original: '{malformed-v2',
      raw: '{malformed-v2',
      reason: 'Stored main data is not valid JSON.',
    });
  });

  it('durably acknowledges malformed current data without deleting its downloadable raw value', async () => {
    const raw = '{malformed-v2';
    window.localStorage.setItem('isf-main-v2', raw);
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(null),
    });
    const failed = await repository.load();
    expect(failed).toMatchObject({ status: 'failed', raw });

    repository.acknowledgeFailedCurrent(raw);

    expect(window.localStorage.getItem('isf-main-v2')).toBe(raw);
    expect(window.localStorage.getItem('isf-main-v2-quarantined-current')).toBe(raw);
    await expect(repository.load()).resolves.toEqual({ status: 'empty', data: null, original: null });
  });

  it('identifies malformed pending data as the failed source', async () => {
    const raw = '{malformed-pending';
    window.localStorage.setItem('isf-main-v2-pending', raw);
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(null),
    });

    await expect(repository.load()).resolves.toMatchObject({
      status: 'failed',
      source: 'pending',
      raw,
      original: raw,
    });
  });

  it('durably acknowledges malformed pending data without deleting its downloadable raw value', async () => {
    const raw = '{malformed-pending';
    window.localStorage.setItem('isf-main-v2-pending', raw);
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(null),
    });

    repository.acknowledgeFailedPending(raw);

    expect(window.localStorage.getItem('isf-main-v2-pending')).toBe(raw);
    expect(window.localStorage.getItem('isf-main-v2-quarantined-pending')).toBe(raw);
    await expect(repository.load()).resolves.toEqual({ status: 'empty', data: null, original: null });
  });

  it('keeps malformed pending recovery active when its quarantine write fails', async () => {
    const raw = '{malformed-pending';
    const sharedValues = new Map<string, string>([
      ['isf-main-v2-pending', raw],
    ]);
    const storage = new HookedStorage(
      sharedValues,
      (key, _value, commit) => {
        if (key === 'isf-main-v2-quarantined-pending') throw new Error('quota');
        commit();
      },
    );
    const repository = new BrowserMainRepository(
      {
        saveMainV2: vi.fn(),
        loadLatestMainV2: vi.fn().mockResolvedValue(null),
      },
      createSerialLock(),
      storage,
    );

    expect(() => repository.acknowledgeFailedPending(raw)).toThrow('quota');

    expect(storage.getItem('isf-main-v2-pending')).toBe(raw);
    expect(storage.getItem('isf-main-v2-quarantined-pending')).toBeNull();
    await expect(repository.load()).resolves.toMatchObject({
      status: 'failed',
      source: 'pending',
      raw,
    });
  });

  it('keeps a concurrent pending successor active while acknowledging only the exact malformed raw', async () => {
    const targetRaw = '{malformed-pending';
    const successor = validData();
    successor.updatedAt = 30;
    successor.monthlyNetIncomeWon = 6_000_000;
    const successorRaw = JSON.stringify(successor);
    const sharedValues = new Map<string, string>([
      ['isf-main-v2-pending', targetRaw],
    ]);
    const storage = new HookedStorage(
      sharedValues,
      (key, _value, commit) => {
        if (key === 'isf-main-v2-quarantined-pending') {
          sharedValues.set('isf-main-v2-pending', successorRaw);
        }
        commit();
      },
    );
    const repository = new BrowserMainRepository(
      {
        saveMainV2: vi.fn(),
        loadLatestMainV2: vi.fn().mockResolvedValue(null),
      },
      createSerialLock(),
      storage,
    );

    repository.acknowledgeFailedPending(targetRaw);

    expect(storage.getItem('isf-main-v2-pending')).toBe(successorRaw);
    expect(storage.getItem('isf-main-v2-quarantined-pending')).toBe(targetRaw);
    await expect(repository.load()).resolves.toMatchObject({
      status: 'recovery',
      source: 'pending',
      data: { updatedAt: 30, monthlyNetIncomeWon: 6_000_000 },
    });
  });

  it('returns a failed load for a schema v1 document stored under the v2 key', async () => {
    const v1 = { schemaVersion: 1, updatedAt: 10 };
    window.localStorage.setItem('isf-main-v2', JSON.stringify(v1));

    const result = await new BrowserMainRepository({ saveMainV2: vi.fn() }).load();

    expect(result).toMatchObject({ status: 'failed', data: null, original: v1 });
  });

  it.each([
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects an invalid persisted revision %s at the scalar boundary', (updatedAt) => {
    expect(isMainDataShape({ ...validData(), updatedAt })).toBe(false);
  });

  it.each([
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects an invalid input revision %s before any durable save write', async (updatedAt) => {
    const saveMainV2 = vi.fn();
    const repository = new BrowserMainRepository({ saveMainV2 });

    await expect(repository.save({ ...validData(), updatedAt })).rejects.toThrow('invalid');

    expect(saveMainV2).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('isf-main-v2')).toBeNull();
    expect(window.localStorage.getItem('isf-main-v2-pending')).toBeNull();
  });

  it('offers newer validated history for explicit recovery without auto-applying it', async () => {
    const current = validData();
    current.updatedAt = 10;
    const history = validData();
    history.updatedAt = 20;
    history.monthlyNetIncomeWon = 5_000_000;
    window.localStorage.setItem('isf-main-v2', JSON.stringify(current));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(history),
    });

    const result = await repository.load();

    expect(result).toMatchObject({
      status: 'recovery',
      source: 'history',
      current: { updatedAt: 10 },
      data: { updatedAt: 20, monthlyNetIncomeWon: 5_000_000 },
    });
    expect(JSON.parse(window.localStorage.getItem('isf-main-v2') ?? '')).toEqual(current);
  });

  it('durably suppresses a discarded history revision across repository reloads', async () => {
    const current = validData();
    current.updatedAt = 10;
    const history = validData();
    history.updatedAt = 20;
    window.localStorage.setItem('isf-main-v2', JSON.stringify(current));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(history),
    });

    expect(await repository.load()).toMatchObject({ status: 'recovery', source: 'history' });
    repository.discardRecovery(history.updatedAt);

    expect(await repository.load()).toMatchObject({ status: 'current', data: { updatedAt: 10 } });
    expect(window.localStorage.getItem('isf-main-v2-dismissed-recovery')).toBe('20');
  });

  it('offers newer history instead of masking it with an older pending draft', async () => {
    const current = validData();
    current.updatedAt = 10;
    const pending = validData();
    pending.updatedAt = 20;
    pending.monthlyNetIncomeWon = 5_000_000;
    const history = validData();
    history.updatedAt = 30;
    history.monthlyNetIncomeWon = 6_000_000;
    window.localStorage.setItem('isf-main-v2', JSON.stringify(current));
    window.localStorage.setItem('isf-main-v2-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(history),
    });

    expect(await repository.load()).toMatchObject({
      status: 'recovery',
      source: 'history',
      current: { updatedAt: 10 },
      data: { updatedAt: 30, monthlyNetIncomeWon: 6_000_000 },
    });
  });

  it('does not offer an older pending draft over a newer applied revision', async () => {
    const current = validData();
    current.updatedAt = 30;
    current.monthlyNetIncomeWon = 6_000_000;
    const pending = validData();
    pending.updatedAt = 20;
    pending.monthlyNetIncomeWon = 5_000_000;
    window.localStorage.setItem('isf-main-v2', JSON.stringify(current));
    window.localStorage.setItem('isf-main-v2-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(null),
    });

    expect(await repository.load()).toMatchObject({
      status: 'current',
      data: { updatedAt: 30, monthlyNetIncomeWon: 6_000_000 },
    });
  });

  it('does not let malformed current data mask a valid pending recovery draft', async () => {
    const pending = validData();
    pending.updatedAt = 20;
    pending.monthlyNetIncomeWon = 5_000_000;
    window.localStorage.setItem('isf-main-v2', '{malformed-current');
    window.localStorage.setItem('isf-main-v2-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(null),
    });

    expect(await repository.load()).toMatchObject({
      status: 'recovery',
      source: 'pending',
      current: null,
      data: { updatedAt: 20, monthlyNetIncomeWon: 5_000_000 },
    });

    repository.discardRecovery(pending.updatedAt);

    expect(window.localStorage.getItem('isf-main-v2-quarantined-current')).toBe('{malformed-current');
    await expect(repository.load()).resolves.toEqual({ status: 'empty', data: null, original: null });
  });

  it('treats a pending-only first save as explicit recovery', async () => {
    const pending = validData();
    pending.updatedAt = 20;
    window.localStorage.setItem('isf-main-v2-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(pending),
    });

    expect(await repository.load()).toMatchObject({
      status: 'recovery',
      source: 'pending',
      current: null,
      data: { updatedAt: 20 },
    });
  });

  it('keeps the existing current key when history persistence fails', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    window.localStorage.setItem('isf-main-v2', JSON.stringify(existing));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn().mockRejectedValue(new Error('indexeddb unavailable')),
    });

    await expect(repository.save(validData())).rejects.toThrow('indexeddb unavailable');

    expect(JSON.parse(window.localStorage.getItem('isf-main-v2') ?? '')).toEqual(existing);
    expect(window.localStorage.getItem('isf-main-v2-pending')).toBeNull();
  });

  it('fails before every write when latest history cannot be read for revision issuance', async () => {
    const current = validData();
    current.updatedAt = 10;
    const pending = validData();
    pending.updatedAt = 20;
    const currentRaw = JSON.stringify(current);
    const pendingRaw = JSON.stringify(pending);
    window.localStorage.setItem('isf-main-v2', currentRaw);
    window.localStorage.setItem('isf-main-v2-pending', pendingRaw);
    const saveMainV2 = vi.fn().mockResolvedValue(undefined);
    const loadLatestMainV2 = vi.fn().mockRejectedValue(new Error('history read unavailable'));
    const repository = new BrowserMainRepository({
      saveMainV2,
      loadLatestMainV2,
    });

    await expect(repository.save(validData())).rejects.toThrow('history read unavailable');

    expect(loadLatestMainV2).toHaveBeenCalledOnce();
    expect(saveMainV2).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('isf-main-v2')).toBe(currentRaw);
    expect(window.localStorage.getItem('isf-main-v2-pending')).toBe(pendingRaw);
  });

  it('writes v2 with matching timestamps in current storage and history without touching legacy keys', async () => {
    const saveMainV2 = vi.fn().mockResolvedValue(undefined);
    const v1Raw = JSON.stringify({ schemaVersion: 1, updatedAt: 10 });
    const legacyRaw = JSON.stringify({ modelVersion: 10, monthlyIncome: 3_000_000 });
    window.localStorage.setItem('isf-main-v1', v1Raw);
    window.localStorage.setItem('isf-rebuild-v1', legacyRaw);
    vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    const input = validData();
    const repository = new BrowserMainRepository({ saveMainV2 });

    const saved = await repository.save(input);

    expect(window.localStorage.getItem('isf-main-v2')).toBe(JSON.stringify(saved));
    expect(saved.updatedAt).toBeGreaterThanOrEqual(1_750_000_000_000);
    expect(saveMainV2).toHaveBeenCalledWith(saved);
    expect(saved).not.toBe(input);
    expect(input.updatedAt).toBe(0);
    expect(window.localStorage.getItem('isf-main-v2-pending')).toBeNull();
    expect(window.localStorage.getItem('isf-main-v1')).toBe(v1Raw);
    expect(window.localStorage.getItem('isf-rebuild-v1')).toBe(legacyRaw);
  });

  it('keeps separate monotonically increasing history entries when saves share a millisecond', async () => {
    const history = new Map<number, MainData>();
    const saveMainV2 = vi.fn(async (data: MainData) => {
      history.set(data.updatedAt, structuredClone(data));
    });
    vi.spyOn(Date, 'now').mockReturnValue(1_850_000_000_000);
    const first = new BrowserMainRepository({ saveMainV2 });
    const second = new BrowserMainRepository({ saveMainV2 });

    await Promise.all([first.save(validData()), second.save(validData())]);

    expect(history.size).toBe(2);
    expect([...history.keys()]).toEqual([1_850_000_000_000, 1_850_000_000_001]);
  });

  it('issues a revision newer than a pending draft left by a crashed tab', async () => {
    const pending = validData();
    pending.updatedAt = 100;
    window.localStorage.setItem('isf-main-v2-pending', JSON.stringify(pending));
    vi.spyOn(Date, 'now').mockReturnValue(50);
    const repository = new BrowserMainRepository({ saveMainV2: vi.fn().mockResolvedValue(undefined) });

    const saved = await repository.save(validData());

    expect(saved.updatedAt).toBeGreaterThan(100);
  });

  it('issues above a future dismissal tombstone when the clock rolls back', async () => {
    const futureTombstone = 3_000_000_000_000;
    window.localStorage.setItem('isf-main-v2-dismissed-recovery', String(futureTombstone));
    vi.spyOn(Date, 'now').mockReturnValue(50);
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn().mockResolvedValue(undefined),
      loadLatestMainV2: vi.fn().mockResolvedValue(null),
    });

    const saved = await repository.save(validData());

    expect(saved.updatedAt).toBe(futureTombstone + 1);
  });

  it('issues above both the recovered input revision and latest v2 history', async () => {
    const history = validData();
    history.updatedAt = 4_000_000_000_000;
    const recoveredDraft = validData();
    recoveredDraft.updatedAt = 5_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(50);
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn().mockResolvedValue(undefined),
      loadLatestMainV2: vi.fn().mockResolvedValue(history),
    });

    const saved = await repository.save(recoveredDraft);

    expect(saved.updatedAt).toBe(recoveredDraft.updatedAt + 1);
  });

  it('issues above latest v2 history when it is newer than the recovered input', async () => {
    const history = validData();
    history.updatedAt = 6_000_000_000_000;
    const recoveredDraft = validData();
    recoveredDraft.updatedAt = 5_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(50);
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn().mockResolvedValue(undefined),
      loadLatestMainV2: vi.fn().mockResolvedValue(history),
    });

    const saved = await repository.save(recoveredDraft);

    expect(saved.updatedAt).toBe(history.updatedAt + 1);
  });

  it('fails before any durable write when the revision ceiling is exhausted', async () => {
    const history = validData();
    history.updatedAt = Number.MAX_SAFE_INTEGER;
    const saveMainV2 = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(Date, 'now').mockReturnValue(50);
    const repository = new BrowserMainRepository({
      saveMainV2,
      loadLatestMainV2: vi.fn().mockResolvedValue(history),
    });

    await expect(repository.save(validData())).rejects.toThrow('revision');

    expect(saveMainV2).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('isf-main-v2')).toBeNull();
    expect(window.localStorage.getItem('isf-main-v2-pending')).toBeNull();
  });

  it('retains old current data and pending recovery when replacing current fails', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    window.localStorage.setItem('isf-main-v2', JSON.stringify(existing));
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'isf-main-v2') throw new Error('quota exceeded');
      MemoryStorage.prototype.setItem.call(window.localStorage, key, value);
    });
    const repository = new BrowserMainRepository({ saveMainV2: vi.fn().mockResolvedValue(undefined) });

    await expect(repository.save(validData())).rejects.toThrow('quota exceeded');

    expect(JSON.parse(window.localStorage.getItem('isf-main-v2') ?? '')).toEqual(existing);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v2-pending') ?? '').updatedAt).toBeGreaterThan(10);
  });

  it('lets the exact history revision from a failed save be dismissed when pending persistence fails', async () => {
    const history: MainData[] = [];
    const storage = new HookedStorage(
      new Map(),
      (key, _value, commit) => {
        if (key === 'isf-main-v2-pending') throw new Error('pending unavailable');
        commit();
      },
    );
    const repository = new BrowserMainRepository(
      {
        saveMainV2: vi.fn(async (data) => {
          history.push(structuredClone(data));
        }),
        loadLatestMainV2: vi.fn(async () => history.at(-1) ?? null),
      },
      createSerialLock(),
      storage,
    );

    await expect(repository.save(validData())).rejects.toThrow('pending unavailable');
    const recovery = await repository.load();
    expect(recovery).toMatchObject({ status: 'recovery', source: 'history' });
    if (recovery.status !== 'recovery') throw new Error('Expected history recovery');

    repository.discardRecovery(recovery.data.updatedAt);

    await expect(repository.load()).resolves.toEqual({ status: 'empty', data: null, original: null });
  });

  it('rolls current back when pending cleanup fails after the current write', async () => {
    const sharedValues = new Map<string, string>();
    const existing = validData();
    existing.updatedAt = 10;
    sharedValues.set('isf-main-v2', JSON.stringify(existing));
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      undefined,
      (key, remove) => {
        if (key === 'isf-main-v2-pending') throw new Error('pending cleanup failed');
        remove();
      },
    );
    const repository = new BrowserMainRepository(
      { saveMainV2: vi.fn().mockResolvedValue(undefined) },
      createSerialLock(),
      storage,
    );

    await expect(repository.save(validData())).rejects.toThrow('pending cleanup failed');

    expect(JSON.parse(storage.getItem('isf-main-v2') ?? '')).toEqual(existing);
    expect(storage.getItem('isf-main-v2-pending')).not.toBeNull();
  });

  it('does not roll back a successor current revision after a late cleanup failure', async () => {
    const sharedValues = new Map<string, string>();
    const current = validData();
    current.updatedAt = 10;
    const successor = validData();
    successor.updatedAt = 9_999;
    successor.monthlyNetIncomeWon = 6_000_000;
    const successorRaw = JSON.stringify(successor);
    sharedValues.set('isf-main-v2', JSON.stringify(current));
    let replaceOnRollbackRead = false;
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      (key, read) => {
        const value = read();
        if (key === 'isf-main-v2' && replaceOnRollbackRead) {
          replaceOnRollbackRead = false;
          sharedValues.set(key, successorRaw);
        }
        return value;
      },
      (key, remove) => {
        if (key === 'isf-main-v2-pending') {
          replaceOnRollbackRead = true;
          throw new Error('late pending cleanup failure');
        }
        remove();
      },
    );
    const repository = new BrowserMainRepository(
      { saveMainV2: vi.fn().mockResolvedValue(undefined) },
      createSerialLock(),
      storage,
    );

    await expect(repository.save(validData())).rejects.toThrow('late pending cleanup failure');

    expect(storage.getItem('isf-main-v2')).toBe(successorRaw);
  });

  it('durably dismisses a pending recovery draft without physically deleting its raw data', async () => {
    const pending = validData();
    pending.updatedAt = 20;
    window.localStorage.setItem('isf-main-v2-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV2: vi.fn(),
      loadLatestMainV2: vi.fn().mockResolvedValue(null),
    });

    repository.discardPending(pending.updatedAt);

    expect(window.localStorage.getItem('isf-main-v2-pending')).toBe(JSON.stringify(pending));
    expect(window.localStorage.getItem('isf-main-v2-dismissed-recovery')).toBe('20');
    await expect(repository.load()).resolves.toEqual({ status: 'empty', data: null, original: null });
  });

  it.each([
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('does not persist an invalid dismissed recovery revision %s', (updatedAt) => {
    const repository = new BrowserMainRepository({ saveMainV2: vi.fn() });

    repository.discardRecovery(updatedAt);

    expect(window.localStorage.getItem('isf-main-v2-dismissed-recovery')).toBeNull();
  });

  it('does not discard or suppress a successor pending draft from another tab', () => {
    const sharedValues = new Map<string, string>();
    const target = validData();
    target.updatedAt = 20;
    const successor = validData();
    successor.updatedAt = 30;
    successor.monthlyNetIncomeWon = 6_000_000;
    const targetRaw = JSON.stringify(target);
    const successorRaw = JSON.stringify(successor);
    sharedValues.set('isf-main-v2-pending', targetRaw);
    let pendingReads = 0;
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      (key, read) => {
        const current = read();
        if (key === 'isf-main-v2-pending') {
          pendingReads += 1;
          if (pendingReads === 2) {
            sharedValues.set(key, successorRaw);
            return successorRaw;
          }
        }
        return current;
      },
      (key, remove) => {
        if (key === 'isf-main-v2-pending' && pendingReads === 1) {
          sharedValues.set(key, successorRaw);
        }
        remove();
      },
    );
    const repository = new BrowserMainRepository(
      { saveMainV2: vi.fn() },
      createSerialLock(),
      storage,
    );

    repository.discardPending(target.updatedAt);

    expect(storage.getItem('isf-main-v2-pending')).toBe(successorRaw);
    expect(storage.getItem('isf-main-v2-dismissed-recovery')).toBeNull();
  });

  it('does not delete a successor that replaces pending immediately after the final comparison', async () => {
    const sharedValues = new Map<string, string>();
    const target = validData();
    target.updatedAt = 20;
    const successor = validData();
    successor.updatedAt = 30;
    successor.monthlyNetIncomeWon = 6_000_000;
    const targetRaw = JSON.stringify(target);
    const successorRaw = JSON.stringify(successor);
    sharedValues.set('isf-main-v2-pending', targetRaw);
    let pendingReads = 0;
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      (key, read) => {
        const current = read();
        if (key === 'isf-main-v2-pending') {
          pendingReads += 1;
          if (pendingReads === 2) sharedValues.set(key, successorRaw);
        }
        return current;
      },
    );
    const repository = new BrowserMainRepository(
      {
        saveMainV2: vi.fn(),
        loadLatestMainV2: vi.fn().mockResolvedValue(null),
      },
      createSerialLock(),
      storage,
    );

    repository.discardPending(target.updatedAt);

    expect(storage.getItem('isf-main-v2-pending')).toBe(successorRaw);
    expect(storage.getItem('isf-main-v2-dismissed-recovery')).toBe('20');
    await expect(repository.load()).resolves.toMatchObject({
      status: 'recovery',
      source: 'pending',
      data: { updatedAt: 30, monthlyNetIncomeWon: 6_000_000 },
    });
  });

  it('round-trips housing setup progress under the v2 progress key', () => {
    const repository = new BrowserMainRepository({ saveMainV2: vi.fn() });
    const draft = validData();
    const legacyProgressRaw = JSON.stringify({ step: 'account' });
    window.localStorage.setItem('isf-main-v1-setup-progress', legacyProgressRaw);

    repository.saveSetupProgress('housing', draft, 'restart');

    expect(window.localStorage.getItem('isf-main-v2-setup-progress')).toContain('"step":"housing"');
    expect(repository.loadSetupProgress()).toMatchObject({ kind: 'restart', step: 'housing', draft });
    expect(repository.loadSetupProgress()?.savedAt).toEqual(expect.any(Number));
    expect(window.localStorage.getItem('isf-main-v1-setup-progress')).toBe(legacyProgressRaw);
    repository.clearSetupProgress();
    expect(window.localStorage.getItem('isf-main-v2-setup-progress')).toBeNull();
  });

  it.each([
    ['monthlyNetIncomeWon', -1],
    ['monthlyNetIncomeWon', 0.5],
    ['monthlyNetIncomeWon', Number.MAX_SAFE_INTEGER + 1],
    ['monthlyHousingWon', -1],
    ['monthlyHousingWon', 0.5],
    ['monthlyHousingWon', Number.MAX_SAFE_INTEGER + 1],
    ['monthlyLivingWon', -1],
    ['monthlyLivingWon', 0.5],
    ['monthlyLivingWon', Number.MAX_SAFE_INTEGER + 1],
    ['monthlySavingWon', -1],
    ['monthlySavingWon', 0.5],
    ['monthlySavingWon', Number.MAX_SAFE_INTEGER + 1],
    ['monthlyInvestmentWon', -1],
    ['monthlyInvestmentWon', 0.5],
    ['monthlyInvestmentWon', Number.MAX_SAFE_INTEGER + 1],
  ] as const)('does not resume setup progress with invalid money %s=%s', (field, value) => {
    const repository = new BrowserMainRepository({ saveMainV2: vi.fn() });
    const draft = validData();
    draft[field] = value;
    window.localStorage.setItem(
      'isf-main-v2-setup-progress',
      JSON.stringify({ kind: 'initial', step: 'housing', draft }),
    );

    expect(repository.loadSetupProgress()).toBeNull();
  });

  it('serializes fallback saves across independent repository and storage instances', async () => {
    const sharedValues = new Map<string, string>();
    const firstStorage = new MemoryStorage(sharedValues);
    const secondStorage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    let releaseFirstHistory: (() => void) | undefined;
    let markFirstHistoryStarted: (() => void) | undefined;
    const firstHistoryStarted = new Promise<void>((resolve) => {
      markFirstHistoryStarted = resolve;
    });
    const firstHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirstHistory = resolve;
      markFirstHistoryStarted?.();
    }));
    const secondHistory = vi.fn().mockResolvedValue(undefined);
    const firstRepository = new BrowserMainRepository(
      { saveMainV2: firstHistory },
      undefined,
      firstStorage,
      leaseOptions('tab-a', leaseClock),
    );
    const secondRepository = new BrowserMainRepository(
      { saveMainV2: secondHistory },
      undefined,
      secondStorage,
      leaseOptions('tab-b', leaseClock),
    );
    const firstDraft = validData();
    firstDraft.monthlyNetIncomeWon = 5_000_000;
    const secondDraft = validData();
    secondDraft.monthlyNetIncomeWon = 6_000_000;

    const firstSave = firstRepository.save(firstDraft);
    await firstHistoryStarted;
    const secondSave = secondRepository.save(secondDraft);
    await vi.waitFor(() => expect(leaseClock.pendingWaits()).toBe(1));

    expect(secondHistory).not.toHaveBeenCalled();
    releaseFirstHistory?.();
    await expect(firstSave).resolves.toMatchObject({ monthlyNetIncomeWon: 5_000_000 });
    await leaseClock.releaseNextWait();
    await expect(secondSave).resolves.toMatchObject({ monthlyNetIncomeWon: 6_000_000 });
    expect(JSON.parse(secondStorage.getItem('isf-main-v2') ?? '')).toMatchObject({
      monthlyNetIncomeWon: 6_000_000,
    });
    expectInactiveLease(secondStorage, 'tab-a');
    expectInactiveLease(secondStorage, 'tab-b');
  });

  it('lets a stale fallback lease be taken over after its owner tab disappears', async () => {
    const sharedValues = new Map<string, string>();
    const storage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    storage.setItem(leaseStorageKey('crashed-tab'), activeLeaseRecord('crashed-tab', 999));
    const repository = new BrowserMainRepository(
      { saveMainV2: vi.fn().mockResolvedValue(undefined) },
      undefined,
      storage,
      leaseOptions('replacement-tab', leaseClock),
    );

    await expect(repository.save(validData())).resolves.toMatchObject({
      monthlyNetIncomeWon: 4_200_000,
    });

    expect(storage.getItem('isf-main-v2')).not.toBeNull();
    expectInactiveLease(storage, 'replacement-tab');
  });

  it('does not let a former lease owner release the new owner lease after stale takeover', async () => {
    const sharedValues = new Map<string, string>();
    const firstStorage = new MemoryStorage(sharedValues);
    const secondStorage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    let releaseFirstHistory: (() => void) | undefined;
    let markFirstHistoryStarted: (() => void) | undefined;
    const firstHistoryStarted = new Promise<void>((resolve) => {
      markFirstHistoryStarted = resolve;
    });
    const firstHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirstHistory = resolve;
      markFirstHistoryStarted?.();
    }));
    let releaseSecondHistory: (() => void) | undefined;
    let markSecondHistoryStarted: (() => void) | undefined;
    const secondHistoryStarted = new Promise<void>((resolve) => {
      markSecondHistoryStarted = resolve;
    });
    const secondHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseSecondHistory = resolve;
      markSecondHistoryStarted?.();
    }));
    const firstRepository = new BrowserMainRepository(
      { saveMainV2: firstHistory },
      undefined,
      firstStorage,
      leaseOptions('tab-a', leaseClock),
    );
    const secondRepository = new BrowserMainRepository(
      { saveMainV2: secondHistory },
      undefined,
      secondStorage,
      leaseOptions('tab-b', leaseClock),
    );

    const firstSave = firstRepository.save(validData());
    await firstHistoryStarted;
    leaseClock.setNow(1_101);
    const secondSave = secondRepository.save(validData());
    await secondHistoryStarted;
    releaseFirstHistory?.();

    await expect(firstSave).rejects.toThrow('Workspace save lock ownership was lost');
    expect(JSON.parse(firstStorage.getItem(leaseStorageKey('tab-b')) ?? '')).toMatchObject({
      owner: 'tab-b',
      ticket: 1,
    });
    releaseSecondHistory?.();
    await expect(secondSave).resolves.toBeTruthy();
    expectInactiveLease(secondStorage, 'tab-b');
  });

  it('does not let a late expired writer erase a newer successful fallback save', async () => {
    const sharedValues = new Map<string, string>();
    const firstStorage = new MemoryStorage(sharedValues);
    const secondStorage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    let releaseFirstHistory: (() => void) | undefined;
    let markFirstHistoryStarted: (() => void) | undefined;
    const firstHistoryStarted = new Promise<void>((resolve) => {
      markFirstHistoryStarted = resolve;
    });
    const firstHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirstHistory = resolve;
      markFirstHistoryStarted?.();
    }));
    const firstRepository = new BrowserMainRepository(
      { saveMainV2: firstHistory },
      undefined,
      firstStorage,
      leaseOptions('tab-a', leaseClock),
    );
    const secondRepository = new BrowserMainRepository(
      { saveMainV2: vi.fn().mockResolvedValue(undefined) },
      undefined,
      secondStorage,
      leaseOptions('tab-b', leaseClock),
    );
    const firstDraft = validData();
    firstDraft.monthlyNetIncomeWon = 5_000_000;
    const secondDraft = validData();
    secondDraft.monthlyNetIncomeWon = 6_000_000;

    const firstSave = firstRepository.save(firstDraft);
    await firstHistoryStarted;
    leaseClock.setNow(1_101);
    await expect(secondRepository.save(secondDraft)).resolves.toMatchObject({
      monthlyNetIncomeWon: 6_000_000,
    });
    releaseFirstHistory?.();

    await expect(firstSave).rejects.toThrow('Workspace save lock ownership was lost');
    expect(JSON.parse(firstStorage.getItem('isf-main-v2') ?? '')).toMatchObject({
      monthlyNetIncomeWon: 6_000_000,
    });
  });

  it('does not remove a successor pending draft during older writer cleanup', async () => {
    const sharedValues = new Map<string, string>();
    const successor = validData();
    successor.updatedAt = 9_999;
    successor.monthlyNetIncomeWon = 6_000_000;
    const successorRaw = JSON.stringify(successor);
    let pendingReads = 0;
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      (key, read) => {
        const value = read();
        if (key === 'isf-main-v2-pending') {
          pendingReads += 1;
          if (pendingReads === 2) sharedValues.set(key, successorRaw);
        }
        return value;
      },
    );
    const repository = new BrowserMainRepository(
      { saveMainV2: vi.fn().mockResolvedValue(undefined) },
      createSerialLock(),
      storage,
    );

    await expect(repository.save(validData())).resolves.toBeTruthy();

    expect(storage.getItem('isf-main-v2-pending')).toBe(successorRaw);
  });

  it('bounds fallback acquisition and leaves the draft untouched while another owner remains active', async () => {
    const sharedValues = new Map<string, string>();
    const storage = new MemoryStorage(sharedValues);
    let now = 1_000;
    storage.setItem(leaseStorageKey('active-tab'), activeLeaseRecord('active-tab', 5_000));
    const history = vi.fn();
    const input = validData();
    const repository = new BrowserMainRepository(
      { saveMainV2: history },
      undefined,
      storage,
      {
        ...leaseOptions('waiting-tab', createControlledLeaseClock(1_000)),
        now: () => now,
        wait: async (delayMs: number) => {
          now += delayMs;
        },
        acquireTimeoutMs: 20,
        retryDelayMs: 10,
      },
    );

    await expect(repository.save(input)).rejects.toThrow('Could not acquire the Workspace save lock');

    expect(history).not.toHaveBeenCalled();
    expect(storage.getItem('isf-main-v2')).toBeNull();
    expect(storage.getItem('isf-main-v2-pending')).toBeNull();
    expect(input.updatedAt).toBe(0);
    expect(storage.getItem(leaseStorageKey('active-tab'))).toBe(activeLeaseRecord('active-tab', 5_000));
    expectInactiveLease(storage, 'waiting-tab');
  });

  it('exposes pending recovery without replacing the last applied current data', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    window.localStorage.setItem('isf-main-v2', JSON.stringify(existing));
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'isf-main-v2') throw new Error('quota exceeded');
      MemoryStorage.prototype.setItem.call(window.localStorage, key, value);
    });
    const failedSave = new BrowserMainRepository({ saveMainV2: vi.fn().mockResolvedValue(undefined) });

    await expect(failedSave.save(validData())).rejects.toThrow('quota exceeded');
    const recovered = await new BrowserMainRepository({ saveMainV2: vi.fn() }).load();

    expect(recovered).toMatchObject({ status: 'recovery', current: { updatedAt: 10 } });
    expect(recovered.data?.updatedAt).toBeGreaterThan(10);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v2') ?? '')).toEqual(existing);
  });
});

function createSerialLock() {
  let tail = Promise.resolve();
  const guard = { assertOwned: () => undefined };
  return {
    runExclusive<T>(task: (guard: { assertOwned(): void }) => Promise<T>): Promise<T> {
      const result = tail.then(() => task(guard), () => task(guard));
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

interface ControlledLeaseClock {
  now(): number;
  wait(delayMs: number): Promise<void>;
  pendingWaits(): number;
  releaseNextWait(): Promise<void>;
  setNow(value: number): void;
}

function createControlledLeaseClock(initialNow: number): ControlledLeaseClock {
  let now = initialNow;
  const waiters: Array<{ delayMs: number; resolve: () => void }> = [];
  return {
    now: () => now,
    wait: (delayMs) => new Promise<void>((resolve) => {
      waiters.push({ delayMs, resolve });
    }),
    pendingWaits: () => waiters.length,
    releaseNextWait: async () => {
      const waiter = waiters.shift();
      if (waiter === undefined) throw new Error('Expected a pending lease wait.');
      now += waiter.delayMs;
      waiter.resolve();
      await Promise.resolve();
    },
    setNow: (value) => {
      now = value;
    },
  };
}

function leaseOptions(owner: string, clock: ControlledLeaseClock) {
  return {
    createOwnerToken: () => owner,
    now: clock.now,
    wait: clock.wait,
    yieldAfterClaim: async () => undefined,
    leaseDurationMs: 100,
    acquireTimeoutMs: 500,
    retryDelayMs: 10,
  };
}

function leaseStorageKey(owner: string): string {
  return `isf-workspace-v1-save-lease:${encodeURIComponent(owner)}`;
}

function activeLeaseRecord(owner: string, expiresAt: number, ticket = 1): string {
  return JSON.stringify({
    owner,
    choosing: false,
    ticket,
    expiresAt,
  });
}

function inactiveLeaseRecord(owner: string): string {
  return JSON.stringify({
    owner,
    choosing: false,
    ticket: 0,
    expiresAt: 0,
  });
}

function expectInactiveLease(storage: Storage, owner: string): void {
  expect(storage.getItem(leaseStorageKey(owner))).toBe(inactiveLeaseRecord(owner));
}

function releaseClaim(
  waiters: Array<{ owner: string; resolve: () => void }>,
  owner: string,
): void {
  const index = waiters.findIndex((waiter) => waiter.owner === owner);
  if (index === -1) throw new Error(`Expected a pending claim for ${owner}.`);
  waiters.splice(index, 1)[0]?.resolve();
}

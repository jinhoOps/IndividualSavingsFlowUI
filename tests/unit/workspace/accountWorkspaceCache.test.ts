import {afterEach, describe, expect, it} from 'vitest';
import {createEmptyWorkspace} from '../../../src/workspace/domain/model';
import {AccountWorkspaceCache} from '../../../src/workspace/infrastructure/accountWorkspaceCache';

const namespace = 'project:user:tab';
const oldKey = `isf-account-workspace-v1:${namespace}`;
const key = `isf-account-workspace-v2:${namespace}`;
const pending = {operation: 'save_main' as const, expectedRevision: 0,
  payload: {main: {applied: null, setupProgress: null}}, mutationId: '00000000-0000-4000-8000-000000000001'};
afterEach(() => window.localStorage.clear());

describe('v4 account cache boundary', () => {
  it('converts only the old snapshot envelope and keeps v3 pending as raw recovery, never a v4 retry', () => {
    const snapshot = {...createEmptyWorkspace(1000), schemaVersion: 3};
    const raw = JSON.stringify({version: 1, snapshot, pending, recoveryDrafts: {main: {baseRevision: 0, value: {typed: 123}}}});
    window.localStorage.setItem(oldKey, raw);
    const cache = new AccountWorkspaceCache(namespace, window.localStorage);
    const result = cache.read()!;
    expect(cache.key).toBe(key);
    expect(result.version).toBe(2);
    expect(result.snapshot).toEqual({...snapshot, schemaVersion: 4});
    expect(result.pending).toBeNull();
    expect(result.recoveryDrafts).toEqual({'__legacy-v3-cache__': {baseRevision: 0, value: {key: oldKey, raw}}});
    expect(window.localStorage.getItem(oldKey)).toBe(raw);
    expect(window.localStorage.getItem(key)).toBeNull();
    cache.save(result.snapshot, result.pending, result.recoveryDrafts);
    expect(window.localStorage.getItem(oldKey)).toBe(raw);
    expect(cache.read()).toEqual(result);
  });
  it('keeps malformed old raw data downloadable without making it an editable workspace', () => {
    window.localStorage.setItem(oldKey, '{broken');
    const result = new AccountWorkspaceCache(namespace, window.localStorage).read()!;
    expect(result.snapshot).toBeNull();
    expect(result.pending).toBeNull();
    expect(result.recoveryDrafts['__legacy-v3-cache__'].value).toEqual({key: oldKey, raw: '{broken'});
  });
  it('never falls back to old cache when the new cache exists but is invalid', () => {
    window.localStorage.setItem(oldKey, JSON.stringify({version: 1, snapshot: {...createEmptyWorkspace(1000), schemaVersion: 3}, pending}));
    window.localStorage.setItem(key, '{broken');
    const cache = new AccountWorkspaceCache(namespace, window.localStorage);
    const restored = cache.read()!;
    expect(restored.snapshot).toBeNull();
    expect(restored.pending).toBeNull();
    expect(restored.recoveryDrafts).toEqual({'__invalid-current-cache__': {baseRevision: 0, value: {key, raw: '{broken'}}});
    cache.save(createEmptyWorkspace(2000), null, restored.recoveryDrafts);
    expect(cache.read()?.recoveryDrafts).toEqual(restored.recoveryDrafts);
  });
  it('quarantines damaged current snapshot and original unsent input instead of dropping it on refresh', () => {
    const raw = JSON.stringify({version: 2, snapshot: {broken: true}, pending,
      recoveryDrafts: {main: {baseRevision: 1, value: {typed: 123}}}});
    window.localStorage.setItem(key, raw);
    const cache = new AccountWorkspaceCache(namespace, window.localStorage);
    const restored = cache.read()!;
    expect(restored.snapshot).toBeNull();
    expect(restored.pending).toBeNull();
    cache.save(createEmptyWorkspace(2000), null, restored.recoveryDrafts);
    expect(cache.read()?.recoveryDrafts['__invalid-current-cache__'].value).toEqual({key, raw});
  });
  it('retains current v4 mutation identity for explicit retry and clears both generations on explicit logout', () => {
    const cache = new AccountWorkspaceCache(namespace, window.localStorage);
    window.localStorage.setItem(oldKey, 'old');
    window.localStorage.setItem('isf-account-workspace-v1:other:user:tab', 'keep');
    cache.save(createEmptyWorkspace(1000), pending, {});
    expect(cache.read()?.pending).toEqual(pending);
    cache.clear();
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(oldKey)).toBeNull();
    expect(window.localStorage.getItem('isf-account-workspace-v1:other:user:tab')).toBe('keep');
  });
});

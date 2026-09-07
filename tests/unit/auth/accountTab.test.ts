import {afterEach, expect, it} from 'vitest';
import {accountCacheKeys, accountRecoveryRecords, hasAccountRecovery} from '../../../src/auth/accountTab';

afterEach(() => window.localStorage.clear());
it('exports previous-tab recovery for only the current account without its cached server snapshot', () => {
  const prefix = 'isf-account-workspace-v1:project:user-a';
  window.localStorage.setItem(`${prefix}:closed-tab`, JSON.stringify({snapshot: {financial: 'saved'}, pending: null, recoveryDrafts: {main: {baseRevision: 1, value: {typed: '1300000'}}}}));
  window.localStorage.setItem('isf-account-workspace-v1:project:user-b:other', JSON.stringify({pending: {private: true}}));
  window.localStorage.setItem('isf-workspace-v3', 'migration-original');
  expect(hasAccountRecovery(window.localStorage, prefix)).toBe(true);
  expect(accountRecoveryRecords(window.localStorage, prefix)).toEqual([{key: `${prefix}:closed-tab`, pending: null,
    drafts: {main: {baseRevision: 1, value: {typed: '1300000'}}}}]);
  expect(accountCacheKeys(window.localStorage, prefix)).toEqual([`${prefix}:closed-tab`]);
});

it('keeps malformed account recovery available as raw export without parsing or sending it', () => {
  const prefix = 'isf-account-workspace-v1:project:user-a';
  window.localStorage.setItem(`${prefix}:old`, '{broken');
  expect(hasAccountRecovery(window.localStorage, prefix)).toBe(true);
  expect(accountRecoveryRecords(window.localStorage, prefix)).toEqual([{key: `${prefix}:old`, raw: '{broken'}]);
});

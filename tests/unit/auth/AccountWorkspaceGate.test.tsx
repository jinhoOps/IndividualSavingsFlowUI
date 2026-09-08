import React from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AccountWorkspaceGate} from '../../../src/auth/AccountWorkspaceGate';

const config = {url: 'https://example.supabase.co', publishableKey: 'sb_publishable_public', projectRef: 'example'};
afterEach(() => {cleanup(); window.localStorage.clear();});
function client(user: boolean, read: () => Promise<{data: unknown; error: unknown}>): SupabaseClient {
  return {auth: {
    getSession: async () => ({data: {session: user ? {user: {id: 'user-a', email: 'a@example.com'}, access_token: 'token-a'} : null}, error: null}),
    onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
  }, from: () => ({select: () => ({eq: () => ({maybeSingle: () => ({setHeader: () => ({retry: read})})})})})} as unknown as SupabaseClient;
}
describe('account workspace gate', () => {
  it('never mounts financial UI before sign-in', async () => {
    render(<AccountWorkspaceGate config={config} client={client(false, async () => ({data: null, error: null}))}>{() => <p>Financial data</p>}</AccountWorkspaceGate>);
    expect(screen.queryByText('Financial data')).toBeNull();
    expect(await screen.findByRole('button', {name: 'Google로 계속하기'})).toBeTruthy();
    expect(screen.queryByText('Financial data')).toBeNull();
  });
  it('rejects a password login without mounting financial UI and clears the password', async () => {
    const supplied = client(false, async () => ({data: null, error: null}));
    supplied.auth.signInWithPassword = vi.fn().mockResolvedValue({data: {session: null}, error: {code: 'invalid_credentials'}});
    render(<AccountWorkspaceGate config={config} client={supplied}>{() => <p>Financial data</p>}</AccountWorkspaceGate>);
    fireEvent.change(await screen.findByLabelText('이메일'), {target: {value: 'a@example.com'}});
    fireEvent.change(screen.getByLabelText('비밀번호'), {target: {value: 'fixture-password'}});
    fireEvent.submit(screen.getByRole('form', {name: '임시 이메일 로그인'}));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText('Financial data')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
  it('blocks repeated submits and Google while signing in, then allows retry after a network error', async () => {
    let fail!: (error: Error) => void;
    const supplied = client(false, async () => ({data: null, error: null}));
    const pending = new Promise((_resolve, reject) => {fail = reject;});
    const signIn = vi.fn().mockReturnValue(pending);
    supplied.auth.signInWithPassword = signIn;
    render(<AccountWorkspaceGate config={config} client={supplied}>{() => <p>Financial data</p>}</AccountWorkspaceGate>);
    fireEvent.change(await screen.findByLabelText('이메일'), {target: {value: 'a@example.com'}});
    fireEvent.change(screen.getByLabelText('비밀번호'), {target: {value: 'fixture-password'}});
    const form = screen.getByRole('form', {name: '임시 이메일 로그인'});
    fireEvent.submit(form); fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', {name: 'Google로 계속하기'}) as HTMLButtonElement).disabled).toBe(true);
    fail(new TypeError('network failed'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('button', {name: '이메일로 로그인'}) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('Financial data')).toBeNull();
  });
  it('requires an explicit first plan choice when the server is empty', async () => {
    render(<AccountWorkspaceGate config={config} client={client(true, async () => ({data: null, error: null}))}>{() => <p>Financial data</p>}</AccountWorkspaceGate>);
    expect(await screen.findByRole('button', {name: '새로 시작'})).toBeTruthy();
    expect(screen.queryByText('Financial data')).toBeNull();
  });
  it('shows retry instead of creating a blank workspace on a failed read', async () => {
    let reads = 0;
    render(<AccountWorkspaceGate config={config} client={client(true, async () => {reads++; return {data: null, error: {status: 503}};})}>{() => <p>Financial data</p>}</AccountWorkspaceGate>);
    fireEvent.click(await screen.findByRole('button', {name: '다시 불러오기'}));
    await waitFor(() => expect(reads).toBe(2));
    expect(screen.queryByRole('button', {name: '새로 시작'})).toBeNull();
    expect(screen.queryByText('Financial data')).toBeNull();
  });
});

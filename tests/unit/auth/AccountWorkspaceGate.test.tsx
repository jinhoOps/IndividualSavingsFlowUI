import React from 'react';
import {afterEach, describe, expect, it} from 'vitest';
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

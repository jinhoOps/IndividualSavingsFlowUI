import {describe, expect, it, vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createWorkspaceRemote} from '../../../src/workspace/infrastructure/workspaceRemote';

function fixture(response = {data: {status: 'saved'}, error: null as unknown, status: 200}) {
  const headers: Record<string, string> = {};
  const request = {
    setHeader(name: string, value: string) {headers[name] = value; return this;},
    retry() {return this;},
    then: Promise.resolve(response).then.bind(Promise.resolve(response)),
  };
  const session = {user: {id: 'a'}, access_token: 'token-a'};
  const rpc = vi.fn(() => request);
  const client = {auth: {getSession: async () => ({data: {session}, error: null})}, rpc,
    from: () => ({select: () => ({eq: () => ({maybeSingle: () => request})})})};
  return {remote: createWorkspaceRemote(client as unknown as SupabaseClient, 'a'), session, headers, rpc};
}
describe('workspace remote account-bound requests', () => {
  it('does not send an old account payload with a new account session', async () => {
    const {remote, session, rpc} = fixture();
    session.user.id = 'b'; session.access_token = 'token-b';
    await expect(remote.write('save_main', 0, {}, 'mutation')).rejects.toMatchObject({status: 401});
    expect(rpc).not.toHaveBeenCalled();
  });
  it('pins the validated account token on each request despite later SDK token resolution', async () => {
    const {remote, headers} = fixture();
    await remote.write('save_main', 0, {}, 'mutation');
    expect(headers.Authorization).toBe('Bearer token-a');
    await remote.read();
    expect(headers.Authorization).toBe('Bearer token-a');
  });
  it('preserves HTTP 401 even for unrecognized JWT error codes', async () => {
    const {remote} = fixture({data: {status: ''}, error: {code: 'PGRST303', message: 'JWT claims validation failed'}, status: 401});
    await expect(remote.read()).rejects.toMatchObject({status: 401, code: 'PGRST303'});
    await expect(remote.write('save_main', 0, {}, 'mutation')).rejects.toMatchObject({status: 401});
  });
});

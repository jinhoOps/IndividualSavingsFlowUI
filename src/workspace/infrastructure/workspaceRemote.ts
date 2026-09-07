import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceDocument } from '../domain/model';
import { parseWorkspaceDocument } from '../domain/validation';

export type WorkspacePayload = Pick<WorkspaceDocument, 'main' | 'simulation' | 'portfolio' | 'locations' | 'accountMap'>;
export type WorkspaceOperation = 'initialize_workspace' | 'save_main' | 'save_simulation' | 'save_portfolio' | 'save_account_map' | 'restore_workspace';
export interface RemoteCommit {
  status: 'saved' | 'exists' | 'conflict' | 'invalid';
  workspace?: unknown;
  committed_revision?: number;
}
export interface WorkspaceRemote {
  read(): Promise<unknown | null>;
  write(operation: WorkspaceOperation, expectedRevision: number | null, payload: Partial<WorkspacePayload>, mutationId: string): Promise<RemoteCommit>;
}
export function workspacePayload(workspace: WorkspaceDocument): WorkspacePayload {
  const {main, simulation, portfolio, locations, accountMap} = workspace;
  return structuredClone({main, simulation, portfolio, locations, accountMap});
}
export function workspaceFromRow(value: unknown, userId: string): WorkspaceDocument | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (row.user_id !== userId || row.schema_version !== 3 || typeof row.updated_at !== 'string'
    || typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload)) return null;
  const revision = typeof row.revision === 'string' && /^\d+$/.test(row.revision) ? Number(row.revision) : row.revision;
  const payload = row.payload as Record<string, unknown>;
  if (Object.keys(payload).sort().join(',') !== 'accountMap,locations,main,portfolio,simulation') return null;
  return parseWorkspaceDocument({...payload, schemaVersion: 3, revision, updatedAt: Date.parse(row.updated_at)});
}
export function createWorkspaceRemote(client: SupabaseClient, userId: string): WorkspaceRemote {
  async function authorization(): Promise<string> {
    const {data, error} = await client.auth.getSession();
    if (error || data.session?.user.id !== userId || !data.session.access_token) {
      throw {status: 401, code: 'ACCOUNT_SESSION_CHANGED'};
    }
    // Pin this account's token: the shared SDK may resolve a different session
    // while a queued request waits. A late A request must never write as B.
    return `Bearer ${data.session.access_token}`;
  }
  return {
    async read() {
      const token = await authorization();
      const {data, error, status} = await client.from('user_workspaces').select('*').eq('user_id', userId).maybeSingle().setHeader('Authorization', token).retry(false);
      if (error) throw {...error, status};
      return data;
    },
    async write(operation, revision, payload, mutationId) {
      const token = await authorization();
      const {data, error, status} = await client.rpc(operation, {
        p_payload: payload, p_mutation_id: mutationId,
        ...(operation === 'initialize_workspace' ? {} : {p_expected_revision: revision}),
      }).setHeader('Authorization', token).retry(false);
      if (error) throw {...error, status};
      if (!data || !['saved', 'exists', 'conflict', 'invalid'].includes(data.status)) throw new Error('Invalid workspace response');
      return data as RemoteCommit;
    },
  };
}

import {
  applyAccountMapCommand,
  type AccountMapCommand,
  type AccountMapCommandError,
} from '../domain/commands';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceLoadResult,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';

export type AccountMapWriteResult =
  | { status: 'saved'; workspace: WorkspaceDocument }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'rejected'; reason: AccountMapCommandError; locationId?: string }
  | { status: 'invalid' | 'unavailable' };

export interface AccountMapRepository {
  load(): WorkspaceLoadResult;
  save(expectedRevision: number, command: AccountMapCommand): Promise<AccountMapWriteResult>;
  migrate(expectedRevision: number): Promise<AccountMapWriteResult>;
  reset(expectedRevision: number): Promise<AccountMapWriteResult>;
}

export class BrowserAccountMapRepository implements AccountMapRepository {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository(),
    private readonly now: () => number = Date.now,
  ) {}

  load(): WorkspaceLoadResult {
    return this.workspaceRepository.load();
  }

  async save(expectedRevision: number, command: AccountMapCommand): Promise<AccountMapWriteResult> {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') return { status: loaded.status };
    if (loaded.workspace.revision !== expectedRevision) {
      return { status: 'conflict', currentRevision: loaded.workspace.revision };
    }
    const candidate = applyAccountMapCommand(loaded.workspace, command, this.now());
    if (!candidate.ok) {
      return {
        status: 'rejected',
        reason: candidate.reason,
        ...(candidate.locationId === undefined ? {} : { locationId: candidate.locationId }),
      };
    }
    return await this.workspaceRepository.replace(expectedRevision, candidate.workspace);
  }

  async migrate(expectedRevision: number): Promise<AccountMapWriteResult> {
    return await this.workspaceRepository.migrate(expectedRevision);
  }

  async reset(expectedRevision: number): Promise<AccountMapWriteResult> {
    return await this.save(expectedRevision, { type: 'reset-map' });
  }
}

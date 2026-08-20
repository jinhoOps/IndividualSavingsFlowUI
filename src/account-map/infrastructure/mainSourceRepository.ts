import type { MainData } from '../../main/domain/model';
import { isMainDataShape, validateMainData } from '../../main/domain/validation';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';

export type AccountMapMainSourceLoadResult =
  | { status: 'found'; data: MainData }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface AccountMapMainSourceRepository {
  load(): AccountMapMainSourceLoadResult;
}

export class BrowserAccountMapMainSourceRepository implements AccountMapMainSourceRepository {
  constructor(
    private readonly workspaceRepository: Pick<WorkspaceRepository, 'load'> = new BrowserWorkspaceRepository(),
  ) {}

  load(): AccountMapMainSourceLoadResult {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') return { status: loaded.status };
    const applied = loaded.workspace.main.applied;
    if (applied === null) return { status: 'empty' };
    if (!isMainDataShape(applied) || !validateMainData(applied).valid) return { status: 'invalid' };
    return { status: 'found', data: structuredClone(applied) };
  }
}

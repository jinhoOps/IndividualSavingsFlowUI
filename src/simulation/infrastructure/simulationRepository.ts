import {
  BrowserWorkspaceRepository,
  type WorkspaceLoadResult,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';
import type { CompoundSimulationDraft, SimulationDraftMigration } from '../domain/model';
import { parseSimulationDraft } from '../domain/validation';

export type SimulationLoadResult =
  | {
    status: 'found';
    draft: CompoundSimulationDraft;
    migration: SimulationDraftMigration | null;
  }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export type SimulationSaveResult = { status: 'saved' } | { status: 'unavailable' };
export type SimulationClearResult = { status: 'cleared' } | { status: 'unavailable' };

export interface SimulationRepository {
  load(): SimulationLoadResult;
  save(draft: CompoundSimulationDraft): Promise<SimulationSaveResult>;
  clear(): Promise<SimulationClearResult>;
}

export class BrowserSimulationRepository implements SimulationRepository {
  private draftBase: CompoundSimulationDraft | null | typeof untrackedBase = untrackedBase;

  constructor(
    private readonly workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository(),
  ) {}

  load(): SimulationLoadResult {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') {
      this.draftBase = untrackedBase;
      return { status: loaded.status };
    }
    const draft = loaded.workspace.simulation.draft;
    this.draftBase = cloneDraft(draft);
    return draft === null
      ? { status: 'empty' }
      : {
          status: 'found',
          draft: structuredClone(draft),
          migration: loaded.status === 'found'
            ? (loaded.simulationMigration ?? (loaded.needsMigration ? 'schema-upgraded' : null))
            : null,
        };
  }

  async save(draft: CompoundSimulationDraft): Promise<SimulationSaveResult> {
    const parsed = parseSimulationDraft(draft);
    if (parsed === null || this.draftBase === untrackedBase) return { status: 'unavailable' };
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (loaded === null || !sameDraft(loaded.workspace.simulation.draft, this.draftBase)) {
      return { status: 'unavailable' };
    }
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        simulation: { draft: structuredClone(parsed) },
      }),
    );
    if (result.status !== 'saved') return { status: 'unavailable' };
    this.draftBase = cloneDraft(result.workspace.simulation.draft);
    return { status: 'saved' };
  }

  async clear(): Promise<SimulationClearResult> {
    if (this.draftBase === untrackedBase) return { status: 'unavailable' };
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (loaded === null || !sameDraft(loaded.workspace.simulation.draft, this.draftBase)) {
      return { status: 'unavailable' };
    }
    if (loaded.workspace.simulation.draft === null) {
      this.draftBase = null;
      return { status: 'cleared' };
    }
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({ ...current, simulation: { draft: null } }),
    );
    if (result.status !== 'saved') return { status: 'unavailable' };
    this.draftBase = null;
    return { status: 'cleared' };
  }
}

const untrackedBase = Symbol('untracked Simulation workspace slice');

function loadWritableWorkspace(repository: WorkspaceRepository): Extract<WorkspaceLoadResult, {
  status: 'found' | 'empty';
}> | null {
  const loaded = repository.load();
  return loaded.status === 'found' || loaded.status === 'empty' ? loaded : null;
}

function cloneDraft(draft: CompoundSimulationDraft | null): CompoundSimulationDraft | null {
  return draft === null ? null : structuredClone(draft);
}

function sameDraft(
  left: CompoundSimulationDraft | null,
  right: CompoundSimulationDraft | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

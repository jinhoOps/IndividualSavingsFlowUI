import {
  archiveLocation,
  createLocation,
  renameLocation,
  type LocationCommandDependencies,
  type LocationCommandError,
  type LocationCommandResult,
  type PortfolioReferenceDisposition,
} from '../../workspace/domain/locationCommands';
import {
  normalizeLocationName,
  type FinancialLocation,
  type FinancialLocationKind,
  type InstitutionRef,
} from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
  type WorkspaceWriteResult,
} from '../../workspace/infrastructure/workspaceRepository';

export type LocationWriteError = LocationCommandError | 'conflict' | 'unavailable';

export type LocationWriteResult =
  | { status: 'saved'; location: FinancialLocation }
  | {
    status: LocationWriteError;
    referencedScopes?: string[];
  };

export interface InvestmentLocationRepository {
  list(): FinancialLocation[];
  create(input: {
    shortName: string;
    institution?: InstitutionRef;
    kind: FinancialLocationKind;
  }): Promise<LocationWriteResult>;
  rename(id: string, shortName: string): Promise<LocationWriteResult>;
  archive(
    id: string,
    disposition?: PortfolioReferenceDisposition,
  ): Promise<LocationWriteResult>;
  subscribe(listener: (locations: FinancialLocation[]) => void): () => void;
}

export class BrowserInvestmentLocationRepository implements InvestmentLocationRepository {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository(),
    private readonly dependencies: Partial<LocationCommandDependencies> = {},
  ) {}

  list(): FinancialLocation[] {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') return [];
    return selectInvestmentLocations(loaded.workspace.locations);
  }

  async create(input: {
    shortName: string;
    institution?: InstitutionRef;
    kind: FinancialLocationKind;
  }): Promise<LocationWriteResult> {
    return await this.run((workspace) => createLocation(workspace, {
      ...input,
      roles: ['investing'],
    }, this.dependencies));
  }

  async rename(id: string, shortName: string): Promise<LocationWriteResult> {
    return await this.run((workspace) => renameLocation(
      workspace,
      id,
      shortName,
      this.dependencies.now?.() ?? Date.now(),
    ));
  }

  async archive(
    id: string,
    disposition?: PortfolioReferenceDisposition,
  ): Promise<LocationWriteResult> {
    return await this.run((workspace) => archiveLocation(
      workspace,
      id,
      disposition,
      this.dependencies.now?.() ?? Date.now(),
    ));
  }

  subscribe(listener: (locations: FinancialLocation[]) => void): () => void {
    return this.workspaceRepository.subscribe((workspace) => {
      listener(selectInvestmentLocations(workspace.locations));
    });
  }

  private async run(
    command: (workspace: WorkspaceDocument) => LocationCommandResult,
  ): Promise<LocationWriteResult> {
    try {
      const loaded = this.workspaceRepository.load();
      if (loaded.status === 'invalid' || loaded.status === 'unavailable') {
        return { status: 'unavailable' };
      }
      const commandResult = command(loaded.workspace);
      if (!commandResult.ok) return commandFailure(commandResult);

      const writeResult = await this.workspaceRepository.update(
        loaded.workspace.revision,
        () => commandResult.workspace,
      );
      return writeOutcome(writeResult, commandResult.location.id);
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function selectInvestmentLocations(locations: FinancialLocation[]): FinancialLocation[] {
  return locations
    .filter((location) => location.archivedAt === undefined
      && location.roles.includes('investing'))
    .map((location) => structuredClone(location))
    .sort((left, right) => normalizedCompare(left, right));
}

function normalizedCompare(left: FinancialLocation, right: FinancialLocation): number {
  const byName = normalizeLocationName(left.shortName).localeCompare(
    normalizeLocationName(right.shortName),
    'ko-KR',
    { numeric: true },
  );
  return byName === 0 ? left.id.localeCompare(right.id) : byName;
}

function commandFailure(
  result: Extract<LocationCommandResult, { ok: false }>,
): LocationWriteResult {
  return {
    status: result.reason,
    ...(result.referencedScopes === undefined
      ? {}
      : { referencedScopes: [...result.referencedScopes] }),
  };
}

function writeOutcome(
  result: WorkspaceWriteResult,
  locationId: string,
): LocationWriteResult {
  if (result.status !== 'saved') {
    if (result.status === 'conflict') return { status: 'conflict' };
    if (result.status === 'invalid') return { status: 'invalid-input' };
    return { status: 'unavailable' };
  }
  const location = result.workspace.locations.find(({ id }) => id === locationId);
  return location === undefined
    ? { status: 'unavailable' }
    : { status: 'saved', location: structuredClone(location) };
}

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
import {
  countDisplayCharacters,
  type FinancialLocation,
  type FinancialLocationKind,
} from '../../workspace/domain/financialLocation';
import {
  BrowserInvestmentLocationRepository,
  type InvestmentLocationRepository,
  type LocationPortfolioStatus,
  type LocationWriteError,
  type LocationWriteResult,
} from '../infrastructure/locationRepository';
import { PortfolioDialog } from './PortfolioDialog';

interface RenameState {
  id: string;
  sourceShortName: string;
  value: string;
  pending: boolean;
  error?: string;
}

interface ArchiveState {
  location: FinancialLocation;
  disposition: 'preserve' | 'delete';
  pending: boolean;
  error?: string;
}

interface DirectArchiveState {
  id: string;
  pending: boolean;
  error?: string;
}

export function InvestmentLocations({
  repository: providedRepository,
}: {
  repository?: InvestmentLocationRepository;
}) {
  const repositoryRef = useRef<InvestmentLocationRepository | null>(null);
  if (providedRepository === undefined && repositoryRef.current === null) {
    repositoryRef.current = new BrowserInvestmentLocationRepository();
  }
  const repository = providedRepository ?? repositoryRef.current!;
  const [locations, setLocations] = useState(() => repository.list());
  const [shortName, setShortName] = useState('');
  const [kind, setKind] = useState<FinancialLocationKind>('brokerage');
  const [institution, setInstitution] = useState('');
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [linkCandidate, setLinkCandidate] = useState<FinancialLocation>();
  const [rename, setRename] = useState<RenameState>();
  const [archive, setArchive] = useState<ArchiveState>();
  const [directArchive, setDirectArchive] = useState<DirectArchiveState>();
  const [focusHeadingAfterArchive, setFocusHeadingAfterArchive] = useState(false);
  const [locationErrors, setLocationErrors] = useState<Record<string, string>>({});
  const [syncNotice, setSyncNotice] = useState<string>();
  const [settlementGeneration, setSettlementGeneration] = useState(0);
  const archiveReturnFocusRef = useRef<HTMLElement | null>(null);
  const locationHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setLocations(repository.list());
    return repository.subscribe(setLocations);
  }, [repository]);

  useEffect(() => {
    let closedStaleWork = false;
    if (rename !== undefined && !rename.pending) {
      const currentLocation = locations.find((location) => location.id === rename.id);
      if (currentLocation === undefined) {
        setRename(undefined);
        closedStaleWork = true;
      } else if (currentLocation.shortName !== rename.sourceShortName) {
        setRename({
          ...rename,
          sourceShortName: currentLocation.shortName,
          value: currentLocation.shortName,
        });
      }
    }
    if (directArchive !== undefined && !directArchive.pending) {
      const currentLocation = locations.find((location) => location.id === directArchive.id);
      setDirectArchive(undefined);
      if (currentLocation === undefined) {
        archiveReturnFocusRef.current = null;
        closedStaleWork = true;
      } else {
        setLocationError(directArchive.id, directArchive.error);
      }
    }
    if (archive !== undefined && !archive.pending) {
      const currentLocation = locations.find((location) => location.id === archive.location.id);
      if (currentLocation === undefined) {
        archiveReturnFocusRef.current = null;
        setArchive(undefined);
        closedStaleWork = true;
      } else if (currentLocation.shortName !== archive.location.shortName
        || currentLocation.updatedAt !== archive.location.updatedAt) {
        setArchive({ ...archive, location: currentLocation });
      }
    }
    if (closedStaleWork) {
      setSyncNotice('다른 화면에서 위치가 변경되어 작업을 닫았습니다.');
      setFocusHeadingAfterArchive(true);
    }
  }, [locations, settlementGeneration]);

  useEffect(() => {
    if (!focusHeadingAfterArchive || archive !== undefined) return;
    locationHeadingRef.current?.focus();
    setFocusHeadingAfterArchive(false);
  }, [archive, focusHeadingAfterArchive]);

  async function addLocation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (createPending) return;
    setCreatePending(true);
    setCreateError(undefined);
    setLinkCandidate(undefined);
    const trimmedInstitution = institution.trim().replace(/\s+/gu, ' ');
    const result = await repository.create({
      shortName,
      ...(trimmedInstitution.length === 0
        ? {}
        : { institution: { name: trimmedInstitution } }),
      kind,
    });
    setCreatePending(false);
    if (result.status !== 'saved') {
      setCreateError(writeErrorMessage(result.status));
      if (result.existingLocation !== undefined) {
        setLinkCandidate(result.existingLocation);
      }
      return;
    }
    setShortName('');
    setInstitution('');
    setKind('brokerage');
    refreshLocations();
  }

  async function linkExistingLocation(): Promise<void> {
    if (createPending || linkCandidate === undefined) return;
    setCreatePending(true);
    setCreateError(undefined);
    const result = await repository.link(linkCandidate.id);
    setCreatePending(false);
    if (result.status !== 'saved') {
      if (result.status === 'stale-location' || result.status === 'location-not-found') {
        setLinkCandidate(undefined);
        setCreateError('기존 위치가 다른 화면에서 변경되었습니다. 다시 확인해 주세요.');
        refreshLocations();
        return;
      }
      setCreateError(writeErrorMessage(result.status));
      return;
    }
    setShortName('');
    setInstitution('');
    setKind('brokerage');
    setLinkCandidate(undefined);
    refreshLocations();
  }

  async function saveRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (rename === undefined || rename.pending) return;
    const current = rename;
    setRename({ ...current, pending: true, error: undefined });
    const result = await repository.rename(current.id, current.value);
    if (result.status !== 'saved') {
      if (result.status === 'stale-location' || result.status === 'location-not-found') {
        closeStaleOperation();
        return;
      }
      setRename({
        ...current,
        pending: false,
        error: writeErrorMessage(result.status),
      });
      setSettlementGeneration((generation) => generation + 1);
      return;
    }
    setRename(undefined);
    refreshLocations();
  }

  async function requestArchive(
    location: FinancialLocation,
    event: MouseEvent<HTMLButtonElement>,
  ): Promise<void> {
    archiveReturnFocusRef.current = event.currentTarget;
    setLocationError(location.id, undefined);
    setDirectArchive({ id: location.id, pending: true });
    const result = await repository.archive(location.id);
    if (result.status === 'saved') {
      setDirectArchive(undefined);
      setFocusHeadingAfterArchive(true);
      refreshLocations();
      return;
    }
    if (result.status === 'portfolio-reference') {
      setDirectArchive(undefined);
      setArchive({ location, disposition: 'preserve', pending: false });
      return;
    }
    if (result.status === 'stale-location' || result.status === 'location-not-found') {
      setDirectArchive(undefined);
      archiveReturnFocusRef.current = null;
      closeStaleOperation();
      return;
    }
    setDirectArchive({
      id: location.id,
      pending: false,
      error: writeErrorMessage(result.status),
    });
    setSettlementGeneration((generation) => generation + 1);
  }

  async function confirmArchive(): Promise<void> {
    if (archive === undefined || archive.pending) return;
    const current = archive;
    setArchive({ ...current, pending: true, error: undefined });
    const result = await repository.archive(current.location.id, current.disposition);
    if (result.status !== 'saved') {
      if (result.status === 'stale-location' || result.status === 'location-not-found') {
        archiveReturnFocusRef.current = null;
        closeStaleOperation();
        return;
      }
      setArchive({
        ...current,
        pending: false,
        error: writeErrorMessage(result.status),
      });
      setSettlementGeneration((generation) => generation + 1);
      return;
    }
    setFocusHeadingAfterArchive(true);
    setArchive(undefined);
    refreshLocations();
  }

  function refreshLocations(): void {
    setLocations(repository.list());
  }

  function closeStaleOperation(): void {
    setRename(undefined);
    setArchive(undefined);
    setSyncNotice('다른 화면에서 위치가 변경되어 작업을 닫았습니다.');
    setFocusHeadingAfterArchive(true);
    refreshLocations();
  }

  function setLocationError(id: string, message: string | undefined): void {
    setLocationErrors((current) => {
      const next = { ...current };
      if (message === undefined) delete next[id];
      else next[id] = message;
      return next;
    });
  }

  const createErrorId = createError === undefined ? undefined : 'investment-location-create-error';
  const createCounterId = 'investment-location-name-counter';

  return (
    <Surface
      as="section"
      className="portfolio-locations"
      aria-labelledby="investment-locations-title"
    >
      <header className="portfolio-locations__header">
        <div>
          <p>공유 위치</p>
          <h2 ref={locationHeadingRef} id="investment-locations-title" tabIndex={-1}>
            투자 위치
          </h2>
        </div>
        <p>전체 기준 배분은 그대로 유지됩니다</p>
      </header>

      {syncNotice === undefined ? null : (
        <p className="portfolio-locations__error" role="alert">{syncNotice}</p>
      )}

      {locations.length === 0 ? (
        <p className="portfolio-locations__empty">아직 등록한 투자 위치가 없습니다.</p>
      ) : (
        <ul className="portfolio-locations__list">
          {locations.map((location) => {
            const renaming = rename?.id === location.id;
            const errorId = locationErrors[location.id] === undefined
              ? undefined
              : `investment-location-${location.id}-error`;
            return (
              <li className="portfolio-locations__item" key={location.id}>
                <div className="portfolio-locations__identity">
                  <strong>{location.shortName}</strong>
                  <span>{location.institution?.name ?? kindLabel(location.kind)}</span>
                </div>
                <Button type="button" variant="quiet" disabled>
                  {portfolioStatusLabel(location.portfolioStatus)}
                </Button>
                <div className="portfolio-locations__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`${location.shortName} 이름 바꾸기`}
                    aria-expanded={renaming}
                    onClick={() => {
                      setRename(renaming ? undefined : {
                        id: location.id,
                        sourceShortName: location.shortName,
                        value: location.shortName,
                        pending: false,
                      });
                      setLocationError(location.id, undefined);
                    }}
                  >
                    이름 변경
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={directArchive?.id === location.id && directArchive.pending}
                    aria-label={`${location.shortName} 보관하기`}
                    aria-describedby={errorId}
                    onClick={(event) => void requestArchive(location, event)}
                  >
                    보관
                  </Button>
                </div>
                {renaming ? (
                  <form className="portfolio-locations__rename" onSubmit={(event) => void saveRename(event)}>
                    <label>
                      <span>{location.shortName} 새 이름</span>
                      <input
                        value={rename.value}
                        maxLength={8}
                        required
                        disabled={rename.pending}
                        aria-describedby={rename.error === undefined
                          ? undefined
                          : `investment-location-${location.id}-rename-error`}
                        onChange={(event) => setRename({
                          ...rename,
                          value: event.target.value,
                          error: undefined,
                        })}
                      />
                    </label>
                    <span className="portfolio-locations__counter">
                      {countDisplayCharacters(rename.value)}/8자
                    </span>
                    {rename.error === undefined ? null : (
                      <p
                        id={`investment-location-${location.id}-rename-error`}
                        className="portfolio-locations__error"
                        role="alert"
                      >
                        {rename.error}
                      </p>
                    )}
                    <div className="portfolio-locations__form-actions">
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={rename.pending}
                        onClick={() => setRename(undefined)}
                      >
                        취소
                      </Button>
                      <Button type="submit" variant="primary" disabled={rename.pending}>
                        이름 저장
                      </Button>
                    </div>
                  </form>
                ) : null}
                {errorId === undefined ? null : (
                  <p id={errorId} className="portfolio-locations__error" role="alert">
                    {locationErrors[location.id]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="portfolio-locations__create"
        aria-busy={createPending}
        onSubmit={(event) => void addLocation(event)}
      >
        <h3>투자 위치 추가</h3>
        <div className="portfolio-locations__fields">
          <div className="portfolio-locations__field">
            <label>
              <span>짧은 이름</span>
              <input
                value={shortName}
                maxLength={8}
                required
                disabled={createPending}
                aria-describedby={[createCounterId, createErrorId].filter(Boolean).join(' ') || undefined}
                onChange={(event) => {
                  setShortName(event.target.value);
                  setCreateError(undefined);
                  setLinkCandidate(undefined);
                }}
              />
            </label>
            <span id={createCounterId} className="portfolio-locations__counter">
              {countDisplayCharacters(shortName)}/8자
            </span>
          </div>
          <label>
            <span>형태</span>
            <select
              value={kind}
              disabled={createPending}
              onChange={(event) => setKind(event.target.value as FinancialLocationKind)}
            >
              <option value="bank">은행</option>
              <option value="brokerage">증권</option>
              <option value="cash">현금</option>
            </select>
          </label>
          <label>
            <span>기관 (선택)</span>
            <input
              type="search"
              value={institution}
              disabled={createPending}
              onChange={(event) => {
                setInstitution(event.target.value);
                setCreateError(undefined);
                setLinkCandidate(undefined);
              }}
            />
          </label>
        </div>
        {createError === undefined ? null : (
          <p id={createErrorId} className="portfolio-locations__error" role="alert">
            {createError}
          </p>
        )}
        {linkCandidate === undefined ? null : (
          <p className="portfolio-locations__link-candidate">
            {linkCandidate.shortName} 공유 위치를 투자 위치로 연결할 수 있습니다.
          </p>
        )}
        <div className="portfolio-locations__form-actions">
          {linkCandidate === undefined ? null : (
            <Button
              type="button"
              variant="secondary"
              disabled={createPending}
              onClick={() => void linkExistingLocation()}
            >
              기존 위치 연결
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={createPending}>
            투자 위치 추가
          </Button>
        </div>
      </form>

      {archive === undefined ? null : (
        <PortfolioDialog
          labelledBy="investment-location-archive-title"
          returnFocusRef={archiveReturnFocusRef}
          onClose={() => {
            if (!archive.pending) setArchive(undefined);
          }}
        >
          <div aria-busy={archive.pending}>
            <h2 id="investment-location-archive-title">
              {archive.location.shortName} 위치를 보관할까요?
            </h2>
            <p>연결된 Portfolio 데이터도 함께 삭제할까요?</p>
            <fieldset className="portfolio-locations__disposition" disabled={archive.pending}>
              <legend>Portfolio 데이터</legend>
              <label>
                <input
                  type="radio"
                  name="portfolio-location-disposition"
                  value="preserve"
                  checked={archive.disposition === 'preserve'}
                  onChange={() => setArchive({ ...archive, disposition: 'preserve' })}
                />
                Portfolio 데이터 유지
              </label>
              <label>
                <input
                  type="radio"
                  name="portfolio-location-disposition"
                  value="delete"
                  checked={archive.disposition === 'delete'}
                  onChange={() => setArchive({ ...archive, disposition: 'delete' })}
                />
                Portfolio 데이터 삭제
              </label>
            </fieldset>
            {archive.error === undefined ? null : (
              <p className="portfolio-locations__error" role="alert">{archive.error}</p>
            )}
            <div className="portfolio-locations__form-actions">
              <Button
                type="button"
                variant="secondary"
                data-dialog-initial-focus
                aria-disabled={archive.pending}
                onClick={() => {
                  if (!archive.pending) setArchive(undefined);
                }}
              >
                취소
              </Button>
              <Button
                type="button"
                variant="primary"
                aria-disabled={archive.pending}
                onClick={() => void confirmArchive()}
              >
                보관
              </Button>
            </div>
          </div>
        </PortfolioDialog>
      )}
    </Surface>
  );
}

function kindLabel(kind: FinancialLocationKind): string {
  if (kind === 'bank') return '은행';
  if (kind === 'brokerage') return '증권';
  return '현금';
}

function portfolioStatusLabel(status: LocationPortfolioStatus): string {
  if (status === 'applied') return '배분 데이터 있음';
  if (status === 'draft') return '배분 초안 있음';
  if (status === 'applied-and-draft') return '배분 데이터 및 초안 있음';
  return '아직 배분하지 않음';
}

function writeErrorMessage(status: LocationWriteResult['status']): string {
  const messages: Record<LocationWriteError, string> = {
    'duplicate-name': '이미 같은 이름의 위치가 있습니다.',
    'name-required': '짧은 이름을 입력해 주세요.',
    'name-too-long': '짧은 이름은 8자까지 입력할 수 있습니다.',
    'purpose-capacity': '투자 위치는 최대 10개까지 추가할 수 있습니다.',
    'location-not-found': '이 위치를 찾을 수 없습니다.',
    'stale-location': '이 위치가 다른 화면에서 변경되었습니다. 다시 확인해 주세요.',
    'portfolio-reference': '연결된 Portfolio 데이터 처리 방법을 선택해 주세요.',
    'invalid-input': '한글, 영문, 숫자와 공백만 입력해 주세요.',
    conflict: '다른 화면에서 변경되었습니다. 다시 시도해 주세요.',
    unavailable: '저장하지 못했습니다. 다시 시도해 주세요.',
  };
  return status === 'saved' ? '' : messages[status];
}

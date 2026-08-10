import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  InvestmentLocationView,
  InvestmentLocationRepository,
  LocationWriteResult,
} from '../../../src/portfolio/infrastructure/locationRepository';
import { InvestmentLocations } from '../../../src/portfolio/ui/InvestmentLocations';
import type { FinancialLocation } from '../../../src/workspace/domain/financialLocation';

afterEach(cleanup);

function location(shortName: string = 'ISA'): InvestmentLocationView {
  return {
    id: `location-${shortName}`,
    shortName,
    kind: 'brokerage',
    roles: ['investing'],
    portfolioStatus: 'empty',
    createdAt: 100,
    updatedAt: 100,
  };
}

function createRepository(
  initial: InvestmentLocationView[] = [],
  { archiveReferenced = true }: { archiveReferenced?: boolean } = {},
) {
  let locations = [...initial];
  let listener: ((next: InvestmentLocationView[]) => void) | undefined;
  let nextResult: LocationWriteResult | undefined;
  const linkCandidates = new Map<string, FinancialLocation>();
  const repository: InvestmentLocationRepository & {
    publish(next: InvestmentLocationView[]): void;
    setNextResult(result: LocationWriteResult): void;
  } = {
    list: () => locations,
    create: vi.fn(async (input): Promise<LocationWriteResult> => {
      if (nextResult !== undefined) {
        const result = consumeResult();
        if (result.status !== 'saved' && result.existingLocation !== undefined) {
          linkCandidates.set(result.existingLocation.id, result.existingLocation);
        }
        return result;
      }
      const created: InvestmentLocationView = {
        id: `location-${input.shortName}`,
        shortName: input.shortName,
        ...(input.institution === undefined ? {} : { institution: input.institution }),
        kind: input.kind,
        roles: ['investing'],
        portfolioStatus: 'empty',
        createdAt: 200,
        updatedAt: 200,
      };
      locations = [...locations, created];
      listener?.(locations);
      return { status: 'saved', location: created };
    }),
    link: vi.fn(async (id): Promise<LocationWriteResult> => {
      if (nextResult !== undefined) return consumeResult();
      const candidate = linkCandidates.get(id);
      if (candidate === undefined) return { status: 'location-not-found' };
      const linked: InvestmentLocationView = {
        ...candidate,
        roles: [...candidate.roles, 'investing'],
        portfolioStatus: 'empty',
        updatedAt: 200,
      };
      locations = [...locations, linked];
      listener?.(locations);
      return { status: 'saved', location: linked };
    }),
    rename: vi.fn(async (id, shortName): Promise<LocationWriteResult> => {
      if (nextResult !== undefined) return consumeResult();
      locations = locations.map((item) => item.id === id
        ? { ...item, shortName, updatedAt: 200 }
        : item);
      listener?.(locations);
      return { status: 'saved', location: locations.find((item) => item.id === id)! };
    }),
    archive: vi.fn(async (id, disposition): Promise<LocationWriteResult> => {
      if (disposition === undefined && archiveReferenced) {
        return { status: 'portfolio-reference', referencedScopes: [`location:${id}`] };
      }
      if (nextResult !== undefined) return consumeResult();
      locations = locations.filter((item) => item.id !== id);
      listener?.(locations);
      return {
        status: 'saved',
        location: { ...initial.find((item) => item.id === id)!, archivedAt: 200 },
      };
    }),
    subscribe(nextListener) {
      listener = nextListener;
      return () => { listener = undefined; };
    },
    publish(next) {
      locations = [...next];
      listener?.(locations);
    },
    setNextResult(result) {
      nextResult = result;
    },
  };
  return repository;

  function consumeResult(): LocationWriteResult {
    const result = nextResult!;
    nextResult = undefined;
    return result;
  }
}

describe('InvestmentLocations', () => {
  it('keeps the aggregate allocation first and explains an empty location registry', () => {
    const repository = createRepository();

    render(<InvestmentLocations repository={repository} />);

    expect(screen.getByRole('heading', { name: '투자 위치' })).toBeVisible();
    expect(screen.getByText('전체 기준 배분은 그대로 유지됩니다')).toBeVisible();
    expect(screen.getByText('아직 등록한 투자 위치가 없습니다.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /배분.*(설정|편집)/ })).not.toBeInTheDocument();
  });

  it('shows an Account Map-created empty location without creating a Portfolio plan', () => {
    const repository = createRepository([location()]);

    render(<InvestmentLocations repository={repository} />);

    expect(screen.getByText('ISA')).toBeVisible();
    expect(screen.getByRole('button', { name: '아직 배분하지 않음' })).toBeDisabled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('distinguishes applied, draft-only, and truly empty location allocation status', () => {
    const applied = Object.assign(location('ISA'), { portfolioStatus: 'applied' as const });
    const draft = Object.assign(location('연금'), { portfolioStatus: 'draft' as const });
    const empty = Object.assign(location('해외'), { portfolioStatus: 'empty' as const });
    const repository = createRepository([applied, draft, empty]);

    render(<InvestmentLocations repository={repository} />);

    expect(screen.getByText('배분 데이터 있음')).toBeVisible();
    expect(screen.getByText('배분 초안 있음')).toBeVisible();
    expect(screen.getByRole('button', { name: '아직 배분하지 않음' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /배분.*(설정|편집)/ })).not.toBeInTheDocument();
  });

  it('adds a location with short name, kind, optional searchable institution, and counter', async () => {
    const repository = createRepository();
    render(<InvestmentLocations repository={repository} />);

    fireEvent.change(screen.getByLabelText('짧은 이름'), { target: { value: '연금저축' } });
    expect(screen.getByText('4/8자')).toBeVisible();
    fireEvent.change(screen.getByLabelText('형태'), { target: { value: 'brokerage' } });
    const institution = screen.getByLabelText('기관 (선택)');
    expect(institution).toHaveAttribute('type', 'search');
    fireEvent.change(institution, { target: { value: '미래에셋' } });
    fireEvent.click(screen.getByRole('button', { name: '투자 위치 추가' }));

    await waitFor(() => expect(repository.create).toHaveBeenCalledWith({
      shortName: '연금저축',
      institution: { name: '미래에셋' },
      kind: 'brokerage',
    }));
    expect(await screen.findByText('연금저축')).toBeVisible();
  });

  it('links an active non-investing normalized duplicate instead of creating a second identity', async () => {
    const repository = createRepository();
    const existing: FinancialLocation = {
      ...location('Toss ISA'),
      id: 'shared-toss-isa',
      roles: ['saving'],
    };
    repository.setNextResult({ status: 'duplicate-name', existingLocation: existing });
    render(<InvestmentLocations repository={repository} />);
    fireEvent.change(screen.getByLabelText('짧은 이름'), { target: { value: ' toss   isa ' } });

    fireEvent.click(screen.getByRole('button', { name: '투자 위치 추가' }));
    const link = await screen.findByRole('button', { name: '기존 위치 연결' });
    fireEvent.click(link);

    await waitFor(() => expect(repository.link).toHaveBeenCalledWith('shared-toss-isa'));
    expect(await screen.findByText('Toss ISA')).toBeVisible();
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the duplicate link action and form input when linking reaches capacity', async () => {
    const repository = createRepository();
    const existing: FinancialLocation = {
      ...location('Toss ISA'),
      id: 'shared-toss-isa',
      roles: ['saving'],
    };
    repository.setNextResult({ status: 'duplicate-name', existingLocation: existing });
    render(<InvestmentLocations repository={repository} />);
    fireEvent.change(screen.getByLabelText('짧은 이름'), { target: { value: 'Toss ISA' } });
    fireEvent.click(screen.getByRole('button', { name: '투자 위치 추가' }));
    const link = await screen.findByRole('button', { name: '기존 위치 연결' });
    repository.setNextResult({ status: 'purpose-capacity' });

    fireEvent.click(link);

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('투자 위치는 최대 10개까지 추가할 수 있습니다.');
    expect(screen.getByLabelText('짧은 이름')).toHaveValue('Toss ISA');
    expect(screen.getByRole('button', { name: '기존 위치 연결' })).toBeVisible();
  });

  it('closes a stale duplicate link candidate after an external identity change', async () => {
    const repository = createRepository();
    const existing: FinancialLocation = {
      ...location('Toss ISA'),
      id: 'shared-toss-isa',
      roles: ['saving'],
    };
    repository.setNextResult({ status: 'duplicate-name', existingLocation: existing });
    render(<InvestmentLocations repository={repository} />);
    fireEvent.change(screen.getByLabelText('짧은 이름'), { target: { value: 'Toss ISA' } });
    fireEvent.click(screen.getByRole('button', { name: '투자 위치 추가' }));
    const link = await screen.findByRole('button', { name: '기존 위치 연결' });
    repository.setNextResult({ status: 'stale-location' });

    fireEvent.click(link);

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('기존 위치가 다른 화면에서 변경되었습니다. 다시 확인해 주세요.');
    expect(screen.queryByRole('button', { name: '기존 위치 연결' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('짧은 이름')).toHaveValue('Toss ISA');
  });

  it.each([
    ['duplicate-name', '이미 같은 이름의 위치가 있습니다.'],
    ['purpose-capacity', '투자 위치는 최대 10개까지 추가할 수 있습니다.'],
    ['unavailable', '저장하지 못했습니다. 다시 시도해 주세요.'],
    ['conflict', '다른 화면에서 변경되었습니다. 다시 시도해 주세요.'],
    ['invalid-input', '한글, 영문, 숫자와 공백만 입력해 주세요.'],
    ['name-too-long', '짧은 이름은 8자까지 입력할 수 있습니다.'],
  ] as const)('keeps the %s error next to the add form', async (status, message) => {
    const repository = createRepository();
    repository.setNextResult({ status });
    render(<InvestmentLocations repository={repository} />);
    fireEvent.change(screen.getByLabelText('짧은 이름'), { target: { value: 'Toss ISA' } });

    fireEvent.click(screen.getByRole('button', { name: '투자 위치 추가' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('짧은 이름')).toHaveValue('Toss ISA');
  });

  it('renames the shared registry value in place', async () => {
    const repository = createRepository([location()]);
    render(<InvestmentLocations repository={repository} />);

    fireEvent.click(screen.getByRole('button', { name: 'ISA 이름 바꾸기' }));
    const input = screen.getByLabelText('ISA 새 이름');
    fireEvent.change(input, { target: { value: '연금 ISA' } });
    fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));

    await waitFor(() => expect(repository.rename)
      .toHaveBeenCalledWith('location-ISA', '연금 ISA'));
    expect(await screen.findByText('연금 ISA')).toBeVisible();
  });

  it('keeps rename errors and input beside the location form', async () => {
    const repository = createRepository([location()]);
    repository.setNextResult({ status: 'duplicate-name' });
    render(<InvestmentLocations repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: 'ISA 이름 바꾸기' }));
    fireEvent.change(screen.getByLabelText('ISA 새 이름'), { target: { value: '중복 ISA' } });

    fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('이미 같은 이름의 위치가 있습니다.');
    expect(alert).toHaveClass('portfolio-locations__error');
    expect(screen.getByLabelText('ISA 새 이름')).toHaveValue('중복 ISA');
  });

  it('closes an open rename when its subscribed target disappears and focuses the section heading', async () => {
    const repository = createRepository([location()]);
    render(<InvestmentLocations repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: 'ISA 이름 바꾸기' }));
    screen.getByLabelText('ISA 새 이름').focus();

    repository.publish([]);

    await waitFor(() => expect(screen.queryByLabelText('ISA 새 이름')).not.toBeInTheDocument());
    expect(await screen.findByRole('alert'))
      .toHaveTextContent('다른 화면에서 위치가 변경되어 작업을 닫았습니다.');
    await waitFor(() => expect(screen.getByRole('heading', { name: '투자 위치' })).toHaveFocus());
  });

  it('reconciles an open rename form with the current subscribed registry name', async () => {
    const repository = createRepository([location()]);
    render(<InvestmentLocations repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: 'ISA 이름 바꾸기' }));
    fireEvent.change(screen.getByLabelText('ISA 새 이름'), { target: { value: '내 초안' } });

    repository.publish([{ ...location(), shortName: '외부 ISA', updatedAt: 300 }]);

    expect(await screen.findByLabelText('외부 ISA 새 이름')).toHaveValue('외부 ISA');
    expect(screen.queryByLabelText('ISA 새 이름')).not.toBeInTheDocument();
  });

  it('confirms referenced archive disposition with preservation selected by default', async () => {
    const repository = createRepository([location()]);
    render(<InvestmentLocations repository={repository} />);
    const archiveTrigger = screen.getByRole('button', { name: 'ISA 보관하기' });

    fireEvent.click(archiveTrigger);

    const dialog = await screen.findByRole('dialog', { name: 'ISA 위치를 보관할까요?' });
    expect(within(dialog).getByText('연결된 Portfolio 데이터도 함께 삭제할까요?')).toBeVisible();
    expect(within(dialog).getByRole('radio', { name: 'Portfolio 데이터 유지' })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: '보관' }));

    await waitFor(() => expect(repository.archive)
      .toHaveBeenLastCalledWith('location-ISA', 'preserve'));
    expect(screen.queryByText('ISA')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: '투자 위치' })).toHaveFocus());
  });

  it('moves focus to the location heading after direct unreferenced archive', async () => {
    const repository = createRepository([location()], { archiveReferenced: false });
    render(<InvestmentLocations repository={repository} />);
    const archiveTrigger = screen.getByRole('button', { name: 'ISA 보관하기' });
    archiveTrigger.focus();

    fireEvent.click(archiveTrigger);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'ISA 보관하기' }))
      .not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { name: '투자 위치' })).toHaveFocus());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends explicit delete disposition and keeps archive failures in the dialog', async () => {
    const repository = createRepository([location()]);
    render(<InvestmentLocations repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: 'ISA 보관하기' }));
    const dialog = await screen.findByRole('dialog', { name: 'ISA 위치를 보관할까요?' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Portfolio 데이터 삭제' }));
    repository.setNextResult({ status: 'unavailable' });

    fireEvent.click(within(dialog).getByRole('button', { name: '보관' }));

    expect(await within(dialog).findByRole('alert'))
      .toHaveTextContent('저장하지 못했습니다. 다시 시도해 주세요.');
    expect(repository.archive).toHaveBeenLastCalledWith('location-ISA', 'delete');
    expect(dialog).toBeVisible();
  });

  it('closes an open archive after subscribed removal without focusing its detached trigger', async () => {
    const repository = createRepository([location()]);
    render(<InvestmentLocations repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: 'ISA 보관하기' }));
    expect(await screen.findByRole('dialog', { name: 'ISA 위치를 보관할까요?' })).toBeVisible();

    repository.publish([]);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('alert'))
      .toHaveTextContent('다른 화면에서 위치가 변경되어 작업을 닫았습니다.');
    await waitFor(() => expect(screen.getByRole('heading', { name: '투자 위치' })).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'ISA 보관하기' })).not.toBeInTheDocument();
  });

  it('reconciles an open archive snapshot with the current subscribed registry name', async () => {
    const repository = createRepository([location()]);
    render(<InvestmentLocations repository={repository} />);
    fireEvent.click(screen.getByRole('button', { name: 'ISA 보관하기' }));
    expect(await screen.findByRole('dialog', { name: 'ISA 위치를 보관할까요?' })).toBeVisible();

    repository.publish([{ ...location(), shortName: '외부 ISA', updatedAt: 300 }]);

    expect(await screen.findByRole('dialog', { name: '외부 ISA 위치를 보관할까요?' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'ISA 위치를 보관할까요?' })).not.toBeInTheDocument();
  });
});

# Main React Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Main의 핵심 재무 입력, 명시적 적용, 요약, Sankey, 로컬 저장 기능을 React, TypeScript, Tailwind CSS로 새로 구현하고 GitHub Pages 하위 경로에 안전하게 배포한다.

**Architecture:** Vite 멀티 페이지 구조와 기존 Main URL을 유지한다. 신규 코드는 `src/main` 안에서 도메인, 작업 흐름, 브라우저 저장소, React UI로 분리하며 기존 JavaScript는 계산 결과와 저장 형식 확인에만 사용한다. 신규 구현 검증 후 Main 진입점만 교체하고 다른 앱과 공유하는 레거시 코드는 유지한다.

**Tech Stack:** React 19, TypeScript 5.5 strict mode, Vite 5, Tailwind CSS 4, Vitest 4, Playwright 1.60, LocalStorage, IndexedDB, GitHub Pages

## Global Constraints

- 배포 기준 URL은 `https://jinhoops.github.io/IndividualSavingsFlowUI/`이다.
- Main 배포 경로는 `https://jinhoops.github.io/IndividualSavingsFlowUI/apps/main/`이다.
- 저장소 루트를 무시하는 `"/..."` 절대경로를 새 코드에 사용하지 않는다.
- 앱 링크와 공개 파일 경로는 `import.meta.env.BASE_URL` 기준으로 만든다.
- 서버, SSR, React Server Components, Server Actions, API를 추가하지 않는다.
- 기존 `isf-rebuild-v1` 데이터를 원본 수정 없이 읽고 변환한다.
- 신규 Main 적용이 성공하기 전까지 기존 저장 데이터를 덮어쓰지 않는다.
- Simulation, Portfolio, Account Map 동작과 진입점을 변경하지 않는다.
- 계산과 검증은 React와 브라우저 API에 의존하지 않는 순수 함수로 둔다.
- 모든 기능 작업은 실패 테스트, 최소 구현, 통과 테스트 순서로 진행한다.
- 기준선은 `npm run check` 통과, Playwright 95개 중 94개 통과다. 기존 실패는 `tests/step2.spec.ts:528`의 첫 실행 배너 포인터 가로채기다.

## Planned File Map

```text
src/main/
  domain/
    model.ts                 # 신규 Main 도메인 타입과 기본값
    money.ts                 # 원 단위 파싱과 한국어 금액 표시
    validation.ts            # 항목, 계좌, 배분 검증
    cashflow.ts              # 합계와 투자 가능액 계산
    sankey.ts                # 렌더러 독립 Sankey 그래프 생성
  application/
    mainReducer.ts           # 적용 상태, 초안, 설정 단계 전이
    bootstrap.ts             # 저장 데이터 로드와 최초 화면 결정
  infrastructure/
    legacyMigration.ts       # isf-rebuild-v1 변환
    mainRepository.ts        # LocalStorage와 IndexedDB 저장
    backup.ts                # JSON 내보내기와 가져오기
    paths.ts                 # GitHub Pages 안전 경로 생성
  ui/
    MainApp.tsx              # 앱 조립과 오류 경계
    setup/SetupFlow.tsx      # 신규/재설정 단계
    dashboard/SummaryDashboard.tsx
    dashboard/CashflowSummary.tsx
    dashboard/CashflowSankey.tsx
    editor/FinancialEditor.tsx
    editor/ApplyBar.tsx
    common/MoneyField.tsx
    main.css                 # Tailwind theme와 소수의 복합 스타일
  main.tsx                   # React 진입점
tests/unit/main/             # Vitest 도메인·작업 흐름·저장 테스트
tests/main-react.spec.ts     # 신규 Main Playwright 흐름
vitest.config.ts             # 단위 테스트 전용 수집 범위
```

---

### Task 1: 단위 테스트 기반과 도메인 모델

**Files:**
- Create: `vitest.config.ts`
- Create: `src/main/domain/model.ts`
- Create: `tests/unit/main/model.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `MainData`, `FinancialItem`, `IncomeItem`, `Account`, `IncomeAllocation`, `SetupStep`, `createEmptyMainData()`
- Consumes: 없음

- [ ] **Step 1: 단위 테스트 명령을 Playwright 스펙과 분리한다**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
    coverage: {
      include: ['src/main/**/*.ts', 'src/main/**/*.tsx'],
    },
  },
});
```

`package.json` scripts에 다음을 추가한다.

```json
{
  "test:unit": "vitest run",
  "test:unit:watch": "vitest"
}
```

- [ ] **Step 2: 기본 데이터 계약의 실패 테스트를 작성한다**

`tests/unit/main/model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyMainData } from '../../../src/main/domain/model';

describe('createEmptyMainData', () => {
  it('creates a versioned empty draft without shared arrays', () => {
    const first = createEmptyMainData();
    const second = createEmptyMainData();

    expect(first).toMatchObject({
      schemaVersion: 1,
      incomes: [],
      expenses: [],
      savings: [],
      investments: [],
      accounts: [],
    });
    expect(first.incomes).not.toBe(second.incomes);
    expect(first.updatedAt).toBe(0);
  });
});
```

- [ ] **Step 3: 테스트가 타입 누락으로 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/model.test.ts`

Expected: FAIL with `Failed to resolve import "../../../src/main/domain/model"`.

- [ ] **Step 4: 신규 도메인 타입과 빈 모델을 구현한다**

`src/main/domain/model.ts`:

```ts
export type ItemKind = 'income' | 'expense' | 'saving' | 'investment';
export type SetupStep = 'welcome' | 'income' | 'expense' | 'saving-investment' | 'account' | 'review';

export interface FinancialItem {
  id: string;
  name: string;
  amountWon: number;
  group?: string;
  accountId?: string;
  annualRate?: number;
  maturityMonth?: string;
}

export interface IncomeAllocation {
  accountId: string;
  amountWon: number;
}

export interface IncomeItem extends FinancialItem {
  allocations: IncomeAllocation[];
}

export interface Account {
  id: string;
  name: string;
  kind: 'income' | 'spending' | 'saving' | 'investment' | 'other';
}

export interface MainData {
  schemaVersion: 1;
  updatedAt: number;
  incomes: IncomeItem[];
  expenses: FinancialItem[];
  savings: FinancialItem[];
  investments: FinancialItem[];
  accounts: Account[];
}

export function createEmptyMainData(): MainData {
  return {
    schemaVersion: 1,
    updatedAt: 0,
    incomes: [],
    expenses: [],
    savings: [],
    investments: [],
    accounts: [],
  };
}
```

- [ ] **Step 5: 단위 테스트와 타입 검사를 통과시킨다**

Run: `npm run test:unit -- tests/unit/main/model.test.ts && npm run check`

Expected: 1 test PASS, TypeScript exit 0.

- [ ] **Step 6: 커밋한다**

```bash
git add package.json package-lock.json vitest.config.ts src/main/domain/model.ts tests/unit/main/model.test.ts
git commit -m "test(main): establish typed domain harness"
```

---

### Task 2: 금액, 검증, 현금흐름 계산

**Files:**
- Create: `src/main/domain/money.ts`
- Create: `src/main/domain/validation.ts`
- Create: `src/main/domain/cashflow.ts`
- Create: `tests/unit/main/money.test.ts`
- Create: `tests/unit/main/validation.test.ts`
- Create: `tests/unit/main/cashflow.test.ts`

**Interfaces:**
- Consumes: `MainData`, `FinancialItem`, `IncomeItem` from `src/main/domain/model.ts`
- Produces: `parseWonInput(value): number`, `formatWon(value): string`, `validateMainData(data): ValidationResult`, `calculateCashflow(data): CashflowSummary`

- [ ] **Step 1: 금액과 계산의 실패 테스트를 작성한다**

`tests/unit/main/cashflow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateCashflow } from '../../../src/main/domain/cashflow';
import type { MainData } from '../../../src/main/domain/model';

const data: MainData = {
  schemaVersion: 1,
  updatedAt: 0,
  incomes: [{ id: 'salary', name: '급여', amountWon: 5_000_000, allocations: [] }],
  expenses: [{ id: 'living', name: '생활비', amountWon: 2_000_000 }],
  savings: [{ id: 'deposit', name: '적금', amountWon: 800_000 }],
  investments: [{ id: 'etf', name: 'ETF', amountWon: 700_000 }],
  accounts: [],
};

describe('calculateCashflow', () => {
  it('derives totals and unallocated investable cash', () => {
    expect(calculateCashflow(data)).toEqual({
      incomeWon: 5_000_000,
      expenseWon: 2_000_000,
      savingWon: 800_000,
      investmentWon: 700_000,
      plannedOutflowWon: 3_500_000,
      availableWon: 1_500_000,
      deficitWon: 0,
    });
  });
});
```

`tests/unit/main/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateMainData } from '../../../src/main/domain/validation';
import { createEmptyMainData } from '../../../src/main/domain/model';

describe('validateMainData', () => {
  it('rejects missing income and mismatched allocations', () => {
    const empty = validateMainData(createEmptyMainData());
    expect(empty.issues).toContainEqual({ path: 'incomes', code: 'income_required' });

    const invalid = createEmptyMainData();
    invalid.accounts = [{ id: 'salary-account', name: '급여통장', kind: 'income' }];
    invalid.incomes = [{
      id: 'salary',
      name: '급여',
      amountWon: 3_000_000,
      allocations: [{ accountId: 'salary-account', amountWon: 2_000_000 }],
    }];
    expect(validateMainData(invalid).issues).toContainEqual({
      path: 'incomes.salary.allocations',
      code: 'allocation_total_mismatch',
    });
  });
});
```

- [ ] **Step 2: 테스트가 구현 누락으로 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/cashflow.test.ts tests/unit/main/validation.test.ts`

Expected: FAIL with unresolved `cashflow` and `validation` imports.

- [ ] **Step 3: 최소 금액·검증·계산 함수를 구현한다**

`src/main/domain/cashflow.ts` 핵심:

```ts
import type { MainData } from './model';

export interface CashflowSummary {
  incomeWon: number;
  expenseWon: number;
  savingWon: number;
  investmentWon: number;
  plannedOutflowWon: number;
  availableWon: number;
  deficitWon: number;
}

const total = (items: { amountWon: number }[]) =>
  items.reduce((sum, item) => sum + Math.max(0, item.amountWon), 0);

export function calculateCashflow(data: MainData): CashflowSummary {
  const incomeWon = total(data.incomes);
  const expenseWon = total(data.expenses);
  const savingWon = total(data.savings);
  const investmentWon = total(data.investments);
  const plannedOutflowWon = expenseWon + savingWon + investmentWon;
  return {
    incomeWon,
    expenseWon,
    savingWon,
    investmentWon,
    plannedOutflowWon,
    availableWon: Math.max(0, incomeWon - plannedOutflowWon),
    deficitWon: Math.max(0, plannedOutflowWon - incomeWon),
  };
}
```

검증 결과 타입:

```ts
export type ValidationCode =
  | 'income_required'
  | 'name_required'
  | 'amount_negative'
  | 'account_missing'
  | 'allocation_total_mismatch';

export interface ValidationResult {
  valid: boolean;
  issues: { path: string; code: ValidationCode }[];
}
```

`parseWonInput`은 쉼표와 공백을 제거한 정수만 허용하고 음수와 비정상 입력은 `0`으로 정규화한다. `formatWon`은 `Intl.NumberFormat('ko-KR')` 결과에 `원`을 붙인다.

- [ ] **Step 4: 경계값 테스트를 추가한다**

`tests/unit/main/money.test.ts`에 `"1,250,000"`, 빈 문자열, 음수, `100_000_000`의 억/만원 표시를 검증한다. `validation.test.ts`에 음수 금액, 없는 계좌 ID, 정상 배분 합계를 추가한다.

- [ ] **Step 5: 단위 테스트와 타입 검사를 통과시킨다**

Run: `npm run test:unit -- tests/unit/main && npm run check`

Expected: 모든 `tests/unit/main` 테스트 PASS, TypeScript exit 0.

- [ ] **Step 6: 커밋한다**

```bash
git add src/main/domain tests/unit/main
git commit -m "feat(main): add cashflow domain rules"
```

---

### Task 3: 기존 데이터 변환과 저장소

**Files:**
- Create: `src/main/infrastructure/legacyMigration.ts`
- Create: `src/main/infrastructure/mainRepository.ts`
- Create: `src/main/infrastructure/backup.ts`
- Create: `tests/unit/main/legacyMigration.test.ts`
- Create: `tests/unit/main/mainRepository.test.ts`
- Modify: `src/core/storage/IsfStore.ts`

**Interfaces:**
- Consumes: `MainData` and `validateMainData`
- Produces: `migrateLegacyMain(input: unknown): MigrationResult`, `MainRepository`, `BrowserMainRepository`, `exportMainData(data): string`, `importMainData(json): MainData`

- [ ] **Step 1: 실제 레거시 형식의 실패 테스트를 작성한다**

`tests/unit/main/legacyMigration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { migrateLegacyMain } from '../../../src/main/infrastructure/legacyMigration';

describe('migrateLegacyMain', () => {
  it('maps isf-rebuild-v1 fields without mutating the source', () => {
    const legacy = {
      incomes: [{
        id: 'income-main',
        name: '급여',
        amount: 4_200_000,
        accountId: 'acc-salary',
        allocations: [{ accountId: 'acc-salary', amount: 4_200_000 }],
      }],
      expenseItems: [{ id: 'rent', name: '주거비', amount: 900_000, group: '고정비' }],
      savingsItems: [{ id: 'saving', name: '적금', amount: 600_000, maturityMonth: '2028-12' }],
      investItems: [{ id: 'invest', name: 'ETF', amount: 800_000 }],
      accounts: [{ id: 'acc-salary', name: '급여통장', type: 'income' }],
    };
    const snapshot = structuredClone(legacy);

    const result = migrateLegacyMain(legacy);

    expect(result.status).toBe('migrated');
    expect(result.data?.incomes[0].amountWon).toBe(4_200_000);
    expect(result.data?.expenses[0].group).toBe('고정비');
    expect(result.data?.savings[0].maturityMonth).toBe('2028-12');
    expect(legacy).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: 변환 테스트가 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/legacyMigration.test.ts`

Expected: FAIL with unresolved `legacyMigration` import.

- [ ] **Step 3: 안전한 변환과 실패 결과를 구현한다**

```ts
export type MigrationResult =
  | { status: 'empty'; data: null; original: null }
  | { status: 'current'; data: MainData; original: unknown }
  | { status: 'migrated'; data: MainData; original: unknown }
  | { status: 'failed'; data: null; original: unknown; reason: string };

export function migrateLegacyMain(input: unknown): MigrationResult;
```

알 수 없는 객체를 강제 캐스팅하지 않는다. 배열과 각 필드 타입을 확인한 뒤 `amount`를 `amountWon`, `expenseItems`를 `expenses`, `savingsItems`를 `savings`, `investItems`를 `investments`로 복사한다. 변환 실패 결과에는 직렬화 가능한 원본을 유지한다.

- [ ] **Step 4: 저장소 계약의 실패 테스트를 작성한다**

```ts
export interface MainRepository {
  load(): Promise<MigrationResult>;
  save(data: MainData): Promise<void>;
  saveSetupProgress(step: SetupStep, draft: MainData): void;
  loadSetupProgress(): { step: SetupStep; draft: MainData } | null;
  clearSetupProgress(): void;
}
```

테스트에서 `localStorage`에 `isf-rebuild-v1`을 넣고 `load()`가 변환 결과를 반환하는지, `save()` 실패 시 기존 키가 유지되는지, 성공 시 `isf-main-v1`과 IndexedDB 이력에 같은 `updatedAt`을 저장하는지 검증한다.

- [ ] **Step 5: 원자적 저장 순서와 백업을 구현한다**

`BrowserMainRepository.save()`은 다음 순서만 사용한다.

1. 입력 복사본에 새 `updatedAt` 부여
2. IndexedDB 이력 저장
3. `isf-main-v1-pending`에 JSON 저장
4. `isf-main-v1` 교체
5. pending 키 제거

`src/core/storage/IsfStore.ts`에는 기존 메서드를 깨지 않고 `saveMainV1(data: MainData)`와 `loadLatestMainV1()`을 추가한다. 기존 DB 버전을 올리고 `main_v1_history` object store를 생성한다.

`backup.ts`는 아래 함수만 노출한다.

```ts
export function exportMainData(data: MainData): string;
export function importMainData(json: string): MainData;
export function exportRecoveryData(original: unknown): string;
```

- [ ] **Step 6: 저장·변환 테스트와 타입 검사를 통과시킨다**

Run: `npm run test:unit -- tests/unit/main/legacyMigration.test.ts tests/unit/main/mainRepository.test.ts && npm run check`

Expected: 관련 테스트 PASS, TypeScript exit 0.

- [ ] **Step 7: 커밋한다**

```bash
git add src/main/infrastructure src/core/storage/IsfStore.ts tests/unit/main
git commit -m "feat(main): migrate and persist local data"
```

---

### Task 4: 적용·취소·설정 재개 상태 머신

**Files:**
- Create: `src/main/application/mainReducer.ts`
- Create: `src/main/application/bootstrap.ts`
- Create: `tests/unit/main/mainReducer.test.ts`
- Create: `tests/unit/main/bootstrap.test.ts`

**Interfaces:**
- Consumes: `MainData`, `SetupStep`, `MainRepository`, `MigrationResult`
- Produces: `MainState`, `MainAction`, `mainReducer`, `bootstrapMain(repository): Promise<MainState>`, `applyDraft(state, repository): Promise<ApplyResult>`

- [ ] **Step 1: 상태 전이 실패 테스트를 작성한다**

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyMainData } from '../../../src/main/domain/model';
import { mainReducer } from '../../../src/main/application/mainReducer';

describe('mainReducer', () => {
  it('edits only the draft and cancel restores applied data', () => {
    const applied = createEmptyMainData();
    applied.incomes = [{ id: 'salary', name: '급여', amountWon: 3_000_000, allocations: [] }];
    const initial = {
      mode: 'dashboard' as const,
      applied,
      draft: structuredClone(applied),
      setupStep: null,
      dirty: false,
      saveStatus: 'idle' as const,
      loadError: null,
    };

    const edited = mainReducer(initial, {
      type: 'replace-draft',
      draft: { ...initial.draft, incomes: [{ ...initial.draft.incomes[0], amountWon: 4_000_000 }] },
    });
    expect(edited.applied.incomes[0].amountWon).toBe(3_000_000);
    expect(edited.dirty).toBe(true);

    const cancelled = mainReducer(edited, { type: 'cancel-draft' });
    expect(cancelled.draft).toEqual(applied);
    expect(cancelled.dirty).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 구현 누락으로 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/mainReducer.test.ts`

Expected: FAIL with unresolved `mainReducer` import.

- [ ] **Step 3: 명시적 상태와 액션을 구현한다**

```ts
export interface MainState {
  mode: 'setup' | 'dashboard' | 'recovery';
  applied: MainData | null;
  draft: MainData;
  setupStep: SetupStep | null;
  dirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  loadError: { message: string; original: unknown } | null;
}

export type MainAction =
  | { type: 'replace-draft'; draft: MainData }
  | { type: 'cancel-draft' }
  | { type: 'set-setup-step'; step: SetupStep }
  | { type: 'restart-setup' }
  | { type: 'save-started' }
  | { type: 'save-succeeded'; data: MainData }
  | { type: 'save-failed' };
```

`restart-setup`은 적용 데이터를 복사해 `welcome` 단계 초안으로 사용한다. 적용 데이터는 유지한다.

- [ ] **Step 4: 부트스트랩과 적용 통합 테스트를 추가한다**

다음 네 상태를 검증한다.

- 데이터 없음: `mode: 'setup'`, `setupStep: 'welcome'`
- 설정 진행 데이터 있음: 저장된 마지막 단계 재개
- 현재/변환 데이터 있음: `mode: 'dashboard'`
- 변환 실패: `mode: 'recovery'`, 원본 유지

`applyDraft`는 검증 실패 시 저장소를 호출하지 않고 첫 오류를 반환하며, 저장 실패 시 `applied`를 바꾸지 않는다.

- [ ] **Step 5: 부트스트랩과 적용 함수를 구현한다**

```ts
export type ApplyResult =
  | { ok: true; data: MainData }
  | { ok: false; kind: 'validation'; issues: ValidationIssue[] }
  | { ok: false; kind: 'storage'; error: Error };

export async function bootstrapMain(repository: MainRepository): Promise<MainState>;
export async function applyDraft(state: MainState, repository: MainRepository): Promise<ApplyResult>;
```

- [ ] **Step 6: 작업 흐름 테스트와 타입 검사를 통과시킨다**

Run: `npm run test:unit -- tests/unit/main/mainReducer.test.ts tests/unit/main/bootstrap.test.ts && npm run check`

Expected: 관련 테스트 PASS, TypeScript exit 0.

- [ ] **Step 7: 커밋한다**

```bash
git add src/main/application tests/unit/main
git commit -m "feat(main): model explicit draft workflow"
```

---

### Task 5: Sankey 그래프 도메인과 React 렌더러

**Files:**
- Create: `src/main/domain/sankey.ts`
- Create: `src/main/ui/dashboard/CashflowSankey.tsx`
- Create: `tests/unit/main/sankey.test.ts`
- Create: `tests/unit/main/CashflowSankey.test.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `MainData`, `CashflowSummary`
- Produces: `SankeyGraph`, `buildSankeyGraph(data): SankeyGraph`, `<CashflowSankey graph={graph} />`

- [ ] **Step 1: 그래프 계약의 실패 테스트를 작성한다**

```ts
it('routes income through total income to every outflow category', () => {
  const graph = buildSankeyGraph(data);
  expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
    'income:salary',
    'total-income',
    'category:expense',
    'category:saving',
    'category:investment',
  ]));
  expect(graph.links).toContainEqual({
    source: 'income:salary',
    target: 'total-income',
    valueWon: 5_000_000,
  });
});
```

- [ ] **Step 2: 테스트가 구현 누락으로 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/sankey.test.ts`

Expected: FAIL with unresolved `sankey` import.

- [ ] **Step 3: 렌더러 독립 그래프를 구현한다**

```ts
export interface SankeyNode {
  id: string;
  label: string;
  kind: 'income' | 'aggregate' | 'expense' | 'saving' | 'investment' | 'available' | 'deficit';
}

export interface SankeyLink {
  source: string;
  target: string;
  valueWon: number;
}

export interface SankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export function buildSankeyGraph(data: MainData): SankeyGraph;
```

0원 링크는 만들지 않는다. 결손은 `deficit` 노드에서 `total-income`으로 들어오는 보조 수입으로 표현한다. 사용자 입력 문자열은 SVG에 `dangerouslySetInnerHTML` 없이 텍스트 노드로 렌더한다.

- [ ] **Step 4: React SVG 테스트 환경을 추가한다**

`package.json` devDependencies에 `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`을 추가한다.

`CashflowSankey.test.tsx`에서 노드 라벨, 빈 그래프 대체 문구, 악성 문자열이 HTML로 실행되지 않는지 검증한다.

- [ ] **Step 5: 반응형 SVG 렌더러를 구현한다**

`CashflowSankey`는 외부 측정값 없이 `viewBox="0 0 960 420"`과 `width="100%"`를 사용한다. 그래프 생성 실패는 상위에서 잡을 수 있도록 던지고, 빈 그래프는 `"표시할 현금흐름이 없습니다"`를 렌더한다.

- [ ] **Step 6: 그래프와 컴포넌트 테스트를 통과시킨다**

Run: `npm install && npm run test:unit -- tests/unit/main/sankey.test.ts tests/unit/main/CashflowSankey.test.tsx && npm run check`

Expected: 관련 테스트 PASS, TypeScript exit 0.

- [ ] **Step 7: 커밋한다**

```bash
git add package.json package-lock.json src/main/domain/sankey.ts src/main/ui/dashboard/CashflowSankey.tsx tests/unit/main
git commit -m "feat(main): render typed cashflow Sankey"
```

---

### Task 6: 신규 사용자 설정 흐름

**Files:**
- Create: `src/main/ui/common/MoneyField.tsx`
- Create: `src/main/ui/setup/SetupFlow.tsx`
- Create: `tests/unit/main/SetupFlow.test.tsx`
- Create: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: `MainData`, `SetupStep`, `ValidationIssue`, `MainAction`
- Produces: `<SetupFlow draft step issues onChange onStepChange onApply />`

- [ ] **Step 1: 설정 흐름 컴포넌트 실패 테스트를 작성한다**

```tsx
render(
  <SetupFlow
    draft={createEmptyMainData()}
    step="income"
    issues={[]}
    onChange={onChange}
    onStepChange={onStepChange}
    onApply={onApply}
  />,
);

expect(screen.getByRole('heading', { name: '월 수입을 알려주세요' })).toBeVisible();
await userEvent.type(screen.getByLabelText('수입 이름'), '급여');
await userEvent.type(screen.getByLabelText('월 금액'), '4200000');
await userEvent.click(screen.getByRole('button', { name: '다음' }));
expect(onStepChange).toHaveBeenCalledWith('expense');
```

- [ ] **Step 2: 테스트가 구현 누락으로 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/SetupFlow.test.tsx`

Expected: FAIL with unresolved `SetupFlow` import.

- [ ] **Step 3: 여섯 단계 설정 UI를 구현한다**

단계는 `welcome`, `income`, `expense`, `saving-investment`, `account`, `review` 순서다. 각 단계는 하나의 `<form>`을 사용한다. Enter 제출, 이전/다음 버튼, 현재 단계 표시, 입력별 오류 연결을 제공한다. 진행할 때 `saveSetupProgress(step, draft)`를 호출할 수 있도록 상위 콜백만 사용한다.

`MoneyField` 공개 계약:

```ts
interface MoneyFieldProps {
  id: string;
  label: string;
  valueWon: number;
  error?: string;
  onChange(valueWon: number): void;
}
```

- [ ] **Step 4: Playwright에 신규 사용자 실패 시나리오를 작성한다**

`tests/main-react.spec.ts`:

```ts
test('new user completes setup and sees summary', async ({ page }) => {
  await page.goto('apps/main/');
  await expect(page.getByRole('heading', { name: '내 자금 계획을 시작합니다' })).toBeVisible();
  // 단계별 실제 label을 사용해 수입, 생활비, 저축, 투자, 계좌를 입력한다.
  await page.getByRole('button', { name: '계획 적용' }).click();
  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByText('투자 가능액')).toBeVisible();
});
```

Run: `npm run test:e2e -- tests/main-react.spec.ts --reporter=line`

Expected: FAIL because the legacy Main does not expose the new setup flow.

- [ ] **Step 5: 설정 UI 단위 테스트를 통과시킨다**

Run: `npm run test:unit -- tests/unit/main/SetupFlow.test.tsx && npm run check`

Expected: 관련 테스트 PASS, TypeScript exit 0. E2E는 진입점 교체 전까지 실패 상태를 유지한다.

- [ ] **Step 6: 커밋한다**

```bash
git add src/main/ui/common src/main/ui/setup tests/unit/main tests/main-react.spec.ts
git commit -m "feat(main): add guided financial setup"
```

---

### Task 7: 요약 대시보드와 명시적 편집

**Files:**
- Create: `src/main/ui/dashboard/CashflowSummary.tsx`
- Create: `src/main/ui/dashboard/SummaryDashboard.tsx`
- Create: `src/main/ui/editor/FinancialEditor.tsx`
- Create: `src/main/ui/editor/ApplyBar.tsx`
- Create: `tests/unit/main/SummaryDashboard.test.tsx`
- Create: `tests/unit/main/FinancialEditor.test.tsx`
- Modify: `tests/main-react.spec.ts`

**Interfaces:**
- Consumes: `MainData`, `CashflowSummary`, `SankeyGraph`, `MainAction`
- Produces: `<SummaryDashboard />`, `<FinancialEditor />`, `<ApplyBar />`

- [ ] **Step 1: 요약과 편집의 실패 테스트를 작성한다**

다음을 실제 접근성 역할로 검증한다.

- 수입, 생활비, 저축, 투자, 투자 가능액 카드
- Sankey 제목과 SVG
- 수입 카드 선택 시 편집 패널 열림
- 편집은 초안만 변경
- `취소`는 기존 값 복원
- 검증 실패 시 `적용` 차단과 첫 오류 포커스

핵심 적용 바 계약:

```ts
interface ApplyBarProps {
  dirty: boolean;
  saving: boolean;
  onApply(): void;
  onCancel(): void;
}
```

- [ ] **Step 2: 컴포넌트 테스트가 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/SummaryDashboard.test.tsx tests/unit/main/FinancialEditor.test.tsx`

Expected: FAIL with unresolved dashboard/editor imports.

- [ ] **Step 3: 요약 우선 화면을 구현한다**

`SummaryDashboard` 순서:

1. 저장 상태와 `처음부터 다시 설정`
2. 다섯 핵심 수치 카드
3. `CashflowSankey`
4. 수입, 생활비, 저축, 투자 섹션 요약

각 카드와 섹션은 `<button>`으로 편집 패널을 연다. 데스크톱은 우측 패널, 모바일은 전체 폭 dialog를 사용하되 동일 `FinancialEditor` 내용을 렌더한다.

- [ ] **Step 4: 명시적 편집과 이탈 보호를 구현한다**

편집 패널에서 추가, 이름, 금액, 계좌, 배분, 삭제를 처리한다. dirty 상태일 때만 `beforeunload` 경고를 연결한다. dialog 닫기, Escape, 배경 선택은 dirty 상태면 확인을 요청한다. 성공한 `적용` 후에만 `saved` 상태를 보여준다.

- [ ] **Step 5: Playwright 편집 시나리오를 구체화한다**

`tests/main-react.spec.ts`에 다음을 추가한다.

```ts
test('apply persists edits and cancel restores the last applied value', async ({ page }) => {
  await seedCurrentMain(page);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: /수입 편집/ }).click();
  await page.getByLabel('급여 월 금액').fill('5000000');
  await page.getByRole('button', { name: '적용' }).click();
  await page.reload();
  await expect(page.getByText('500만 원')).toBeVisible();

  await page.getByRole('button', { name: /수입 편집/ }).click();
  await page.getByLabel('급여 월 금액').fill('6000000');
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('500만 원')).toBeVisible();
});
```

저장 실패, 다시 설정 중 취소, 390px 가로 overflow 없음 시나리오도 추가한다.

- [ ] **Step 6: 대시보드·편집 단위 테스트를 통과시킨다**

Run: `npm run test:unit -- tests/unit/main && npm run check`

Expected: 모든 Main 단위 테스트 PASS, TypeScript exit 0.

- [ ] **Step 7: 커밋한다**

```bash
git add src/main/ui tests/unit/main tests/main-react.spec.ts
git commit -m "feat(main): add summary-first editing"
```

---

### Task 8: 앱 조립, Tailwind 재설계, GitHub Pages 전환

**Files:**
- Create: `src/main/ui/MainApp.tsx`
- Create: `src/main/ui/main.css`
- Create: `src/main/main.tsx`
- Create: `src/main/infrastructure/paths.ts`
- Create: `tests/unit/main/paths.test.ts`
- Modify: `apps/main/index.html`
- Modify: `vite.config.ts`
- Modify: `public/manifest.webmanifest`
- Modify: `tests/main-react.spec.ts`
- Delete after usage audit: `src/entries/step1.ts`
- Delete after usage audit: `apps/main/styles.css`
- Delete after usage audit: `apps/main/app.js`
- Delete after usage audit: Main-only files under `apps/main/modules/`

**Interfaces:**
- Consumes: 모든 이전 Task 공개 인터페이스
- Produces: `mainHref(path?: string): string`, 실행 가능한 신규 Main 페이지

- [ ] **Step 1: GitHub Pages 경로 실패 테스트를 작성한다**

`tests/unit/main/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAppPaths } from '../../../src/main/infrastructure/paths';

describe('createAppPaths', () => {
  it('keeps every route under the repository base', () => {
    const paths = createAppPaths('/IndividualSavingsFlowUI/');
    expect(paths.main).toBe('/IndividualSavingsFlowUI/apps/main/');
    expect(paths.simulation).toBe('/IndividualSavingsFlowUI/apps/simulation/');
    expect(paths.portfolio).toBe('/IndividualSavingsFlowUI/apps/portfolio/');
    expect(paths.accountMap).toBe('/IndividualSavingsFlowUI/apps/account-map/');
    expect(Object.values(paths).every((path) => !path.startsWith('/apps/'))).toBe(true);
  });
});
```

- [ ] **Step 2: 경로 테스트가 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/main/paths.test.ts`

Expected: FAIL with unresolved `paths` import.

- [ ] **Step 3: 경로 생성기와 Main 조립을 구현한다**

```ts
export function createAppPaths(baseUrl: string) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    main: `${base}apps/main/`,
    simulation: `${base}apps/simulation/`,
    portfolio: `${base}apps/portfolio/`,
    accountMap: `${base}apps/account-map/`,
  } as const;
}
```

`MainApp`은 `bootstrapMain` 완료 전 로딩 상태, `setup`, `dashboard`, `recovery`를 명시적으로 분기한다. recovery 화면은 기존 원본 JSON 다운로드와 빈 초안 시작만 제공한다.

- [ ] **Step 4: Main HTML을 React root로 교체한다**

`apps/main/index.html` body를 아래 최소 구조로 바꾼다.

```html
<body>
  <div id="root"></div>
  <noscript>이 앱은 브라우저에서 JavaScript를 활성화해야 사용할 수 있습니다.</noscript>
  <script type="module" src="../../src/main/main.tsx"></script>
</body>
```

manifest와 icon 링크는 Vite base에서 올바르게 출력되는 상대경로를 유지한다.

- [ ] **Step 5: Tailwind 기반 시각 체계를 구현한다**

`main.css`에서 `src/styles/globals.css`의 Tailwind import와 색상 토큰을 가져오되 legacy bridge class를 복사하지 않는다. 새 UI는 utility class를 우선 사용하고, Sankey 선/노드, dialog transition처럼 utility만으로 읽기 어려운 스타일만 `@layer components`에 둔다.

반응형 기준:

- 390px: 단일 열, 고정 적용 바가 입력을 가리지 않음
- 768px: 두 열 핵심 카드, 전체 폭 Sankey
- 1280px: 최대 콘텐츠 폭 1200px, 편집 우측 패널

- [ ] **Step 6: 레거시 사용처를 감사하고 Main 전용 파일만 제거한다**

Run:

```bash
rg -n "apps/main|shared/components|CompatibilityBridge|financial-modal|sankey-builder" apps src shared tests
```

Simulation, Portfolio, Account Map 또는 공유 진입점에서 import하는 파일은 삭제하지 않는다. `src/entries/step1.ts`, `apps/main/app.js`, `apps/main/styles.css`, Main 전용 module은 신규 진입점과 새 테스트가 더 이상 참조하지 않을 때만 삭제한다.

- [ ] **Step 7: 신규 Main 단위·E2E를 통과시킨다**

Run:

```bash
npm run test:unit -- tests/unit/main
npm run check
npm run test:e2e -- tests/main-react.spec.ts --reporter=line
```

Expected: 모든 Main 단위 테스트 PASS, TypeScript exit 0, 신규 Main E2E PASS.

- [ ] **Step 8: 전체 기존 E2E 회귀를 확인한다**

Run: `npm run test:e2e -- --reporter=line`

Expected: Account Map와 Simulation 회귀 없음. 기준선의 `tests/step2.spec.ts:528`만 같은 원인으로 실패할 수 있다. 다른 실패가 있으면 전환 회귀로 처리하고 수정 후 재실행한다.

- [ ] **Step 9: 정적 빌드와 하위 경로를 검증한다**

버전 자동 증가를 피하기 위해 검증 중에는 직접 Vite 빌드를 사용한다.

```bash
npx vite build
rg -n '="/assets/|href="/apps/|src="/src/' dist
test -f dist/apps/main/index.html
test -f dist/manifest.webmanifest
```

Expected: Vite exit 0, `rg` 결과 없음, 두 파일 존재.

Playwright 정적 서버로 `dist`를 열어 다음 URL을 직접 방문한다.

```text
http://127.0.0.1:4173/IndividualSavingsFlowUI/apps/main/
```

Main이 로드되고 모든 JS/CSS 요청이 200인지 확인한다.

- [ ] **Step 10: 최종 커밋한다**

```bash
git add apps/main src/main src/entries/step1.ts src/styles vite.config.ts public/manifest.webmanifest tests package.json package-lock.json
git commit -m "feat(main): cut over to React rebuild"
```

---

## Final Verification

- [ ] `npm run test:unit -- tests/unit/main` 전체 통과
- [ ] `npm run check` 통과
- [ ] `npm run test:e2e -- tests/main-react.spec.ts --reporter=line` 통과
- [ ] 전체 E2E가 기준선보다 나빠지지 않음
- [ ] `npx vite build` 통과
- [ ] `dist/apps/main/index.html` 존재
- [ ] 빌드 결과에 `="/assets/`, `href="/apps/`, `src="/src/` 없음
- [ ] 기존 `isf-rebuild-v1` fixture가 자동 변환됨
- [ ] 저장 실패 시 기존 데이터가 유지됨
- [ ] 신규 설정, 설정 재개, 다시 설정, 적용, 취소가 390px과 1280px에서 동작
- [ ] Simulation, Portfolio, Account Map 진입점이 계속 빌드됨

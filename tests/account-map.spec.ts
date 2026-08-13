import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'isf-workspace-v1';
const now = Date.UTC(2026, 7, 13, 6);

const main = {
  schemaVersion: 2 as const,
  updatedAt: now,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const protectedSlices = {
  main: { applied: main, setupProgress: null },
  simulation: { draft: null },
  portfolio: { plans: [], draft: null },
};

function emptyWorkspace() {
  return {
    schemaVersion: 2 as const,
    revision: 1,
    updatedAt: now,
    ...structuredClone(protectedSlices),
    locations: [],
    accountMap: {
      applied: null,
      draft: null,
      legacyPhaseA: { instruments: [], flows: [] },
    },
  };
}

function mappedWorkspace() {
  const workspace = emptyWorkspace();
  workspace.locations = [
    location('salary', '급여통장', 'kb-kookmin', 'KB국민은행', ['income']),
    location('living', '생활비통장', 'toss-bank', '토스뱅크', ['spending']),
  ];
  workspace.accountMap.applied = {
    schemaVersion: 1,
    sourceMainUpdatedAt: now,
    customPurposes: [],
    links: [
      link('income', 'system:income', 'salary', 3_200_000, true),
      link('living', 'system:living', 'living', 1_000_000, true),
    ],
    layout: 'purpose',
    setupCompletedAt: now,
    updatedAt: now,
  };
  return workspace;
}

function editableWorkspace() {
  const workspace = mappedWorkspace();
  workspace.locations.push(location('living-backup', '보조생활비', 'kakao-bank', '카카오뱅크', ['spending']));
  workspace.accountMap.applied!.links.find(({ id }) => id === 'living')!.monthlyAmountWon = 900_000;
  workspace.accountMap.applied!.links.push(link('living-backup', 'system:living', 'living-backup', 100_000, false));
  return workspace;
}

function location(id: string, shortName: string, institutionId: string, institutionName: string, roles: string[]) {
  return { id, shortName, institution: { id: institutionId, name: institutionName }, kind: 'bank', roles, createdAt: now, updatedAt: now };
}

function link(id: string, purposeId: string, locationId: string, monthlyAmountWon: number, remainder: boolean) {
  return { id, purposeId, locationId, monthlyAmountWon, remainder, status: 'active', createdAt: now, updatedAt: now };
}

async function seed(page: Page, workspace: ReturnType<typeof emptyWorkspace>) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: workspace });
}

async function readProtected(page: Page) {
  return page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key)!);
    return { main: workspace.main, simulation: workspace.simulation, portfolio: workspace.portfolio };
  }, STORAGE_KEY);
}

async function openNode(page: Page, name: RegExp) {
  await page.locator('.account-map-canvas').click({ position: { x: 8, y: 8 } });
  const node = page.getByRole('button', { name }).first();
  await node.click();
  await node.click();
}

test('requires Main without creating Account Map state', async ({ page }) => {
  const workspace = emptyWorkspace();
  workspace.main.applied = null;
  await seed(page, workspace);
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: '월 자금 계획이 먼저 필요해요' })).toBeVisible();
  await expect(page.getByRole('link', { name: '월 자금 계획 만들기' })).toBeVisible();
  expect(await readProtected(page)).toEqual({ ...protectedSlices, main: { applied: null, setupProgress: null } });
});

test('creates a purpose-first map and preserves protected product slices', async ({ page }) => {
  await seed(page, emptyWorkspace());
  await page.goto('apps/account-map/');
  const before = await readProtected(page);

  await page.getByRole('article').filter({ hasText: '수입' }).getByRole('button', { name: '연결' }).click();
  await page.getByRole('button', { name: '새 계좌·보관처 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '수입 연결' });
  for (const bank of ['KB국민은행', '신한은행', '하나은행', '우리은행', 'NH농협은행', 'IBK기업은행', 'KDB산업은행', '토스뱅크', '카카오뱅크', '직접 입력']) {
    await expect(dialog.getByRole('button', { name: bank, exact: true })).toBeVisible();
  }
  await dialog.getByRole('button', { name: 'KB국민은행', exact: true }).click();
  await dialog.getByLabel('표시 이름').fill('급여통장');
  await dialog.getByRole('button', { name: '완료' }).click();

  await page.getByRole('button', { name: '세부 목적 추가' }).click();
  const purposeDialog = page.getByRole('dialog', { name: '세부 목적 추가' });
  await purposeDialog.getByLabel('목적 이름').fill('여행');
  await purposeDialog.getByLabel('월 금액').fill('100000');
  await purposeDialog.getByRole('button', { name: '추가' }).click();

  await page.getByRole('button', { name: '검토' }).click();
  await expect(page.getByRole('heading', { name: '연결 검토' })).toBeVisible();
  await page.getByRole('button', { name: '지도 만들기' }).click();
  await expect(page.getByRole('heading', { name: '계좌 연결 지도' })).toBeVisible();
  expect(await readProtected(page)).toEqual(before);
});

test('persists a resumed review step and exits to Main without deleting its draft', async ({ page }) => {
  const workspace = emptyWorkspace();
  workspace.accountMap.draft = {
    schemaVersion: 1,
    sourceMainUpdatedAt: now,
    customPurposes: [],
    links: [],
    step: 'connect',
    updatedAt: now,
  };
  await seed(page, workspace);
  await page.goto('apps/account-map/');
  await page.getByRole('button', { name: '검토' }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.draft.step, STORAGE_KEY)).toBe('review');
  await page.getByRole('button', { name: '이전' }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.draft.step, STORAGE_KEY)).toBe('connect');
  await page.getByRole('button', { name: '나가기' }).click();
  await expect(page).toHaveURL(/\/apps\/main\/$/);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.draft.step, STORAGE_KEY)).toBe('connect');
});

test('supports layout, semantic zoom, focus parity, second invoke, and same-modal edit', async ({ page }) => {
  await seed(page, editableWorkspace());
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: '목적과 계좌의 연결' })).toBeVisible();

  const living = page.getByRole('button', { name: /생활비.*1,000,000원/ }).first();
  await living.hover();
  await expect(page.locator('.account-map-edge-amount')).toHaveText(['900,000원', '100,000원']);
  await page.locator('.account-map-canvas').click({ position: { x: 8, y: 8 } });
  await expect(living).not.toHaveClass(/is-pinned/);
  await living.focus();
  await expect(page.locator('.account-map-edge-amount')).toHaveText(['900,000원', '100,000원']);
  await living.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await living.click();
  const detail = page.getByRole('dialog', { name: /생활비 상세/ });
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: '편집' }).click();
  await expect(page.getByRole('dialog', { name: /생활비 편집/ })).toBeVisible();
  await page.getByRole('textbox', { name: '보조생활비 월 금액' }).fill('200000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.applied.links.find((item: { id: string }) => item.id === 'living-backup').monthlyAmountWon, STORAGE_KEY)).toBe(200_000);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.applied.links.find((item: { id: string }) => item.id === 'living').monthlyAmountWon, STORAGE_KEY)).toBe(800_000);

  await page.getByRole('button', { name: '계좌 중심' }).click();
  await expect(page.getByRole('button', { name: '계좌 중심' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '축소' }).click();
  await expect(page.getByRole('button', { name: '확대' })).toBeEnabled();
  await expect(page.getByRole('table', { name: '계좌 연결 읽기 표' })).toBeAttached();
});

test('archives, selectively restores, and resets only Account Map', async ({ page }) => {
  await seed(page, mappedWorkspace());
  await page.goto('apps/account-map/');
  const before = await readProtected(page);

  await openNode(page, /^생활비통장$/);
  await page.getByRole('button', { name: '보관' }).click();
  await expect(page.getByText('생활비 1,000,000원 연결이 중지됩니다')).toBeVisible();
  await page.getByRole('button', { name: '보관하기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await readProtected(page)).toEqual(before);

  await page.getByRole('button', { name: '확대' }).click();
  await openNode(page, /^생활비통장$/);
  await page.getByRole('button', { name: '복원' }).click();
  await page.getByRole('checkbox', { name: /생활비/ }).check();
  await page.getByRole('button', { name: '선택 복원' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await readProtected(page)).toEqual(before);

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: '월 연결 다시 만들기' }).click();
  await page.getByRole('button', { name: '다시 만들기' }).click();
  await expect(page.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
  expect(await readProtected(page)).toEqual(before);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.locations).toHaveLength(2);
  expect(stored.accountMap.applied).toBeNull();
});

test('migrates a v1 workspace without touching its protected slices', async ({ page }) => {
  const current = mappedWorkspace();
  const legacy = {
    ...current,
    schemaVersion: 1,
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
  await seed(page, legacy as ReturnType<typeof emptyWorkspace>);
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.schemaVersion).toBe(2);
  expect({ main: stored.main, simulation: stored.simulation, portfolio: stored.portfolio }).toEqual(protectedSlices);
});

test('honors reduced motion and stays contained at supported widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, mappedWorkspace());
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/account-map/');
    const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    await openNode(page, /생활비.*1,000,000원/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '닫기' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'isf-workspace-v3';
const RETIRED_STORAGE_KEY = 'isf-workspace-v1';
const now = Date.UTC(2026, 7, 13, 6);

test.use({ hasTouch: true });

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
    schemaVersion: 3 as const,
    revision: 1,
    updatedAt: now,
    ...structuredClone(protectedSlices),
    locations: [],
    accountMap: {
      applied: null,
      draft: null,
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
    schemaVersion: 2,
    sourceMainUpdatedAt: now,
    customPurposes: [],
    links: [
      link('income', 'system:income', 'salary', 3_200_000, true),
      link('living', 'system:living', 'living', 1_000_000, true),
    ],
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

function responsiveWorkspace() {
  const workspace = editableWorkspace();
  workspace.locations.push({
    ...location('archived-vault', '보관함', 'hana', '하나은행', ['saving']),
    archivedAt: now,
  });
  workspace.accountMap.applied!.links.find(({ id }) => id === 'living')!.monthlyAmountWon = 800_000;
  workspace.accountMap.applied!.customPurposes = [
    {
      id: 'custom:trip', parentId: 'system:living', name: '여행', targetMonthlyWon: 100_000,
      createdAt: now, updatedAt: now,
    },
    {
      id: 'custom:gifts', parentId: 'system:living', name: '선물', targetMonthlyWon: 50_000,
      archivedAt: now, createdAt: now, updatedAt: now,
    },
  ];
  workspace.accountMap.applied!.links.push(
    link('trip-link', 'custom:trip', 'living-backup', 100_000, true),
    {
      ...link('gifts-link', 'custom:gifts', 'living', 50_000, false),
      status: 'suspended',
      suspendedReason: 'user',
    },
  );
  return workspace;
}

function archivableDetailWorkspace() {
  const workspace = mappedWorkspace();
  workspace.locations.push(location('archived-detail', '보관 대상 통장', 'woori', '우리은행', ['saving']));
  workspace.accountMap.applied!.links.push(link('archived-detail-link', 'system:saving', 'archived-detail', 300_000, false));
  return workspace;
}

function primaryIncomeWorkspace() {
  const workspace = responsiveWorkspace();
  workspace.locations.push(location('primary-income', '주수입통장', 'shinhan', '신한은행', ['income']));
  workspace.accountMap.applied!.links.find(({ id }) => id === 'income')!.monthlyAmountWon = 1_200_000;
  // Keep the larger income link second in stored order: the map must rank by amount, not storage order.
  workspace.accountMap.applied!.links.splice(1, 0, link('primary-income', 'system:income', 'primary-income', 2_000_000, false));
  return workspace;
}

function manyToManyWorkspace() {
  const workspace = mappedWorkspace();
  workspace.locations.push(location('brokerage', 'ISA', 'future-bank', '미래은행', ['investing']));
  workspace.accountMap.applied!.links.push(link('investing-brokerage', 'system:investing', 'brokerage', 50_000, false));
  workspace.simulation.draft = {
    schemaVersion: 3,
    source: {
      monthlySavingsWon: main.monthlySavingWon,
      monthlyInvestmentWon: main.monthlyInvestmentWon,
      mainUpdatedAt: main.updatedAt,
    },
    initialInvestmentWon: 2_000_000,
    years: 20,
    expectedAnnualReturnPercent: 8,
    baseRatePercent: 2.5,
    inflationOffsetPercentPoints: -0.5,
    amountMode: 'nominal',
    updatedAt: now,
    targetAmountWon: 100_000_000,
  };
  workspace.portfolio.plans = [
    {
      schemaVersion: 2,
      scope: { type: 'aggregate' },
      items: [{
        id: 'asset-global', name: '글로벌 인덱스', shareUnits: 700_000, order: 0,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
      cashShareUnits: 300_000,
      cashMode: 'automatic',
      syncedInvestmentWon: main.monthlyInvestmentWon,
      appliedAt: now,
      updatedAt: now,
    },
  ];
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

async function seedRetired(page: Page, workspace: unknown) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: RETIRED_STORAGE_KEY,
    value: workspace,
  });
}

async function seedMigrationCollision(page: Page, legacy: unknown, latest: ReturnType<typeof emptyWorkspace>) {
  await page.addInitScript(({ retiredKey, currentKey, legacyWorkspace, latestWorkspace }) => {
    localStorage.setItem(retiredKey, JSON.stringify(legacyWorkspace));
    const originalRequest = navigator.locks.request.bind(navigator.locks);
    let injected = false;
    Object.defineProperty(navigator.locks, 'request', {
      configurable: true,
      value: (name: string, callback: (lock: Lock | null) => unknown) => {
        if (!injected && name === 'isf-workspace-v1-save') {
          injected = true;
          localStorage.setItem(currentKey, JSON.stringify(latestWorkspace));
        }
        return originalRequest(name, callback);
      },
    });
  }, {
    retiredKey: RETIRED_STORAGE_KEY,
    currentKey: STORAGE_KEY,
    legacyWorkspace: legacy,
    latestWorkspace: latest,
  });
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

async function touchDrag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y, id: 1 }] });
  for (let step = 1; step <= 4; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: start.x + ((end.x - start.x) * step) / 4,
        y: start.y + ((end.y - start.y) * step) / 4,
        id: 1,
      }],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

async function expectContainedActionTargets(page: Page, state: string) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const audit = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const actions = [...document.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="menuitem"]',
    )].filter(visible);
    const uniqueTargets = new Map<HTMLElement, HTMLElement>();
    for (const action of actions) {
      const input = action instanceof HTMLInputElement ? action : null;
      const label = input !== null && (input.type === 'checkbox' || input.type === 'radio')
        ? input.closest('label') ?? (input.id === '' ? null : document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`))
        : null;
      uniqueTargets.set(action, label ?? action);
    }
    const failures = [...uniqueTargets].flatMap(([action, target]) => {
      const rect = target.getBoundingClientRect();
      if (rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= window.innerWidth) return [];
      return [{
        name: action.getAttribute('aria-label') ?? action.textContent?.trim().slice(0, 60) ?? action.tagName,
        tag: action.tagName,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
      }];
    });
    return {
      count: actions.length,
      failures,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
  expect(audit.count, `${state}: visible actions`).toBeGreaterThan(0);
  expect(audit.documentWidth, `${state}: horizontal overflow`).toBeLessThanOrEqual(audit.viewportWidth);
  expect(audit.failures, `${state}: 44px targets or viewport containment`).toEqual([]);
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

test('creates an Account Map and preserves protected product slices', async ({ page }) => {
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

test('creates brokerage and cash locations from setup location kinds', async ({ page }) => {
  await seed(page, emptyWorkspace());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/account-map/');

  await page.getByRole('article').filter({ hasText: '투자' }).getByRole('button', { name: '연결' }).click();
  const investingDialog = page.getByRole('dialog', { name: '투자 연결' });
  await investingDialog.getByRole('button', { name: '새 계좌·보관처 추가' }).click();
  await investingDialog.getByRole('button', { name: '증권' }).click();
  await expect(investingDialog.getByRole('textbox', { name: '기관 이름' })).toBeVisible();
  await investingDialog.getByRole('textbox', { name: '기관 이름' }).fill('미래증권');
  await investingDialog.getByRole('textbox', { name: '표시 이름' }).fill('ISA');
  await investingDialog.getByRole('button', { name: '완료' }).click();

  await page.getByRole('article').filter({ hasText: '저축' }).getByRole('button', { name: '연결' }).click();
  const savingDialog = page.getByRole('dialog', { name: '저축 연결' });
  await savingDialog.getByRole('button', { name: '새 계좌·보관처 추가' }).click();
  await savingDialog.getByRole('button', { name: '현금' }).click();
  await expect(savingDialog.getByRole('textbox', { name: '기관 이름' })).toHaveCount(0);
  await savingDialog.getByRole('textbox', { name: '표시 이름' }).fill('금현물');
  await savingDialog.getByRole('button', { name: '완료' }).click();

  await expect.poll(() => page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key)!);
    return workspace.locations.map((item: { shortName: string; kind: string; institution?: { name: string }; roles: string[] }) => ({
      shortName: item.shortName,
      kind: item.kind,
      institutionName: item.institution?.name,
      roles: item.roles,
    }));
  }, STORAGE_KEY)).toEqual([
    { shortName: 'ISA', kind: 'brokerage', institutionName: '미래증권', roles: ['investing'] },
    { shortName: '금현물', kind: 'cash', institutionName: undefined, roles: ['saving'] },
  ]);
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

test('supports the canonical map, semantic zoom, focus parity, second invoke, and same-modal edit', async ({ page }) => {
  await seed(page, editableWorkspace());
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: '목적과 계좌의 연결' })).toBeVisible();
  await expect(page.getByRole('button', {
    name: '목적 · 생활비 · 1,000,000원 · 활성 연결 2개 · 연결 완료',
  })).toBeVisible();
  await expect(page.getByRole('button', {
    name: '계좌·보관처 · 생활비통장 · 활성 연결 1개 · 연결 완료',
  })).toBeVisible();

  const living = page.getByRole('button', { name: /생활비.*1,000,000원/ }).first();
  await living.hover();
  const pointerAmounts = await page.locator('.account-map-edge-amount').allTextContents();
  expect(pointerAmounts).toEqual(['900,000원', '100,000원']);
  await page.locator('.account-map-canvas').click({ position: { x: 8, y: 8 } });
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);
  await living.focus();
  expect(await page.locator('.account-map-edge-amount').allTextContents()).toEqual(pointerAmounts);
  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  expect(await page.locator('.account-map-edge-amount').allTextContents()).toEqual(pointerAmounts);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(living).toBeFocused();
  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  await page.locator('.account-map-canvas').click({ position: { x: 8, y: 8 } });
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);
  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  await living.tap();
  await expect(page.getByRole('dialog', { name: /생활비 상세/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await living.tap();
  const detail = page.getByRole('dialog', { name: /생활비 상세/ });
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: '편집' }).click();
  await expect(page.getByRole('dialog', { name: /생활비 편집/ })).toBeVisible();
  await page.getByRole('textbox', { name: '보조생활비 월 금액' }).fill('200000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.applied.links.find((item: { id: string }) => item.id === 'living-backup').monthlyAmountWon, STORAGE_KEY)).toBe(200_000);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.applied.links.find((item: { id: string }) => item.id === 'living').monthlyAmountWon, STORAGE_KEY)).toBe(800_000);

  await expect(page.getByRole('button', { name: '목적 중심' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '계좌 중심' })).toHaveCount(0);
  await page.getByRole('button', { name: '축소' }).click();
  await expect(page.getByRole('button', { name: '확대' })).toBeEnabled();
  await expect(page.getByRole('table', { name: '계좌 연결 읽기 표' })).toBeAttached();
  await expect(page.getByRole('table', { name: '계좌 연결 읽기 표' })).not.toHaveAttribute('tabindex');
});

test('keeps overview node and edge topology representative-only, then restores unlinked discovery at default zoom', async ({ page }) => {
  const workspace = editableWorkspace();
  workspace.locations.push(location('vault', '비상금함', 'hana', '하나은행', ['saving']));
  await seed(page, workspace);
  await page.goto('apps/account-map/');

  await expect(page.locator('.account-map-node--location')).toHaveCount(4);
  await expect(page.locator('.account-map-edges path')).toHaveCount(3);
  await page.getByRole('button', { name: '축소' }).click();
  await expect(page.getByText('전체 보기')).toBeVisible();
  await expect(page.getByRole('button', {
    name: '계좌·보관처 · 생활비통장 · 활성 연결 1개 · 연결 완료',
  })).toBeVisible();
  await expect(page.getByRole('button', {
    name: '목적 · 생활비 · 1,000,000원 · 활성 연결 2개 · 연결 완료',
  })).toBeVisible();
  await expect(page.getByRole('button', { name: /보조생활비/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /비상금함/ })).toHaveCount(0);
  await expect(page.locator('.account-map-node--location')).toHaveCount(2);
  await expect(page.locator('.account-map-edges path')).toHaveCount(2);
  await expect(page.locator('.account-map-linear-table tbody tr')).toHaveCount(2);

  await page.getByRole('button', { name: '확대' }).click();
  const unlinked = page.getByRole('button', {
    name: '계좌·보관처 · 비상금함 · 활성 연결 0개 · 연결 완료',
  });
  await expect(page.getByText('기본 보기')).toBeVisible();
  await expect(page.getByRole('button', { name: /보조생활비/ })).toBeVisible();
  await expect(unlinked).toBeVisible();
  await openNode(page, /계좌·보관처 · 비상금함 · 활성 연결 0개 · 연결 완료/);
  await expect(page.getByRole('dialog', { name: '비상금함 상세' })).toBeVisible();
});

test('shows the Main reference on a system purpose while keeping its direct links at the remainder', async ({ page }) => {
  const workspace = responsiveWorkspace();
  await seed(page, workspace);
  await page.goto('apps/account-map/');

  const living = page.getByRole('button', {
    name: '목적 · 생활비 · 1,000,000원 · 활성 연결 2개 · 연결 완료',
  });
  await expect(living).toBeVisible();
  await expect(page.getByRole('button', {
    name: '목적 · 여행 · 100,000원 · 활성 연결 1개 · 연결 완료',
  })).toBeVisible();
  await living.focus();
  expect(await page.locator('.account-map-edge-amount').allTextContents()).toEqual(['800,000원', '100,000원']);
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(persisted.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living'))
    .toMatchObject({ monthlyAmountWon: 800_000, remainder: true });
  expect(persisted.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living-backup'))
    .toMatchObject({ monthlyAmountWon: 100_000, remainder: false });
});

test('gives management overlays first Escape ownership before clearing a pinned map node', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, responsiveWorkspace());
  await page.goto('apps/account-map/');
  const living = page.getByRole('button', { name: /생활비.*1,000,000원/ }).first();

  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(2);
  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await expect(page.getByRole('menu', { name: '관리 메뉴' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: '관리 메뉴' })).toHaveCount(0);
  await expect(living).toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);

  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: '월 연결 다시 만들기' }).click();
  const confirmation = page.getByRole('dialog', { name: '월 연결을 다시 만들까요?' });
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(living).toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);

  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: /선물 · 생활비 · 50,000원/ }).click();
  const purposeRestore = page.getByRole('dialog', { name: '선물 복원' });
  await expect(purposeRestore).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(purposeRestore).toHaveCount(0);
  await expect(living).toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);
});

test('gives a visible launcher tooltip first Escape ownership without moving focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, editableWorkspace());
  await page.goto('apps/account-map/');
  const living = page.getByRole('button', { name: /생활비.*1,000,000원/ }).first();
  const mainLink = page.getByRole('link', { name: '자금 흐름 (Main)' });

  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  expect(await page.locator('.account-map-edge-amount').allTextContents()).toEqual(['900,000원', '100,000원']);
  await mainLink.focus();
  await expect(mainLink).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('자금 흐름 (Main)');

  await page.keyboard.press('Escape');

  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(mainLink).toBeFocused();
  await expect(living).toHaveClass(/is-pinned/);
  expect(await page.locator('.account-map-edge-amount').allTextContents()).toEqual(['900,000원', '100,000원']);

  await page.keyboard.press('Escape');

  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(mainLink).toBeFocused();
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);

  await page.addStyleTag({ content: '.journey-launcher { width: 220px !important; }' });
  const more = page.getByRole('button', { name: '앱 더보기' });
  await expect(more).toBeVisible();
  await living.tap();
  await expect(living).toHaveClass(/is-pinned/);
  await more.click();
  await expect(page.getByRole('region', { name: '추가 앱' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('region', { name: '추가 앱' })).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(living).toHaveClass(/is-pinned/);
  expect(await page.locator('.account-map-edge-amount').allTextContents()).toEqual(['900,000원', '100,000원']);

  await page.keyboard.press('Escape');

  await expect(more).toBeFocused();
  await expect(living).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.account-map-edge-amount')).toHaveCount(0);
});

test('explicitly reapplies a stale edit without losing an unrelated concurrent change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, editableWorkspace());
  await page.goto('apps/account-map/');
  const concurrentSimulationDraft = {
    schemaVersion: 3,
    source: {
      monthlySavingsWon: main.monthlySavingWon,
      monthlyInvestmentWon: main.monthlyInvestmentWon,
      mainUpdatedAt: main.updatedAt,
    },
    initialInvestmentWon: 1_000_000,
    years: 10,
    expectedAnnualReturnPercent: 7,
    baseRatePercent: 2.5,
    inflationOffsetPercentPoints: 0,
    amountMode: 'nominal',
    updatedAt: now + 1,
    targetAmountWon: 100_000_000,
  };

  await openNode(page, /생활비.*1,000,000원/);
  await page.getByRole('button', { name: '편집' }).click();
  const input = page.getByRole('textbox', { name: '보조생활비 월 금액' });
  await input.fill('200000');

  await page.evaluate(({ key, draft }) => {
    const workspace = JSON.parse(localStorage.getItem(key)!);
    workspace.revision += 1;
    workspace.updatedAt += 1;
    workspace.simulation.draft = draft;
    localStorage.setItem(key, JSON.stringify(workspace));
  }, { key: STORAGE_KEY, draft: concurrentSimulationDraft });

  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('status')).toContainText('편집 중인 입력은 그대로 두었습니다.');
  await expect(input).toHaveValue('200,000');
  await page.getByRole('button', { name: '최신 상태에서 다시 적용' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const stored = await page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key)!);
    return { workspace, simulationDraftJson: JSON.stringify(workspace.simulation.draft) };
  }, STORAGE_KEY);
  expect(stored.workspace.revision).toBe(3);
  expect(stored.workspace.simulation.draft).toEqual(concurrentSimulationDraft);
  expect(stored.simulationDraftJson).toBe(JSON.stringify(concurrentSimulationDraft));
  expect(stored.workspace.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living-backup'))
    .toMatchObject({ monthlyAmountWon: 200_000, remainder: false });
  expect(stored.workspace.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living'))
    .toMatchObject({ monthlyAmountWon: 800_000, remainder: true });
});

test('blocks a same-field stale replay, preserves input, and focuses the conflict', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, editableWorkspace());
  await page.goto('apps/account-map/');

  await openNode(page, /생활비.*1,000,000원/);
  await page.getByRole('button', { name: '편집' }).click();
  const input = page.getByRole('textbox', { name: '보조생활비 월 금액' });
  await input.fill('200000');

  await page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key)!);
    workspace.revision += 1;
    workspace.updatedAt += 1;
    const fixed = workspace.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living-backup');
    const remainder = workspace.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living');
    fixed.monthlyAmountWon = 150_000;
    fixed.updatedAt = workspace.updatedAt;
    remainder.monthlyAmountWon = 850_000;
    remainder.updatedAt = workspace.updatedAt;
    workspace.accountMap.applied.updatedAt = workspace.updatedAt;
    localStorage.setItem(key, JSON.stringify(workspace));
  }, STORAGE_KEY);

  await page.getByRole('button', { name: '저장' }).click();
  await expect(input).toHaveValue('200,000');
  await page.getByRole('button', { name: '최신 상태에서 다시 적용' }).click();
  await expect(page.getByRole('alert')).toContainText('월 금액 항목이 최신 상태에서도 변경되어');
  await expect(input).toHaveValue('200,000');
  await expect(input).toBeFocused();

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.revision).toBe(2);
  expect(stored.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living-backup'))
    .toMatchObject({ monthlyAmountWon: 150_000, remainder: false });
  expect(stored.accountMap.applied.links.find(({ id }: { id: string }) => id === 'living'))
    .toMatchObject({ monthlyAmountWon: 850_000, remainder: true });
});

test('requires Main after a concurrent whole-workspace restore removes its applied plan', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, editableWorkspace());
  await page.goto('apps/account-map/');
  const restored = emptyWorkspace();
  restored.revision = 2;
  restored.updatedAt = now + 1;
  restored.main.applied = null;

  await openNode(page, /계좌·보관처 · 생활비통장 ·/);
  await page.getByRole('button', { name: '편집' }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('생활통장');
  await page.getByRole('textbox', { name: '생활비 월 금액' }).fill('800000');

  await page.evaluate(({ key, workspace }) => {
    localStorage.setItem(key, JSON.stringify(workspace));
  }, { key: STORAGE_KEY, workspace: restored });

  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '월 자금 계획이 먼저 필요해요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '최신 상태에서 다시 검토' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '최신 상태에서 다시 적용' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.main.applied).toBeNull();
  expect(stored.accountMap.applied).toBeNull();
});

test('does not replay a single location edit after a concurrent empty-Main restore', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const initial = editableWorkspace();
  await seed(page, initial);
  await page.goto('apps/account-map/');
  const restored = structuredClone(initial);
  restored.revision = 2;
  restored.updatedAt = now + 1;
  restored.main.applied = null;
  restored.accountMap.applied = null;
  restored.accountMap.draft = null;
  const restoredJson = JSON.stringify(restored);

  await openNode(page, /계좌·보관처 · 생활비통장 ·/);
  await page.getByRole('button', { name: '편집' }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('생활통장');

  await page.evaluate(({ key, workspace }) => {
    localStorage.setItem(key, JSON.stringify(workspace));
    const originalSetItem = Storage.prototype.setItem;
    Object.defineProperty(window, '__accountMapWrites', { configurable: true, value: 0, writable: true });
    Storage.prototype.setItem = function setItem(storageKey: string, value: string) {
      if (storageKey === key) {
        (window as typeof window & { __accountMapWrites: number }).__accountMapWrites += 1;
      }
      originalSetItem.call(this, storageKey, value);
    };
  }, { key: STORAGE_KEY, workspace: restored });

  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '월 자금 계획이 먼저 필요해요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '최신 상태에서 다시 적용' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '표시 이름' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const persisted = await page.evaluate((key) => ({
    raw: localStorage.getItem(key),
    writes: (window as typeof window & { __accountMapWrites: number }).__accountMapWrites,
  }), STORAGE_KEY);
  expect(persisted.writes).toBe(0);
  expect(persisted.raw).toBe(restoredJson);
  const stored = JSON.parse(persisted.raw!);
  expect(stored.revision).toBe(2);
  expect(stored.locations).toEqual(restored.locations);
  expect(stored.main).toEqual(restored.main);
  expect(stored.simulation).toEqual(restored.simulation);
  expect(stored.portfolio).toEqual(restored.portfolio);
});

test('connects a spending location to investing with one role-and-link revision', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, manyToManyWorkspace());
  await page.goto('apps/account-map/');
  const before = await readProtected(page);
  await page.evaluate((key) => {
    const originalSetItem = Storage.prototype.setItem;
    Object.defineProperty(window, '__accountMapWrites', { configurable: true, value: 0, writable: true });
    Storage.prototype.setItem = function setItem(storageKey: string, value: string) {
      if (storageKey === key) {
        (window as typeof window & { __accountMapWrites: number }).__accountMapWrites += 1;
      }
      originalSetItem.call(this, storageKey, value);
    };
  }, STORAGE_KEY);

  await openNode(page, /투자.*200,000원/);
  await page.getByRole('button', { name: '편집' }).click();
  await page.getByRole('button', { name: '연결 추가' }).click();
  const connect = page.getByRole('dialog', { name: '투자 연결 추가' });
  await connect.getByRole('button', { name: /생활비통장/ }).click();
  await connect.getByRole('textbox', { name: /이 계좌에 둘 월 금액/ }).fill('150000');
  await connect.getByRole('button', { name: '완료' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const stored = await page.evaluate((key) => ({
    workspace: JSON.parse(localStorage.getItem(key)!),
    writes: (window as typeof window & { __accountMapWrites: number }).__accountMapWrites,
  }), STORAGE_KEY);
  expect(stored.workspace.revision).toBe(2);
  expect(stored.writes).toBe(1);
  expect(stored.workspace.locations.find(({ id }: { id: string }) => id === 'living').roles)
    .toEqual(['spending', 'investing']);
  expect(stored.workspace.accountMap.applied.links.filter((item: { purposeId: string; locationId: string }) => (
    item.purposeId === 'system:investing' && item.locationId === 'living'
  ))).toEqual([expect.objectContaining({ monthlyAmountWon: 150_000, remainder: false, status: 'active' })]);
  expect(stored.workspace.accountMap.applied.links.filter(({ purposeId }: { purposeId: string }) => purposeId === 'system:investing'))
    .toHaveLength(2);
  expect(stored.workspace.accountMap.applied.links.filter(({ purposeId }: { purposeId: string }) => purposeId === 'system:investing'))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ locationId: 'brokerage', monthlyAmountWon: 50_000, remainder: true }),
      expect.objectContaining({ locationId: 'living', monthlyAmountWon: 150_000, remainder: false }),
    ]));
  expect(stored.workspace.accountMap.applied.links.filter(({ locationId }: { locationId: string }) => locationId === 'living'))
    .toHaveLength(2);
  expect(stored.workspace.accountMap.applied.links.filter(({ locationId }: { locationId: string }) => locationId === 'living'))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ purposeId: 'system:living' }),
      expect.objectContaining({ purposeId: 'system:investing' }),
    ]));
  expect(await readProtected(page)).toEqual(before);
});

test('creates, archives, and restores a corrected custom purpose without resuming its links', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, emptyWorkspace());
  await page.goto('apps/account-map/');

  await page.getByRole('article').filter({ hasText: '수입' }).getByRole('button', { name: '연결' }).click();
  await page.getByRole('button', { name: '새 계좌·보관처 추가' }).click();
  const incomeDialog = page.getByRole('dialog', { name: '수입 연결' });
  await incomeDialog.getByRole('button', { name: 'KB국민은행', exact: true }).click();
  await incomeDialog.getByLabel('표시 이름').fill('급여통장');
  await incomeDialog.getByRole('button', { name: '완료' }).click();

  for (const [name, amount] of [['여행', '400000'], ['통신비', '600000']] as const) {
    await page.getByRole('button', { name: '세부 목적 추가' }).click();
    const purposeDialog = page.getByRole('dialog', { name: '세부 목적 추가' });
    if (name === '여행') {
      const parent = purposeDialog.getByRole('combobox', { name: '큰 목적' });
      await expect(parent).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(purposeDialog.getByRole('button', { name: '취소' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(parent).toBeFocused();
    }
    await purposeDialog.getByLabel('목적 이름').fill(name);
    await purposeDialog.getByLabel('월 금액').fill(amount);
    await purposeDialog.getByRole('button', { name: '추가' }).click();
  }

  await page.getByRole('article').filter({ hasText: '여행' }).getByRole('button', { name: '연결' }).click();
  const tripConnection = page.getByRole('dialog', { name: '여행 연결' });
  await tripConnection.getByRole('button', { name: /급여통장/ }).click();
  await tripConnection.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '검토' }).click();
  await page.getByRole('button', { name: '지도 만들기' }).click();

  await openNode(page, /여행.*400,000원/);
  const tripDetail = page.getByRole('dialog', { name: '여행 상세' });
  await tripDetail.getByRole('button', { name: '여행 더보기' }).click();
  await tripDetail.getByRole('menuitem', { name: '목적 보관' }).click();
  await page.getByRole('dialog', { name: '여행 보관' }).getByRole('button', { name: '보관하기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /여행.*400,000원/ })).toHaveCount(0);

  await openNode(page, /통신비.*600,000원/);
  await page.getByRole('button', { name: '편집' }).click();
  const telecomEdit = page.getByRole('dialog', { name: '통신비 편집' });
  await telecomEdit.getByRole('textbox', { name: '월 목표 금액' }).fill('900000');
  await telecomEdit.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await expect(page.getByText('보관된 목적 1개')).toBeVisible();
  await page.getByRole('menuitem', { name: /여행.*생활비.*400,000원/ }).click();
  const restore = page.getByRole('dialog', { name: '여행 복원' });
  await expect(restore).toContainText('복원 가능 100,000원');
  await restore.getByRole('textbox', { name: '월 목표 금액' }).fill('100000');
  await restore.getByRole('button', { name: '목적 복원' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /여행.*100,000원/ })).toBeVisible();

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  const trip = stored.accountMap.applied.customPurposes.find(({ name }: { name: string }) => name === '여행');
  const tripLinks = stored.accountMap.applied.links.filter(({ purposeId }: { purposeId: string }) => purposeId === trip.id);
  expect(trip).toMatchObject({ targetMonthlyWon: 100_000 });
  expect(trip).not.toHaveProperty('archivedAt');
  expect(tripLinks).toHaveLength(1);
  expect(tripLinks[0]).toMatchObject({
    status: 'suspended',
    suspendedReason: 'user',
    remainder: false,
  });
});

test('archives, selectively restores, and resets only Account Map', async ({ page }) => {
  await seed(page, mappedWorkspace());
  await page.goto('apps/account-map/');
  const before = await readProtected(page);

  await openNode(page, /계좌·보관처 · 생활비통장 ·/);
  await page.getByRole('button', { name: '보관', exact: true }).click();
  await expect(page.getByText('생활비 1,000,000원 연결이 중지됩니다')).toBeVisible();
  await page.getByRole('button', { name: '보관하기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await readProtected(page)).toEqual(before);

  await page.getByRole('button', { name: '확대' }).click();
  await openNode(page, /계좌·보관처 · 생활비통장 ·/);
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

test('edits and archives an active zero-link location, then restores it from management', async ({ page }) => {
  const workspace = mappedWorkspace();
  workspace.locations.push(location('vault', '비상금함', 'hana', '하나은행', ['saving']));
  await seed(page, workspace);
  await page.goto('apps/account-map/');
  const before = await readProtected(page);

  await openNode(page, /계좌·보관처 · 비상금함 · 활성 연결 0개 · 연결 완료/);
  await expect(page.getByText('연결된 항목이 없습니다.')).toBeVisible();
  await page.getByRole('button', { name: '편집' }).click();
  await page.getByRole('textbox', { name: '표시 이름' }).fill('예비자금');
  await page.getByRole('button', { name: '저장' }).click();
  const renamed = page.getByRole('button', { name: /계좌·보관처 · 예비자금 · 활성 연결 0개 · 연결 완료/ });
  await expect(renamed).toBeVisible();
  await expect(renamed).toBeFocused();

  await openNode(page, /계좌·보관처 · 예비자금 · 활성 연결 0개 · 연결 완료/);
  await page.getByRole('button', { name: '보관', exact: true }).click();
  await page.getByRole('button', { name: '보관하기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '목적과 계좌의 연결' })).toBeFocused();
  await expect(renamed).toHaveCount(0);

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await expect(page.getByText('보관된 계좌·보관처 1개')).toBeVisible();
  await page.getByRole('menuitem', { name: '예비자금 · 하나은행' }).click();
  const restore = page.getByRole('dialog', { name: '예비자금 복원' });
  await expect(restore.getByRole('checkbox')).toHaveCount(0);
  await expect(restore.getByRole('button', { name: '선택 복원' })).toBeEnabled();
  await restore.getByRole('button', { name: '선택 복원' }).click();
  await expect(page.getByRole('button', { name: /계좌·보관처 · 예비자금 · 활성 연결 0개 · 연결 완료/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '관리 메뉴' })).toBeFocused();
  expect(await readProtected(page)).toEqual(before);
});

test('offers only location-archived links and leaves user-suspended links untouched', async ({ page }) => {
  const workspace = mappedWorkspace();
  workspace.locations.push({
    ...location('vault', '혼합보관함', 'hana', '하나은행', ['spending', 'saving']),
    archivedAt: now,
  });
  workspace.accountMap.applied!.links.push(
    {
      ...link('archived-housing', 'system:housing', 'vault', 100_000, false),
      status: 'suspended', suspendedReason: 'location-archived',
    },
    {
      ...link('manual-saving', 'system:saving', 'vault', 200_000, false),
      status: 'suspended', suspendedReason: 'user',
    },
  );
  await seed(page, workspace);
  await page.goto('apps/account-map/');

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: '혼합보관함 · 하나은행' }).click();
  const restore = page.getByRole('dialog', { name: '혼합보관함 복원' });
  await expect(restore.getByRole('checkbox', { name: /주거/ })).toBeVisible();
  await expect(restore.getByRole('checkbox', { name: /저축/ })).toHaveCount(0);
  await restore.getByRole('checkbox', { name: /주거/ }).check();
  await restore.getByRole('button', { name: '선택 복원' }).click();
  await expect(restore).toHaveCount(0);

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.locations.find(({ id }: { id: string }) => id === 'vault')).not.toHaveProperty('archivedAt');
  expect(stored.accountMap.applied.links.find(({ id }: { id: string }) => id === 'archived-housing'))
    .toMatchObject({ status: 'active', remainder: false });
  expect(stored.accountMap.applied.links.find(({ id }: { id: string }) => id === 'manual-saving'))
    .toMatchObject({ status: 'suspended', suspendedReason: 'user', remainder: false });
});

test('migrates a v1 workspace without touching its protected slices', async ({ page }) => {
  const current = mappedWorkspace();
  const legacy = {
    ...current,
    schemaVersion: 1,
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
  await seedRetired(page, legacy);
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.schemaVersion).toBe(3);
  expect({ main: stored.main, simulation: stored.simulation, portfolio: stored.portfolio }).toEqual(protectedSlices);
});

test('adopts a concurrently changed Main when migration collides', async ({ page }) => {
  const current = mappedWorkspace();
  const legacy = {
    ...current,
    schemaVersion: 1,
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
  const latest = emptyWorkspace();
  latest.revision = 2;
  latest.updatedAt = now + 1;
  latest.main.applied = { ...main, updatedAt: now + 1, monthlyLivingWon: 1_200_000 };
  latest.accountMap.draft = {
    schemaVersion: 1, sourceMainUpdatedAt: now, customPurposes: [], links: [], step: 'connect', updatedAt: now,
  };
  await seedMigrationCollision(page, legacy, latest);
  await page.goto('apps/account-map/');

  await expect(page.getByText('Main의 월 금액이 바뀌었어요')).toBeVisible();
  await expect(page.getByRole('heading', { name: '생활비' }).locator('../..')).toContainText('1,200,000원');
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored).toEqual(latest);
});

test('requires Main when migration collision adopts a workspace without Main', async ({ page }) => {
  const current = mappedWorkspace();
  const legacy = {
    ...current,
    schemaVersion: 1,
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
  const latest = emptyWorkspace();
  latest.revision = 2;
  latest.updatedAt = now + 1;
  latest.main.applied = null;
  await seedMigrationCollision(page, legacy, latest);
  await page.goto('apps/account-map/');

  await expect(page.getByRole('heading', { name: '월 자금 계획이 먼저 필요해요' })).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored).toEqual(latest);
});

test('completes reduced-motion node, detail, and modal motion synchronously', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, mappedWorkspace());
  await page.goto('apps/account-map/');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));

  const living = page.getByRole('button', { name: /생활비.*1,000,000원/ }).first();
  await living.evaluate((element) => element.click());
  await page.clock.runFor(16);
  await living.evaluate((element) => element.click());
  await page.clock.runFor(32);
  const modalMotion = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const close = dialog?.querySelector<HTMLButtonElement>('button[aria-label="닫기"]');
    return { busy: dialog?.getAttribute('aria-busy') ?? null, closeDisabled: close?.disabled ?? null };
  });
  expect(modalMotion).toEqual({ busy: null, closeDisabled: false });

  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('button', { name: '목적 중심' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '계좌 중심' })).toHaveCount(0);
});

test('keeps an archived location with suspended links resolvable in detail view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, archivableDetailWorkspace());
  await page.goto('apps/account-map/');

  await openNode(page, /계좌·보관처 · 보관 대상 통장 ·/);
  await page.getByRole('button', { name: '보관', exact: true }).click();
  await page.getByRole('button', { name: '보관하기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: '확대' }).click();
  await expect(page.getByText('상세 보기')).toBeVisible();
  const archived = page.getByRole('button', { name: /계좌·보관처 · 보관 대상 통장 ·/ });
  await archived.focus();
  await archived.click();
  await expect(archived).toHaveClass(/is-pinned/);
  await expect(page.getByLabel('보관 대상 통장 월 연결 구성')).toContainText('활성 월 연결이 없습니다.');
});

test('keeps all Account Map states contained with 44px action targets at supported widths', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ key, workspace }) => {
    if (sessionStorage.getItem('account-map-responsive-seeded') !== null) return;
    localStorage.setItem(key, JSON.stringify(workspace));
    sessionStorage.setItem('account-map-responsive-seeded', 'true');
  }, { key: STORAGE_KEY, workspace: primaryIncomeWorkspace() });
  const viewports = [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }];
  for (const [index, viewport] of viewports.entries()) {
    await page.setViewportSize(viewport);
    if (index > 0) {
      await page.evaluate(({ key, workspace }) => localStorage.setItem(key, JSON.stringify(workspace)), {
        key: STORAGE_KEY,
        workspace: primaryIncomeWorkspace(),
      });
    }
    await page.goto('apps/account-map/');
    const prefix = `${viewport.width}px`;
    const frame = page.locator('main.account-map-page');
    await expect(frame).toHaveClass(/app-content-frame/);
    await expect(page.getByTestId('app-shell-launcher')).not.toHaveClass(/app-content-frame/);
    await expect(page.getByRole('button', { name: '목적 중심' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '계좌 중심' })).toHaveCount(0);

    const primaryIncome = page.getByRole('button', { name: /계좌·보관처 · 주수입통장/ });
    await expect(primaryIncome).toBeVisible();
    const mapFocusOrder = await page.locator('.account-map-node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
    expect(mapFocusOrder[0]).toContain('주수입통장');
    await expect(page.getByRole('table', { name: '계좌 연결 읽기 표' }).locator('tbody tr').first().locator('td').first()).toHaveText('주수입통장');

    await primaryIncome.hover();
    await primaryIncome.focus();
    const connectionDetail = page.getByLabel('주수입통장 월 연결 구성');
    await expect(connectionDetail).toBeVisible();
    await expect(connectionDetail).toContainText('월 계획 연결 기준 · 실제 잔액·거래·계좌 간 이동이 아님');
    await expect(connectionDetail.getByText('2,000,000원 · 100%')).toBeVisible();
    await primaryIncome.click();
    await expect(primaryIncome).toHaveClass(/is-pinned/);
    await expect(connectionDetail.getByText('2,000,000원 · 100%')).toBeVisible();
    const detailBounds = await page.evaluate(() => {
      const canvas = document.querySelector('.account-map-canvas')?.getBoundingClientRect();
      const detail = document.querySelector('.account-map-connection-detail')?.getBoundingClientRect();
      if (canvas === undefined || detail === undefined) return null;
      const actionableIntersections = [...document.querySelectorAll<HTMLElement>('.account-map-node')]
        .filter((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
            && detail.left < rect.right && detail.right > rect.left
            && detail.top < rect.bottom && detail.bottom > rect.top;
        })
        .map((node) => node.getAttribute('aria-label'));
      return {
        canvas: { left: canvas.left, top: canvas.top, right: canvas.right, bottom: canvas.bottom },
        detail: { left: detail.left, top: detail.top, right: detail.right, bottom: detail.bottom },
        actionableIntersections,
      };
    });
    expect(detailBounds).not.toBeNull();
    expect(detailBounds!.detail.left).toBeGreaterThanOrEqual(detailBounds!.canvas.left - 1);
    expect(detailBounds!.detail.top).toBeGreaterThanOrEqual(detailBounds!.canvas.top - 1);
    expect(detailBounds!.detail.right).toBeLessThanOrEqual(detailBounds!.canvas.right + 1);
    expect(detailBounds!.detail.bottom).toBeLessThanOrEqual(detailBounds!.canvas.bottom + 1);
    expect(detailBounds!.actionableIntersections, `${prefix} detail must not obscure actionable nodes`).toEqual([]);
    if (viewport.width <= 600) {
      expect(detailBounds!.detail.left).toBeCloseTo(detailBounds!.canvas.left + 16, 0);
      expect(detailBounds!.detail.right - detailBounds!.detail.left).toBeCloseTo(
        detailBounds!.canvas.right - detailBounds!.canvas.left - 32,
        0,
      );
    }
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(viewport.width);
    await expectContainedActionTargets(page, `${prefix} map`);
    const canvasBox = await page.locator('.account-map-canvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    const canvasContent = page.locator('.account-map-canvas__content');
    const transformBeforePan = await canvasContent.evaluate((element) => getComputedStyle(element).transform);
    await page.mouse.move(canvasBox!.x + 8, canvasBox!.y + 8);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 48, canvasBox!.y + 33);
    await page.mouse.up();
    await expect.poll(() => canvasContent.evaluate((element) => getComputedStyle(element).transform), {
      message: `${prefix} empty-space drag pans the map`,
    }).not.toBe(transformBeforePan);
    await page.getByRole('button', { name: '축소' }).click();
    await page.getByRole('button', { name: '확대' }).click();

    await page.getByRole('button', { name: '관리 메뉴' }).click();
    const archivedPurpose = page.getByRole('menuitem', { name: /선물 · 생활비 · 50,000원/ });
    await expect(archivedPurpose).toBeVisible();
    await expectContainedActionTargets(page, `${prefix} management menu`);
    await archivedPurpose.click();
    const purposeRestore = page.getByRole('dialog', { name: '선물 복원' });
    await expect(purposeRestore).toBeVisible();
    await expect(purposeRestore.getByRole('textbox', { name: '월 목표 금액' })).toBeVisible();
    await expect(purposeRestore.getByRole('button', { name: '목적 복원' })).toBeVisible();
    await expectContainedActionTargets(page, `${prefix} purpose restore`);
    await purposeRestore.getByRole('button', { name: '취소' }).click();

    await page.getByRole('button', { name: '관리 메뉴' }).click();
    await page.getByRole('menuitem', { name: '보관함 · 하나은행' }).click();
    const locationRestore = page.getByRole('dialog', { name: '보관함 복원' });
    await expect(locationRestore.getByRole('button', { name: '선택 복원' })).toBeEnabled();
    await expectContainedActionTargets(page, `${prefix} zero-link location restore`);
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${viewport.width}-zero-link-location-restore.png`) });
    await locationRestore.getByRole('button', { name: '취소' }).click();

    await openNode(page, /여행.*100,000원/);
    const more = page.getByRole('button', { name: '여행 더보기' });
    await expect(more).toBeVisible();
    await expectContainedActionTargets(page, `${prefix} custom-purpose read`);
    await more.click();
    await expect(page.getByRole('menuitem', { name: '목적 보관' })).toBeVisible();
    await expectContainedActionTargets(page, `${prefix} custom-purpose title menu`);
    await page.getByRole('menuitem', { name: '목적 보관' }).click();
    const purposeArchive = page.getByRole('dialog', { name: '여행 보관' });
    await expect(purposeArchive).toBeVisible();
    await expect(purposeArchive.getByRole('button', { name: '취소' })).toBeVisible();
    await expect(purposeArchive.getByRole('button', { name: '보관하기' })).toBeVisible();
    await expectContainedActionTargets(page, `${prefix} custom-purpose archive`);
    await page.getByRole('button', { name: '취소' }).click();
    await page.getByRole('button', { name: '닫기' }).click();

    await openNode(page, /생활비.*1,000,000원/);
    await expectContainedActionTargets(page, `${prefix} node read`);
    await page.getByRole('button', { name: '편집' }).click();
    await expectContainedActionTargets(page, `${prefix} node edit`);
    await page.getByRole('button', { name: '연결 추가' }).click();
    await expectContainedActionTargets(page, `${prefix} node connect`);
    await page.getByRole('button', { name: '취소' }).click();
    await page.getByRole('button', { name: '취소' }).click();
    await page.getByRole('button', { name: '닫기' }).click();

    await openNode(page, /계좌·보관처 · 보조생활비 ·/);
    await page.getByRole('button', { name: '보관', exact: true }).click();
    await expectContainedActionTargets(page, `${prefix} node archive`);
    await page.getByRole('button', { name: '보관하기' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '확대' }).click();
    await openNode(page, /계좌·보관처 · 보조생활비 ·/);
    await page.getByRole('button', { name: '복원' }).click();
    await expectContainedActionTargets(page, `${prefix} node restore`);
    await page.getByRole('button', { name: '취소' }).click();
    await page.getByRole('button', { name: '닫기' }).click();

    await page.evaluate(({ key, workspace }) => localStorage.setItem(key, JSON.stringify(workspace)), {
      key: STORAGE_KEY,
      workspace: emptyWorkspace(),
    });
    await page.reload();
    await expectContainedActionTargets(page, `${prefix} setup`);
    await page.getByRole('button', { name: '세부 목적 추가' }).click();
    await expectContainedActionTargets(page, `${prefix} custom-purpose form`);
    const customDialog = page.getByRole('dialog', { name: '세부 목적 추가' });
    await customDialog.getByRole('textbox', { name: '목적 이름' }).fill('여행');
    await customDialog.getByRole('textbox', { name: '월 금액' }).fill('100000');
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      (window as typeof window & { __accountMapOriginalSetItem?: typeof Storage.prototype.setItem }).__accountMapOriginalSetItem = original;
      Storage.prototype.setItem = function setItem(storageKey: string, value: string) {
        if (storageKey === key) throw new Error('forced storage failure');
        original.call(this, storageKey, value);
      };
    }, STORAGE_KEY);
    await customDialog.getByRole('button', { name: '추가' }).click();
    const saveAlert = customDialog.getByRole('alert');
    await expect(saveAlert).toHaveText('저장하지 못했어요. 입력은 그대로 두었습니다.');
    await expect(saveAlert).toBeFocused();
    await expectContainedActionTargets(page, `${prefix} custom-purpose save failure`);
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${viewport.width}-custom-purpose-save-failure.png`) });
    await page.evaluate(() => {
      const target = window as typeof window & { __accountMapOriginalSetItem?: typeof Storage.prototype.setItem };
      if (target.__accountMapOriginalSetItem !== undefined) Storage.prototype.setItem = target.__accountMapOriginalSetItem;
      delete target.__accountMapOriginalSetItem;
    });
    await customDialog.getByRole('button', { name: '취소' }).click();
    await page.getByRole('article').filter({ hasText: '수입' }).getByRole('button', { name: '연결' }).click();
    await expectContainedActionTargets(page, `${prefix} connection sheet`);
    await page.getByRole('button', { name: '새 계좌·보관처 추가' }).click();
    await expectContainedActionTargets(page, `${prefix} institution picker`);
    await page.getByRole('button', { name: 'KB국민은행', exact: true }).click();
    await expectContainedActionTargets(page, `${prefix} new-location form`);
  }
});

test('keeps pointer map pan and vertical touch page scroll in Account Map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, responsiveWorkspace());
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto('apps/account-map/');

  const canvas = page.locator('.account-map-canvas');
  const content = page.locator('.account-map-canvas__content');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS('touch-action', 'pan-y');
  expect(await page.evaluate(() => document.scrollingElement?.scrollHeight ?? 0)).toBeGreaterThan(520);

  const panBox = await canvas.boundingBox();
  expect(panBox).not.toBeNull();
  const transformBeforePan = await content.evaluate((element) => getComputedStyle(element).transform);
  const panY = panBox!.y + 8;
  await page.mouse.move(panBox!.x + 8, panY);
  await page.mouse.down();
  await page.mouse.move(panBox!.x + 92, panY);
  await page.mouse.up();
  await expect.poll(() => content.evaluate((element) => getComputedStyle(element).transform), {
    message: 'horizontal pointer drag pans the map',
  }).not.toBe(transformBeforePan);

  await page.getByRole('button', { name: '축소' }).click();
  await page.getByRole('button', { name: '확대' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));

  const scrollBox = await canvas.boundingBox();
  expect(scrollBox).not.toBeNull();
  const startY = Math.min(scrollBox!.y + scrollBox!.height - 48, 496);
  const endY = Math.max(scrollBox!.y + 48, startY - 180);
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await touchDrag(page, { x: scrollBox!.x + scrollBox!.width / 2, y: startY }, { x: scrollBox!.x + scrollBox!.width / 2, y: endY });
  await expect.poll(() => page.evaluate(() => window.scrollY), {
    message: 'vertical touch drag on the map scrolls the page',
  }).toBeGreaterThan(beforeScroll + 20);
});

test('wraps a 24-character custom-purpose detail title beside its actions at 390px', async ({ page }, testInfo) => {
  const purposeName = '가'.repeat(24);
  const workspace = responsiveWorkspace();
  workspace.accountMap.applied!.customPurposes.find(({ id }) => id === 'custom:trip')!.name = purposeName;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, workspace);
  await page.goto('apps/account-map/');

  await openNode(page, new RegExp(purposeName));
  const dialog = page.getByRole('dialog', { name: `${purposeName} 상세` });
  const title = dialog.getByRole('heading', { name: `${purposeName} 상세` });
  const more = dialog.getByRole('button', { name: `${purposeName} 더보기` });
  await expect(title).toBeVisible();
  await expect(more).toBeVisible();
  await page.screenshot({ fullPage: true, path: testInfo.outputPath('390-long-custom-purpose-detail.png') });

  const geometry = await dialog.evaluate((modal) => {
    const header = modal.querySelector<HTMLElement>(':scope > header')!;
    const heading = header.querySelector<HTMLElement>('h2')!;
    const titleContainer = heading.parentElement!;
    const actions = header.querySelector<HTMLElement>('.account-map-modal__title-actions')!;
    const body = modal.querySelector<HTMLElement>('.account-map-modal__body')!;
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, width: bounds.width };
    };
    const range = document.createRange();
    range.selectNodeContents(heading);
    return {
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      modal: rect(modal),
      header: rect(header),
      titleContainer: {
        ...rect(titleContainer),
        minWidth: getComputedStyle(titleContainer).minWidth,
      },
      title: {
        ...rect(heading),
        clientWidth: heading.clientWidth,
        scrollWidth: heading.scrollWidth,
        lines: new Set([...range.getClientRects()].map(({ y }) => Math.round(y))).size,
        overflowWrap: getComputedStyle(heading).overflowWrap,
      },
      actions: rect(actions),
      body: {
        ...rect(body),
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth,
      },
    };
  });

  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.modal.left).toBeGreaterThanOrEqual(0);
  expect(geometry.modal.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.header.left).toBeGreaterThanOrEqual(geometry.modal.left);
  expect(geometry.header.right).toBeLessThanOrEqual(geometry.modal.right);
  expect(geometry.titleContainer.minWidth).toBe('0px');
  expect(geometry.title.overflowWrap).toBe('anywhere');
  expect(geometry.title.lines).toBeGreaterThan(1);
  expect(geometry.title.scrollWidth).toBeLessThanOrEqual(geometry.title.clientWidth);
  expect(geometry.title.right).toBeLessThanOrEqual(geometry.actions.left);
  expect(geometry.actions.right).toBeLessThanOrEqual(geometry.header.right);
  expect(geometry.body.left).toBeGreaterThanOrEqual(geometry.modal.left);
  expect(geometry.body.right).toBeLessThanOrEqual(geometry.modal.right);
  expect(geometry.body.scrollWidth).toBeLessThanOrEqual(geometry.body.clientWidth);
});

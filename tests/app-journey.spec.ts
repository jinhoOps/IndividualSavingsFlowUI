import { expect, test } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 6, 30, 6),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const appliedWorkspace = {
  schemaVersion: 5,
  revision: 1,
  updatedAt: appliedMain.updatedAt,
  main: { expenseAssistant: null, applied: appliedMain, setupProgress: null },
  simulation: { draft: null },
  portfolio: { plans: [], draft: null },
  locations: [],
  accountMap: { applied: null, draft: null },
};

const appliedWorkspaceV3 = {
  schemaVersion: 3,
  revision: 1,
  updatedAt: appliedMain.updatedAt,
  main: { applied: appliedMain, setupProgress: null },
  simulation: { draft: null },
  portfolio: { plans: [], draft: null },
  locations: [],
  accountMap: { applied: null, draft: null },
};

const previousSimulationSource = {
  monthlySavingsWon: 100_000,
  monthlyInvestmentWon: 100_000,
  mainUpdatedAt: appliedMain.updatedAt - 1,
};

const appliedSimulationDraft = {
  schemaVersion: 3,
  source: previousSimulationSource,
  initialInvestmentWon: 10_000_000,
  targetAmountWon: 100_000_000,
  years: 20,
  expectedAnnualReturnPercent: 9,
  baseRatePercent: 2.75,
  inflationOffsetPercentPoints: -0.25,
  amountMode: 'nominal',
  updatedAt: previousSimulationSource.mainUpdatedAt,
};

const workspaceWithSimulationDraft = {
  ...appliedWorkspace,
  simulation: { draft: appliedSimulationDraft },
};

const sharedShellViewports = [
  { width: 390, height: 844, launcherX: 20, launcherWidth: 350 },
  { width: 768, height: 1024, launcherX: 32, launcherWidth: 704 },
  { width: 1280, height: 900, launcherX: 72, launcherWidth: 1136 },
] as const;

for (const viewport of sharedShellViewports) {
  for (const app of ['main', 'simulation', 'portfolio'] as const) {
    test(`${app} setup entry keeps heading focus without a selection outline at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (app !== 'main') {
        await page.addInitScript((workspace) => {
          localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
        }, appliedWorkspace);
      }

      await page.goto(`apps/${app}/`);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeFocused();
      await expect(heading).toHaveCSS('outline-style', 'none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      await page.keyboard.press('Tab');
      const firstAction = page.getByRole('button', {
        name: app === 'main' ? '다음' : app === 'simulation' ? '있어요' : '배분 시작하기',
        exact: true,
      });
      await expect(firstAction).toBeFocused();
      expect(await firstAction.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      })).toBe(true);
      const box = await firstAction.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);

      if (app !== 'simulation') {
        await page.keyboard.press('Enter');
        await expect(heading).toBeFocused();
        await expect(heading).toHaveCSS('outline-style', 'none');
      }
    });
  }
}

test('retired journey snapshot survives Main startup and a current edit', async ({ page }) => {
  const sentinel = '{"retired":"keep-this-byte-for-byte"}';
  await page.addInitScript(({ workspace, snapshot }) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
    localStorage.setItem('isf-journey-snapshot-v1', snapshot);
  }, { workspace: appliedWorkspace, snapshot: sentinel });

  await page.goto('apps/main/');
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBe(sentinel);

  await page.getByRole('button', { name: '월 금액 편집' }).click();
  await page.getByLabel('월평균 생활비').fill('1100000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBe(sentinel);
});

test('reads workspace v3 without a write, then migrates only the authorized Main save while preserving v3 bytes', async ({ page }) => {
  const v3Raw = JSON.stringify(appliedWorkspaceV3);
  await page.addInitScript((raw) => localStorage.setItem('isf-workspace-v3', raw), v3Raw);

  await page.goto('apps/main/');
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('180만 원');
  expect(await page.evaluate(() => ({
    v3: localStorage.getItem('isf-workspace-v3'),
    v4: localStorage.getItem('isf-workspace-v5'),
  }))).toEqual({ v3: v3Raw, v4: null });

  await page.getByRole('button', { name: '월 금액 편집' }).click();
  await page.getByLabel('월평균 생활비').fill('1100000');
  await page.getByRole('button', { name: '적용' }).click();

  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
  expect(await page.evaluate(() => ({
    v3: localStorage.getItem('isf-workspace-v3'),
    v4: JSON.parse(localStorage.getItem('isf-workspace-v5')!),
  }))).toEqual({
    v3: v3Raw,
    v4: expect.objectContaining({
      schemaVersion: 5,
      main: expect.objectContaining({
        applied: expect.objectContaining({ monthlyLivingWon: 1_100_000 }),
      }),
    }),
  });
});

test('prefers a valid workspace v5 over a conflicting v3 and never falls back from invalid v5', async ({ page }) => {
  const v3 = {
    ...appliedWorkspaceV3,
    main: { applied: { ...appliedMain, monthlyLivingWon: 600_000 }, setupProgress: null },
  };
  const v4 = {
    ...appliedWorkspace,
    main: { expenseAssistant: null, applied: { ...appliedMain, monthlyLivingWon: 1_100_000 }, setupProgress: null },
  };
  const v3Raw = JSON.stringify(v3);
  await page.addInitScript(({ current, previous }) => {
    if (sessionStorage.getItem('isf-v4-precedence-seeded') !== null) return;
    sessionStorage.setItem('isf-v4-precedence-seeded', 'true');
    localStorage.setItem('isf-workspace-v5', JSON.stringify(current));
    localStorage.setItem('isf-workspace-v3', previous);
  }, { current: v4, previous: v3Raw });

  await page.goto('apps/main/');
  await page.getByRole('button', { name: '월 금액 편집' }).click();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,100,000');
  await page.getByRole('button', { name: '취소' }).click();

  const invalidV4 = '{invalid-v4';
  await page.evaluate(({ current, previous }) => {
    localStorage.setItem('isf-workspace-v5', current);
    localStorage.setItem('isf-workspace-v3', previous);
  }, { current: invalidV4, previous: v3Raw });
  await page.reload();
  await expect(page.getByRole('heading', { name: '저장 복구가 필요합니다' })).toBeVisible();
  expect(await page.evaluate(() => ({
    v4: localStorage.getItem('isf-workspace-v5'),
    v3: localStorage.getItem('isf-workspace-v3'),
  }))).toEqual({ v4: invalidV4, v3: v3Raw });
});

for (const viewport of sharedShellViewports) {
  test(`shares Main launcher geometry and canvas at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript((fixture) => {
      localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
    }, appliedWorkspace);

    const routes = [
      'apps/main/',
      'apps/simulation/',
      'apps/portfolio/',
      'apps/account-map/',
    ];
    const geometries: Array<{ frame: { x: number; y: number; width: number }; launcher: { x: number; y: number; width: number } }> = [];

    for (const route of routes) {
      await page.goto(route);
      const frame = page.getByTestId('app-shell-launcher');
      const launcher = frame.locator('.journey-launcher');
      await expect(launcher).toBeVisible();

      const frameBox = await frame.boundingBox();
      const launcherBox = await launcher.boundingBox();
      expect(frameBox).not.toBeNull();
      expect(launcherBox).not.toBeNull();
      geometries.push({
        frame: { x: frameBox!.x, y: frameBox!.y, width: frameBox!.width },
        launcher: { x: launcherBox!.x, y: launcherBox!.y, width: launcherBox!.width },
      });

      expect(await page.getByTestId('app-shell').evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      )).toBe('rgba(0, 0, 0, 0)');
      expect(await page.locator('body').evaluate(
        (body) => getComputedStyle(body).backgroundImage,
      )).not.toBe('none');
    }

    expect(new Set(geometries.map((value) => JSON.stringify(value))).size).toBe(1);
    const [{ frame, launcher }] = geometries;
    expect(frame.x).toBe(viewport.width === 1280 ? 40 : 0);
    expect(frame.y).toBe(0);
    expect(frame.width).toBe(viewport.width === 1280 ? 1200 : viewport.width);
    expect(launcher.x).toBe(viewport.launcherX);
    expect(launcher.y).toBe(20);
    expect(launcher.width).toBe(viewport.launcherWidth);
  });
}

test('connects Main directly to the detailed Simulation', async ({ page }) => {
  await page.addInitScript((workspace) => {
    const seedMarker = 'isf-test-journey-fixture-seeded';
    if (sessionStorage.getItem(seedMarker) !== null) return;
    sessionStorage.setItem(seedMarker, 'true');

    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
  }, workspaceWithSimulationDraft);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect(page.getByRole('heading', { name: /1억 원을 모으려면|현재 조건으로는 30년 안에 1억 원/ }))
    .toBeVisible();
  await expect(page.getByText('월 저축 30만 원 · 투자 20만 원 · 연 9%')).toBeVisible();
  await expect(page.getByText('전부 저축보다')).toBeVisible();
  await expect(page.locator('.simulation-comparison__semantic-value')).toHaveText([
    '1억 295만 원',
    '215%',
  ]);
  await expect(page.getByRole('link', { name: /미래 성장 \(Simulation\).*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
});

test('revisits Simulation at the result and refreshes only its Main source', async ({ page }) => {
  await page.addInitScript((workspace) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
  }, workspaceWithSimulationDraft);

  await page.goto('apps/simulation/');
  await expect(page.getByRole('heading', { name: /1억 원을 모으려면|현재 조건으로는 30년 안에 1억 원/ }))
    .toBeVisible();
  await expect(page.getByText('월 저축 30만 원 · 투자 20만 원 · 연 9%')).toBeVisible();
  await expect(page.locator('.simulation-comparison__semantic-value')).toHaveText([
    '1억 295만 원',
    '215%',
  ]);
  await expect(page.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' }))
    .toHaveCount(0);

  const stored = await page.evaluate(() => ({
    workspace: JSON.parse(localStorage.getItem('isf-workspace-v5')!),
  }));
  expect(stored.workspace.simulation.draft.source.monthlySavingsWon).toBe(300_000);
  expect(stored.workspace.simulation.draft.initialInvestmentWon).toBe(10_000_000);
});

test('keeps detailed Portfolio and purpose-first Account Map isolated', async ({ page }) => {
  const supportedAccountMapWorkspace = { ...appliedWorkspace, main: {...appliedWorkspace.main, expenseAssistant: null},
    schemaVersion: 5,
    accountMap: { applied: null, draft: null },
  };
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), supportedAccountMapWorkspace);
  await page.goto('apps/portfolio/');
  await expect(page.getByRole('heading', { name: '매달 200,000원을 어디에 투자할까요?' })).toBeVisible();
  await expect(page.getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ })).toBeVisible();
  await page.addInitScript(() => {
    const calls: Array<{ operation: 'get' | 'set' | 'remove'; key: string }> = [];
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    Object.defineProperty(window, '__accountMapStorageCalls', { value: calls });
    Storage.prototype.getItem = function (key) {
      if (this === localStorage) calls.push({ operation: 'get', key });
      return originalGetItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage) calls.push({ operation: 'set', key });
      return originalSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (this === localStorage) calls.push({ operation: 'remove', key });
      return originalRemoveItem.call(this, key);
    };
  });
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: '월 자금 기준 확인' })).toBeVisible();
  await expect(page.locator('app-header, data-hub-modal, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
  const accountMapObservation = await page.evaluate(() => ({
    calls: (
    window as typeof window & {
      __accountMapStorageCalls: Array<{ operation: 'get' | 'set' | 'remove'; key: string }>;
    }
    ).__accountMapStorageCalls,
    protectedSlices: (() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
      return {
        main: workspace.main,
        simulation: workspace.simulation,
        portfolio: workspace.portfolio,
      };
    })(),
  }));
  expect(accountMapObservation.calls.length).toBeGreaterThan(0);
  expect([...new Set(accountMapObservation.calls.map(({ key }) => key))]).toEqual(['isf-workspace-v5']);
  expect(accountMapObservation.calls.filter(({ operation }) => operation !== 'get')).toEqual([]);
  expect(accountMapObservation.protectedSlices).toEqual({
    main: supportedAccountMapWorkspace.main,
    simulation: supportedAccountMapWorkspace.simulation,
    portfolio: supportedAccountMapWorkspace.portfolio,
  });
});

test('groups icon navigation and management in a compact dock across viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspace);
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/simulation/');
    const launcher = page.getByRole('navigation', { name: 'ISF 앱' });
    const launcherRoot = page.locator('.journey-launcher__dock');
    const tools = page.getByRole('group', { name: '앱 도구' });
    await expect(launcher).toBeVisible();
    await expect(page.getByRole('link', { name: /미래 성장 \(Simulation\).*현재 위치/ }))
      .toHaveAttribute('aria-current', 'page');
    const currentLink = page.getByRole('link', { name: /미래 성장 \(Simulation\).*현재 위치/ });
    await currentLink.focus();
    expect(await currentLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 1;
    })).toBe(true);

    const appTargets = await launcher.locator('.journey-launcher__app-link').evaluateAll((links) =>
      links.map((link) => {
        const rect = link.getBoundingClientRect();
        return { width: rect.width, height: rect.height, top: rect.top };
      }));
    expect(appTargets).toHaveLength(4);
    for (const target of appTargets) {
      expect(target.width).toBe(44);
      expect(target.height).toBe(44);
      expect(target.top).toBe(appTargets[0].top);
    }

    await expect(launcher.getByRole('button', { name: '관리 메뉴' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '앱 아이콘 도움말' })).toHaveCount(0);
    const management = tools.getByRole('button', { name: '관리 메뉴' });
    const geometry = await page.evaluate(([root, group, trigger]) => {
      const rootRect = root.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const style = getComputedStyle(group);
      return {
        trigger: { width: triggerRect.width, height: triggerRect.height, top: triggerRect.top },
        rightDelta: Math.abs(rootRect.right - groupRect.right),
        borderWidth: Number.parseFloat(style.borderLeftWidth),
        borderColor: style.borderLeftColor,
      };
    }, [await launcherRoot.elementHandle(), await tools.elementHandle(), await management.elementHandle()] as const);
    expect(geometry.trigger).toEqual({ width: 44, height: 44, top: appTargets[0].top });
    // The management tool sits inside the dock's 6px padding and 1px border.
    expect(geometry.rightDelta).toBe(7);
    const dockBox = await launcherRoot.boundingBox();
    expect(dockBox!.width).toBeLessThanOrEqual(280);
    expect(dockBox!.x + dockBox!.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(geometry.borderWidth).toBe(1);
    expect(geometry.borderColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('keeps all app icons visible while launcher geometry is unresolved', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspace);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('apps/simulation/');

  const navigation = page.getByRole('navigation', { name: 'ISF 앱' });
  const links = navigation.locator('.journey-launcher__app-link');
  await expect(links).toHaveCount(4);

  const unresolvedGeometry = await page.addStyleTag({
    content: `
      .journey-launcher {
        width: 120px !important;
      }

      .journey-launcher__app-link {
        width: 24px !important;
        height: 24px !important;
      }
    `,
  });

  await expect(links).toHaveCount(4);
  await expect(navigation.getByRole('button', { name: '앱 더보기' })).toHaveCount(0);

  await unresolvedGeometry.evaluate((style) => style.remove());
  await expect(links).toHaveCount(4);
  await expect.poll(async () => links.first().evaluate((link) => link.getBoundingClientRect().width))
    .toBe(44);
});

test('dock preview follows pointer and keyboard without changing the current app or target geometry', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspace);
  await page.goto('apps/main/');
  const navigation = page.getByRole('navigation', { name: 'ISF 앱' });
  const main = navigation.getByRole('link', { name: /자금 흐름/ });
  const simulation = navigation.getByRole('link', { name: /미래 성장/ });
  const portfolio = navigation.getByRole('link', { name: /투자 배분/ });
  const selection = navigation.locator('.journey-launcher__selection');
  const targetBefore = await simulation.boundingBox();
  const tracks = async (link: typeof main) => {
    await expect.poll(async () => {
      const [background, target] = await Promise.all([selection.boundingBox(), link.boundingBox()]);
      return Math.abs(background!.x - target!.x);
    }).toBeLessThan(1);
  };

  await tracks(main);
  await simulation.hover();
  await tracks(simulation);
  await expect(main).toHaveAttribute('aria-current', 'page');
  await expect(simulation).not.toHaveAttribute('aria-current');
  await expect(page).toHaveURL(/\/apps\/main\/$/);
  expect(await simulation.boundingBox()).toEqual(targetBefore);
  await page.mouse.move(0, 0);
  await tracks(main);

  await portfolio.focus();
  await tracks(portfolio);
  await page.keyboard.press('Tab');
  await tracks(navigation.getByRole('link', { name: /계좌 연결/ }));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '관리 메뉴', exact: true })).toBeFocused();
  await tracks(main);
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await simulation.hover();
  await tracks(simulation);
  // The foundation sets a tiny global duration; transition-property:none disables motion entirely.
  await expect(selection).toHaveCSS('transition-property', 'none');
  await expect(simulation.locator('svg')).toHaveCSS('transform', 'none');
  await simulation.click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect(page.getByRole('link', { name: /미래 성장.*현재 위치/ })).toHaveAttribute('aria-current', 'page');
});

test('mobile dock supports direct taps and history while preserving Main amounts', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block',
  });
  try {
    await context.addInitScript((fixture) => {
      if (localStorage.getItem('isf-workspace-v5') === null) {
        localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
      }
    }, appliedWorkspace);
    const page = await context.newPage();
    await page.goto('apps/main/');
    await page.getByRole('link', { name: /미래 성장/ }).tap();
    await expect(page).toHaveURL(/\/apps\/simulation\/$/);
    await expect(page.getByRole('link', { name: /미래 성장.*현재 위치/ })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('link', { name: /자금 흐름.*현재 위치/ })).toBeVisible();
    await page.getByRole('button', { name: '관리 메뉴', exact: true }).tap();
    await expect(page.getByRole('menu', { name: '관리 메뉴' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-workspace-v5')!).main.applied))
      .toEqual(appliedMain);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await context.close();
  }
});

test('keeps each app management menu reachable and contained across viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspace);
  const apps = [
    { path: 'apps/main/', text: '처음부터 다시' },
    { path: 'apps/simulation/', text: '시뮬레이션 다시 설정' },
    { path: 'apps/portfolio/', text: '투자 배분 처음부터 다시' },
    { path: 'apps/account-map/', text: '아직 만든 연결 지도가 없습니다' },
  ];

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const app of apps) {
      await page.goto(app.path);
      const trigger = page.getByRole('button', { name: '관리 메뉴' });
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      const triggerBox = await trigger.boundingBox();
      expect(triggerBox?.width).toBe(44);
      expect(triggerBox?.height).toBe(44);

      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const popover = page.locator('.journey-management__popover');
      const menu = page.getByRole('menu', { name: '관리 메뉴', exact: true });
      await expect(popover).toBeVisible();
      await expect(menu).toBeVisible();
      await expect(popover.getByText('앱 아이콘 안내')).toHaveCount(0);
      await expect(popover.getByText(/백업/)).toHaveCount(0);
      await expect(popover.getByText(app.text)).toBeVisible();
      const popoverBox = await popover.boundingBox();
      expect(popoverBox).not.toBeNull();
      expect(popoverBox!.x).toBeGreaterThanOrEqual(16);
      expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(viewport.width - 16);

      await page.keyboard.press('Escape');
      await expect(popover).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();

      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.locator('main').click({ position: { x: 1, y: 1 } });
      await expect(popover).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
      expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('keeps Account Map usable at mobile, tablet, and desktop widths', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspace);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/account-map/');

    const launcher = page.getByRole('navigation', { name: 'ISF 앱' });
    const accountMapLink = page.getByRole('link', { name: /계좌 연결 \(Account Map\).*현재 위치/ });
    await expect(launcher).toBeVisible();
    await expect(page.getByRole('heading', { name: '월 자금 기준 확인' })).toBeVisible();

    await expect(accountMapLink).toHaveAttribute('aria-current', 'page');

    const visibleTargetSizes = await page.locator(
      '.journey-launcher__app-link, .account-map-setup button, .account-map-actions button',
    ).evaluateAll((elements) => elements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ width: rect.width, height: rect.height })));
    expect(visibleTargetSizes.length).toBeGreaterThan(0);
    for (const size of visibleTargetSizes) {
      // CSS pixel layout can report 43.999… for the 44px minimum at fractional device scale.
      expect(size.width).toBeGreaterThanOrEqual(43.9);
      expect(size.height).toBeGreaterThanOrEqual(43.9);
    }

    for (let attempt = 0; attempt < 8 && !await accountMapLink.evaluate(
      (element) => document.activeElement === element,
    ); attempt += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(accountMapLink).toBeFocused();
    expect(await accountMapLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 1;
    })).toBe(true);

    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('explains app icons with pointer, keyboard and touch without duplicate management help', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspace);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/simulation/');

  const mainLink = page.getByRole('link', { name: '자금 흐름 (Main)' });
  await mainLink.hover();
  await expect(page.getByRole('tooltip')).toHaveText('자금 흐름 (Main)');
  await page.locator('main').hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await mainLink.focus();
  await expect(page.getByRole('tooltip')).toHaveText('자금 흐름 (Main)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await expect(page.getByText('앱 아이콘 안내')).toHaveCount(0);
  await page.locator('main').click({ position: { x: 1, y: 1 } });

  const portfolioLink = page.getByRole('link', { name: '투자 배분 (Portfolio)' });
  const before = page.url();
  await portfolioLink.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7 });
  await page.waitForTimeout(460);
  await expect(page.getByRole('tooltip')).toHaveText('투자 배분 (Portfolio)');
  await portfolioLink.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7 });
  await portfolioLink.dispatchEvent('click');
  expect(page.url()).toBe(before);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await portfolioLink.evaluate((element) => {
    const value = getComputedStyle(element).transitionDuration;
    return value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1_000;
  })).toBeLessThan(1);

  await mainLink.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 8 });
  await mainLink.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 8 });
  await mainLink.click();
  await expect(page).toHaveURL(/\/apps\/main\/$/);
});

test('keeps the current app direct and exposes hidden apps through overflow', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspace);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/account-map/');
  const narrowLauncher = await page.addStyleTag({ content: '.journey-launcher { width: 220px !important; }' });

  const navigation = page.getByRole('navigation', { name: 'ISF 앱' });
  await expect(navigation.getByRole('link', { name: /계좌 연결 \(Account Map\).*현재 위치/ })).toBeVisible();
  const more = navigation.getByRole('button', { name: '앱 더보기' });
  await expect(more).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const overflow = page.getByRole('region', { name: '추가 앱' });
  const overflowBox = await overflow.boundingBox();
  expect(overflowBox).not.toBeNull();
  expect(overflowBox!.x).toBeGreaterThanOrEqual(16);
  expect(overflowBox!.x + overflowBox!.width).toBeLessThanOrEqual(374);
  await expect(overflow.getByRole('link')).toHaveCount(2);
  await expect(overflow.getByRole('link').nth(0)).toContainText('미래 성장 (Simulation)');
  await expect(overflow.getByRole('link').nth(1)).toContainText('투자 배분 (Portfolio)');

  const gear = page.getByRole('button', { name: '관리 메뉴' });
  await gear.click();
  await expect(overflow).toHaveCount(0);
  await expect(page.getByRole('menu', { name: '관리 메뉴' })).toBeVisible();
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: '관리 메뉴' })).toHaveCount(0);
  await expect(overflow).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overflow).toHaveCount(0);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toBeFocused();

  await more.click();
  await page.locator('main').click({ position: { x: 1, y: 1 } });
  await expect(overflow).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

  await narrowLauncher.evaluate((style) => style.remove());
  await expect(navigation.getByRole('link')).toHaveCount(4);
  await expect(more).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: /계좌 연결.*현재 위치/ })).toBeFocused();
});

test('commits launcher reveals before paint on the supported Account Map under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/account-map/');

  const accountMapMessage = page.locator('.account-map-message');
  const currentLine = page.locator(
    '[aria-current="page"] .journey-launcher__current-line',
  );
  await expect(accountMapMessage).toBeVisible();
  await expect(page.getByRole('heading', { name: '월 자금 계획이 먼저 필요해요' })).toBeVisible();
  await expect(currentLine).toBeVisible();
  expect(await readMotionState(currentLine)).toEqual({ opacity: 1, x: 0, y: 0 });

  await page.addStyleTag({ content: '.journey-launcher { width: 220px !important; }' });
  const more = page.getByRole('button', { name: '앱 더보기' });
  await more.click();
  const overflow = page.getByRole('region', { name: '추가 앱' });
  await expect(overflow).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(await readMotionState(overflow)).toEqual({ opacity: 1, x: 0, y: 0 });

  await page.keyboard.press('Escape');
  await expect(overflow).toHaveCount(0);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toBeFocused();
});

test('keeps the Main mobile editor modal synchronous under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspace);
  await page.goto('apps/main/');

  const opener = page.getByRole('button', { name: '월 금액 편집' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: '월 자금 계획 편집' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByTestId('dashboard-controls')).toHaveAttribute('inert', '');
  expect(await readMotionState(dialog)).toEqual({ opacity: 1, x: 0, y: 0 });
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('legacy Simulation DOM is absent from the supported route', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspace);
  await page.goto('apps/simulation/');
  await expect(page.locator('app-header, data-hub-modal, #strategyCardGroup')).toHaveCount(0);
});

async function readMotionState(locator: import('@playwright/test').Locator): Promise<{
  opacity: number;
  x: number;
  y: number;
}> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = style.transform === 'none'
      ? new DOMMatrixReadOnly()
      : new DOMMatrixReadOnly(style.transform);
    return {
      opacity: Number.parseFloat(style.opacity),
      x: matrix.m41,
      y: matrix.m42,
    };
  });
}

// Brand orange is decorative; small action labels must remain readable in every app.
test('primary action labels meet text contrast in resting and hover states across apps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((workspace) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
  }, workspaceWithSimulationDraft);

  for (const app of ['main', 'simulation', 'portfolio', 'account-map']) {
    await page.goto(`apps/${app}/`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const actions = page.locator('.ui-button--primary, .simulation-controls button[aria-pressed="true"], .simulation-amount-mode button[aria-pressed="true"]');
    expect(await actions.count()).toBeGreaterThan(0);
    for (const action of await actions.all()) {
      await expect(action).toBeVisible();
      for (const state of ['resting', 'hover']) {
        if (state === 'hover') await action.hover();
        const contrast = await action.evaluate((element) => {
          // Computed color-mix() values may use color(srgb ...), not rgb(0..255).
          const canvas = document.createElement('canvas');
          canvas.width = 1; canvas.height = 1;
          const context = canvas.getContext('2d', { willReadFrequently: true })!;
          const rgba = (value: string) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = value;
            context.fillRect(0, 0, 1, 1);
            const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
            return [red, green, blue, alpha / 255];
          };
          const composite = (front: number[], back: number[]) => {
            const alpha = front[3] ?? 1;
            return front.slice(0, 3).map((channel, index) => channel * alpha + back[index] * (1 - alpha));
          };
          const ancestors: Element[] = [];
          for (let node: Element | null = element; node !== null; node = node.parentElement) ancestors.unshift(node);
          let background = [255, 255, 255];
          for (const node of ancestors) background = composite(rgba(getComputedStyle(node).backgroundColor), background);
          const foreground = composite(rgba(getComputedStyle(element).color), background);
          const luminance = (color: number[]) => color.map((value) => {
            const channel = value / 255;
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
          }).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0);
          const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
          return (values[0] + .05) / (values[1] + .05);
        });
        expect.soft(contrast, `${app} ${state} primary action contrast`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

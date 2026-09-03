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
  schemaVersion: 3,
  revision: 1,
  updatedAt: appliedMain.updatedAt,
  main: { applied: appliedMain, setupProgress: null },
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

const oldSimulationRaw = JSON.stringify({
  ...appliedSimulationDraft,
  source: {
    monthlySavingsWon: 1,
    monthlyInvestmentWon: 1,
    mainUpdatedAt: 1,
  },
  initialInvestmentWon: 1,
  years: 29,
  expectedAnnualReturnPercent: 5,
  updatedAt: 1,
});

const workspaceWithSimulationDraft = {
  ...appliedWorkspace,
  simulation: { draft: appliedSimulationDraft },
};

const sharedShellViewports = [
  { width: 390, height: 844, launcherX: 20, launcherWidth: 350 },
  { width: 768, height: 1024, launcherX: 32, launcherWidth: 704 },
  { width: 1280, height: 900, launcherX: 72, launcherWidth: 1136 },
] as const;

test('retired journey snapshot survives Main startup and a current edit', async ({ page }) => {
  const sentinel = '{"retired":"keep-this-byte-for-byte"}';
  await page.addInitScript(({ workspace, snapshot }) => {
    localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace));
    localStorage.setItem('isf-journey-snapshot-v1', snapshot);
  }, { workspace: appliedWorkspaceV3, snapshot: sentinel });

  await page.goto('apps/main/');
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBe(sentinel);

  await page.getByRole('button', { name: '월 소비 편집' }).click();
  await page.getByLabel('월평균 생활비').fill('1100000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText('190만 원');
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBe(sentinel);
});

for (const viewport of sharedShellViewports) {
  test(`shares Main launcher geometry and canvas at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript((fixture) => {
      localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture));
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
  const journeySnapshotRaw = JSON.stringify({
    monthlySavingWon: 900_000,
    monthlyInvestmentWon: 900_000,
  });
  await page.addInitScript(({ workspace, seededOldSimulation, snapshot }) => {
    const seedMarker = 'isf-test-journey-fixture-seeded';
    if (sessionStorage.getItem(seedMarker) !== null) return;
    sessionStorage.setItem(seedMarker, 'true');

    localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace));
    localStorage.setItem('isf-journey-snapshot-v1', snapshot);
    localStorage.setItem('isf-simulation-compound-v1', seededOldSimulation);
  }, { workspace: workspaceWithSimulationDraft, seededOldSimulation: oldSimulationRaw, snapshot: journeySnapshotRaw });
  await page.goto('apps/main/');
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBe(journeySnapshotRaw);
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBe(journeySnapshotRaw);
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
  expect(await page.evaluate(() => localStorage.getItem('isf-simulation-compound-v1')))
    .toBe(oldSimulationRaw);
});

test('revisits Simulation at the result and refreshes only its Main source', async ({ page }) => {
  await page.addInitScript(({ workspace, seededOldSimulation }) => {
    localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace));
    localStorage.setItem('isf-simulation-compound-v1', seededOldSimulation);
  }, { workspace: workspaceWithSimulationDraft, seededOldSimulation: oldSimulationRaw });

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
    workspace: JSON.parse(localStorage.getItem('isf-workspace-v3')!),
    oldSimulation: localStorage.getItem('isf-simulation-compound-v1'),
  }));
  expect(stored.workspace.simulation.draft.source.monthlySavingsWon).toBe(300_000);
  expect(stored.workspace.simulation.draft.initialInvestmentWon).toBe(10_000_000);
  expect(stored.oldSimulation).toBe(oldSimulationRaw);
});

test('keeps detailed Portfolio and purpose-first Account Map isolated', async ({ page }) => {
  const supportedAccountMapWorkspace = {
    ...appliedWorkspace,
    schemaVersion: 3,
    accountMap: { applied: null, draft: null },
  };
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture)), supportedAccountMapWorkspace);
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
  await expect(page.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
  await expect(page.locator('app-header, data-hub-modal, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
  const accountMapObservation = await page.evaluate(() => ({
    calls: (
    window as typeof window & {
      __accountMapStorageCalls: Array<{ operation: 'get' | 'set' | 'remove'; key: string }>;
    }
    ).__accountMapStorageCalls,
    protectedSlices: (() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v3')!);
      return {
        main: workspace.main,
        simulation: workspace.simulation,
        portfolio: workspace.portfolio,
      };
    })(),
  }));
  expect(accountMapObservation.calls.length).toBeGreaterThan(0);
  expect([...new Set(accountMapObservation.calls.map(({ key }) => key))]).toEqual(['isf-workspace-v3']);
  expect(accountMapObservation.calls.filter(({ operation }) => operation !== 'get')).toEqual([]);
  expect(accountMapObservation.protectedSlices).toEqual({
    main: supportedAccountMapWorkspace.main,
    simulation: supportedAccountMapWorkspace.simulation,
    portfolio: supportedAccountMapWorkspace.portfolio,
  });
});

test('separates app navigation and the right-aligned management tool across viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture));
  }, appliedWorkspace);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/simulation/');
    const launcher = page.getByRole('navigation', { name: 'ISF 앱' });
    const launcherRoot = page.locator('.journey-launcher');
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
    expect(geometry.rightDelta).toBeLessThanOrEqual(1);
    expect(geometry.borderWidth).toBe(1);
    expect(geometry.borderColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('keeps all app icons visible while launcher geometry is unresolved', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture));
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

test('keeps each app management menu reachable and contained across viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture));
  }, appliedWorkspace);
  const apps = [
    { path: 'apps/main/', text: '백업 가져오기' },
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
      const help = menu.getByRole('menuitem', { name: '앱 아이콘 안내' });
      await expect(help).toHaveAttribute('aria-expanded', 'false');
      await help.click();
      const guide = page.getByRole('region', { name: '앱 아이콘 안내' });
      await expect(guide).toContainText('자금 흐름 (Main)');
      await expect(guide).toContainText('미래 성장 (Simulation)');
      await expect(guide).toContainText('투자 배분 (Portfolio)');
      await expect(guide).toContainText('계좌 연결 (Account Map)');
      await expect(guide).not.toContainText('준비 중');
      expect(await menu.evaluate((node) => node.querySelector('[role="region"]'))).toBeNull();
      const guideBox = await guide.boundingBox();
      expect(guideBox).not.toBeNull();
      expect(guideBox!.x).toBeGreaterThanOrEqual(16);
      expect(guideBox!.x + guideBox!.width).toBeLessThanOrEqual(viewport.width - 16);
      await help.click();
      await expect(guide).toHaveCount(0);
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
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture)), appliedWorkspace);
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
    await expect(page.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();

    await expect(accountMapLink).toHaveAttribute('aria-current', 'page');

    const visibleTargetSizes = await page.locator(
      '.journey-launcher__app-link, .account-map-purpose-card__action, .account-map-actions button',
    ).evaluateAll((elements) => elements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ width: rect.width, height: rect.height })));
    expect(visibleTargetSizes.length).toBeGreaterThan(0);
    for (const size of visibleTargetSizes) {
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
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

test('explains app icons with pointer, keyboard, touch and integrated management help', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture)), appliedWorkspace);
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
  const help = page.getByRole('menuitem', { name: '앱 아이콘 안내' });
  await help.click();
  const panel = page.getByRole('region', { name: '앱 아이콘 안내' });
  await expect(panel).toContainText('계좌 연결 (Account Map)');
  await expect(panel).not.toContainText('준비 중');
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(16);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(374);

  await help.click();
  await expect(panel).toHaveCount(0);

  await help.click();
  await page.locator('main').click({ position: { x: 1, y: 1 } });
  await expect(page.getByRole('region', { name: '앱 아이콘 안내' })).toHaveCount(0);

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
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture)), appliedWorkspace);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/account-map/');
  await page.addStyleTag({ content: '.journey-launcher { width: 220px !important; }' });

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
    localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture));
  }, appliedWorkspace);
  await page.goto('apps/main/');

  const opener = page.getByRole('button', { name: '월 소비 편집' });
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
    localStorage.setItem('isf-workspace-v3', JSON.stringify(fixture));
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

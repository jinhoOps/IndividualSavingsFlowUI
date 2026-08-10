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
  schemaVersion: 1,
  revision: 1,
  updatedAt: appliedMain.updatedAt,
  main: { applied: appliedMain, setupProgress: null },
  simulation: { draft: null },
  portfolio: { plans: [], draft: null },
  locations: [],
  accountMap: { applied: null, draft: null, instruments: [], flows: [] },
};

const sharedShellViewports = [
  { width: 390, height: 844, launcherX: 20, launcherWidth: 350 },
  { width: 768, height: 1024, launcherX: 32, launcherWidth: 704 },
  { width: 1280, height: 900, launcherX: 72, launcherWidth: 1136 },
] as const;

for (const viewport of sharedShellViewports) {
  test(`shares Main launcher geometry and canvas at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript((fixture) => {
      localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
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
  await page.addInitScript((fixture) => {
    const seedMarker = 'isf-test-journey-fixture-seeded';
    if (sessionStorage.getItem(seedMarker) !== null) return;
    sessionStorage.setItem(seedMarker, 'true');

    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
    localStorage.setItem('isf-journey-snapshot-v1', JSON.stringify({
      monthlySavingWon: 900_000,
      monthlyInvestmentWon: 900_000,
    }));
    localStorage.setItem('isf-simulation-compound-v1', JSON.stringify({
      schemaVersion: 2,
      source: {
        monthlySavingsWon: 100_000,
        monthlyInvestmentWon: 100_000,
        mainUpdatedAt: fixture.main.applied.updatedAt - 1,
      },
      initialInvestmentWon: 10_000_000,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: fixture.main.applied.updatedAt - 1,
    }));
  }, appliedWorkspace);
  await page.goto('apps/main/');
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBeNull();
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBeNull();
  await expect(page.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
  await expect(page.getByText('월 저축 30만 원 · 투자 20만 원 · 연 9%')).toBeVisible();
  await expect(page.getByRole('link', { name: /미래 성장 \(Simulation\).*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
});

test('revisits Simulation at the result and refreshes only its Main source', async ({ page }) => {
  const previousSource = {
    monthlySavingsWon: 100_000,
    monthlyInvestmentWon: 100_000,
    mainUpdatedAt: appliedMain.updatedAt - 1,
  };
  await page.addInitScript(({ workspace, source }) => {
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    localStorage.setItem('isf-simulation-compound-v1', JSON.stringify({
      schemaVersion: 2,
      source,
      initialInvestmentWon: 10_000_000,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: source.mainUpdatedAt,
    }));
  }, { workspace: appliedWorkspace, source: previousSource });

  await page.goto('apps/simulation/');
  await expect(page.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
  await expect(page.getByText(/월 저축 30만 원 · 투자 20만 원/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' }))
    .toHaveCount(0);

  const stored = await page.evaluate(() => JSON.parse(
    localStorage.getItem('isf-simulation-compound-v1')!,
  ));
  expect(stored.source.monthlySavingsWon).toBe(300_000);
  expect(stored.initialInvestmentWon).toBe(10_000_000);
});

test('keeps detailed Portfolio and readiness-only Account Map isolated', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture)), appliedWorkspace);
  await page.goto('apps/portfolio/');
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  await expect(page.getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ })).toBeVisible();
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
  await expect(page.locator('app-header, data-hub-modal, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
});

test('separates app navigation and the right-aligned management tool across viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
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

test('keeps each app management menu reachable and contained across viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, appliedWorkspace);
  const apps = [
    { path: 'apps/main/', text: '백업 가져오기' },
    { path: 'apps/simulation/', text: '시뮬레이션 다시 설정' },
    { path: 'apps/portfolio/', text: '투자 배분 처음부터 다시' },
    { path: 'apps/account-map/', text: '아직 관리할 설정이 없습니다' },
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
      const triggerBox = await trigger.boundingBox();
      expect(triggerBox?.width).toBe(44);
      expect(triggerBox?.height).toBe(44);

      await trigger.click();
      const menu = page.getByRole('menu', { name: '관리 메뉴' });
      await expect(menu).toBeVisible();
      const help = menu.getByRole('menuitem', { name: '앱 아이콘 안내' });
      await expect(help).toHaveAttribute('aria-expanded', 'false');
      await help.click();
      const guide = page.getByRole('region', { name: '앱 아이콘 안내' });
      await expect(guide).toContainText('자금 흐름 (Main)');
      await expect(guide).toContainText('미래 성장 (Simulation)');
      await expect(guide).toContainText('투자 배분 (Portfolio)');
      await expect(guide).toContainText('계좌 연결 (Account Map)');
      await expect(guide).toContainText('준비 중');
      expect(await menu.evaluate((node) => node.querySelector('[role="region"]'))).toBeNull();
      const guideBox = await guide.boundingBox();
      expect(guideBox).not.toBeNull();
      expect(guideBox!.x).toBeGreaterThanOrEqual(16);
      expect(guideBox!.x + guideBox!.width).toBeLessThanOrEqual(viewport.width - 16);
      await help.click();
      await expect(guide).toHaveCount(0);
      await expect(menu.getByText(app.text)).toBeVisible();
      const menuBox = await menu.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox!.x).toBeGreaterThanOrEqual(16);
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.width - 16);

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await page.locator('main').click({ position: { x: 1, y: 1 } });
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('keeps Account Map usable at mobile, tablet, and desktop widths', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/account-map/');

    const launcher = page.getByRole('navigation', { name: 'ISF 앱' });
    const accountMapLink = page.getByRole('link', { name: /계좌 연결 \(Account Map\).*현재 위치.*준비 중/ });
    const mainLink = page.getByRole('link', { name: 'Main으로 이동' });
    await expect(launcher).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
    await expect(mainLink).toBeVisible();
    await expect(mainLink).toHaveAttribute('href', /\/apps\/main\/$/);

    await expect(accountMapLink).toHaveAttribute('aria-current', 'page');

    const visibleTargetSizes = await page.locator(
      '.journey-launcher__app-link, .journey-readiness__content .journey-action',
    ).evaluateAll((elements) => elements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ width: rect.width, height: rect.height })));
    expect(visibleTargetSizes.length).toBeGreaterThan(0);
    for (const size of visibleTargetSizes) {
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }

    for (let attempt = 0; attempt < 8 && !await mainLink.evaluate(
      (element) => document.activeElement === element,
    ); attempt += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(mainLink).toBeFocused();
    expect(await mainLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 1;
    })).toBe(true);

    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('explains app icons with pointer, keyboard, touch and integrated management help', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture)), appliedWorkspace);
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
  await expect(panel).toContainText('준비 중');
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
  await page.addInitScript((fixture) => localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture)), appliedWorkspace);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/account-map/');
  await page.addStyleTag({ content: '.journey-launcher { width: 220px !important; }' });

  const navigation = page.getByRole('navigation', { name: 'ISF 앱' });
  await expect(navigation.getByRole('link', { name: /계좌 연결 \(Account Map\).*현재 위치/ })).toBeVisible();
  const more = navigation.getByRole('button', { name: '앱 더보기' });
  await expect(more).toBeVisible();
  await more.click();
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
  await expect(more).toBeFocused();

  await more.click();
  await page.locator('main').click({ position: { x: 1, y: 1 } });
  await expect(overflow).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
});

test('legacy Simulation DOM is absent from the supported route', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, appliedWorkspace);
  await page.goto('apps/simulation/');
  await expect(page.locator('app-header, data-hub-modal, #strategyCardGroup')).toHaveCount(0);
});

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

test('connects Main directly to the detailed Simulation', async ({ page }) => {
  await page.addInitScript((fixture) => {
    const seedMarker = 'isf-test-journey-fixture-seeded';
    if (sessionStorage.getItem(seedMarker) !== null) return;
    sessionStorage.setItem(seedMarker, 'true');

    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    localStorage.setItem('isf-journey-snapshot-v1', JSON.stringify({
      monthlySavingWon: 900_000,
      monthlyInvestmentWon: 900_000,
    }));
    localStorage.setItem('isf-simulation-compound-v1', JSON.stringify({
      schemaVersion: 2,
      source: {
        monthlySavingsWon: 100_000,
        monthlyInvestmentWon: 100_000,
        mainUpdatedAt: fixture.updatedAt - 1,
      },
      initialInvestmentWon: 10_000_000,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: fixture.updatedAt - 1,
    }));
  }, appliedMain);
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
  await page.addInitScript(({ main, source }) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(main));
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
  }, { main: appliedMain, source: previousSource });

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
  await page.addInitScript((fixture) => localStorage.setItem('isf-main-v2', JSON.stringify(fixture)), appliedMain);
  await page.goto('apps/portfolio/');
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  await expect(page.getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ })).toBeVisible();
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
  await expect(page.locator('app-header, data-hub-modal, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
});

test('contains launcher and current Simulation route at mobile, tablet, and desktop widths', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/simulation/');
    const launcher = page.getByRole('navigation', { name: 'ISF 앱' });
    await expect(launcher).toBeVisible();
    await expect(page.getByRole('link', { name: /미래 성장 \(Simulation\).*현재 위치/ }))
      .toHaveAttribute('aria-current', 'page');

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

    const helpTarget = await launcher.getByRole('button', { name: '앱 아이콘 도움말' })
      .evaluate((button) => {
        const hit = button.getBoundingClientRect();
        const visual = button.querySelector('[data-help-visual]')!.getBoundingClientRect();
        return {
          hit: { width: hit.width, height: hit.height, top: hit.top },
          visual: { width: visual.width, height: visual.height },
        };
      });
    expect(helpTarget.hit).toEqual({ width: 32, height: 44, top: appTargets[0].top });
    expect(helpTarget.visual).toEqual({ width: 30, height: 30 });
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
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

    for (let attempt = 0; attempt < 6 && !await mainLink.evaluate(
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

test('explains app icons with pointer, keyboard, touch and narrow help', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-main-v2', JSON.stringify(fixture)), appliedMain);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/simulation/');

  const mainLink = page.getByRole('link', { name: '자금 흐름 (Main)' });
  await mainLink.hover();
  await expect(page.getByRole('tooltip')).toHaveText('자금 흐름 (Main)');
  await mainLink.focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  const help = page.getByRole('button', { name: '앱 아이콘 도움말' });
  await help.click();
  const panel = page.getByRole('region', { name: '앱 아이콘 안내' });
  await expect(panel).toContainText('계좌 연결 (Account Map)');
  await expect(panel).toContainText('준비 중');
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeLessThanOrEqual(220);
  expect(panelBox!.x).toBeGreaterThanOrEqual(16);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(374);

  await page.locator('main').click({ position: { x: 1, y: 1 } });
  await expect(panel).toHaveCount(0);

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
});

test('legacy Simulation DOM is absent from the supported route', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
  await page.goto('apps/simulation/');
  await expect(page.locator('app-header, data-hub-modal, #strategyCardGroup')).toHaveCount(0);
});

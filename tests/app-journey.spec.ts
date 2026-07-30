import { expect, test } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 6, 29, 3, 15),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

test('connects Main through Simulation readiness to Portfolio readiness', async ({ page }) => {
  await page.addInitScript((fixture) => {
    if (localStorage.getItem('isf-main-v2') === null) {
      localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    }
  }, appliedMain);
  await page.goto('apps/main/');

  await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect(page.getByRole('status')).toContainText('연결되었습니다');
  await expect(page.getByText('월 투자 가능액 110만 원')).toBeVisible();
  await expect(page.locator('time')).toHaveAttribute('datetime', new Date(appliedMain.updatedAt).toISOString());
  await expect(page.getByRole('link', { name: 'Main에서 최신 정보 가져오기' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('월 투자 가능액 110만 원')).toBeVisible();
  await page.getByRole('button', { name: 'Portfolio로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/portfolio\/$/);
  await expect(page.getByRole('status')).toContainText('연결되었습니다');
  await page.getByRole('link', { name: 'Simulation 준비 중' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect(page.getByRole('status')).toContainText('연결되었습니다');
  await expect(page.getByText('월 투자 가능액 110만 원')).toBeVisible();

  await page.evaluate((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify({
      ...fixture,
      updatedAt: fixture.updatedAt + 1,
      monthlyNetIncomeWon: 3_600_000,
    }));
  }, appliedMain);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page.getByText('월 투자 가능액 150만 원')).toBeVisible();

  await page.goto('apps/portfolio/');
  await expect(page.getByRole('link', { name: 'Main으로 이동' })).toBeVisible();
});

test('requires Main input before journey navigation', async ({ page }) => {
  await page.goto('apps/main/');

  await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeDisabled();
});

test('recovers from missing and malformed journey storage', async ({ page }) => {
  await page.goto('apps/simulation/');
  await expect(page.getByRole('link', { name: 'Main으로 이동' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('isf-journey-snapshot-v1', '{broken'));
  await page.reload();
  await expect(page.getByText('연결 정보를 확인하지 못했습니다')).toBeVisible();
});

test('recovers to a Main path when browser storage reads are blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is disabled', 'SecurityError');
      },
    });
  });
  await page.goto('apps/simulation/');

  await expect(page.getByText('연결 정보를 확인하지 못했습니다')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Main으로 이동' })).toBeVisible();
});

test('legacy app DOM is absent from product routes', async ({ page }) => {
  for (const app of ['simulation', 'portfolio', 'account-map']) {
    await page.goto(`apps/${app}/`);
    await expect(page.locator('app-header, data-hub-modal, #strategyCardGroup, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /준비 중$/ })).toBeVisible();
  }
});

test.describe('mobile app journey', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('keeps launcher and keyboard journey handoff usable without horizontal overflow', async ({ page }) => {
    await page.addInitScript((fixture) => {
      localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    }, appliedMain);
    await page.goto('apps/main/');

    const launcher = page.locator('.journey-launcher summary');
    const launcherBox = await launcher.boundingBox();
    expect(launcherBox).not.toBeNull();
    expect(launcherBox!.height).toBeGreaterThanOrEqual(44);
    await launcher.tap();
    const simulationLink = page.getByRole('link', { name: 'Simulation 준비 중' });
    const simulationLinkBox = await simulationLink.boundingBox();
    expect(simulationLinkBox).not.toBeNull();
    expect(simulationLinkBox!.height).toBeGreaterThanOrEqual(44);
    const action = page.getByRole('button', { name: 'Simulation으로 이어가기' });
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const actionWidth = await action.evaluate((element) => {
      const parent = element.parentElement!;
      const parentStyle = getComputedStyle(parent);
      const parentContentWidth = parent.getBoundingClientRect().width
        - Number.parseFloat(parentStyle.paddingLeft)
        - Number.parseFloat(parentStyle.paddingRight)
        - Number.parseFloat(parentStyle.borderLeftWidth)
        - Number.parseFloat(parentStyle.borderRightWidth);
      return {
        action: element.getBoundingClientRect().width,
        parentContent: parentContentWidth,
      };
    });
    expect(Math.abs(actionWidth.action - actionWidth.parentContent)).toBeLessThanOrEqual(1);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    await simulationLink.tap();
    await expect(page).toHaveURL(/\/apps\/simulation\/$/);
    const recoveryAction = page.getByRole('link', { name: 'Main으로 이동' });
    const recoveryActionWidth = await recoveryAction.evaluate((element) => {
      const parent = element.parentElement!;
      const parentStyle = getComputedStyle(parent);
      const parentContentWidth = parent.getBoundingClientRect().width
        - Number.parseFloat(parentStyle.paddingLeft)
        - Number.parseFloat(parentStyle.paddingRight)
        - Number.parseFloat(parentStyle.borderLeftWidth)
        - Number.parseFloat(parentStyle.borderRightWidth);
      return {
        action: element.getBoundingClientRect().width,
        parentContent: parentContentWidth,
      };
    });
    expect(Math.abs(recoveryActionWidth.action - recoveryActionWidth.parentContent)).toBeLessThanOrEqual(1);
    await recoveryAction.tap();
    await expect(page).toHaveURL(/\/apps\/main\/$/);
    await action.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/apps\/simulation\/$/);
    const keyboardPortfolioAction = page.getByRole('button', { name: 'Portfolio로 이어가기' });
    const readinessActionWidth = await keyboardPortfolioAction.evaluate((element) => {
      const parent = element.parentElement!;
      const parentStyle = getComputedStyle(parent);
      const parentContentWidth = parent.getBoundingClientRect().width
        - Number.parseFloat(parentStyle.paddingLeft)
        - Number.parseFloat(parentStyle.paddingRight)
        - Number.parseFloat(parentStyle.borderLeftWidth)
        - Number.parseFloat(parentStyle.borderRightWidth);
      return {
        action: element.getBoundingClientRect().width,
        parentContent: parentContentWidth,
      };
    });
    expect(Math.abs(readinessActionWidth.action - readinessActionWidth.parentContent)).toBeLessThanOrEqual(1);
    await keyboardPortfolioAction.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/apps\/portfolio\/$/);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('tablet app journey', () => {
  test.use({ viewport: { width: 768, height: 900 } });

  test('keeps launcher, readiness status, focus actions and content contained at 768px', async ({ page }) => {
    await page.addInitScript((fixture) => {
      localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    }, appliedMain);
    await page.goto('apps/main/');

    await expect(page.locator('.journey-launcher summary')).toBeHidden();
    await expect(page.getByRole('link', { name: /Main 사용 중.*현재 위치/ }))
      .toHaveAttribute('aria-current', 'page');
    for (const label of ['Simulation 준비 중', 'Portfolio 준비 중', 'Account Map 준비 중']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }

    const mainAction = page.getByRole('button', { name: 'Simulation으로 이어가기' });
    await mainAction.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/apps\/simulation\/$/);
    await expect(page.getByRole('link', { name: /Simulation 준비 중.*현재 위치/ }))
      .toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('status')).toContainText('연결되었습니다');
    await expect(page.getByRole('link', { name: 'Main 사용 중' })).toBeVisible();

    const readiness = page.locator('.journey-readiness__content');
    const visualFoundation = await readiness.evaluate((element) => {
      const bodyStyle = getComputedStyle(document.body);
      const style = getComputedStyle(element);
      return {
        bodyFont: bodyStyle.fontFamily,
        background: style.backgroundColor,
        border: style.borderStyle,
      };
    });
    expect(visualFoundation.bodyFont).toContain('Gowun');
    expect(visualFoundation.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(visualFoundation.border).toBe('solid');

    const portfolioAction = page.getByRole('button', { name: 'Portfolio로 이어가기' });
    const containment = await portfolioAction.evaluate((element) => {
      const action = element.getBoundingClientRect();
      const content = element.parentElement!.getBoundingClientRect();
      return action.left >= content.left
        && action.right <= content.right
        && action.top >= content.top
        && action.bottom <= content.bottom;
    });
    expect(containment).toBe(true);

    await portfolioAction.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/apps\/portfolio\/$/);
    await expect(page.getByRole('link', { name: /Portfolio 준비 중.*현재 위치/ }))
      .toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('status')).toContainText('연결되었습니다');
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  });
});

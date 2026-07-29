import { expect, test, type Page } from '@playwright/test';

const appliedMainV2 = {
  schemaVersion: 2 as const,
  updatedAt: 1,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

async function clearBrowserStorage(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('isf-e2e-storage-cleared') !== null) return;
    localStorage.clear();
    sessionStorage.setItem('isf-e2e-storage-cleared', 'true');
  });
}

async function pressTab(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab');
  }
}

test('new user applies the v2 quick setup and refreshes into matching dashboard totals', async ({ page }) => {
  await clearBrowserStorage(page);
  await page.goto('apps/main/');

  await expect(page).toHaveURL(/\/IndividualSavingsFlowUI\/apps\/main\/$/);
  await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 실수령액').fill('3200000');
  await expect(page.getByLabel('월 실수령액')).toHaveValue('3,200,000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 주거 고정비').fill('800000');
  await expect(page.getByLabel('월 주거 고정비')).toHaveValue('800,000');
  await expect(page.getByRole('meter', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '25.0%');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월평균 생활비').fill('1000000');
  await expect(page.getByRole('meter', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '56.3%');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 저축액').fill('300000');
  await page.getByLabel('월 투자액').fill('200000');
  await expect(page.getByRole('meter', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '71.9%');
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('button', { name: '소비 56.3%' })).toBeVisible();
  await expect(page.getByRole('button', { name: '저축 9.4%' })).toBeVisible();
  await expect(page.getByRole('button', { name: '투자 6.3%' })).toBeVisible();
  await expect(page.getByRole('button', { name: '남는 돈 28.1%' })).toBeVisible();
  await expect(page.getByRole('list', { name: '월 자금 항목' })).toContainText('소비 180만 원');
  await expect(page.getByRole('list', { name: '월 자금 항목' })).toContainText('저축 30만 원');
  await expect(page.getByRole('list', { name: '월 자금 항목' })).toContainText('투자 20만 원');
  await expect(page.getByRole('list', { name: '월 자금 항목' })).toContainText('남는 돈 90만 원');
  await page.getByRole('button', { name: '계획 적용' }).click();

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: '월 실수령액 편집' })).toContainText('320만 원');
  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText('180만 원');
  await expect(page.getByRole('button', { name: '월 저축 편집' })).toContainText('30만 원');
  await expect(page.getByRole('button', { name: '월 투자 편집' })).toContainText('20만 원');
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('90만 원');

  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-main-v2');
    if (raw === null) return null;
    const { updatedAt: _updatedAt, ...stored } = JSON.parse(raw);
    return stored;
  })).toEqual({
    schemaVersion: 2,
    monthlyNetIncomeWon: 3_200_000,
    monthlyHousingWon: 800_000,
    monthlyLivingWon: 1_000_000,
    monthlySavingWon: 300_000,
    monthlyInvestmentWon: 200_000,
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('isf-main-v2-setup-progress'))).toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('isf-main-v1'))).toBeNull();

  await page.reload();

  await expect(page).toHaveURL(/\/IndividualSavingsFlowUI\/apps\/main\/$/);
  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: '월 실수령액 편집' })).toContainText('320만 원');
  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText('180만 원');
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('90만 원');
});

test.describe('mobile quick setup', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('formats money and reveals the live percentage by tap', async ({ page }) => {
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 실수령액').fill('3200000');
    await expect(page.getByLabel('월 실수령액')).toHaveValue('3,200,000');
    await page.getByRole('button', { name: '다음' }).tap();

    await page.getByLabel('월 주거 고정비').fill('800000');
    const meter = page.getByRole('meter', { name: '수입 대비 현재 계획' });
    await expect(meter).toHaveAttribute('aria-valuetext', '25.0%');
    await meter.hover();
    await expect(page.getByRole('tooltip')).toHaveText(/^\d+\.\d%$/);
    await expect(page.getByText(/^월 수입 \d/)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const meterBox = await meter.boundingBox();
    expect(meterBox).not.toBeNull();
    expect(meterBox!.height).toBeGreaterThanOrEqual(44);
    await meter.tap();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await meter.tap();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' }).tap();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    expect(await page.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('keeps allocation segment and tiny legend targets at least 44px', async ({ page }) => {
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 실수령액').fill('3200000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 투자액').fill('1000');
    await page.getByRole('button', { name: '다음' }).tap();

    for (const name of ['남는 돈 100.0%', '소비 0.0%', '투자 0.0%']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box, `${name} target`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }

    const tinyTarget = page.getByRole('button', { name: '투자 0.0%' });
    await tinyTarget.tap();
    await expect(page.getByRole('tooltip')).toHaveText(/^0\.0%$/);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('routes adjacent small allocations to non-overlapping legend targets', async ({ page }) => {
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 실수령액').fill('10000000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 주거 고정비').fill('200000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월평균 생활비').fill('300000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 저축액').fill('600000');
    await page.getByLabel('월 투자액').fill('700000');
    await page.getByRole('button', { name: '다음' }).tap();

    for (const [name, percentage] of [
      ['소비 5.0%', '5.0%'],
      ['저축 6.0%', '6.0%'],
      ['투자 7.0%', '7.0%'],
    ] as const) {
      const target = page.getByRole('button', { name });
      await expect(target).toHaveClass(/allocation-bar__legend-target/);
      const box = await target.boundingBox();
      expect(box, `${name} target`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      await target.tap();
      await expect(page.getByRole('tooltip')).toHaveText(percentage);
    }

    const remaining = page.getByRole('button', { name: '남는 돈 82.0%' });
    await expect(remaining).toHaveClass(/allocation-bar__segment-target/);
    await expect(remaining).toHaveCSS('min-width', '0px');
    await expect(page.locator('.allocation-bar__segment-target')).toHaveCount(1);
  });
});

test('backup import has a matching accessible name and visible keyboard focus ring', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMainV2);
  await page.goto('apps/main/');

  const input = page.getByLabel('백업 가져오기');
  await expect(input).toHaveAttribute('type', 'file');
  await input.focus();
  const label = input.locator('..');
  await expect(label).toHaveCSS('box-shadow', /rgba?\(/);
  await expect(page.getByLabel('JSON 백업 파일')).toHaveCount(0);
});

test('keyboard-only user completes the full quick setup', async ({ page }) => {
  await clearBrowserStorage(page);
  await page.goto('apps/main/');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('3200000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('800000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1000000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('300000');
  await pressTab(page, 5);
  await page.keyboard.type('200000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('90만 원');
});

test('interrupted setup reloads at housing with its v2 draft intact', async ({ page }) => {
  await clearBrowserStorage(page);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 실수령액').fill('3200000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 주거 고정비').fill('800000');

  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-main-v2-setup-progress');
    return raw === null ? null : JSON.parse(raw);
  })).toMatchObject({
    kind: 'initial',
    step: 'housing',
    draft: {
      schemaVersion: 2,
      monthlyNetIncomeWon: 3_200_000,
      monthlyHousingWon: 800_000,
    },
  });

  await page.reload();

  await expect(page.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' })).toBeVisible();
  await expect(page.getByLabel('월 주거 고정비')).toHaveValue('800,000');
  await expect(page.getByRole('meter', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '25.0%');
  await expect(page.getByText(/^월 수입 \d/)).toHaveCount(0);
});

test('dashboard edit persists only the v2 scalar plan', async ({ page }) => {
  await page.addInitScript((fixture) => {
    if (localStorage.getItem('isf-main-v2') === null) {
      localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    }
  }, appliedMainV2);
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '월 소비 편집' }).click();
  await page.getByLabel('월평균 생활비').fill('1100000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('status')).toHaveText('저장됨');
  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText('190만 원');
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('80만 원');

  await page.reload();

  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText('190만 원');
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-main-v2');
    return raw === null ? null : Object.keys(JSON.parse(raw)).sort();
  })).toEqual([
    'monthlyHousingWon',
    'monthlyInvestmentWon',
    'monthlyLivingWon',
    'monthlyNetIncomeWon',
    'monthlySavingWon',
    'schemaVersion',
    'updatedAt',
  ]);
});

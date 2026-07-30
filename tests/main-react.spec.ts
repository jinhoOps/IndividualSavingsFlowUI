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
  await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 실수령액').fill('3200000');
  await expect(page.getByLabel('월 실수령액')).toHaveValue('3,200,000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 주거 고정비').fill('800000');
  await expect(page.getByLabel('월 주거 고정비')).toHaveValue('800,000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월평균 생활비').fill('1000000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 180만 원 · 수입의 56.3%');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 저축액').fill('300000');
  await page.getByLabel('월 투자액').fill('200000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 230만 원 · 수입의 71.9%');
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
  await expect(page.locator('.setup-review-transition')).toBeVisible();
  await expect(page.getByRole('button', { name: '소비 · 180만 원 · 56.3%' })).toBeVisible();
  await expect(page.getByRole('button', { name: /저축 (상세 정보|· 30만 원 · 9\.4%)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /투자 (상세 정보|· 20만 원 · 6\.3%)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '남는 돈 · 90만 원 · 28.1%' })).toBeVisible();
  const reviewTable = page.getByRole('table', { name: '월 자금 항목' });
  await expect(reviewTable.getByRole('row', { name: /소비.*180만 원.*56\.3%/ })).toBeVisible();
  await expect(reviewTable.getByRole('row', { name: /저축.*30만 원.*9\.4%/ })).toBeVisible();
  await expect(reviewTable.getByRole('row', { name: /투자.*20만 원.*6\.3%/ })).toBeVisible();
  await expect(reviewTable.getByRole('row', { name: /남는 돈.*90만 원.*28\.1%/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
  ))).toBe(true);
  await expect(page.locator('.setup-review-transition')).toHaveCount(0);
  await page.getByRole('button', { name: '이전' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('.setup-review-transition')).toBeVisible();
  await page.getByRole('button', { name: '계획 적용' }).click();

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeEnabled();
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

test('review transition stays contained and respects reduced motion', async ({ page }) => {
  await page.addInitScript((draft) => {
    localStorage.clear();
    localStorage.setItem('isf-main-v2-setup-progress', JSON.stringify({
      kind: 'initial',
      step: 'review',
      draft,
      savedAt: Date.now(),
    }));
  }, appliedMainV2);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/main/');
    await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toHaveCount(0);
    await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
    await expect(page.locator('.setup-review-transition')).toBeVisible();
    await expect.poll(() => page.locator('.setup-review-transition__track').evaluate((element) => {
      const style = getComputedStyle(element);
      return { delay: style.animationDelay, duration: style.animationDuration };
    })).toEqual({ delay: '0.35s', duration: '0.62s' });
    await expect.poll(() => page.locator('.setup-review-transition__accent').evaluate((element) => {
      const style = getComputedStyle(element);
      return { delay: style.animationDelay, duration: style.animationDuration };
    })).toEqual({ delay: '0.35s', duration: '0.92s' });
    if (viewport.width === 390) {
      await expect.poll(() => page.evaluate(() => {
        const track = document.querySelector('.setup-review-transition__track');
        const accent = document.querySelector('.setup-review-transition__accent');
        return {
          track: track?.getAnimations()[0]?.playState,
          accent: accent?.getAnimations()[0]?.playState,
        };
      })).toEqual({ track: 'finished', accent: 'running' });
      await expect(page.locator('.setup-review-transition')).toBeVisible();
      const opacity = await page.locator('.setup-review-transition__accent').evaluate(
        (element) => Number(getComputedStyle(element).opacity),
      );
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
      await expect(page.locator('.setup-review-transition')).toHaveCount(0);
    }
    await expect(page.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (
      document.documentElement.scrollWidth <= window.innerWidth
    ))).toBe(true);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('.setup-review-transition')).toBeHidden();
  await expect(page.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
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
    const meter = page.getByRole('progressbar', { name: '수입 대비 현재 계획' });
    await expect(meter).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
    await meter.hover();
    await expect(page.getByRole('tooltip')).toHaveText('현재 계획 80만 원 · 수입의 25.0%');
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

  test('shows an ordered review table and keeps tiny table targets at least 44px', async ({ page }) => {
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 실수령액').fill('3200000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 투자액').fill('1000');
    await page.getByRole('button', { name: '다음' }).tap();

    const table = page.getByRole('table', { name: '월 자금 항목' });
    await expect(table.getByRole('columnheader')).toHaveText(['종류', '금액', '수입 대비']);
    await expect(table.getByRole('row')).toHaveText([
      '종류금액수입 대비',
      '소비0원0.0%',
      '저축0원0.0%',
      '투자1,000원0.0%',
      '남는 돈319.9만 원100.0%',
    ]);

    const layout = await page.locator('.allocation-bar').evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      const parentRect = card.closest('form')!.getBoundingClientRect();
      const tableRect = card.querySelector('.allocation-table')!.getBoundingClientRect();
      const bar = card.querySelector('.allocation-bar__segments')!;
      const cardStyle = getComputedStyle(card);
      const barStyle = getComputedStyle(bar);
      const borderMatch = cardStyle.borderLeftColor.match(/rgba?\(([^)]+)\)/);
      const borderParts = borderMatch?.[1].split(',').map((part) => Number.parseFloat(part.trim())) ?? [];
      return {
        leftGap: cardRect.left - parentRect.left,
        rightGap: parentRect.right - cardRect.right,
        paddingLeft: Number.parseFloat(cardStyle.paddingLeft),
        paddingRight: Number.parseFloat(cardStyle.paddingRight),
        borderWidth: Number.parseFloat(cardStyle.borderLeftWidth),
        borderAlpha: borderParts.length === 4 ? borderParts[3] : 1,
        tableMatchesCard:
          Math.abs(tableRect.left - (cardRect.left + 13)) <= 1
          && Math.abs(tableRect.right - (cardRect.right - 13)) <= 1,
        barRightMargin: Number.parseFloat(barStyle.marginRight),
      };
    });
    expect(Math.abs(layout.leftGap - layout.rightGap)).toBeLessThanOrEqual(1);
    expect(layout.paddingLeft).toBe(12);
    expect(layout.paddingRight).toBe(12);
    expect(layout.borderWidth).toBe(1);
    expect(layout.borderAlpha).toBeGreaterThan(0);
    expect(layout.borderAlpha).toBeLessThanOrEqual(0.2);
    expect(layout.tableMatchesCard).toBe(true);
    expect(layout.barRightMargin).toBe(0);

    for (const name of [
      '남는 돈 · 319.9만 원 · 100.0%',
      '소비 상세 정보',
      '투자 상세 정보',
    ]) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box, `${name} target`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }

    const tinyTarget = page.getByRole('button', { name: '투자 상세 정보' });
    await tinyTarget.tap();
    await expect(page.getByRole('tooltip')).toHaveText('투자 · 1,000원 · 0.0%');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('routes adjacent small allocations to non-overlapping table targets', async ({ page }) => {
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
      ['소비 상세 정보', '소비 · 50만 원 · 5.0%'],
      ['저축 상세 정보', '저축 · 60만 원 · 6.0%'],
      ['투자 상세 정보', '투자 · 70만 원 · 7.0%'],
    ] as const) {
      const target = page.getByRole('button', { name });
      await expect(target).toHaveClass(/allocation-table__label-target/);
      const box = await target.boundingBox();
      expect(box, `${name} target`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      await target.tap();
      await expect(page.getByRole('tooltip')).toHaveText(percentage);
    }

    const remaining = page.getByRole('button', { name: '남는 돈 · 820만 원 · 82.0%' });
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
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
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

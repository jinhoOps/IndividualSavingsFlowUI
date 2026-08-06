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

async function expectDashboardSummary(page: Page, amounts: {
  consumption: string;
  remaining: string;
  saving: string;
  investment: string;
}) {
  const summary = page.getByRole('region', { name: '월 자금 구성 요약' });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('15.6%', { exact: true })).toBeVisible();
  await expect(summary.getByText('저축·투자', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '월 실수령액 편집' })).toHaveCount(0);
  await expect(page.locator('details.allocation-details')).not.toHaveAttribute('open');
  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText(amounts.consumption);
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText(amounts.remaining);
  await expect(page.getByRole('button', { name: '월 저축 편집' })).toContainText(amounts.saving);
  await expect(page.getByRole('button', { name: '월 투자 편집' })).toContainText(amounts.investment);
  await page.getByText('자세히 보기', { exact: true }).click();
  await expect(page.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
}

async function expectResponsiveDashboardFlow(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto('apps/main/');

  const summary = page.getByRole('region', { name: '월 자금 구성 요약' });
  const donut = summary.getByRole('region', { name: '월 수입 배분' });
  const cards = page.getByRole('region', { name: '월간 핵심 수치' });
  const simulation = page.getByRole('region', { name: 'Simulation으로 계획 이어가기' });
  await expect(donut).toBeVisible();
  await expect(cards).toBeVisible();
  await expect(simulation).toBeVisible();

  const layout = await page.evaluate(() => {
    const donut = document.querySelector<HTMLElement>('.cashflow-donut')!;
    const cards = document.querySelector<HTMLElement>('[aria-label="월간 핵심 수치"]')!;
    const simulation = document.querySelector<HTMLElement>('[aria-labelledby="journey-entry-title"]')!;
    const chart = donut.querySelector<HTMLElement>('.cashflow-donut__chart')!;
    const center = donut.querySelector<HTMLElement>('.cashflow-donut__center')!;
    const centerValue = center.querySelector<HTMLElement>('strong')!;
    const centerLabel = center.querySelector<HTMLElement>('span')!;
    const chartRect = chart.getBoundingClientRect();
    const valueRect = centerValue.getBoundingClientRect();
    const labelRect = centerLabel.getBoundingClientRect();
    const relativeLuminance = (color: string) => {
      const channels = color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3).map((value) => {
        const normalized = Number(value) / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const whiteLuminance = 1;
    return {
      domOrder: (donut.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        && (cards.compareDocumentPosition(simulation) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      visualOrder: [donut, cards, simulation].map((element) => element.getBoundingClientRect().top),
      centerWithinChart: valueRect.top >= chartRect.top
        && labelRect.bottom <= chartRect.bottom
        && valueRect.bottom <= labelRect.top,
      legendHeights: Array.from(donut.querySelectorAll<HTMLElement>('.cashflow-donut__legend-button')).map((element) => element.getBoundingClientRect().height),
      legendTextContrast: Array.from(donut.querySelectorAll<HTMLElement>('.cashflow-donut__legend-button span')).map((element) => {
        const luminance = relativeLuminance(getComputedStyle(element).color);
        return (whiteLuminance + 0.05) / (luminance + 0.05);
      }),
      detailsSummaryHeight: document.querySelector<HTMLElement>('.allocation-details > summary')!.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(layout.domOrder).toBe(true);
  expect(layout.visualOrder[0]).toBeLessThan(layout.visualOrder[1]);
  expect(layout.visualOrder[1]).toBeLessThan(layout.visualOrder[2]);
  expect(layout.centerWithinChart).toBe(true);
  for (const height of layout.legendHeights) expect(height).toBeGreaterThanOrEqual(43.99);
  expect(layout.detailsSummaryHeight).toBeGreaterThanOrEqual(43.99);
  for (const contrast of layout.legendTextContrast) expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(layout.overflow).toBe(true);

  const details = page.locator('details.allocation-details');
  await expect(details).not.toHaveAttribute('open');
  await page.getByText('자세히 보기', { exact: true }).click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('.allocation-bar')).toBeVisible();
  await expect(details.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
  ))).toBe(true);

  await page.getByRole('button', { name: '월 소비 편집' }).click();
  const editor = viewport.width < 768
    ? page.getByRole('dialog')
    : page.locator('div.fixed.inset-y-0.right-0');
  await expect(editor).toBeVisible();
  await expect.poll(() => editor.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
  const containment = await editor.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      contained: bounds.left >= 0 && bounds.top >= 0 && bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  expect(containment.contained, JSON.stringify(containment)).toBe(true);
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
  await expectDashboardSummary(page, {
    consumption: '180만 원',
    remaining: '90만 원',
    saving: '30만 원',
    investment: '20만 원',
  });

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
  await expectDashboardSummary(page, {
    consumption: '180만 원',
    remaining: '90만 원',
    saving: '30만 원',
    investment: '20만 원',
  });
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
    await page.locator('.allocation-bar').evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    const initialRevealState = await page.locator('.allocation-bar').evaluate((element) => ({
      borderColor: getComputedStyle(element).borderColor,
      backgroundColor: getComputedStyle(element).backgroundColor,
      contextOpacity: getComputedStyle(element.querySelector('.allocation-bar__context')!).opacity,
      tableOpacity: getComputedStyle(element.querySelector('.allocation-table')!).opacity,
      finalTrackOpacity: getComputedStyle(element.querySelector('.allocation-bar__segments')!).opacity,
      transitionOpacity: getComputedStyle(element.querySelector('.setup-review-transition')!).opacity,
    }));
    expect(initialRevealState).toEqual({
      borderColor: 'rgba(0, 0, 0, 0)',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      contextOpacity: '0',
      tableOpacity: '0',
      finalTrackOpacity: '0',
      transitionOpacity: '0',
    });
    await expect.poll(() => page.locator('.setup-review-transition__track').evaluate((element) => {
      const style = getComputedStyle(element);
      return { delay: style.animationDelay, duration: style.animationDuration };
    })).toEqual({ delay: '0.35s', duration: '0.62s' });
    await expect.poll(() => page.locator('.setup-review-transition__accent').evaluate((element) => {
      const style = getComputedStyle(element);
      return { delay: style.animationDelay, duration: style.animationDuration };
    })).toEqual({ delay: '0.35s', duration: '0.92s' });
    await page.locator('.allocation-bar').evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.currentTime = 1100;
      }
    });
    await expect(page.locator('.setup-review-transition')).toBeVisible();
    const opacity = await page.locator('.setup-review-transition__accent').evaluate(
      (element) => Number(getComputedStyle(element).opacity),
    );
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
    await page.locator('.allocation-bar').evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.play();
      }
    });
    await expect(page.locator('.setup-review-transition')).toHaveCount(0);
    await expect.poll(() => page.locator('.allocation-table').evaluate(
      (element) => getComputedStyle(element).opacity,
    )).toBe('1');
    await expect.poll(() => page.locator('.allocation-bar__segments').evaluate(
      (element) => getComputedStyle(element).opacity,
    )).toBe('1');
    await expect.poll(() => page.locator('.allocation-bar').evaluate(
      (element) => getComputedStyle(element).borderColor,
    )).not.toBe('rgba(0, 0, 0, 0)');
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

test('live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.clear();
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMainV2);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await expectResponsiveDashboardFlow(page, viewport);
  }
});

test.describe('mobile cashflow donut', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('keeps a compact legend and reveals touched ring details', async ({ page }) => {
    await page.addInitScript((fixture) => {
      localStorage.clear();
      localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    }, appliedMainV2);
    await page.goto('apps/main/');

    const donut = page.getByRole('region', { name: '월 수입 배분' });
    const legendLayout = await donut.locator('.cashflow-donut__legend-button').evaluateAll((buttons) => (
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('span:first-child')!.getBoundingClientRect();
        const percentage = button.querySelector('span:last-child')!.getBoundingClientRect();
        const amount = button.querySelector<HTMLElement>('.cashflow-donut__legend-amount')!;
        return {
          height: rect.height,
          oneLine: Math.abs(label.top - percentage.top) <= 1,
          amountDisplay: getComputedStyle(amount).display,
        };
      })
    ));

    expect(legendLayout).toHaveLength(4);
    for (const item of legendLayout) {
      expect(item.height).toBeGreaterThanOrEqual(44);
      expect(item.oneLine).toBe(true);
      expect(item.amountDisplay).toBe('none');
    }

    const chart = donut.getByRole('img', { name: /소비 56\.3%.*여윳돈 28\.1%/ });
    const chartBox = await chart.boundingBox();
    expect(chartBox).not.toBeNull();
    const center = donut.locator('.cashflow-donut__center');
    for (const allocation of [
      { id: 'consumption', label: '소비', amount: '180만 원', percentage: '56.3%', x: 89.2, y: 57.8 },
      { id: 'saving', label: '저축', amount: '30만 원', percentage: '9.4%', x: 24.6, y: 80.9 },
      { id: 'investment', label: '투자', amount: '20만 원', percentage: '6.3%', x: 13, y: 65.3 },
      { id: 'remaining', label: '여윳돈', amount: '90만 원', percentage: '28.1%', x: 19.1, y: 24.6 },
    ]) {
      await chart.tap({
        position: {
          x: chartBox!.width * allocation.x / 100,
          y: chartBox!.height * allocation.y / 100,
        },
      });
      await expect(center.getByText(allocation.percentage, { exact: true })).toBeVisible();
      await expect(center.getByText(allocation.label, { exact: true })).toBeVisible();
      await expect(donut.getByRole('tooltip')).toHaveText(
        `${allocation.label} · ${allocation.amount} · ${allocation.percentage}`,
      );
      await expect(donut.getByRole('button', {
        name: `${allocation.label} · ${allocation.amount} · ${allocation.percentage}`,
      })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => (
        donut.locator(`circle.cashflow-donut__segment--${allocation.id}`).evaluate((circle) => {
          const style = getComputedStyle(circle);
          return { r: style.r, strokeWidth: style.strokeWidth };
        })
      )).toEqual({ r: '42px', strokeWidth: '15px' });
    }

    await page.getByRole('heading', { name: '이번 달 자금 흐름' }).tap();
    await expect(center.getByText('15.6%', { exact: true })).toBeVisible();
    await expect(center.getByText('저축·투자', { exact: true })).toBeVisible();
    await expect(donut.locator('.cashflow-donut__segment--active')).toHaveCount(0);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    await page.setViewportSize({ width: 768, height: 900 });
    for (const amount of await donut.locator('.cashflow-donut__legend-amount').all()) {
      await expect(amount).toBeVisible();
    }

    const tabletChartBox = await chart.boundingBox();
    expect(tabletChartBox).not.toBeNull();
    await chart.tap({
      position: {
        x: tabletChartBox!.width * 0.13,
        y: tabletChartBox!.height * 0.653,
      },
    });
    const saving = donut.getByRole('button', { name: '저축 · 30만 원 · 9.4%' });
    await saving.focus();
    await expect(center.getByText('9.4%', { exact: true })).toBeVisible();
    await expect(center.getByText('저축', { exact: true })).toBeVisible();
    await expect(donut.getByRole('tooltip')).toHaveText('저축 · 30만 원 · 9.4%');
    await expect(donut.getByRole('button', { name: '투자 · 20만 원 · 6.3%' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(donut.locator('circle.cashflow-donut__segment--saving'))
      .toHaveClass(/cashflow-donut__segment--active/);
    await saving.evaluate((button) => button.blur());
    await expect(center.getByText('6.3%', { exact: true })).toBeVisible();
    await expect(center.getByText('투자', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await saving.hover();
    await expect(center.getByText('9.4%', { exact: true })).toBeVisible();
    await expect(donut.getByRole('tooltip')).toHaveText('저축 · 30만 원 · 9.4%');
  });
});

test('live dashboard removes donut circle transitions when reduced motion is requested', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.clear();
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMainV2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/main/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();

  await expect(page.getByRole('region', { name: '월 자금 구성 요약' })).toBeVisible();
  const chart = page.getByRole('img', { name: /소비 56\.3%/ });
  const chartBox = await chart.boundingBox();
  expect(chartBox).not.toBeNull();
  await chart.click({ position: { x: chartBox!.width / 2, y: chartBox!.height * 0.1 } });
  const transition = await page.locator('.cashflow-donut__segment--active').evaluate((element) => {
    const style = getComputedStyle(element);
    return { duration: style.transitionDuration, property: style.transitionProperty, r: style.r };
  });
  expect(transition).toEqual({ duration: '0s', property: 'none', r: '42px' });
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
    const quickAdjustments = ['-50만', '-10만', '+10만', '+50만'].map(
      (name) => page.getByRole('button', { name }),
    );
    const adjustmentBoxes = await Promise.all(quickAdjustments.map((button) => button.boundingBox()));
    expect(new Set(adjustmentBoxes.map((box) => Math.round(box!.y))).size).toBe(1);
    for (const box of adjustmentBoxes) {
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
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
    await expect(page.locator('.setup-review-transition')).toHaveCount(0);

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
      const target = page.getByRole('button', { name });
      await expect(target).toHaveCSS('min-height', '44px');
      const box = await target.boundingBox();
      expect(box, `${name} target`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(43.99);
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

  const trigger = page.getByRole('button', { name: '관리 메뉴' });
  await trigger.click();
  const input = page.getByLabel('백업 가져오기');
  await expect(input).toHaveAttribute('type', 'file');
  await input.focus();
  const label = input.locator('..');
  await expect(label).toHaveCSS('box-shadow', /rgba?\(/);
  await expect(page.getByLabel('JSON 백업 파일')).toHaveCount(0);
  await input.setInputFiles({
    name: 'main-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(appliedMainV2)),
  });
  await expect(trigger).toBeFocused();
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

test('월 자금 계획 편집은 편집 중인 금액의 빠른 조정만 표시한다', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMainV2);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '월 소비 편집' }).click();

  const editor = page.locator('[aria-labelledby="cashflow-editor-title"]');
  const fields = editor.locator('.money-field');
  await fields.nth(0).getByRole('textbox').focus();
  await expect(fields.nth(0).locator('.money-field__adjustments')).toBeVisible();
  await expect(fields.nth(1).locator('.money-field__adjustments')).toBeHidden();

  await fields.nth(0).getByRole('button', { name: '+10만' }).focus();
  await expect(fields.nth(0).locator('.money-field__adjustments')).toBeVisible();

  await fields.nth(1).getByRole('textbox').focus();
  await expect(fields.nth(0).locator('.money-field__adjustments')).toBeHidden();
  await expect(fields.nth(1).locator('.money-field__adjustments')).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 6, 30, 6),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

async function seedMain(page: Page, fixture = appliedMain) {
  await page.addInitScript((value) => {
    if (localStorage.getItem('isf-main-v2') === null) {
      localStorage.setItem('isf-main-v2', JSON.stringify(value));
    }
  }, fixture);
}

async function openFirstResult(page: Page) {
  await page.goto('apps/simulation/');
  await page.getByRole('button', { name: '없어요' }).click();
  await expect(page.getByRole('heading', {
    name: '얼마나 오래, 어느 정도 수익을 기대할까요?',
  })).toBeVisible();
  await page.getByRole('button', { name: '결과 보기' }).click();
  await expect(page.getByRole('heading', { name: /이대로 20년 유지하면 .*이 됩니다!/ }))
    .toBeVisible();
}

test('390px 시작 자산 빠른 조정은 한 줄 터치 영역을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page);
  await page.goto('apps/simulation/');
  await page.getByRole('button', { name: '있어요' }).click();

  const buttons = ['-1000만', '-100만', '+100만', '+1000만']
    .map((name) => page.getByRole('button', { name }));
  const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));

  expect(boxes.every((box) => box !== null)).toBe(true);
  expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(1);
  expect(boxes.every((box) => box !== null && box.height >= 44)).toBe(true);
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
});

test('guides first run, supports boundary years and keeps Main read-only', async ({ page }) => {
  await seedMain(page);
  await openFirstResult(page);

  await page.getByRole('spinbutton', { name: '기간 숫자' }).fill('0');
  await expect(page.getByRole('heading', { name: /현재 시작 자산은/ })).toBeVisible();
  await page.getByRole('spinbutton', { name: '기간 숫자' }).fill('30');
  await expect(page.getByRole('heading', { name: /이대로 30년 유지하면/ })).toBeVisible();

  await page.getByRole('button', { name: '직접 입력' }).click();
  await page.getByRole('spinbutton', { name: '연 기대수익률 직접 입력' }).fill('8.75');
  await expect(page.getByText(/연 8.75%/)).toBeVisible();
  await expect(page.getByText(/백테스트나 금융 자문이 아닙니다/)).toBeHidden();
  await page.getByText('계산 기준').click();
  await expect(page.getByText(/백테스트나 금융 자문이 아닙니다/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-main-v2')!)))
    .toEqual(appliedMain);
});

test('reloads latest Main values and resets only Simulation from its menu', async ({ page }) => {
  await seedMain(page);
  await openFirstResult(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();

  await page.evaluate(() => {
    const main = JSON.parse(localStorage.getItem('isf-main-v2')!);
    localStorage.setItem('isf-main-v2', JSON.stringify({
      ...main,
      monthlySavingWon: 900_000,
      updatedAt: main.updatedAt + 1,
    }));
  });
  await page.reload();
  await expect(page.getByText(/월 저축 90만 원/)).toBeVisible();

  await page.getByText('Simulation 메뉴').click();
  await page.getByRole('button', { name: '시뮬레이션 다시 설정' }).click();
  await page.getByRole('button', { name: '다시 설정 확인' }).click();
  await expect(page.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('isf-main-v2'))).not.toBeNull();
});

for (const viewport of [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 900, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
]) {
  test(`${viewport.label} keeps graph, tooltip, and controls contained`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedMain(page);
    await openFirstResult(page);

    const graph = page.getByRole('img', { name: '연도별 복리 성장 그래프' });
    const explorer = page.getByRole('application', { name: '그래프 연도 탐색' });
    await expect(graph).toBeVisible();
    await expect(page.getByText('전부 저축보다')).toBeVisible();
    await expect(page.getByText('납입원금 대비')).toBeVisible();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    const box = await graph.boundingBox();
    if (box === null) throw new Error('graph has no bounding box');
    await graph.dispatchEvent('pointerdown', {
      clientX: box.x + box.width / 2,
      pointerType: 'touch',
    });
    const tooltip = page.locator('.growth-chart__tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipBox = await tooltip.boundingBox();
    if (tooltipBox === null) throw new Error('tooltip has no bounding box');
    expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(viewport.width);
    expect(tooltipBox.y).toBeGreaterThanOrEqual(box.y);
    expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(box.y + box.height);

    const comparisonWraps = await page.locator('.simulation-comparison dd').evaluateAll((values) => (
      values.some((value) => {
        const range = document.createRange();
        range.selectNodeContents(value);
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.y)));
        return value.scrollWidth > value.clientWidth || lines.size > 1;
      })
    ));
    expect(comparisonWraps).toBe(false);

    await explorer.focus();
    await explorer.press('Home');
    await explorer.press('ArrowRight');
    await expect(page.getByText('1년', { exact: true })).toBeVisible();

    const undersized = await page.locator('button:visible, input:visible').evaluateAll((controls) => (
      controls.filter((control) => control.getBoundingClientRect().height < 44).length
    ));
    expect(undersized).toBe(0);
  });
}

test('mobile keeps compact tooltip stable while dragging', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page);
  await openFirstResult(page);
  await page.getByRole('spinbutton', { name: '기간 숫자' }).fill('30');

  const graph = page.getByRole('img', { name: '연도별 복리 성장 그래프' });
  const box = await graph.boundingBox();
  if (box === null) throw new Error('graph has no bounding box');
  const firstX = box.x + 36 / 680 * box.width;
  const lastX = box.x + 656 / 680 * box.width;

  await graph.dispatchEvent('pointerdown', {
    pointerId: 9,
    pointerType: 'touch',
    buttons: 1,
    clientX: firstX,
  });
  const tooltip = page.locator('.growth-chart__tooltip--compact');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText('현재 계획 총액')).toBeVisible();
  await expect(tooltip.getByText('전부 저축 총액')).toBeVisible();
  await expect(tooltip.getByText('누적 납입원금')).toHaveCount(0);
  await expect(tooltip.getByRole('button')).toHaveCount(0);
  const firstSize = await tooltip.boundingBox();
  expect(firstSize?.width).toBe(192);
  expect(firstSize?.height).toBe(112);

  await graph.dispatchEvent('pointermove', {
    pointerId: 9,
    pointerType: 'touch',
    buttons: 1,
    clientX: lastX,
  });
  await graph.dispatchEvent('pointerup', {
    pointerId: 9,
    pointerType: 'touch',
    buttons: 0,
    clientX: lastX,
  });
  await expect(tooltip.getByText('30년')).toBeVisible();
  const lastSize = await tooltip.boundingBox();
  expect(lastSize?.width).toBe(firstSize?.width);
  expect(lastSize?.height).toBe(firstSize?.height);

  const wrapping = await tooltip.locator('strong, span, b').evaluateAll((nodes) => (
    nodes.some((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.y)));
      return node.scrollWidth > node.clientWidth || lines.size > 1;
    })
  ));
  expect(wrapping).toBe(false);

  await page.mouse.wheel(0, 120);
  await expect(tooltip).toBeHidden();
});

test('requires a nonzero Main savings or investment contribution', async ({ page }) => {
  await seedMain(page, {
    ...appliedMain,
    monthlySavingWon: 0,
    monthlyInvestmentWon: 0,
  });
  await page.goto('apps/simulation/');
  await expect(page.getByText('Main에서 월 저축·투자 금액을 먼저 정해주세요.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Main에서 설정하기' })).toBeVisible();
});

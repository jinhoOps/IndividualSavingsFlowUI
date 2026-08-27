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
const oldMainRaw = JSON.stringify({ ...appliedMain, monthlySavingWon: 1_900_000 });
const oldSimulationRaw = JSON.stringify({
  schemaVersion: 2,
  source: { monthlySavingsWon: 1, monthlyInvestmentWon: 1, mainUpdatedAt: 1 },
  initialInvestmentWon: 0,
  years: 29,
  expectedAnnualReturnPercent: 5,
  baseRatePercent: 2.75,
  inflationOffsetPercentPoints: -0.25,
  amountMode: 'nominal',
  updatedAt: 1,
});

async function seedMain(page: Page, fixture = appliedMain) {
  await page.addInitScript(({ value, seededOldMain, seededOldSimulation }) => {
    if (sessionStorage.getItem('isf-simulation-e2e-seeded') !== null) return;
    localStorage.setItem('isf-workspace-v1', JSON.stringify({
      schemaVersion: 1,
      revision: 1,
      updatedAt: value.updatedAt,
      main: { applied: value, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    }));
    localStorage.setItem('isf-main-v2', seededOldMain);
    localStorage.setItem('isf-simulation-compound-v1', seededOldSimulation);
    sessionStorage.setItem('isf-simulation-e2e-seeded', 'true');
  }, { value: fixture, seededOldMain: oldMainRaw, seededOldSimulation: oldSimulationRaw });
}

async function openFirstResult(page: Page) {
  await page.goto('apps/simulation/');
  await page.getByRole('button', { name: '없어요' }).click();
  await expect(page.getByRole('heading', {
    name: '매년 어느 정도 수익을 기대하나요?',
  })).toBeVisible();
  await page.getByRole('button', { name: '결과 보기' }).click();
  await expect(page.getByRole('heading', { name: /1억 원을 모으려면|현재 조건으로는 30년 안에 1억 원/ }))
    .toBeVisible();
}

for (const viewport of [
  { name: '390px', width: 390, height: 844 },
  { name: '768px', width: 768, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
]) {
  test(`${viewport.name} 계산 기준에서 기존 모아둔 돈을 수정해도 화면을 벗어나지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedMain(page);
    await openFirstResult(page);

    await page.getByText('계산 기준').click();
    const initialAmount = page.getByRole('textbox', { name: '현재 모아둔 돈' });
    await expect(initialAmount).toHaveValue('0');
    const headline = page.getByRole('heading', {
      name: /1억 원을 모으려면|현재 조건으로는 30년 안에 1억 원/,
    });
    const committedHeadline = await headline.textContent();
    await initialAmount.fill('12000000');
    await expect(initialAmount).toHaveValue('12000000');
    await expect(headline).toHaveText(committedHeadline ?? '');
    await initialAmount.blur();
    await expect(initialAmount).toHaveValue('12,000,000');
    await expect.poll(() => page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
      return {
        initialInvestmentWon: workspace.simulation.draft?.initialInvestmentWon,
        targetAmountWon: workspace.simulation.draft?.targetAmountWon,
        main: workspace.main.applied,
      };
    })).toEqual({
      initialInvestmentWon: 12_000_000,
      targetAmountWon: 100_000_000,
      main: appliedMain,
    });

    const adjustments = ['-1000만', '-100만', '+100만', '+1000만']
      .map((name) => page.getByRole('button', { name }));
    const adjustmentBoxes = await Promise.all(adjustments.map((button) => button.boundingBox()));
    expect(adjustmentBoxes.every((box) => box !== null && box.height >= 44)).toBe(true);
    await adjustments[0].click();
    await adjustments[1].click();
    await adjustments[2].click();
    await adjustments[3].click();
    await expect(initialAmount).toHaveValue('12,000,000');
    await expect.poll(() => page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
      return workspace.simulation.draft?.initialInvestmentWon;
    })).toBe(12_000_000);

    const box = await initialAmount.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  });
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

test('guides automatic-goal first run, supports boundary years and keeps Main read-only', async ({ page }) => {
  await seedMain(page);
  await openFirstResult(page);

  const hero = page.getByRole('heading', { name: /1억 원을 모으려면|현재 조건으로는 30년 안에 1억 원/ });
  const headline = await hero.textContent();
  await page.getByRole('spinbutton', { name: '기간 숫자' }).fill('0');
  await expect(page.getByRole('spinbutton', { name: '기간 숫자' })).toHaveValue('0');
  await expect(hero).toHaveText(headline ?? '');
  await page.getByRole('spinbutton', { name: '기간 숫자' }).fill('30');
  await expect(page.getByRole('spinbutton', { name: '기간 숫자' })).toHaveValue('30');
  await expect(hero).toHaveText(headline ?? '');

  await page.getByRole('button', { name: '직접 입력' }).click();
  await page.getByRole('spinbutton', { name: '연 기대수익률 직접 입력' }).fill('8.75');
  await expect(page.getByText(/연 8.75%/)).toBeVisible();
  await expect(page.getByText(/백테스트나 금융 자문이 아닙니다/)).toBeHidden();
  await page.getByText('계산 기준').click();
  await expect(page.getByText(/백테스트나 금융 자문이 아닙니다/)).toBeVisible();
  expect(await page.evaluate(() => ({
    workspace: JSON.parse(localStorage.getItem('isf-workspace-v1')!),
    oldMain: localStorage.getItem('isf-main-v2'),
    oldSimulation: localStorage.getItem('isf-simulation-compound-v1'),
  }))).toMatchObject({
    workspace: {
      main: { applied: appliedMain },
      simulation: { draft: { years: 30, expectedAnnualReturnPercent: 8.75, targetAmountWon: 100_000_000 } },
    },
    oldMain: oldMainRaw,
    oldSimulation: oldSimulationRaw,
  });
});

test('first result keeps final graph semantics available during its restrained reveal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    const observedWindow = window as Window & { __growthChartRevealWidths: string[] };
    observedWindow.__growthChartRevealWidths = [];
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function setObservedAttribute(name, value) {
      if (name === 'width' && this.classList.contains('growth-chart__reveal-clip')) {
        observedWindow.__growthChartRevealWidths.push(String(value));
      }
      setAttribute.call(this, name, value);
    };
  });
  await seedMain(page);
  await openFirstResult(page);

  const semanticPaths = page.locator('.growth-chart__semantic-path');
  const motionPaths = page.locator('.growth-chart__motion-path');
  await expect(semanticPaths).toHaveCount(3);
  await expect(motionPaths).toHaveCount(3);
  expect(await semanticPaths.evaluateAll((paths) => paths.map((path) => path.getAttribute('d'))))
    .toEqual(await motionPaths.evaluateAll((paths) => paths.map((path) => path.getAttribute('d'))));
  await expect(page.locator('.growth-chart__reveal-clip')).toHaveAttribute('width', '620');
  const revealWidths = await page.evaluate(() => (
    (window as Window & { __growthChartRevealWidths: string[] }).__growthChartRevealWidths
  ));
  expect(revealWidths).toContain('0');
  expect(revealWidths.at(-1)).toBe('620');
  await expect(page.locator('.simulation-comparison__semantic-value')).toHaveCount(2);
});

test('reloads latest Main values and resets only Simulation from its menu', async ({ page }) => {
  await seedMain(page);
  await openFirstResult(page);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v1')!).simulation.draft?.years
  ))).toBe(20);
  await page.reload();
  await expect(page.getByRole('heading', { name: /1억 원을 모으려면|현재 조건으로는 30년 안에 1억 원/ }))
    .toBeVisible();

  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    localStorage.setItem('isf-workspace-v1', JSON.stringify({
      ...workspace,
      revision: workspace.revision + 1,
      updatedAt: workspace.updatedAt + 1,
      main: {
        ...workspace.main,
        applied: {
          ...workspace.main.applied,
          monthlySavingWon: 900_000,
          updatedAt: workspace.main.applied.updatedAt + 1,
        },
      },
    }));
  });
  await page.reload();
  await expect(page.getByText(/월 저축 90만 원/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v1')!).simulation.draft?.source.monthlySavingsWon
  ))).toBe(900_000);

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: '시뮬레이션 다시 설정' }).click();
  await page.getByRole('button', { name: '다시 설정' }).click();
  await expect(page.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return {
      mainSaving: workspace.main.applied.monthlySavingWon,
      simulation: workspace.simulation,
      oldMain: localStorage.getItem('isf-main-v2'),
      oldSimulation: localStorage.getItem('isf-simulation-compound-v1'),
    };
  })).toEqual({
    mainSaving: 900_000,
    simulation: { draft: null },
    oldMain: oldMainRaw,
    oldSimulation: oldSimulationRaw,
  });
});

test('migrated v2 high-principal workspace completes the goal without changing Main', async ({ page }) => {
  const highPrincipalV2Workspace = {
    schemaVersion: 2,
    revision: 1,
    updatedAt: appliedMain.updatedAt,
    main: { applied: appliedMain, setupProgress: null },
    simulation: {
      draft: {
        schemaVersion: 2,
        source: {
          monthlySavingsWon: appliedMain.monthlySavingWon,
          monthlyInvestmentWon: appliedMain.monthlyInvestmentWon,
          mainUpdatedAt: appliedMain.updatedAt,
        },
        initialInvestmentWon: 200_000_000,
        years: 17,
        expectedAnnualReturnPercent: 5,
        baseRatePercent: 2.75,
        inflationOffsetPercentPoints: -0.25,
        amountMode: 'nominal',
        updatedAt: appliedMain.updatedAt,
      },
    },
    portfolio: { plans: [], draft: null },
    locations: [],
    accountMap: { applied: null, draft: null, legacyPhaseA: { instruments: [], flows: [] } },
  };
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, highPrincipalV2Workspace);
  await page.goto('apps/simulation/');
  await expect(page.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
  await page.getByRole('textbox', { name: '목표 금액' }).fill('300000000');
  await page.getByRole('button', { name: '결과 보기' }).click();
  await expect(page.getByRole('heading', {
    name: /3억 원을 모으려면|현재 조건으로는 30년 안에 3억 원/,
  })).toBeVisible();

  await expect.poll(() => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return workspace.simulation.draft?.targetAmountWon;
  })).toBe(300_000_000);
  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return workspace.main.applied;
  })).toEqual(appliedMain);
});

test('keeps a failed reset dialog scrollable, contained, and focused in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 220 });
  await seedMain(page);
  await openFirstResult(page);

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: '시뮬레이션 다시 설정' }).click();
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    workspace.simulation.draft.years = workspace.simulation.draft.years === 20 ? 19 : 20;
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
  });

  await page.getByRole('button', { name: '다시 설정' }).click();
  const dialog = page.getByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' });
  await expect(dialog.getByRole('alert')).toHaveText('시뮬레이션을 다시 설정하지 못했어요.');
  await expect(dialog).toBeFocused();

  const containment = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: innerHeight,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      maxBlockSize: style.maxBlockSize,
      overflowY: style.overflowY,
    };
  });
  expect(containment.top).toBeGreaterThanOrEqual(16);
  expect(containment.bottom).toBeLessThanOrEqual(containment.viewportHeight - 16);
  expect(Number.parseFloat(containment.maxBlockSize)).toBeLessThanOrEqual(
    containment.viewportHeight - 32,
  );
  expect(containment.overflowY).toBe('auto');
  expect(containment.scrollHeight).toBeGreaterThan(containment.clientHeight);
});

for (const viewport of [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 900, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
]) {
  test(`${viewport.label} keeps the high-principal goal entry and result contained`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedMain(page);
    await page.goto('apps/simulation/');
    await page.getByRole('button', { name: '있어요' }).click();
    await page.getByRole('textbox', { name: '현재 모아둔 투자금' }).fill('200000000');
    await page.getByRole('button', { name: '다음' }).click();

    const goalHeading = page.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' });
    const goalInput = page.getByRole('textbox', { name: '목표 금액' });
    await expect(goalHeading).toBeVisible();
    await expect(goalHeading).toBeFocused();
    await expect(goalInput).toBeVisible();
    const goalInputBox = await goalInput.boundingBox();
    if (goalInputBox === null) throw new Error('goal input has no bounding box');
    expect(goalInputBox.x).toBeGreaterThanOrEqual(0);
    expect(goalInputBox.x + goalInputBox.width).toBeLessThanOrEqual(viewport.width);
    expect(goalInputBox.height).toBeGreaterThanOrEqual(44);
    await goalInput.focus();
    await expect(goalInput).toBeFocused();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    await goalInput.fill('300000000');
    await page.getByRole('button', { name: '다음' }).click();
    const selectedPreset = page.getByRole('button', { name: '연 기대수익률 9%' });
    await expect(selectedPreset).toHaveAttribute('aria-pressed', 'true');
    expect(await selectedPreset.evaluate((button) => {
      const style = getComputedStyle(button);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderTopColor,
        color: style.color,
      };
    })).toEqual({
      backgroundColor: 'rgb(234, 91, 42)',
      borderColor: 'rgb(234, 91, 42)',
      color: 'rgb(255, 255, 255)',
    });
    await page.getByRole('button', { name: '결과 보기' }).click();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const hero = page.getByRole('heading', {
      name: /3억 원을 모으려면|현재 조건으로는 30년 안에 3억 원/,
    });
    const headline = await hero.textContent();
    const heroBox = await hero.boundingBox();
    if (heroBox === null) throw new Error('simulation hero has no bounding box');
    expect(heroBox.y).toBeLessThan(viewport.height);
    expect(heroBox.y + heroBox.height).toBeGreaterThan(0);
    const years = page.getByRole('spinbutton', { name: '기간 숫자' });
    await expect(years).toHaveValue('20');
    await years.fill('0');
    await expect(hero).toHaveText(headline ?? '');
    await years.fill('3');
    await expect(hero).toHaveText(headline ?? '');

    const graph = page.getByRole('img', { name: '기간별 복리 성장 그래프' });
    const explorer = page.getByRole('application', { name: '그래프 기간 탐색' });
    const frame = page.getByTestId('simulation-page-frame');
    const frameBox = await frame.boundingBox();
    if (frameBox === null) throw new Error('simulation page frame has no bounding box');
    const expectedWidth = Math.min(viewport.width - 32, 768);
    expect(Math.abs(frameBox.width - expectedWidth)).toBeLessThan(1);
    expect(Math.abs(frameBox.x - (viewport.width - expectedWidth) / 2)).toBeLessThan(1);
    await expect(graph).toBeVisible();
    await expect(page.getByText('전부 저축보다')).toBeVisible();
    await expect(page.getByText('납입원금 대비')).toBeVisible();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    const immediateMotionState = await page.locator('.growth-chart').evaluate((chart) => ({
      semanticPaths: [...chart.querySelectorAll('.growth-chart__semantic-path')]
        .map((path) => path.getAttribute('d')),
      motionPaths: [...chart.querySelectorAll('.growth-chart__motion-path')]
        .map((path) => path.getAttribute('d')),
      revealWidth: chart.querySelector('.growth-chart__reveal-clip')?.getAttribute('width'),
    }));
    expect(immediateMotionState.motionPaths).toEqual(immediateMotionState.semanticPaths);
    expect(immediateMotionState.revealWidth).toBe('620');

    const comparisonState = await page.locator('.simulation-comparison dd').evaluateAll((values) => (
      values.map((value) => ({
        semantic: value.querySelector('.simulation-comparison__semantic-value')?.textContent,
        visual: value.querySelector('.simulation-comparison__visual-value')?.textContent,
      }))
    ));
    expect(comparisonState).toHaveLength(2);
    expect(comparisonState.every(({ semantic, visual }) => semantic === visual)).toBe(true);

    const surfaceStyles = await page.locator([
      '.growth-chart',
      '.simulation-controls',
      '.simulation-calculation-settings',
    ].join(',')).evaluateAll((surfaces) => surfaces.map((surface) => {
      const style = getComputedStyle(surface);
      return {
        backgroundColor: style.backgroundColor,
        borderStyle: style.borderTopStyle,
        borderWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        boxShadow: style.boxShadow,
      };
    }));
    expect(surfaceStyles).toHaveLength(3);
    for (const style of surfaceStyles) {
      expect(style.backgroundColor).toBe('rgb(255, 255, 255)');
      expect(style.borderStyle).toBe('solid');
      expect(style.borderWidth).toBe('1px');
      expect(style.borderRadius).toBe('24px');
      expect(style.boxShadow).toBe('none');
    }

    const box = await graph.boundingBox();
    if (box === null) throw new Error('graph has no bounding box');
    await graph.dispatchEvent('pointerdown', {
      pointerId: 11,
      clientX: box.x + box.width / 2,
      pointerType: 'touch',
    });
    const tooltip = page.locator('.growth-chart__tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator('strong')).toHaveText('1년 6개월');
    if (viewport.width < 768) {
      await expect(tooltip.getByText('현재 계획 총액')).toBeVisible();
      await expect(tooltip.getByText('누적 납입원금')).toBeVisible();
      await expect(tooltip.getByText('전부 저축 총액')).toHaveCount(0);
    } else {
      await expect(tooltip.getByText('전부 저축 총액')).toBeVisible();
      await expect(tooltip.getByText('누적 납입원금')).toBeVisible();
      await expect(tooltip.getByText('저축 잔액')).toBeVisible();
      await expect(tooltip.getByText('투자 잔액')).toBeVisible();
    }
    const tooltipBox = await tooltip.boundingBox();
    if (tooltipBox === null) throw new Error('tooltip has no bounding box');
    expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(viewport.width);
    expect(tooltipBox.y).toBeGreaterThanOrEqual(box.y);
    expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(box.y + box.height);
    await graph.dispatchEvent('pointerup', {
      pointerId: 11,
      clientX: box.x + box.width / 2,
      pointerType: 'touch',
    });

    const comparisonWraps = await page.locator(
      '.simulation-comparison__visual-value',
    ).evaluateAll((values) => (
      values.some((value) => {
        const range = document.createRange();
        range.selectNodeContents(value);
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.y)));
        return value.scrollWidth > value.clientWidth || lines.size > 1;
      })
    ));
    expect(comparisonWraps).toBe(false);

    await explorer.evaluate((element) => element.focus({ preventScroll: true }));
    await expect(explorer).toBeFocused();
    await explorer.press('Home');
    await expect(explorer.getByRole('status')).toContainText('현재');
    await explorer.press('ArrowRight');
    await expect(explorer.getByRole('status')).toContainText('1개월');

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

  const graph = page.getByRole('img', { name: '기간별 복리 성장 그래프' });
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
  await expect(tooltip.getByText('누적 납입원금')).toBeVisible();
  await expect(tooltip.getByText('전부 저축 총액')).toHaveCount(0);
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

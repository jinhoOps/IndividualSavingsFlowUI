import { test, expect } from '@playwright/test';

test.describe('Individual Savings Flow Main UI/UX Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Main index
    await page.goto('apps/main/index.html');
    // Wait for main layout rendering
    await page.waitForSelector('main');
  });

  test('Page header and layout loads correctly', async ({ page }) => {
    const title = page.locator('.page-intro h1');
    await expect(title).toHaveText('나의 가계 흐름');
  });

  test('Sankey diagram viewport height constraints', async ({ page }) => {
    const sankeyWrap = page.locator('.sankey-wrap');
    await expect(sankeyWrap).toBeVisible();

    const sankeySvg = page.locator('#sankeySvg');
    await expect(sankeySvg).toBeVisible();

    // Check height bounding box is restricted to <= 440px
    const boundingBox = await sankeySvg.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      expect(boundingBox.height).toBeLessThanOrEqual(440);
    }
  });

  test('UI curvatures (border-radius) align with var(--rd-sm)', async ({ page }) => {
    // Check select box border-radius
    const sortSelect = page.locator('.item-sort-select').first();
    if (await sortSelect.count() > 0) {
      const radius = await sortSelect.evaluate((el) => window.getComputedStyle(el).borderRadius);
      expect(radius).toBe('8px');
    }

    // Check input field border-radius
    const inputControl = page.locator('.control input').first();
    if (await inputControl.count() > 0) {
      const radius = await inputControl.evaluate((el) => window.getComputedStyle(el).borderRadius);
      expect(radius).toBe('8px');
    }

    // Check common button border-radius
    const ghostBtn = page.locator('.btn.btn-ghost').first();
    if (await ghostBtn.count() > 0) {
      const radius = await ghostBtn.evaluate((el) => window.getComputedStyle(el).borderRadius);
      expect(radius).toBe('8px');
    }
  });

  test('Sankey view toggle height matches container spacing', async ({ page }) => {
    const viewBtn = page.locator('.sankey-view-btn').first();
    await expect(viewBtn).toBeVisible();

    const boundingBox = await viewBtn.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      // 28px height check
      expect(boundingBox.height).toBeCloseTo(28, 1);
    }
  });

  test('Phase 07 panel hierarchy is stable on desktop and mobile', async ({ page }) => {
    const viewports = [
      { width: 1280, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);

      const selectors = [
        '.summary-panel',
        '.sankey-panel',
        '.controls-panel',
        '.projection-panel',
        '.comparison-panel',
      ];
      const boxes = [];
      for (const selector of selectors) {
        const box = await page.locator(selector).boundingBox();
        expect(box, `${selector} should have a layout box at ${viewport.width}px`).not.toBeNull();
        boxes.push(box!);
      }

      for (let index = 1; index < boxes.length; index += 1) {
        expect(boxes[index].y).toBeGreaterThanOrEqual(boxes[index - 1].y - 2);
      }
    }
  });

  test('Phase 07 mobile controls stay contained at 768px and 390px', async ({ page }) => {
    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);

      // controls-panel이 접혀 있다면 클릭해서 펼침
      const toggleBtn = page.locator('#toggleControlsBtn');
      if (await toggleBtn.getAttribute('aria-expanded') === 'false') {
        await toggleBtn.click();
        await page.waitForTimeout(500);
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(4);

      // 항상 보이는 탭과 헤더 툴들을 먼저 검사
      for (const selector of ['.mgmt-tabs', '#visualizationToggle', '.sankey-head-tools']) {
        const locator = page.locator(selector).first();
        await expect(locator, `${selector} should be visible at ${viewport.width}px`).toBeVisible();
        const contained = await locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 4 || window.getComputedStyle(element).overflowX !== 'visible');
        expect(contained, `${selector} should fit or scroll within itself at ${viewport.width}px`).toBe(true);
      }

      // '계좌' 및 '흐름배분' 탭을 클릭해서 숨겨져 있던 테이블과 서브 탭 리스트 검사
      const subTabs = [
        { btnId: '#mgmtTabAccount', checkSelector: '.account-list' },
        { btnId: '#mgmtTabFlow', checkSelector: '.advanced-block > .tab-list' }
      ];

      for (const tab of subTabs) {
        const tabBtn = page.locator(tab.btnId);
        await tabBtn.click();
        await page.waitForTimeout(300);

        const locator = page.locator(tab.checkSelector).first();
        await expect(locator, `${tab.checkSelector} should be visible after clicking ${tab.btnId} at ${viewport.width}px`).toBeVisible();
        const contained = await locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 4 || window.getComputedStyle(element).overflowX !== 'visible');
        expect(contained, `${tab.checkSelector} should fit or scroll within itself at ${viewport.width}px`).toBe(true);
      }

      const controls = page.locator('.mgmt-panel:not([hidden]) .controls-block .control');
      const controlCount = await controls.count();
      for (let index = 0; index < Math.min(controlCount, 8); index += 1) {
        const box = await controls.nth(index).boundingBox();
        expect(box, `control ${index} should have a layout box at ${viewport.width}px`).not.toBeNull();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(-1);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        }
      }

      await page.screenshot({ path: `test-results/phase07-step1-mobile-${viewport.width}.png`, fullPage: true });
    }
  });

  test('Phase 07 visualization tabs render nonblank SVGs after switching and resize', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);

    const sankeySvg = page.locator('#sankeySvg');
    await expect(sankeySvg).toBeVisible();
    let sankeyBox = await sankeySvg.boundingBox();
    expect(sankeyBox).not.toBeNull();
    expect(sankeyBox!.width).toBeGreaterThan(0);
    expect(sankeyBox!.height).toBeGreaterThan(0);

    const showNetworkBtn = page.locator('#showNetworkBtn');
    await expect(showNetworkBtn).toBeVisible();
    await showNetworkBtn.click();
    await page.waitForTimeout(600); // 슬라이드 애니메이션 대기

    // translateX(-50%) 이동으로 인해 Playwright 가시성 오판정이 날 수 있으므로 toBeAttached 및 boundingBox 크기로만 검증
    const networkSvg = page.locator('#accountFlowNetworkMap');
    await expect(networkSvg).toBeAttached();
    const networkBox = await networkSvg.boundingBox();
    expect(networkBox).not.toBeNull();
    expect(networkBox!.width).toBeGreaterThan(0);
    expect(networkBox!.height).toBeGreaterThan(0);

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);
    
    const showSankeyDetailBtn = page.locator('#showSankeyDetailBtn');
    await expect(showSankeyDetailBtn).toBeVisible();
    await showSankeyDetailBtn.click();
    await page.waitForTimeout(600);

    sankeyBox = await sankeySvg.boundingBox();
    expect(sankeyBox).not.toBeNull();
    expect(sankeyBox!.width).toBeGreaterThan(0);
    expect(sankeyBox!.height).toBeGreaterThan(0);
  });

  test('Phase 07 gap closure keeps reset in-place and moves rates to settings', async ({ page }) => {
    await expect(page.locator('#loadSample')).toHaveCount(0);
    await expect(page.locator('#advancedTabRates')).toHaveCount(0);

    await page.locator('#toggleControlsBtn').click();
    await page.locator('#mgmtTabSettings').click();
    await expect(page.locator('#ratesAdvancedBlock')).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('중립형 연봉 5,000만 원');
      await dialog.accept();
    });
    await page.locator('#resetInputs').click();
    await expect(page.locator('#applyFeedback')).toContainText('중립형 연봉 5,000만 원');

    const savedInputs = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(savedInputs.incomes?.[0]?.amount).toBe(3550000);
    expect(savedInputs.monthlyExpense).toBeGreaterThan(0);
    expect(savedInputs.expenseItems?.length).toBeGreaterThan(3);
  });

  test('Phase 07 gap closure expands Sankey detail mode into item labels', async ({ page }) => {
    await page.locator('#showSankeyBasicBtn').click();
    await page.waitForTimeout(200);
    const basicExpenseLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent || '').filter((text) => ['관리비', '수도세', '가스비', '전기세'].includes(text)).length
    );
    expect(basicExpenseLabels).toBe(0);

    await page.locator('#showSankeyDetailBtn').click();
    await page.waitForTimeout(300);
    const detailExpenseLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent || '').filter((text) => ['관리비', '수도세', '가스비', '전기세'].includes(text)).length
    );
    expect(detailExpenseLabels).toBeGreaterThanOrEqual(2);
  });
});

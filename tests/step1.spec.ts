// @ts-nocheck
import { test, expect } from '@playwright/test';

async function openControlsPanel(page: import('@playwright/test').Page) {
  const toggleButton = page.locator('#toggleControlsBtn');
  if (await toggleButton.getAttribute('aria-expanded') === 'false') {
    await toggleButton.click();
  }
}

async function openFinancialAddMenu(modal: import('@playwright/test').Locator) {
  await modal.locator('[data-financial-add-menu-toggle]').click();
  await expect(modal.locator('[data-financial-add-menu]')).toBeVisible();
}

test.describe('Individual Savings Flow Main UI/UX Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.databases?.().then((databases) => {
        for (const database of databases) {
          if (database.name) indexedDB.deleteDatabase(database.name);
        }
      }).catch(() => {});
    });
    // Navigate to Main index
    await page.goto('apps/main/index.html');
    // Wait for main layout rendering
    await page.waitForSelector('main');
  });

  test.afterEach(async ({ page }) => {
    if (!page.isClosed()) {
      await page.close();
    }
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

      await expect(page.locator('#inputsTitle')).toContainText('기초 자산·부채 및 가정');
      await expect(page.locator('.mgmt-tabs')).toBeHidden();
      await expect(page.locator('#mgmtPanelIncome')).toBeHidden();
      await expect(page.locator('#mgmtPanelAccount')).toBeHidden();
      await expect(page.locator('#mgmtPanelFlow')).toBeHidden();
      await expect(page.locator('#mgmtPanelSettings')).toBeVisible();

      // 항상 보이는 기초 설정과 헤더 툴들을 먼저 검사
      for (const selector of ['#mgmtPanelSettings', '#visualizationToggle', '.sankey-head-tools']) {
        const locator = page.locator(selector).first();
        await expect(locator, `${selector} should be visible at ${viewport.width}px`).toBeVisible();
        const contained = await locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 4 || window.getComputedStyle(element).overflowX !== 'visible');
        expect(contained, `${selector} should fit or scroll within itself at ${viewport.width}px`).toBe(true);
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
    const networkText = await networkSvg.locator('text').evaluateAll((nodes) => nodes.map((node) => node.textContent || '').join(' '));
    expect(networkText).not.toContain('억');

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
    await page.waitForTimeout(100);
    await expect(page.locator('#inputsTitle')).toContainText('기초 자산·부채 및 가정');
    await expect(page.locator('.mgmt-tabs')).toBeHidden();
    await expect(page.locator('#ratesAdvancedBlock')).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('1인 소득 연봉 4,600만 원');
      await dialog.accept();
    });
    await page.locator('#resetInputs').click();
    await expect(page.locator('#applyFeedback')).toContainText('1인 소득 연봉 4,600만 원');

    const savedInputs = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(savedInputs.incomes?.[0]?.amount).toBe(3310000);
    expect(savedInputs.householdContext).toMatchObject({ profile: 'newlywed', incomeMode: 'single-income', spouseMonthlyIncome: 0 });
    expect(savedInputs.startCash).toBe(920000);
    expect(savedInputs.startSavings).toBe(36800000);
    expect(savedInputs.startInvest).toBe(9200000);
    expect(savedInputs.monthlyExpense).toBeGreaterThan(0);
    expect(savedInputs.expenseItems?.length).toBeGreaterThan(3);
  });

  test('Phase 07 rerun keeps Sankey detail metadata controls effective', async ({ page }) => {
    await page.locator('#showSankeyBasicBtn').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.sankey-grouping-controls')).toBeHidden();
    const basicExpenseLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent || '').filter((text) => ['관리비', '수도세', '가스비', '전기세'].includes(text)).length
    );
    expect(basicExpenseLabels).toBe(0);

    await page.locator('#showSankeyDetailBtn').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.sankey-grouping-controls')).toBeVisible();
    const detailWithTotalGrouping = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent || '').filter((text) => ['관리비', '수도세', '가스비', '전기세'].includes(text)).length
    );
    expect(detailWithTotalGrouping).toBe(0);

    await page.locator('#sankeyGroupingExpense').selectOption('detail');
    await page.waitForTimeout(300);
    const detailExpenseLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent || '').filter((text) => ['관리비', '수도세', '가스비', '전기세'].includes(text)).length
    );
    expect(detailExpenseLabels).toBeGreaterThanOrEqual(2);

    await page.locator('#showNetworkBtn').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.sankey-grouping-controls')).toBeHidden();
  });

  test('Phase 07 rerun formats money fields and groups long item lists', async ({ page }) => {
    await page.locator('#toggleControlsBtn').click();

    const startCash = page.locator('#startCash');
    await startCash.fill('12345678');
    await expect(startCash).toHaveValue('12,345,678');
    await expect(startCash).toHaveAttribute('title', /1234만/);
    const startInvest = page.locator('#startInvest');
    await startInvest.fill('87654321');
    await expect(startInvest).toHaveValue('87,654,321');
    await page.locator('#horizonYears').focus();
    const savedInputs = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(savedInputs.startCash).toBe(12345678);
    expect(savedInputs.startInvest).toBe(87654321);

    await page.locator('[data-financial-settings-detail]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    await expect(modal.locator('[data-financial-detail-panel]')).toContainText('월 생활비');
    await expect(modal.locator('[data-financial-fixed-row]').first()).toBeVisible();

    await modal.getByRole('tab', { name: '저축', exact: true }).click();
    await expect(modal.locator('.financial-group-section').first()).toContainText('저축');
    await modal.getByRole('tab', { name: '투자', exact: true }).click();
    await expect(modal.locator('.financial-group-section').first()).toContainText('투자');
  });

  test('Phase 10.6.1 legacy editor removal keeps controller modules modal-only', async ({ page }) => {
    const contracts = await page.evaluate(async () => {
      const [
        eventBindings,
        persistenceController,
        renderOrchestrator,
        visualizationController,
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/event-bindings.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/persistence-controller.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/visualization-controller.js'),
      ]);

      const itemEditorExportMarker = 'createItem' + 'EditorController';
      const [
        bootstrapSource,
        eventSource,
        domSource,
        uiSource,
        itemEditorSource,
      ] = await Promise.all([
        fetch('/IndividualSavingsFlowUI/apps/main/modules/bootstrap-controller.js').then((response) => response.text()),
        fetch('/IndividualSavingsFlowUI/apps/main/modules/event-bindings.js').then((response) => response.text()),
        fetch('/IndividualSavingsFlowUI/apps/main/modules/dom.js').then((response) => response.text()),
        fetch('/IndividualSavingsFlowUI/apps/main/modules/ui-controller.js').then((response) => response.text()),
        fetch('/IndividualSavingsFlowUI/apps/main/modules/item-' + 'editor-controller.js').then((response) => response.text()),
      ]);
      const source = [bootstrapSource, eventSource, domSource, uiSource].join('\n');
      return {
        exports: {
          bindStep1Events: typeof eventBindings.bindStep1Events,
          createPersistenceController: typeof persistenceController.createPersistenceController,
          createRenderOrchestrator: typeof renderOrchestrator.createRenderOrchestrator,
          createVisualizationController: typeof visualizationController.createVisualizationController,
        },
        itemEditorSourceExists: itemEditorSource.includes(itemEditorExportMarker),
        bootstrapLineCount: bootstrapSource.split(/\r?\n/).length,
        blockedBodies: /function (bindControls|bindVisualizationAndTooltipEvents|renderAll|commitImmediateInputs|handleHashChange|applyItemEditor)\b/.test(source),
        legacyMarkers: new RegExp([
          'createItem' + 'EditorController',
          'item-' + 'editor-controller',
          'commands\\.' + 'itemEditor',
          'syncMobile' + 'ItemEditorFab',
          'sync' + 'PendingBar',
          'mobile' + 'EditorFab',
          'dom\\.' + 'pendingBar',
          'pending' + 'CancelBtn',
          'pending' + 'SaveBtn',
        ].join('|')).test(source),
      };
    });

    expect(contracts.exports).toEqual({
      bindStep1Events: 'function',
      createPersistenceController: 'function',
      createRenderOrchestrator: 'function',
      createVisualizationController: 'function',
    });
    expect(contracts.itemEditorSourceExists).toBe(false);
    expect(contracts.bootstrapLineCount).toBeLessThanOrEqual(350);
    expect(contracts.blockedBodies).toBe(false);
    expect(contracts.legacyMarkers).toBe(false);
    await expect(page.locator('[data-' + 'legacy-flow-editor]')).toHaveCount(0);
    await expect(page.locator('#pending' + 'Bar')).toHaveCount(0);
    await expect(page.locator('#mobile' + 'EditorFab')).toHaveCount(0);
    await expect(page.locator('#editIncomeItems, #editExpenseItems, #editSavingsItems, #editInvestItems, #editAccountItems')).toHaveCount(0);

    await page.locator('[data-financial-settings-detail]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    const editingIncome = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]').first();
    await expect(editingIncome).toBeVisible();
    await editingIncome.locator('[data-financial-modal-field="amount"]').fill('3320000');
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes?.[0]?.amount).toBe(3320000);
  });

  test('Phase 07 group datalist options are DOM-built and safe for imported values', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__unsafeGroupOption = false;
    });
    await page.evaluate(async () => {
      const maliciousGroup = `x"><img src=x onerror="window.__unsafeGroupOption = true">`;
      const [{ state }, { syncGroupOptionsFor }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/ui-controller.js'),
      ]);
      state.inputs.expenseItems = [
        ...(state.inputs.expenseItems || []),
        { id: 'expense-malicious-group', name: '테스트', amount: 10000, group: maliciousGroup, accountId: 'acc-living' },
      ];
      syncGroupOptionsFor('expense');
    });

    const optionInfo = await page.locator('#expenseGroupOptions option').evaluateAll((options) =>
      options.map((option) => ({ value: option.getAttribute('value'), text: option.textContent }))
    );
    expect(optionInfo.some((option) => option.value?.includes('<img'))).toBe(false);
    expect(optionInfo.some((option) => option.text?.includes('<img'))).toBe(false);
    expect(await page.evaluate(() => Boolean((window as any).__unsafeGroupOption))).toBe(false);
  });

  test('Phase 07 account select options escape imported account ids and names', async ({ page }) => {
    await page.evaluate(async () => {
      const unsafeWindow = window as any;
      unsafeWindow.__unsafeAccountOption = false;
      unsafeWindow.__unsafeAccountName = false;
      const maliciousAccountId = `acc"></option><img src=x onerror="window.__unsafeAccountOption = true"><option value="tail`;
      const maliciousAccountName = `계좌"><img src=x onerror="window.__unsafeAccountName = true">`;
      const [{ state }, { sanitizeInputs }, { buildMonthlySnapshot }, { createRenderOrchestrator }, { STORAGE_KEY }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
      ]);

      state.inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{
          id: 'income-malicious-account',
          name: '수입',
          amount: 10000,
          accountId: maliciousAccountId,
          allocations: [{ accountId: maliciousAccountId, amount: 10000 }],
        }],
        accounts: [{ id: maliciousAccountId, name: maliciousAccountName }],
        expenseItems: [{
          id: 'expense-malicious-account',
          name: '지출',
          amount: 10000,
          group: '테스트',
          accountId: maliciousAccountId,
        }],
        savingsItems: [],
        investItems: [],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      window.IsfStorageHub.saveLocal(STORAGE_KEY, state.inputs);
      createRenderOrchestrator().renderAll();
    });

    await page.locator('[data-financial-settings-detail]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    const incomeResult = await page.evaluate(() => {
      const unsafeWindow = window as any;
      const incomeSelect = document.querySelector<HTMLSelectElement>('[data-income-allocation-account]');
      return {
        incomeOptionCount: incomeSelect?.querySelectorAll('option').length ?? 0,
        incomeValue: incomeSelect?.value ?? '',
        incomeText: incomeSelect?.selectedOptions[0]?.textContent ?? '',
        incomeMarkup: incomeSelect?.innerHTML ?? '',
        unsafeFlag: Boolean(unsafeWindow.__unsafeAccountOption || unsafeWindow.__unsafeAccountName),
      };
    });
    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    await modal.locator('[data-modal-row-category="expense"]').first().click();

    const expenseResult = await page.evaluate(() => {
      const unsafeWindow = window as any;
      const expenseSelect = document.querySelector<HTMLSelectElement>('[data-financial-modal-field="accountId"]');
      return {
        expenseOptionCount: expenseSelect?.querySelectorAll('option').length ?? 0,
        expenseValue: expenseSelect?.value ?? '',
        expenseText: expenseSelect?.selectedOptions[0]?.textContent ?? '',
        expenseMarkup: expenseSelect?.innerHTML ?? '',
        injectedImages: document.querySelectorAll('#incomeList img, #expenseList img').length,
        modalInjectedImages: document.querySelectorAll('#financialModal img').length,
        unsafeFlag: Boolean(unsafeWindow.__unsafeAccountOption || unsafeWindow.__unsafeAccountName),
      };
    });

    expect(incomeResult.incomeOptionCount).toBeGreaterThanOrEqual(1);
    expect(expenseResult.expenseOptionCount).toBeGreaterThanOrEqual(1);
    expect(incomeResult.incomeValue).toContain('<img');
    expect(expenseResult.expenseValue).toContain('<img');
    expect(incomeResult.incomeText).toContain('<img');
    expect(expenseResult.expenseText).toContain('<img');
    expect(incomeResult.incomeMarkup).not.toMatch(/<img/i);
    expect(expenseResult.expenseMarkup).not.toMatch(/<img/i);
    expect(expenseResult.injectedImages).toBe(0);
    expect(expenseResult.modalInjectedImages).toBe(0);
    expect(incomeResult.unsafeFlag || expenseResult.unsafeFlag).toBe(false);
  });

  test('Phase 07 allocation groups move behind the integrated financial detail modal', async ({ page }) => {
    await openControlsPanel(page);
    await expect(page.locator('#mgmtPanelFlow')).toBeHidden();
    await expect(page.locator('#expenseAdvancedBlock')).toBeHidden();

    await page.locator('[data-financial-settings-detail]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    await expect(modal.locator('[data-financial-detail-panel]')).toContainText('월 생활비');
    await expect(modal.locator('[data-financial-fixed-row]').first()).toBeVisible();

    await modal.getByRole('tab', { name: '저축', exact: true }).click();
    await expect(modal.locator('.financial-modal-row').first()).toBeVisible();
    await modal.getByRole('tab', { name: '투자', exact: true }).click();
    await expect(modal.locator('.financial-modal-row').first()).toBeVisible();
  });
});

test.describe('Phase 09 account correction and Sankey topology', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('repairs invalid account links and emits correction metadata', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { sanitizeInputs } = await import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js');
      const sanitized = sanitizeInputs({
        modelVersion: 10,
        incomes: [{
          id: 'income-main',
          name: '급여',
          amount: 3000000,
          accountId: 'missing-income',
          allocations: [
            { accountId: 'missing-income', amount: 1000000 },
            { accountId: 'acc-living', amount: 500000 },
          ],
        }],
        accounts: [],
        expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'missing-expense' }],
        savingsItems: [{ id: 'saving', name: '적금', amount: 300000, group: '저축', accountId: 'missing-saving' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'missing-invest' }],
        monthlyDebtPayment: 0,
        startCash: 0,
        startSavings: 0,
        startInvest: 0,
        startDebt: 0,
        annualIncomeGrowth: 0,
        annualExpenseGrowth: 0,
        annualSavingsYield: 3,
        annualInvestReturn: 7,
        annualDebtInterest: 0,
        horizonYears: 5,
      });

      return {
        accountNames: sanitized.accounts.map((account: { name: string }) => account.name),
        incomeAccountId: sanitized.incomes[0].accountId,
        incomeAllocations: sanitized.incomes[0].allocations,
        expenseAccountId: sanitized.expenseItems[0].accountId,
        savingsAccountId: sanitized.savingsItems[0].accountId,
        investAccountId: sanitized.investItems[0].accountId,
        correctionMessages: sanitized.accountCorrections.map((correction: { message: string }) => correction.message),
        correctionTypes: sanitized.accountCorrections.map((correction: { itemType: string }) => correction.itemType),
      };
    });

    expect(result.accountNames).toEqual(expect.arrayContaining(['급여계좌', '생활비계좌', '투자계좌']));
    expect(result.incomeAccountId).toBe('acc-salary');
    expect(result.incomeAllocations).toEqual([{ accountId: 'acc-salary', amount: 3000000 }]);
    expect(result.expenseAccountId).toBe('acc-living');
    expect(result.savingsAccountId).toBe('acc-salary');
    expect(result.investAccountId).toBe('acc-stock');
    expect(result.correctionTypes).toEqual(expect.arrayContaining(['income', 'expense', 'savings', 'invest']));
    expect(result.correctionMessages.join(' ')).toContain('계좌');
    expect(result.correctionMessages.join(' ')).toContain('보정');
  });

  test('builds simple Sankey links around mandatory total-income node without account nodes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [{ sanitizeInputs }, { buildMonthlySnapshot }, { buildSankeyData }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
      ]);

      const inputs = sanitizeInputs({
        modelVersion: 10,
        splitIncomeAccounts: false,
        incomes: [{ id: 'main', name: '급여', amount: 3000000, accountId: 'missing-income' }],
        accounts: [],
        expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'missing-expense' }],
        savingsItems: [{ id: 'saving', name: '적금', amount: 300000, group: '저축', accountId: 'missing-saving' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'missing-invest' }],
        monthlyDebtPayment: 0,
        startCash: 0,
        startSavings: 0,
        startInvest: 0,
        startDebt: 0,
        annualIncomeGrowth: 0,
        annualExpenseGrowth: 0,
        annualSavingsYield: 3,
        annualInvestReturn: 7,
        annualDebtInterest: 0,
        horizonYears: 5,
      });
      const snapshot = buildMonthlySnapshot(inputs);
      const sankey = buildSankeyData(snapshot, 'group', { expense: 'detail', savings: 'detail', invest: 'detail' });

      return {
        totalIncomeNode: sankey?.nodes.find((node: { id: string }) => node.id === 'total-income'),
        incomeToTotal: sankey?.links.some((link: { source: string; target: string }) =>
          link.source === 'income-main' && link.target === 'total-income'
        ),
        totalToExpense: sankey?.links.some((link: { source: string; target: string }) =>
          link.source === 'total-income' && link.target === 'expense-rent'
        ),
        accountNodeIds: sankey?.nodes.filter((node: { id: string }) => node.id.startsWith('acc-')).map((node: { id: string }) => node.id) || [],
        accountLinks: sankey?.links.filter((link: { source: string; target: string }) =>
          link.source.startsWith('acc-') || link.target.startsWith('acc-')
        ) || [],
        labels: sankey?.nodes.map((node: { label: string }) => node.label) || [],
      };
    });

    expect(result.totalIncomeNode).toMatchObject({ id: 'total-income', label: '총수입', tone: 'income' });
    expect(result.incomeToTotal).toBe(true);
    expect(result.totalToExpense).toBe(true);
    expect(result.accountNodeIds).toEqual([]);
    expect(result.accountLinks).toEqual([]);
    expect(result.labels).not.toContain('미지정 계좌');
  });

  test('keeps deficit pseudo-income outside total-income aggregation', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [{ sanitizeInputs }, { buildMonthlySnapshot }, { buildSankeyData }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
      ]);

      const inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'main', name: '급여', amount: 1000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [{ id: 'rent', name: '월세', amount: 1500000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [{ id: 'saving-zero', name: '저축 없음', amount: 0, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest-zero', name: '투자 없음', amount: 0, group: '투자', accountId: 'acc-stock' }],
        monthlyDebtPayment: 0,
        startCash: 0,
        startSavings: 0,
        startInvest: 0,
        startDebt: 0,
        annualIncomeGrowth: 0,
        annualExpenseGrowth: 0,
        annualSavingsYield: 3,
        annualInvestReturn: 7,
        annualDebtInterest: 0,
        horizonYears: 5,
      });
      const snapshot = buildMonthlySnapshot(inputs);
      const sankey = buildSankeyData(snapshot, 'group', { expense: 'detail' });
      const totalIncomeNode = sankey?.nodes.find((node: { id: string }) => node.id === 'total-income');

      return {
        snapshotIncome: snapshot.income,
        deficit: snapshot.deficit,
        totalIncomeValue: totalIncomeNode?.value,
        deficitToTotal: sankey?.links.some((link: { source: string; target: string }) =>
          link.source === 'income-deficit' && link.target === 'total-income'
        ),
      };
    });

    expect(result.snapshotIncome).toBe(1000000);
    expect(result.deficit).toBe(500000);
    expect(result.totalIncomeValue).toBe(1000000);
    expect(result.deficitToTotal).toBe(false);
  });

  test('Phase 09 keeps account correction controls out of the chart header', async ({ page }) => {
    await page.evaluate(async () => {
      const [{ state }, { buildMonthlySnapshot }, { sanitizeInputs }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
      ]);
      state.inputs = {
        ...sanitizeInputs({
          modelVersion: 10,
          incomes: [{ id: 'income-main', name: '급여', amount: 3000000, accountId: 'acc-salary' }],
          accounts: [
            { id: 'acc-salary', name: '급여계좌' },
            { id: 'acc-living', name: '생활비계좌' },
            { id: 'acc-stock', name: '투자계좌' },
          ],
          expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'acc-living' }],
          savingsItems: [{ id: 'saving', name: '적금', amount: 300000, group: '저축', accountId: 'acc-salary' }],
          investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'acc-stock' }],
        }),
        expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'missing-expense' }],
        accountCorrections: [],
      };
      state.snapshot = buildMonthlySnapshot(state.inputs);
    });

    const refreshButton = page.locator('#sankeyCorrectionRefresh');
    await expect(refreshButton).toBeHidden();
    await expect(page.locator('#sankeyCorrectionStatus')).toBeHidden();
    await expect(page.locator('#sankeySvg .sankey-label')).toContainText(['총수입']);
    await expect(page.locator('.sankey-panel')).not.toContainText('계좌 연결 보정');
  });

  test('Phase 09 basic Sankey starts at total-income while detail mode expands items', async ({ page }) => {
    await page.evaluate(async () => {
      const [{ state }, { buildMonthlySnapshot }, { sanitizeInputs }, { renderSankey }, { buildSankeyData }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-renderer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        splitIncomeAccounts: false,
        incomes: [
          { id: 'salary', name: '본업 급여', amount: 3000000, accountId: 'acc-salary' },
          { id: 'side', name: '부업 수입', amount: 500000, accountId: 'acc-salary' },
        ],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [{ id: 'saving', name: '적금', amount: 300000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      state.sankeyDetailMode = 'basic';
      state.sankeyGrouping = { expense: 'total', savings: 'total', invest: 'total' };
      renderSankey(state.snapshot, buildSankeyData, 'group');
    });

    const basicLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent || '')
    );
    expect(basicLabels).toEqual(expect.arrayContaining(['총수입', '고정비(고정지출)', '저축', '투자']));
    expect(basicLabels).not.toEqual(expect.arrayContaining(['급여계좌', '생활비계좌', '투자계좌']));
    expect(basicLabels).not.toEqual(expect.arrayContaining(['본업 급여', '부업 수입', '월세', '적금', 'ETF']));

    await page.locator('#showSankeyDetailBtn').click();
    await page.locator('#sankeyGroupingExpense').selectOption('detail');
    await page.locator('#sankeyGroupingSavings').selectOption('detail');
    await page.locator('#sankeyGroupingInvest').selectOption('detail');
    await page.waitForTimeout(300);

    const detailLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
      labels.map((label) => label.textContent || '')
    );
    expect(detailLabels).toEqual(expect.arrayContaining(['본업 급여', '부업 수입', '월세', '적금', 'ETF']));
  });
});

test.describe('Phase 09 preset quick setup contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('builds percentage preview rows with correction provenance', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const {
        PRESET_STYLES,
        buildPresetPreview,
        applyPresetPreview,
      } = await import('/IndividualSavingsFlowUI/apps/main/modules/presets.js');

      const preview = buildPresetPreview({
        monthlyIncomeWon: 3333333,
        presetKey: 'growth',
        percentages: {
          expense: 41,
          savings: 19,
          invest: 40,
        },
      });
      const inputs = applyPresetPreview(preview);

      return {
        presetNames: Object.values(PRESET_STYLES).map((preset: any) => preset.label),
        presetKeys: Object.keys(PRESET_STYLES),
        totals: preview.totals,
        expenseGroups: preview.expenseItems.map((item: any) => item.group),
        firstExpenseRow: preview.expenseItems[0],
        savingsRow: preview.savingsItems[0],
        investRow: preview.investItems[0],
        inputTotals: {
          monthlyExpense: inputs.monthlyExpense,
          monthlySavings: inputs.monthlySavings,
          monthlyInvest: inputs.monthlyInvest,
        },
        inputItemCounts: {
          expense: inputs.expenseItems.length,
          savings: inputs.savingsItems.length,
          invest: inputs.investItems.length,
        },
      };
    });

    expect(result.presetNames).toEqual(expect.arrayContaining(['안정', '균형', '성장', '야수', '사용자 지정']));
    expect(result.presetKeys).toEqual(expect.arrayContaining(['stable', 'balanced', 'growth', 'beast', 'custom']));
    expect(new Set(result.expenseGroups)).toEqual(new Set(['고정비', '변동비', '행복비', '경조사비']));
    expect(result.totals.monthlyIncomeWon).toBe(3333333);
    expect(result.totals.originalPercentTotal).toBe(100);
    expect(result.firstExpenseRow.originalPercent).toBeGreaterThan(0);
    expect(result.firstExpenseRow.normalizedPercent).toBeGreaterThan(0);
    expect(result.firstExpenseRow.amount).toBeGreaterThan(0);
    expect(result.firstExpenseRow.amount % 10000).toBe(0);
    expect(typeof result.firstExpenseRow.correctionDelta).toBe('number');
    expect(result.savingsRow.originalPercent).toBe(19);
    expect(result.investRow.originalPercent).toBe(40);
    expect(result.inputTotals.monthlyExpense).toBe(result.totals.expenseAmount);
    expect(result.inputTotals.monthlySavings).toBe(result.totals.savingsAmount);
    expect(result.inputTotals.monthlyInvest).toBe(result.totals.investAmount);
    expect(result.inputItemCounts).toEqual({ expense: 4, savings: 1, invest: 1 });
  });

  test('opens guided preset setup and normalizes editable percentages', async ({ page }) => {
    await page.locator('#openPresetBtn').click();
    const modal = page.locator('#presetModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('프리셋 빠른 설정');

    await expect(modal.locator('#presetMonthlyIncome')).toBeVisible();
    await expect(modal.locator('[data-preset-key="stable"]')).toHaveText('안정');
    await expect(modal.locator('[data-preset-key="balanced"]')).toHaveText('균형');
    await expect(modal.locator('[data-preset-key="growth"]')).toHaveText('성장');
    await expect(modal.locator('[data-preset-key="beast"]')).toHaveText('야수');
    await expect(modal.locator('[data-preset-key="custom"]')).toHaveText('사용자 지정');

    await modal.locator('[data-preset-key="growth"]').click();
    await expect(modal.locator('input[data-preset-percent="expense"]')).toHaveValue('38');
    await expect(modal.locator('input[data-preset-percent="savings"]')).toHaveValue('12');
    await expect(modal.locator('input[data-preset-percent="invest"]')).toHaveValue('50');

    await modal.locator('input[data-preset-percent="expense"]').fill('60');
    await modal.locator('input[data-preset-percent="savings"]').fill('20');
    await modal.locator('input[data-preset-percent="invest"]').fill('30');
    await modal.locator('input[data-preset-percent="invest"]').blur();
    await expect(modal.locator('#presetPercentTotal')).toContainText('100%');

    const copiedValues = await modal.locator('input[data-preset-percent]').evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value)
    );
    await modal.locator('[data-preset-key="custom"]').click();
    await expect(modal.locator('input[data-preset-percent="expense"]')).toHaveValue(copiedValues[0]);
    await expect(modal.locator('input[data-preset-percent="savings"]')).toHaveValue(copiedValues[1]);
    await expect(modal.locator('input[data-preset-percent="invest"]')).toHaveValue(copiedValues[2]);
  });

  test('shows confirmation provenance and commits preset through persistence', async ({ page }) => {
    await page.locator('#openPresetBtn').click();
    const modal = page.locator('#presetModal');
    await modal.locator('[data-preset-key="growth"]').click();
    await modal.locator('#applyModalPresetBtn').click();

    await expect(modal.locator('#presetConfirmStep')).toBeVisible();
    await expect(modal.locator('#presetConfirmStep')).toContainText('기존 데이터 덮어쓰기');
    await expect(modal.locator('#presetConfirmStep')).toContainText('원래');
    await expect(modal.locator('#presetConfirmStep')).toContainText('보정');
    await expect(modal.locator('.preset-confirm-row').first()).toContainText('%');

    await modal.locator('#applyModalPresetBtn').click();
    await expect(modal).toBeHidden();

    const savedInputs = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(savedInputs.incomes?.[0]?.id).toBe('income-preset');
    expect(savedInputs.expenseItems?.map((item: any) => item.group)).toEqual(['고정비', '변동비', '행복비', '경조사비']);
    expect(savedInputs.monthlyExpense).toBeGreaterThan(0);
    expect(savedInputs.monthlySavings).toBeGreaterThan(0);
    expect(savedInputs.monthlyInvest).toBeGreaterThan(0);
  });

  test('formats high Korean money units with only one lower unit', async ({ page }) => {
    const result = await page.evaluate(() => ({
      eokHint: window.IsfUtils.convertToKoreanWon(123456789),
      joHint: window.IsfUtils.convertToKoreanWon(1234567890000),
      eokLabel: window.IsfUtils.formatMoney(123456789),
      joLabel: window.IsfUtils.formatMoney(1234567890000),
    }));

    expect(result.eokHint).toBe('1억 2345만');
    expect(result.joHint).toBe('1조 2345억');
    expect(result.eokLabel).toBe('1억 2345만');
    expect(result.joLabel).toBe('1조 2345억');
  });
});

test.describe('Phase 09 financial summary card surface', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('builds and renders core metric cards plus editable outflow cards before Sankey', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [{ buildFinancialSummaryGroups }, { renderFinancialSummaryGroups }, { sanitizeInputs }, { simulateProjection }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/financial-summary.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/financial-summary-renderer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
      ]);
      const inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-test', name: '급여', amount: 3000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [
          { id: 'rent', name: '월세', amount: 800000, group: '고정비', accountId: 'acc-living' },
          { id: 'food', name: '식비', amount: 300000, group: '변동비', accountId: 'acc-living' },
        ],
        savingsItems: [{ id: 'saving', name: '청년적금', amount: 300000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'acc-stock' }],
        horizonYears: 5,
      });
      const projection = simulateProjection(inputs);
      const groups = buildFinancialSummaryGroups(inputs, { projection });
      const host = document.querySelector('#summaryCards');
      renderFinancialSummaryGroups(host, groups);
      const cardButtons = Array.from(document.querySelectorAll('[data-financial-category]'));
      const metricCards = Array.from(document.querySelectorAll('[data-financial-metric]'));
      const summaryPanel = document.querySelector('.summary-panel');
      const sankeyPanel = document.querySelector('.sankey-panel');
      return {
        groupTitles: groups.map((group: any) => group.title),
        cardLabels: groups.flatMap((group: any) => group.cards.map((card: any) => card.label)),
        firstCard: groups[0].cards[0],
        expenseCard: groups[1].cards.find((card: any) => card.category === 'expense'),
        metricCards: metricCards.map((card) => (card as HTMLElement).dataset.financialMetric),
        cardCategories: cardButtons.map((button) => (button as HTMLElement).dataset.financialCategory),
        cardRoles: cardButtons.map((button) => button.getAttribute('role') || button.tagName.toLowerCase()),
        groupTitleElements: document.querySelectorAll('.financial-summary-group__title').length,
        correctionNotes: document.querySelectorAll('.financial-summary-card__note').length,
        summaryBeforeSankey: Boolean(summaryPanel && sankeyPanel && summaryPanel.compareDocumentPosition(sankeyPanel) & Node.DOCUMENT_POSITION_FOLLOWING),
        renderedText: host?.textContent || '',
      };
    });

    expect(result.groupTitles).toEqual(['핵심지표', '지출+저축+투자']);
    expect(result.cardLabels).toEqual(['5년 후 순자산', '미래자산 투입률', '지출', '저축', '투자']);
    expect(result.firstCard).toMatchObject({ type: 'metric', metric: 'future-net-asset', label: '5년 후 순자산' });
    expect(result.firstCard.value).toMatch(/원|만|억|조/);
    expect(result.expenseCard.total).toBe(1100000);
    expect(result.expenseCard.representatives).toEqual(['고정비 80만원', '변동비 30만원']);
    expect(result.metricCards).toEqual(['future-net-asset', 'future-asset-rate']);
    expect(result.cardCategories).toEqual(['expense', 'savings', 'invest']);
    expect(result.cardRoles.every((role: string) => role === 'button')).toBe(true);
    expect(result.groupTitleElements).toBe(0);
    expect(result.correctionNotes).toBe(0);
    expect(result.summaryBeforeSankey).toBe(true);
    expect(result.renderedText).toContain('고정비 80만원');
    expect(result.renderedText).toContain('변동비 30만원');
    expect(result.renderedText).not.toContain('월세 80만원');
    expect(result.renderedText).not.toContain('자동 보정');
  });
});

test.describe('Phase 09 financial category detail modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  async function chooseAdjustmentIfVisible(modal: import('@playwright/test').Locator) {
    const choice = modal.locator('[data-financial-adjustment-choice]').filter({ hasText: '투자 먼저 줄이기' });
    if (await choice.count()) {
      await choice.click();
    }
  }

  test('opens category modal for card detail editing and saves only after explicit confirm', async ({ page }) => {
    await page.locator('[data-financial-category="expense"]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalTitle')).toContainText('재무설정 상세');
    await expect(modal.locator('[data-outflow-tab="living"]')).toHaveClass(/is-active/);
    await expect(modal.locator('[data-modal-row-category="expense"]').first()).toContainText('주거비');
    await expect(modal.locator('[data-financial-modal-field="accountId"]')).toHaveCount(0);

    await modal.locator('[data-modal-row-category="expense"]').first().click();
    const firstName = modal.locator('[data-financial-modal-field="name"]').first();
    await firstName.fill('주거비 수정');
    await modal.locator('#financialModalCancel').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}').expenseItems?.[0]?.name || '')).not.toBe('주거비 수정');
    await modal.locator('#financialModalClose').click();
    await expect(modal).toBeHidden();

    await page.locator('[data-financial-category="expense"]').click();
    await modal.locator('[data-modal-row-category="expense"]').first().click();
    await modal.locator('[data-financial-modal-field="name"]').first().fill('주거비 수정');
    await modal.locator('#financialModalSave').click();
    if (await modal.isVisible()) {
      await expect(modal.locator('[data-financial-adjustment-feedback]')).toContainText('조정 방식을 선택');
      await chooseAdjustmentIfVisible(modal);
      await modal.locator('#financialModalSave').click();
    }
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    const savedName = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}').expenseItems?.[0]?.name);
    expect(savedName).toBe('주거비 수정');
    await expect(page.locator('[data-financial-category="expense"]')).toContainText('고정비');
    await expect(page.locator('[data-financial-category="expense"]')).not.toContainText('주거비 수정');
  });

  test('Phase 09 financial modal compact editing keeps only the selected item expanded on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-financial-category="expense"]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();

    const compactCardCount = await modal.locator('[data-financial-modal-edit]').count();
    expect(compactCardCount).toBeGreaterThan(1);
    await expect(modal.locator('[data-financial-modal-field="name"]')).toHaveCount(0);

    await modal.locator('[data-modal-row-category="expense"]').first().click();
    await expect(modal.locator('[data-financial-modal-field="name"]')).toHaveCount(1);
    await expect(modal.locator('[data-financial-modal-field="amount"]')).toHaveCount(1);
    await expect(modal.locator('.financial-modal-row--editing')).toHaveCount(1);

    const result = await page.evaluate(() => {
      const modalRect = document.querySelector('#financialModal .modal-content')?.getBoundingClientRect();
      const controls = Array.from(document.querySelectorAll<HTMLElement>('#financialModal input, #financialModal select, #financialModal button'))
        .filter((control) => {
          const style = window.getComputedStyle(control);
          const rect = control.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        });
      const overlaps = [];
      for (let i = 0; i < controls.length; i += 1) {
        const a = controls[i].getBoundingClientRect();
        for (let j = i + 1; j < controls.length; j += 1) {
          const b = controls[j].getBoundingClientRect();
          const intersects = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
          if (intersects) overlaps.push([controls[i].tagName, controls[j].tagName]);
        }
      }
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        modalOverflow: modalRect ? Math.max(0, modalRect.right - document.documentElement.clientWidth) : 0,
        visibleControls: controls.length,
      };
    });

    expect(result.pageOverflow).toBeLessThanOrEqual(4);
    expect(result.modalOverflow).toBeLessThanOrEqual(4);
    expect(result.visibleControls).toBeGreaterThan(0);
  });

  test('Phase 09 financial modal group board supports custom groups and drag assignment', async ({ page }) => {
    await page.locator('[data-financial-category="invest"]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-outflow-tab="invest"]')).toHaveClass(/is-active/);
    await modal.locator('[data-financial-modal-edit]').first().click();

    await expect(modal.locator('[data-financial-modal-field="name"]')).toBeVisible();
    await expect(modal.locator('[data-financial-modal-field="accountId"]')).toBeVisible();
    await expect(modal.locator('[data-financial-modal-field="amount"]')).toBeVisible();
    await expect(modal.locator('[data-financial-modal-field="groupMode"]')).toHaveCount(0);
    await expect(modal.locator('[data-financial-modal-field="group"]')).toHaveCount(0);

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('테스트그룹');
    });
    await openFinancialAddMenu(modal);
    await modal.locator('[data-financial-add-group]').click();
    await expect(modal.locator('[data-group-drop-name="테스트그룹"]')).toBeVisible();
    await expect(modal.locator('[data-group-drop-name="테스트그룹"] .financial-group-section__head span')).toHaveCount(0);

    await page.evaluate(() => {
      const source = document.querySelector<HTMLElement>('[data-modal-row-category="invest"][data-modal-row-index="0"]');
      const target = document.querySelector<HTMLElement>('[data-group-drop-category="invest"][data-group-drop-name="테스트그룹"]');
      if (!source || !target) throw new Error('drag fixtures missing');
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    });
    await expect(modal.locator('[data-group-drop-name="테스트그룹"] [data-modal-row-index="0"]')).toBeVisible();
    await chooseAdjustmentIfVisible(modal);
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    const savedGroup = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}').investItems?.[0]?.group);
    expect(savedGroup).toBe('테스트그룹');
  });
});

test.describe('Phase 09 source account automatic flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('preserves manual transfer settings in source-account network flow', async ({ page }) => {
    await openControlsPanel(page);
    await expect(page.locator('text=계좌 간 수동 이체 설정')).toHaveCount(0);
    await expect(page.locator('#transferEditorSection')).toHaveCount(0);

    await page.evaluate(async () => {
      const [{ state }, { sanitizeInputs }, { buildMonthlySnapshot }, { buildSankeyData }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'salary', name: '월급', amount: 3000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [{ id: 'rent', name: '월세', amount: 1000000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [{ id: 'saving', name: '적금', amount: 500000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 400000, group: '투자', accountId: 'acc-stock' }],
        transfers: [{ id: 'legacy', sourceAccountId: 'acc-salary', targetAccountId: 'acc-living', amount: 999999, label: 'legacy' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      (window as any).__phase09Flow = buildSankeyData(state.snapshot, 'group', state.sankeyGrouping, { includeAccountFlow: true });
    });

    const result = await page.evaluate(() => {
      const flow = (window as any).__phase09Flow;
      return {
        surplus: flow.nodes.some((node: any) => node.id === 'surplus'),
        sourceLinks: flow.links.filter((link: any) => ['expense', 'savings', 'invest'].includes(link.tone)).map((link: any) => link.source),
        legacyManual: flow.transfers.some((transfer: any) => transfer.isManual && transfer.id === 'legacy'),
        manualTransfer: flow.transfers.find((transfer: any) => transfer.id === 'legacy'),
      };
    });
    expect(result.surplus).toBe(true);
    expect(result.sourceLinks).toEqual(expect.arrayContaining(['acc-living', 'acc-salary', 'acc-stock']));
    expect(result.legacyManual).toBe(true);
    expect(result.manualTransfer).toMatchObject({
      source: 'acc-salary',
      target: 'acc-living',
      value: 999999,
      label: 'legacy',
      isManual: true,
    });
  });
});

test.describe('Phase 10.8 Account Map Main entry and compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('shows only a lightweight Account Map entry on Main with the dedicated route', async ({ page }) => {
    const entry = page.locator('[data-account-map-entry="lightweight"]');
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('Account Map');
    await expect(entry).toContainText('계좌 연결 현황');
    await expect(entry).toContainText('자동이체');
    await expect(entry).toContainText('고정결제');
    await expect(entry).toContainText('계좌 후보');
    await expect(entry).toContainText('연결 후보');
    await expect(entry).toContainText('결제 후보');

    const link = entry.locator('[data-account-map-link="dedicated"]');
    await expect(link).toHaveAttribute('href', '../account-map/');
    await expect(link).toHaveText('맵 열기');

    const order = await page.evaluate(() => {
      const sankey = document.querySelector('.sankey-panel');
      const accountMap = document.querySelector('.account-map-entry-panel');
      return {
        dom: Boolean(sankey && accountMap && sankey.compareDocumentPosition(accountMap) & Node.DOCUMENT_POSITION_FOLLOWING),
        sankeyOrder: sankey ? Number(window.getComputedStyle(sankey).order) : null,
        accountMapOrder: accountMap ? Number(window.getComputedStyle(accountMap).order) : null,
      };
    });
    expect(order.dom).toBe(true);
    expect(order.accountMapOrder).toBeGreaterThan(order.sankeyOrder ?? 0);

    await expect(page.locator('#accountMapCanvas')).toHaveCount(0);
    await expect(page.locator('#importMainData')).toHaveCount(0);
    await expect(page.locator('[data-candidate-action]')).toHaveCount(0);
    await expect(page.locator('[data-relationship-editor]')).toHaveCount(0);
    await expect(page.locator('#transferEditorSection')).toHaveCount(0);
    await expect(page.locator('text=계좌 간 수동 이체 설정')).toHaveCount(0);
  });

  test('routes Account Map through shared navigation without using Portfolio', async ({ page }) => {
    await page.locator('#appLauncherBtn').click();
    const accountMapLink = page.locator('#appLauncherMenu a[href="../account-map/"]');
    const portfolioLink = page.locator('#appLauncherMenu a[href="../portfolio/"]');
    await expect(accountMapLink).toBeVisible();
    await expect(accountMapLink).toContainText('Account Map');
    await expect(portfolioLink).toBeVisible();
    await expect(portfolioLink).toContainText('주식 모으기');
    await expect(accountMapLink).not.toHaveAttribute('href', '../portfolio/');

    await page.goto('apps/account-map/index.html');
    await expect(page.locator('.current-step-label')).toHaveText('Account Map');
    await page.locator('#appLauncherBtn').click();
    await expect(page.locator('#appLauncherMenu a[href="../account-map/"]')).toHaveClass(/is-active/);
    await expect(page.locator('#appLauncherMenu a[href="../portfolio/"]')).not.toHaveClass(/is-active/);
  });

  test('preserves restored account-flow fields through sanitizer, Sankey, and Main entry rendering', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [
        { state },
        { sanitizeInputs },
        { buildMonthlySnapshot },
        { buildSankeyData },
        { createRenderOrchestrator },
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
      ]);

      state.inputs = sanitizeInputs({
        modelVersion: 10,
        splitIncomeAccounts: true,
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        incomes: [{
          id: 'salary',
          name: '월급',
          amount: 4200000,
          accountId: 'acc-salary',
          allocations: [
            { accountId: 'acc-salary', amount: 3200000 },
            { accountId: 'acc-living', amount: 1000000 },
          ],
        }],
        expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [{ id: 'saving', name: '적금', amount: 500000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 300000, group: '투자', accountId: 'acc-stock' }],
        transfers: [{ id: 'manual-rent', sourceAccountId: 'acc-salary', targetAccountId: 'acc-living', amount: 700000, label: '월세 보전' }],
        surplusTransferAccountId: 'acc-stock',
        monthlyDebtPayment: 0,
        startCash: 0,
        startSavings: 0,
        startInvest: 0,
        startDebt: 0,
        annualIncomeGrowth: 0,
        annualExpenseGrowth: 0,
        annualSavingsYield: 3,
        annualInvestReturn: 7,
        annualDebtInterest: 0,
        horizonYears: 5,
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      const sankey = buildSankeyData(state.snapshot, 'group', state.sankeyGrouping);
      const accountFlow = buildSankeyData(state.snapshot, 'group', state.sankeyGrouping, { includeAccountFlow: true });
      createRenderOrchestrator().renderAll();

      const metrics = Array.from(document.querySelectorAll('.account-map-entry__metric')).map((node) => node.textContent || '');

      return {
        accountIds: state.inputs.accounts.map((account: any) => account.id),
        splitIncomeAccounts: state.inputs.splitIncomeAccounts,
        incomeAllocations: state.inputs.incomes[0].allocations,
        expenseAccountId: state.inputs.expenseItems[0].accountId,
        savingsAccountId: state.inputs.savingsItems[0].accountId,
        investAccountId: state.inputs.investItems[0].accountId,
        transfers: state.inputs.transfers,
        surplusTransferAccountId: state.inputs.surplusTransferAccountId,
        sankeyLabels: sankey.nodes.map((node: any) => node.label),
        manualTransfer: accountFlow.transfers.find((transfer: any) => transfer.id === 'manual-rent'),
        entryMetrics: metrics.join(' '),
        entryLink: document.querySelector('[data-account-map-link="dedicated"]')?.getAttribute('href'),
      };
    });

    expect(result.accountIds).toEqual(['acc-salary', 'acc-living', 'acc-stock']);
    expect(result.splitIncomeAccounts).toBe(true);
    expect(result.incomeAllocations).toEqual([
      { accountId: 'acc-salary', amount: 3200000 },
      { accountId: 'acc-living', amount: 1000000 },
    ]);
    expect(result.expenseAccountId).toBe('acc-living');
    expect(result.savingsAccountId).toBe('acc-salary');
    expect(result.investAccountId).toBe('acc-stock');
    expect(result.transfers).toEqual([{
      id: 'manual-rent',
      sourceAccountId: 'acc-salary',
      targetAccountId: 'acc-living',
      amount: 700000,
      label: '월세 보전',
    }]);
    expect(result.surplusTransferAccountId).toBe('acc-stock');
    expect(result.sankeyLabels).toEqual(expect.arrayContaining(['총수입', '고정비(고정지출)', '저축', '투자']));
    expect(result.sankeyLabels).not.toEqual(expect.arrayContaining(['급여계좌', '생활비계좌', '투자계좌']));
    expect(result.manualTransfer).toMatchObject({
      source: 'acc-salary',
      target: 'acc-living',
      value: 700000,
      label: '월세 보전',
      isManual: true,
    });
    expect(result.entryMetrics).toContain('3계좌');
    expect(result.entryMetrics).toContain('6연결');
    expect(result.entryMetrics).toContain('1결제');
    expect(result.entryLink).toBe('../account-map/');
  });
});

test.describe('Phase 09 guided item and inline account creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('creates a new investment item in the savings-investment tab with final confirmation', async ({ page }) => {
    await page.locator('[data-financial-category="invest"]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-outflow-tab="invest"]')).toHaveClass(/is-active/);
    await openFinancialAddMenu(modal);
    await modal.locator('[data-financial-inline-add]').click();
    const newRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="invest"]').last();
    await expect(newRow.locator('[data-financial-modal-field="accountId"]')).toHaveValue('acc-stock');
    await newRow.locator('[data-financial-modal-field="name"]').fill('테스트 ETF');
    await newRow.locator('[data-financial-modal-field="amount"]').fill('100000');
    await expect(newRow.locator('[data-financial-modal-field="group"]')).toHaveCount(0);
    await expect(newRow.locator('[data-financial-modal-field="name"]')).toHaveValue('테스트 ETF');
    const choice = modal.locator('[data-financial-adjustment-choice]').filter({ hasText: '투자 먼저 줄이기' });
    if (await choice.count()) {
      await choice.click();
    }
    await modal.locator('#financialModalSave').click();
    if (await modal.locator('#financialModalPendingBar').isVisible()) {
      await expect(modal.locator('[data-financial-adjustment-feedback]')).toContainText('조정 방식을 선택');
      await modal.locator('[data-financial-adjustment-choice]').filter({ hasText: '투자 먼저 줄이기' }).click();
      await modal.locator('#financialModalSave').click();
    }
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    const createdItem = saved.investItems.find((item: any) => item.name === '테스트 ETF');
    expect(createdItem).toMatchObject({ amount: 100000, group: '투자', accountId: 'acc-stock' });
    await expect(page.locator('[data-financial-category="invest"]')).toContainText('4개');
  });
});

test.describe('Phase 09 Sankey tooltip readability', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('renders merged Sankey tooltip details as line-broken safe text', async ({ page }) => {
    await page.evaluate(async () => {
      const [{ state }, { buildMonthlySnapshot }, { sanitizeInputs }, { renderSankey }, { buildSankeyData }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-renderer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'salary', name: '급여', amount: 4000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [
          { id: 'rent', name: '월세 <b>', amount: 900000, group: '고정비', accountId: 'acc-living' },
          { id: 'utility', name: '관리비 & 공과금', amount: 200000, group: '고정비', accountId: 'acc-living' },
        ],
        savingsItems: [{ id: 'saving', name: '적금', amount: 300000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      state.sankeyDetailMode = 'basic';
      state.sankeyGrouping = { expense: 'total', savings: 'total', invest: 'total' };
      renderSankey(state.snapshot, buildSankeyData, 'group');
    });

    const tooltipText = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll<SVGPathElement>('#sankeySvg .sankey-path'));
      const tooltip = document.querySelector<HTMLElement>('#sankeyTooltip');
      const wrap = document.querySelector<HTMLElement>('#sankeyWrap');
      if (!tooltip || !wrap) return '';
      for (const path of paths) {
        path.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: wrap.getBoundingClientRect().left + 40,
          clientY: wrap.getBoundingClientRect().top + 40,
        }));
        const text = tooltip.textContent || '';
        if (text.includes('월세 <b>') && text.includes('관리비 & 공과금')) {
          return text;
        }
      }
      return '';
    });

    expect(tooltipText).toContain('구성:');
    expect(tooltipText).toMatch(/구성:\n월세 <b> .*?\n관리비 & 공과금 /);
    expect(tooltipText).not.toContain(', 관리비');
    const tooltipMarkup = await page.locator('#sankeyTooltip').evaluate((element) => element.innerHTML);
    expect(tooltipMarkup).not.toContain('<b>');
    const whiteSpace = await page.locator('#sankeyTooltip').evaluate((element) => window.getComputedStyle(element).whiteSpace);
    expect(whiteSpace).toBe('pre-line');
  });
});

test.describe('Phase 10 financial settings regression fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test.afterEach(async ({ page }) => {
    if (!page.isClosed()) {
      await page.close();
    }
  });

  test('normalizes legacy allocation group paths before saving and rendering', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [{ sanitizeInputs, buildAllocationMetaText }, { state }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
      ]);
      const inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-test', name: '급여', amount: 3000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
        ],
        expenseItems: [
          { id: 'utility', name: '전기세', amount: 120000, group: '생활비-고정비-공과금', accountId: 'acc-living' },
        ],
      });
      state.inputs = inputs;
      return {
        savedGroup: inputs.expenseItems[0].group,
        renderMeta: buildAllocationMetaText(inputs.expenseItems[0]),
      };
    });

    expect(result.savedGroup).toBe('공과금');
    expect(result.renderMeta).toBe('그룹 공과금');
  });

  test('repairs income allocation totals that exceed the income amount', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [{ sanitizeInputs }, { buildMonthlySnapshot }, { buildSankeyData }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
      ]);
      const inputs = sanitizeInputs({
        modelVersion: 10,
        splitIncomeAccounts: true,
        incomes: [{
          id: 'income-over',
          name: '급여',
          amount: 3000000,
          accountId: 'acc-salary',
          allocations: [
            { accountId: 'acc-salary', amount: 3000000 },
            { accountId: 'acc-living', amount: 1000000 },
          ],
        }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [{ id: 'rent', name: '월세', amount: 1000000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [{ id: 'saving', name: '적금', amount: 500000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 400000, group: '투자', accountId: 'acc-stock' }],
      });
      const allocationTotal = inputs.incomes[0].allocations.reduce((sum: number, allocation: any) => sum + allocation.amount, 0);
      const flow = buildSankeyData(buildMonthlySnapshot(inputs), 'group', { expense: 'total', savings: 'total', invest: 'total' });
      const accountIncomeTotal = flow.links
        .filter((link: any) => link.source === 'total-income')
        .reduce((sum: number, link: any) => sum + link.value, 0);
      return {
        incomeAmount: inputs.incomes[0].amount,
        allocationTotal,
        accountIncomeTotal,
      };
    });

    expect(result.allocationTotal).toBe(result.incomeAmount);
    expect(result.accountIncomeTotal).toBeLessThanOrEqual(result.incomeAmount);
  });

});

test.describe('Phase 10 household budget data model', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('sanitizes household context defaults and variable actual spending only', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { sanitizeInputs, sanitizeHouseholdContext, isVariableExpenseItem } = await import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js');
      const defaultInputs = sanitizeInputs({});
      const dualIncome = sanitizeHouseholdContext({
        profile: 'unexpected',
        incomeMode: 'dual-income',
        spouseMonthlyIncome: '123456',
      });
      const unknownMode = sanitizeHouseholdContext({
        incomeMode: 'other',
        spouseMonthlyIncome: '98765',
      });
      const sanitized = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-main', name: '급여', amount: 3000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
        ],
        expenseItems: [
          { id: 'rent', name: '월세', amount: 700000, group: '고정비', actualSpent: 999999, accountId: 'acc-living' },
          { id: 'food', name: '식비', amount: 300000, group: '변동비', actualSpent: 123456, accountId: 'acc-living' },
        ],
      });

      return {
        defaultContext: defaultInputs.householdContext,
        dualIncome,
        unknownMode,
        fixedExpense: sanitized.expenseItems.find((item: any) => item.id === 'rent'),
        variableExpense: sanitized.expenseItems.find((item: any) => item.id === 'food'),
        variablePredicate: sanitized.expenseItems.map((item: any) => isVariableExpenseItem(item)),
        monthlyExpense: sanitized.monthlyExpense,
      };
    });

    expect(result.defaultContext).toEqual({
      profile: 'newlywed',
      incomeMode: 'single-income',
      spouseMonthlyIncome: 0,
    });
    expect(result.dualIncome).toEqual({
      profile: 'newlywed',
      incomeMode: 'dual-income',
      spouseMonthlyIncome: 123456,
    });
    expect(result.unknownMode.incomeMode).toBe('single-income');
    expect(result.unknownMode.spouseMonthlyIncome).toBe(98765);
    expect(result.fixedExpense).not.toHaveProperty('actualSpent');
    expect(result.variableExpense.actualSpent).toBe(123456);
    expect(result.variablePredicate).toEqual([false, true]);
    expect(result.monthlyExpense).toBe(1000000);
  });

  test('derives variable budget rows, status, projection, overview, and three summary metrics', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const {
        BUDGET_STATUS_LABELS,
        buildHouseholdOverview,
        buildHouseholdBudgetSummary,
        buildVariableExpenseBudgetRows,
        projectMonthEndSpending,
        resolveBudgetStatus,
      } = await import('/IndividualSavingsFlowUI/apps/main/modules/household-budget.js');
      const now = new Date('2026-06-30T12:00:00+09:00');
      const inputs = {
        householdContext: {
          profile: 'newlywed',
          incomeMode: 'dual-income',
          spouseMonthlyIncome: 1200000,
        },
        incomes: [{ id: 'income-main', name: '급여', amount: 3000000 }],
        expenseItems: [
          { id: 'food', name: '식비', amount: 100000, group: '변동비', actualSpent: 120000 },
          { id: 'rent', name: '월세', amount: 700000, group: '고정비', actualSpent: 700000 },
        ],
        savingsItems: [{ id: 'saving', name: '적금', amount: 300000 }],
        investItems: [{ id: 'invest', name: 'ISA', amount: 200000 }],
      };
      const rows = buildVariableExpenseBudgetRows(inputs, now);
      const summary = buildHouseholdBudgetSummary(inputs, now);
      const overview = buildHouseholdOverview(inputs, now);

      return {
        labels: BUDGET_STATUS_LABELS,
        projectedZero: projectMonthEndSpending(0, now),
        cautionStatus: resolveBudgetStatus({ target: 100000, actual: 80000, projected: 80000 }),
        overRow: rows[0],
        rowCount: rows.length,
        metricLabels: summary.metrics.map((metric: any) => metric.label),
        householdIncome: summary.householdIncome,
        projectionNote: summary.projectionNote,
        overview: {
          fixedRatio: overview.fixedRatio,
          fixedCommitmentTotal: overview.fixedCommitmentTotal,
          livingExpenseTotal: overview.livingExpenseTotal,
          monthlySavings: overview.monthlySavings,
          rowLabels: overview.rows.map((row: any) => row.label),
        },
      };
    });

    expect(result.labels).toEqual({ safe: '여유', caution: '주의', over: '초과' });
    expect(result.projectedZero).toBe(0);
    expect(result.cautionStatus).toBe('주의');
    expect(result.rowCount).toBe(1);
    expect(result.overRow.status).toBe('초과');
    expect(result.overRow.remaining).toBe(-20000);
    expect(result.metricLabels).toEqual(['가구 월수입', '변동비 실제/목표', '남은 변동비']);
    expect(result.householdIncome).toBe(4200000);
    expect(result.projectionNote).toBe('현재 사용 속도를 단순 환산한 참고값입니다.');
    expect(result.overview.fixedCommitmentTotal).toBe(1200000);
    expect(result.overview.livingExpenseTotal).toBe(100000);
    expect(result.overview.monthlySavings).toBe(2900000);
    expect(result.overview.fixedRatio).toBe(29);
    expect(result.overview.rowLabels).toEqual(['급여', '고정지출 합계', '생활비', '월저축', '1년 후 저축', '5년 후 저축', '10년 후 저축', '고정지출 비율']);
  });
});

test.describe('Phase 10.5 financial settings entry contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('keeps the default screen light with one integrated detail entry before Sankey', async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);

      await expect(page.locator('#householdBudgetPanel')).toHaveCount(0);
      await expect(page.locator('[data-household-overview]')).toHaveCount(0);
      await expect(page.locator('[data-household-budget-row]')).toHaveCount(0);
      await expect(page.locator('[data-household-budget-actual]')).toHaveCount(0);
      await expect(page.locator('.household-mode-toggle')).toHaveCount(0);
      await expect(page.locator('.household-person-tabs')).toHaveCount(0);
      await expect(page.locator('[data-household-person-panel]')).toHaveCount(0);
      await expect(page.locator('[data-household-field="spouseMonthlyIncome"]')).toHaveCount(0);

      const detailActions = page.locator('[data-financial-settings-detail]');
      await expect(detailActions).toHaveCount(1);
      await expect(detailActions.first()).toBeVisible();
      await expect(detailActions.first()).toContainText('재무설정 상세');

      await expect(page.locator('#inputsTitle')).toContainText('기초 자산·부채 및 가정');
      await expect(page.locator('.mgmt-tabs')).toBeHidden();
      await expect(page.locator('#mgmtPanelIncome')).toBeHidden();
      await expect(page.locator('#mgmtPanelAccount')).toBeHidden();
      await expect(page.locator('#mgmtPanelFlow')).toBeHidden();

      await expect(page.getByText('부부합산', { exact: true })).toHaveCount(0);
      await expect(page.getByText('본인 설정', { exact: true })).toHaveCount(0);
      await expect(page.getByText('배우자 설정', { exact: true })).toHaveCount(0);

      const order = await page.evaluate(() => {
        const cards = document.querySelector('#summaryCards');
        const summary = document.querySelector('.summary-panel');
        const sankey = document.querySelector('.sankey-panel');
        if (!cards || !summary || !sankey) return null;
        return {
          summaryBeforeSankey: Boolean(summary.compareDocumentPosition(sankey) & Node.DOCUMENT_POSITION_FOLLOWING),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(order?.summaryBeforeSankey).toBe(true);
      expect(order?.overflow, `no page overflow at ${viewport.width}px`).toBeLessThanOrEqual(4);
      await expect(page.locator('[data-financial-summary-group="core-metrics"]')).toContainText('년 후 순자산');
      await expect(page.locator('[data-financial-summary-group="outflow"]')).toContainText('지출');
    }
  });

  test('keeps base assumptions in the controls panel and amount editing in the detail modal', async ({ page }) => {
    await page.locator('#toggleControlsBtn').click();
    await expect(page.locator('#mgmtPanelSettings')).toBeVisible();
    await expect(page.locator('#startCash')).toBeVisible();
    await expect(page.locator('#startDebt')).toBeVisible();
    await expect(page.locator('#monthlyDebtPayment')).toBeVisible();
    await expect(page.locator('#annualIncomeGrowth')).toBeVisible();
    await expect(page.locator('#annualInvestReturn')).toBeVisible();
    await expect(page.locator('#incomeList')).toBeHidden();
    await expect(page.locator('#expenseList')).toBeHidden();
    await expect(page.locator('#savingsList')).toBeHidden();
    await expect(page.locator('#investList')).toBeHidden();

    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-financial-detail-tab]')).toHaveText(['월 수입', '월 생활비', '투자', '저축', '결과/자동 저축']);
    await modal.locator('[data-financial-modal-edit]').first().click();
    await expect(modal.locator('[data-financial-modal-field="amount"]').first()).toBeVisible();
    await expect(modal.locator('#financialModalCreate')).toBeHidden();
    await expect(modal.locator('[data-financial-add-menu-toggle]')).toBeVisible();
  });

  test('opens the same integrated modal from the detail action and summary category cards', async ({ page }) => {
    const modal = page.locator('#financialModal');
    const detailAction = page.locator('[data-financial-settings-detail]');
    await expect(detailAction).toHaveCount(1);
    await detailAction.click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalTitle')).toHaveText('재무설정 상세');
    await expect(modal.locator('#financialModalCancel')).toHaveText('취소');
    await expect(modal.locator('#financialModalSave')).toHaveText('적용');
    await expect(modal.locator('[data-household-overview]')).toHaveCount(0);
    await expect(modal.getByText('부부합산', { exact: true })).toHaveCount(0);
    await expect(modal.getByText('본인 설정', { exact: true })).toHaveCount(0);
    await expect(modal.getByText('배우자 설정', { exact: true })).toHaveCount(0);
    await modal.locator('#financialModalClose').click();
    await expect(modal).toBeHidden();

    const categories = await page.locator('[data-financial-category]').evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('data-financial-category') || '')
    );
    expect(categories).toEqual(expect.arrayContaining(['expense', 'savings', 'invest']));

    for (const category of categories) {
      await page.locator(`[data-financial-category="${category}"]`).click();
      await expect(modal).toBeVisible();
      await expect(modal.locator('#financialModalTitle')).toHaveText('재무설정 상세');
      await expect(modal.locator('[data-household-overview]')).toHaveCount(0);
      await expect(modal.locator('.household-mode-toggle')).toHaveCount(0);
      await expect(modal.locator('.household-person-tabs')).toHaveCount(0);
      await expect(modal.locator('[data-household-field="spouseMonthlyIncome"]')).toHaveCount(0);
      await modal.locator('#financialModalClose').click();
      await expect(modal).toBeHidden();
    }
  });
});

test.describe('Phase 10.5 integrated modal shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('renders ordered tabs and keeps the compact cashflow summary rail visible', async ({ page }) => {
    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();

    const tabs = modal.locator('[data-financial-detail-tab]');
    await expect(tabs).toHaveText(['월 수입', '월 생활비', '투자', '저축', '결과/자동 저축']);

    const rail = modal.locator('[data-financial-detail-rail]');
    await expect(rail).toBeVisible();
    await expect(rail.locator('[data-financial-rail-label]')).toHaveText([
      '수입',
      '생활비',
      '투자',
      '저축',
    ]);
    await expect(modal.locator('[data-financial-overbudget-action]')).toBeVisible();
    await expect(modal.locator('[data-financial-adjustment-choice]')).toHaveText([
      '투자 먼저 줄이기',
      '저축 먼저 줄이기',
      '저축/투자 비율 유지해서 같이 줄이기',
    ]);

    for (const label of ['월 수입', '월 생활비', '투자', '저축', '결과/자동 저축']) {
      await modal.getByRole('tab', { name: label, exact: true }).click();
      await expect(rail, `summary rail should remain visible on ${label}`).toBeVisible();
      await expect(modal.locator('[data-financial-detail-panel]')).toBeVisible();
      await expect(modal.locator('[data-financial-detail-panel]')).toContainText(label === '결과/자동 저축' ? '자동 저축' : label);
      await expect(page.locator('.modal-overlay:not(#financialModal):visible')).toHaveCount(0);
    }

    const modalText = await modal.textContent();
    expect(modalText || '').not.toMatch(/후회|잘못|책임|대출 상담|세무|투자 조언/);
  });

  test('wraps tabs and summary rail without page overflow', async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);

      const modal = page.locator('#financialModal');
      await page.locator('[data-financial-settings-detail]').click();
      await expect(modal).toBeVisible();
      await expect(modal.locator('[data-financial-detail-rail]')).toBeVisible();
      await expect(modal.locator('[data-financial-detail-tabs]')).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `modal should not create document overflow at ${viewport.width}px`).toBeLessThanOrEqual(4);

      const contained = await modal.evaluate((element) => {
        const rail = element.querySelector('[data-financial-detail-rail]');
        const tabs = element.querySelector('[data-financial-detail-tabs]');
        return [rail, tabs].every((node) => node && node.scrollWidth <= node.clientWidth + 4);
      });
      expect(contained, `rail and tabs should fit their container at ${viewport.width}px`).toBe(true);

      await modal.locator('#financialModalClose').click();
      await expect(modal).toBeHidden();
    }
  });
});

test.describe('Phase 10.5 living expense variable rows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  async function seedLivingExpenseRows(page: import('@playwright/test').Page, includeVariable = true) {
    await page.evaluate(async ({ includeVariable }) => {
      const [{ state }, { sanitizeInputs }, { buildMonthlySnapshot }, { createRenderOrchestrator }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-main', name: '급여', amount: 4200000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [
          { id: 'rent', name: '월세', amount: 900000, group: '고정비', actualSpent: 123456, accountId: 'acc-living' },
          ...(includeVariable
            ? [{ id: 'food', name: '식비', amount: 450000, group: '변동비', actualSpent: 180000, accountId: 'acc-living' }]
            : []),
        ],
        savingsItems: [{ id: 'saving', name: '적금', amount: 300000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      createRenderOrchestrator().renderAll();
    }, { includeVariable });
  }

  test('shows compact variable summaries and expands one editable average/range row', async ({ page }) => {
    await seedLivingExpenseRows(page);

    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();

    const variableRows = modal.locator('[data-financial-variable-row]');
    await expect(variableRows).toHaveCount(1);
    await expect(variableRows.first()).toContainText('식비');
    await expect(variableRows.first()).toContainText('45만');
    await expect(modal.locator('[data-financial-variable-detail]')).toHaveCount(0);
    await expect(modal.locator('[data-financial-modal-field="actualSpent"]')).toHaveCount(0);

    await variableRows.first().click();
    await expect(modal.locator('[data-financial-variable-detail]')).toHaveCount(1);
    await expect(modal.locator('[data-financial-modal-field="amount"]')).toHaveCount(1);
    await expect(modal.locator('[data-financial-modal-field="varianceAmount"]')).toHaveCount(1);
    await expect(modal.locator('[data-financial-modal-field="actualSpent"]')).toHaveCount(0);
    await expect(modal.locator('[data-financial-variable-detail]')).not.toContainText('월말 예상');
    await expect(modal.locator('[data-financial-variable-detail]')).not.toContainText('현재 사용 속도를 단순 환산한 참고값입니다.');

    await modal.locator('[data-financial-modal-field="amount"]').fill('500000');
    await modal.locator('[data-financial-modal-field="varianceAmount"]').fill('70000');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}').expenseItems?.find((item: any) => item.id === 'food')?.actualSpent)).not.toBe(230000);

    const fixedRow = modal.locator('[data-financial-fixed-row]').filter({ hasText: '월세' });
    await expect(fixedRow).toBeVisible();
    await fixedRow.click();
    await expect(fixedRow.locator('[data-financial-modal-field="actualSpent"]')).toHaveCount(0);
    await expect(fixedRow.locator('[data-financial-modal-field="varianceAmount"]')).toHaveCount(0);
    await expect(modal.locator('[data-financial-modal-field="actualSpent"]')).toHaveCount(0);

    await variableRows.first().click();
    await modal.locator('[data-financial-modal-field="amount"]').fill('500000');
    await modal.locator('[data-financial-modal-field="varianceAmount"]').fill('70000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    const variable = saved.expenseItems.find((item: any) => item.id === 'food');
    const fixed = saved.expenseItems.find((item: any) => item.id === 'rent');
    expect(variable).toMatchObject({ amount: 500000, actualSpent: 180000, varianceAmount: 70000 });
    expect(fixed).not.toHaveProperty('actualSpent');
    expect(fixed).not.toHaveProperty('varianceAmount');
  });

  test('renders an empty variable state and avoids 390px overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedLivingExpenseRows(page, false);

    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();

    await expect(modal.locator('[data-financial-variable-row]')).toHaveCount(0);
    await expect(modal.locator('[data-financial-variable-empty]')).toBeVisible();
    await expect(modal.locator('[data-financial-variable-empty]')).toContainText('변동비 항목이 없습니다');
    await expect(modal.locator('[data-financial-modal-field="actualSpent"]')).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(4);
    const contained = await modal.evaluate((element) => element.scrollWidth <= element.clientWidth + 4);
    expect(contained).toBe(true);
  });
});

test.describe('Phase 10.5 automatic savings adjustment', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  async function seedAutomaticSavingsCase(page: import('@playwright/test').Page, overBudget = false) {
    await page.evaluate(async ({ overBudget }) => {
      const [
        { state },
        { sanitizeInputs },
        { buildMonthlySnapshot },
        { createRenderOrchestrator },
        { STORAGE_KEY },
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-main', name: '급여', amount: 4200000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-saving', name: '저축계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [
          { id: 'rent', name: '월세', amount: overBudget ? 1900000 : 1600000, group: '고정비', accountId: 'acc-living' },
          { id: 'food', name: '식비', amount: overBudget ? 100000 : 300000, group: '변동비', actualSpent: 100000, accountId: 'acc-living' },
        ],
        savingsItems: [{ id: 'saving-main', name: '적금', amount: overBudget ? 1800000 : 700000, group: '저축', accountId: 'acc-saving' }],
        investItems: [{ id: 'invest-main', name: 'ETF', amount: overBudget ? 1200000 : 800000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      window.IsfStorageHub.saveLocal(STORAGE_KEY, state.inputs);
      createRenderOrchestrator().renderAll();
    }, { overBudget });
  }

  test('shows derived automatic savings and navigates to savings in the same modal', async ({ page }) => {
    await seedAutomaticSavingsCase(page, false);

    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-financial-detail-rail]')).toContainText('저축');
    await expect(modal.locator('[data-financial-detail-rail]')).toContainText('150만');
    await expect(modal.locator('[data-financial-detail-rail]')).not.toContainText('자동 저축');
    await expect(modal.locator('[data-financial-automatic-savings-input]')).toHaveCount(0);

    await modal.getByRole('tab', { name: '결과/자동 저축', exact: true }).click();
    const resultPanel = modal.locator('[data-financial-detail-panel]');
    await expect(resultPanel).toContainText('자동 저축');
    await expect(resultPanel).toContainText('80만');
    await expect(resultPanel.locator('input')).toHaveCount(0);
    await resultPanel.locator('[data-financial-result-savings-action]').click();
    await expect(modal.getByRole('tab', { name: '저축', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.modal-overlay:not(#financialModal):visible')).toHaveCount(0);
  });

  test('blocks excess save until a choice is selected and applies the choice idempotently', async ({ page }) => {
    await seedAutomaticSavingsCase(page, true);

    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();

    const choices = modal.locator('[data-financial-adjustment-choice]');
    await expect(choices).toHaveText([
      '투자 먼저 줄이기',
      '저축 먼저 줄이기',
      '저축/투자 비율 유지해서 같이 줄이기',
    ]);

    const beforeSave = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    await modal.getByRole('tab', { name: '투자', exact: true }).click();
    await modal.locator('[data-modal-row-category="invest"]').first().click();
    await modal.locator('[data-financial-modal-field="amount"]').fill('1210000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-financial-adjustment-feedback]')).toContainText('조정 방식을 선택');
    const blockedSave = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(blockedSave.savingsItems).toEqual(beforeSave.savingsItems);
    expect(blockedSave.investItems).toEqual(beforeSave.investItems);

    await choices.filter({ hasText: '투자 먼저 줄이기' }).click();
    await modal.locator('#financialModalCancel').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    const afterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(afterCancel.savingsItems).toEqual(beforeSave.savingsItems);
    expect(afterCancel.investItems).toEqual(beforeSave.investItems);
    await modal.locator('#financialModalClose').click();
    await expect(modal).toBeHidden();

    await page.locator('[data-financial-settings-detail]').click();
    await modal.getByRole('tab', { name: '투자', exact: true }).click();
    await modal.locator('[data-modal-row-category="invest"]').first().click();
    await modal.locator('[data-financial-modal-field="amount"]').fill('1210000');
    await modal.locator('[data-financial-adjustment-choice]').filter({ hasText: '투자 먼저 줄이기' }).click();
    await modal.locator('#financialModalSave').click();
    if (await modal.locator('#financialModalPendingBar').isVisible()) {
      await expect(modal.locator('[data-financial-adjustment-feedback]')).toContainText('조정 방식을 선택');
      await modal.locator('[data-financial-adjustment-choice]').filter({ hasText: '투자 먼저 줄이기' }).click();
      await modal.locator('#financialModalSave').click();
    }
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    const adjusted = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(adjusted.savingsItems.map((item: any) => item.id)).toEqual(['saving-main']);
    expect(adjusted.investItems.map((item: any) => item.id)).toEqual(['invest-main']);
    expect(adjusted.savingsItems[0].amount).toBe(1800000);
    expect(adjusted.investItems[0].amount).toBe(400000);

    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    await modal.locator('[data-financial-modal-field="amount"]').fill('4210000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    const repeated = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(repeated.savingsItems.map((item: any) => item.id)).toEqual(['saving-main']);
    expect(repeated.investItems.map((item: any) => item.id)).toEqual(['invest-main']);
    const labels = await page.locator('#sankeySvg .sankey-label').evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
    expect(labels.filter((label) => label.includes('적금')).length).toBeLessThanOrEqual(1);
    expect(labels.filter((label) => label.includes('ETF')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('Phase 10.6 financial detail modal editing repair', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
    await page.waitForFunction(() => Boolean((window as any).IsfShare?.detectViewMode));
  });

  async function seedRegressionFlow(page: import('@playwright/test').Page) {
    await page.evaluate(async () => {
      const [
        { state },
        { sanitizeInputs },
        { buildMonthlySnapshot },
        { createRenderOrchestrator },
        { STORAGE_KEY },
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-main', name: '급여', amount: 4200000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-saving', name: '저축계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [
          { id: 'rent', name: '월세', amount: 1000000, group: '고정비', actualSpent: 111111, varianceAmount: 90000, accountId: 'acc-living' },
          { id: 'food', name: '식비', amount: 500000, group: '변동비', actualSpent: 210000, varianceAmount: 50000, accountId: 'acc-living' },
        ],
        savingsItems: [{ id: 'saving-main', name: '적금', amount: 600000, group: '저축', accountId: 'acc-saving' }],
        investItems: [{ id: 'invest-main', name: 'ETF', amount: 500000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      window.IsfStorageHub.saveLocal(STORAGE_KEY, state.inputs);
      createRenderOrchestrator().renderAll();
    });
  }

  async function openFinancialDetail(page: import('@playwright/test').Page) {
    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    return modal;
  }

  async function assertForbiddenCoupleUiAbsent(page: import('@playwright/test').Page) {
    await expect(page.locator('#householdBudgetPanel')).toHaveCount(0);
    await expect(page.locator('[data-household-overview]')).toHaveCount(0);
    await expect(page.locator('.household-mode-toggle')).toHaveCount(0);
    await expect(page.locator('.household-person-tabs')).toHaveCount(0);
    await expect(page.locator('[data-household-field="spouseMonthlyIncome"]')).toHaveCount(0);
    await expect(page.getByText('부부합산', { exact: true })).toHaveCount(0);
    await expect(page.getByText('본인 설정', { exact: true })).toHaveCount(0);
    await expect(page.getByText('배우자 설정', { exact: true })).toHaveCount(0);
    await expect(page.locator('.modal-overlay:not(#financialModal):visible')).toHaveCount(0);
  }

  test('Phase 10.6 compact rows open cleanly without duplicated labels or pending state', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    await expect(modal.locator('.financial-detail-panel__title')).toHaveCount(0);
    await expect(modal).not.toContainText('신설 모달');
    await assertForbiddenCoupleUiAbsent(page);

    const firstIncomeRow = modal.locator('[data-modal-row-category="income"]').first();
    await expect(firstIncomeRow).toContainText('급여');
    await expect(firstIncomeRow).toContainText('420만');
    await expect(firstIncomeRow).not.toContainText('급여계좌');
    await expect(firstIncomeRow).not.toContainText('수입, 수입');

    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    const variableRow = modal.locator('[data-financial-variable-row]').filter({ hasText: '식비' });
    await expect(variableRow).toContainText('식비');
    await expect(variableRow).toContainText('50만');
    await expect(variableRow).not.toContainText('±');
    await expect(modal.locator('[data-financial-variable-range-summary]')).toContainText('45만');
    await expect(modal.locator('[data-financial-variable-range-summary]')).toContainText('55만');
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
  });

  test('Phase 10.6 account rows and add menu keep compact accessible polish', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = page.locator('#financialModal');
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('open-financial-modal', { detail: { category: 'account' } }));
    });
    await expect(modal).toBeVisible();
    const accountRow = modal.locator('[data-modal-row-category="account"]').first();
    await expect(accountRow).toContainText('급여계좌');
    await expect(accountRow).not.toContainText('계좌 별칭');
    await expect(accountRow.locator('[data-financial-modal-edit]')).toHaveCount(0);

    await modal.locator('#financialModalClose').click();
    await expect(modal).toBeHidden();

    const detailModal = await openFinancialDetail(page);
    await openFinancialAddMenu(detailModal);
    const trigger = detailModal.locator('[data-financial-add-menu-toggle]');
    const menu = detailModal.locator('[data-financial-add-menu]');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toHaveAttribute('role', 'menu');
    await expect(menu.getByRole('menuitem', { name: '수입 추가' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '그룹 추가' })).toBeVisible();

    await trigger.press('Escape');
    await expect(detailModal.locator('[data-financial-add-menu]')).toHaveCount(0);
    await expect(detailModal.locator('[data-financial-add-menu-toggle]')).toHaveAttribute('aria-expanded', 'false');
  });

  test('Phase 10.6 row editing folds one row while preserving changed drafts across tabs', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    const firstIncomeRow = modal.locator('[data-modal-row-category="income"]').first();
    await firstIncomeRow.click();
    const editingIncome = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]');
    await expect(editingIncome).toHaveCount(1);
    await expect(editingIncome.locator('[data-financial-modal-field="name"]')).toHaveValue('급여');
    await expect(editingIncome.locator('[data-financial-modal-field="amount"]')).toHaveValue('4,200,000');
    await expect(editingIncome.locator('[data-financial-modal-field="accountId"]')).toBeVisible();

    await modal.locator('.modal-header').click();
    await expect(modal.locator('.financial-modal-row--editing')).toHaveCount(0);
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    await firstIncomeRow.click();
    await editingIncome.locator('[data-financial-modal-field="amount"]').fill('4300000');
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
    const beforeApply = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(beforeApply.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(4200000);

    await modal.getByRole('tab', { name: '저축', exact: true }).click();
    await expect(modal.locator('.financial-modal-row--editing')).toHaveCount(0);
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await expect(modal.locator('[data-modal-row-category="income"]').first()).toContainText('430만');

    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(4300000);
  });

  test('Phase 10.6 money controls enforce direct input, 10000 steppers, quick increases, and local errors', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await modal.locator('[data-modal-row-category="income"]').first().click();
    const row = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]');
    const amount = row.locator('[data-financial-modal-field="amount"]');

    const layout = await row.evaluate((node) => {
      const input = node.querySelector('[data-financial-modal-field="amount"]') as HTMLElement;
      const down = node.querySelector('[data-money-step="down"]') as HTMLElement;
      const up = node.querySelector('[data-money-step="up"]') as HTMLElement;
      const quick = node.querySelector('[data-money-quick="50000"]') as HTMLElement;
      const account = node.querySelector('[data-financial-modal-field="accountId"]') as HTMLElement;
      const rect = (element: HTMLElement) => element.getBoundingClientRect();
      return {
        downRight: rect(down).right,
        inputLeft: rect(input).left,
        inputRight: rect(input).right,
        upLeft: rect(up).left,
        quickTop: rect(quick).top,
        inputBottom: rect(input).bottom,
        amountTop: rect(input).top,
        accountTop: rect(account).top,
      };
    });
    expect(layout.downRight).toBeLessThanOrEqual(layout.inputLeft + 4);
    expect(layout.inputRight).toBeLessThanOrEqual(layout.upLeft + 4);
    expect(layout.quickTop).toBeGreaterThanOrEqual(layout.inputBottom - 1);
    expect(Math.abs(layout.accountTop - layout.amountTop)).toBeLessThanOrEqual(8);

    await row.locator('[data-money-step="down"]').click();
    await expect(amount).toHaveValue('4,190,000');
    await row.locator('[data-money-step="up"]').click();
    await expect(amount).toHaveValue('4,200,000');
    await row.locator('[data-money-quick="50000"]').click();
    await expect(amount).toHaveValue('4,250,000');
    await row.locator('[data-money-quick="100000"]').click();
    await expect(amount).toHaveValue('4,350,000');
    await row.locator('[data-money-quick="1000000"]').click();
    await expect(amount).toHaveValue('5,350,000');

    await amount.fill('1234567');
    await expect(row.locator('[data-financial-row-error]')).toContainText('금액은 1,000원 단위로 입력해 주세요.');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(row.locator('[data-financial-row-error]')).toContainText('금액은 1,000원 단위로 입력해 주세요.');

    await amount.fill('-1000');
    await expect(amount).toHaveValue('0');
    await expect(row.locator('[data-financial-row-error]')).toContainText('금액은 0원 이상이어야 합니다.');
  });

  test('Phase 10.6 variable rows edit varianceAmount directly with exact quick buttons', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    const variableRow = modal.locator('[data-financial-variable-row]').filter({ hasText: '식비' });
    await variableRow.click();
    await expect(variableRow.locator('[data-financial-modal-field="amount"]')).toHaveValue('500,000');
    await expect(variableRow.locator('[data-financial-modal-field="varianceAmount"]')).toHaveValue('50,000');
    await expect(variableRow.locator('[data-variance-quick="10000"]')).toHaveText('±1만');
    await expect(variableRow.locator('[data-variance-quick="50000"]')).toHaveText('±5만');
    await expect(variableRow.locator('[data-variance-quick="100000"]')).toHaveText('±10만');
    await expect(variableRow).not.toContainText('월말 예상');
    await expect(variableRow).not.toContainText('현재 사용 속도');

    await variableRow.locator('[data-financial-modal-field="varianceAmount"]').fill('70000');
    await expect(modal.locator('[data-financial-variable-range-summary]')).toContainText('43만');
    await expect(modal.locator('[data-financial-variable-range-summary]')).toContainText('57만');
    await expect(variableRow).not.toContainText('±7만');

    await variableRow.locator('[data-variance-quick="10000"]').click();
    await expect(variableRow.locator('[data-financial-modal-field="varianceAmount"]')).toHaveValue('80,000');
    await modal.locator('#financialModalSave').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.expenseItems.find((item: any) => item.id === 'food')).toMatchObject({ amount: 500000, actualSpent: 210000, varianceAmount: 80000 });
    expect(saved.expenseItems.find((item: any) => item.id === 'rent')).not.toHaveProperty('varianceAmount');
    await expect(modal.locator('[data-financial-modal-field="actualSpent"]')).toHaveCount(0);
  });

  test('Phase 10.6 dirty state ignores modal open, row selection, tabs, and empty add row', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    await openFinancialAddMenu(modal);
    await modal.locator('[data-financial-inline-add]').click();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
  });

  test('Phase 10.6 pending bar applies and cancels draft changes in place', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await expect(modal.locator('.modal-content--financial')).toHaveAttribute('role', 'dialog');
    await expect(modal.locator('.modal-content--financial')).toHaveAttribute('aria-modal', 'true');
    await expect(modal.locator('.modal-content--financial')).toHaveAttribute('aria-labelledby', 'financialModalTitle');
    await expect(modal.locator('.modal-content--financial')).toHaveAttribute('aria-describedby', 'financialModalDescription');
    await expect(modal.locator('#financialModalCancel')).toHaveText('취소');
    await expect(modal.locator('#financialModalSave')).toHaveText('적용');
    const pendingBar = modal.locator('#financialModalPendingBar');

    await modal.locator('[data-modal-row-category="income"]').first().click();
    const incomeRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]');
    await incomeRow.locator('[data-financial-modal-field="amount"]').fill('4400000');
    await expect(pendingBar).toBeVisible();
    await expect(pendingBar).toHaveAttribute('role', 'status');
    await expect(pendingBar).toHaveAttribute('aria-live', 'polite');
    await expect(pendingBar.locator('#financialModalPendingMessage')).toContainText('변경사항을 적용해야 저장됩니다.');

    await modal.locator('#financialModalCancel').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.financial-modal-row--editing')).toHaveCount(0);
    await expect(pendingBar).toHaveAttribute('data-pending-state', 'exiting');
    await expect(pendingBar).toBeHidden();
    await expect(modal.locator('[data-modal-row-category="income"]').first()).toContainText('420만');
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(4200000);
    await assertForbiddenCoupleUiAbsent(page);

    await modal.locator('[data-modal-row-category="income"]').first().click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="income"] [data-financial-modal-field="amount"]').fill('4500000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('tab', { name: '월 수입', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(modal.locator('.financial-modal-row--editing')).toHaveCount(0);
    await expect(pendingBar).toHaveAttribute('data-pending-state', 'applied');
    await expect(pendingBar).toBeHidden();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(4500000);
  });

  test('Phase 10.6 pending modal edits warn before page unload', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await modal.locator('[data-modal-row-category="income"]').first().click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="income"] [data-financial-modal-field="amount"]').fill('4700000');

    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);

    await modal.locator('#financialModalCancel').click();
    const cleanPrevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(cleanPrevented).toBe(false);
  });

  test('Phase 10.6 add creates inline temporary rows that persist only on apply', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await openFinancialAddMenu(modal);
    await expect(modal.locator('[data-financial-inline-add]')).toHaveText('수입 추가');
    await modal.locator('[data-financial-inline-add]').click();
    let tempRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]').last();
    await expect(tempRow.locator('[data-financial-modal-field="name"]')).toHaveValue('');
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    await modal.locator('.modal-header').click();
    await expect(modal.locator('.financial-modal-row--editing')).toHaveCount(0);
    await expect(modal.locator('[data-modal-row-category="income"]')).toHaveCount(1);
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    await openFinancialAddMenu(modal);
    await modal.locator('[data-financial-inline-add]').click();
    tempRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]').last();
    await tempRow.locator('[data-financial-modal-field="name"]').fill('부업');
    await tempRow.locator('[data-financial-modal-field="amount"]').fill('300000');
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.map((item: any) => item.name)).not.toContain('부업');

    await modal.locator('#financialModalCancel').click();
    await expect(modal.locator('[data-modal-row-category="income"]')).toHaveCount(1);
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    await openFinancialAddMenu(modal);
    await modal.locator('[data-financial-inline-add]').click();
    tempRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]').last();
    await tempRow.locator('[data-financial-modal-field="name"]').fill('부업');
    await tempRow.locator('[data-financial-modal-field="amount"]').fill('300000');
    await modal.locator('#financialModalSave').click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.name === '부업')?.amount).toBe(300000);
    await expect(modal).toBeVisible();
  });

  test('Phase 10.6 delete keeps existing removals draft-only and discards empty temp rows immediately', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await modal.getByRole('tab', { name: '저축', exact: true }).click();
    await modal.locator('[data-modal-row-category="savings"]').first().click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="savings"] [data-financial-modal-remove]').click();
    await expect(modal.locator('[data-modal-row-category="savings"]')).toHaveCount(0);
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.savingsItems.map((item: any) => item.id)).toContain('saving-main');

    await modal.locator('#financialModalCancel').click();
    await modal.getByRole('tab', { name: '저축', exact: true }).click();
    await expect(modal.locator('[data-modal-row-category="savings"]')).toHaveCount(1);
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    await openFinancialAddMenu(modal);
    await modal.locator('[data-financial-inline-add]').click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="savings"] [data-financial-modal-remove]').click();
    await expect(modal.locator('[data-modal-row-category="savings"]')).toHaveCount(1);
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    await modal.locator('[data-modal-row-category="savings"]').first().click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="savings"] [data-financial-modal-remove]').click();
    await modal.locator('#financialModalSave').click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.savingsItems.map((item: any) => item.id)).not.toContain('saving-main');
    await expect(modal).toBeVisible();
  });

  test('Phase 10.6 close prompts only when pending changes exist for x overlay and escape', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await modal.locator('#financialModalClose').click();
    await expect(modal).toBeHidden();

    await openFinancialDetail(page);
    await modal.locator('[data-modal-row-category="income"]').first().click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="income"] [data-financial-modal-field="amount"]').fill('4600000');
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('변경된 내용을 저장하지 않고 닫으시겠습니까?');
      await dialog.dismiss();
    });
    await modal.locator('#financialModalClose').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('변경된 내용을 저장하지 않고 닫으시겠습니까?');
      await dialog.dismiss();
    });
    await modal.click({ position: { x: 8, y: 8 } });
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('변경된 내용을 저장하지 않고 닫으시겠습니까?');
      await dialog.accept();
    });
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(4200000);
  });

  test('Phase 10.6 validation keeps pending bar open and expands first invalid row', async ({ page }) => {
    await seedRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await openFinancialAddMenu(modal);
    await modal.locator('[data-financial-inline-add]').click();
    const tempRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]').last();
    await tempRow.locator('[data-financial-modal-field="amount"]').fill('1234567');
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
    await modal.locator('#financialModalSave').click();

    const invalidRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]').last();
    await expect(invalidRow.locator('[data-financial-row-error]')).toContainText('이름을 입력해 주세요.');
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();

    await invalidRow.locator('[data-financial-modal-field="name"]').fill('부업');
    await modal.locator('#financialModalSave').click();
    await expect(invalidRow.locator('[data-financial-row-error]')).toContainText('금액은 1,000원 단위로 입력해 주세요.');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
  });

  test('Phase 10.6 mobile summary rail is four-cell and combines automatic savings', async ({ page }) => {
    await seedRegressionFlow(page);

    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const modal = await openFinancialDetail(page);
      const rail = modal.locator('[data-financial-detail-rail]');
      await expect(rail).toBeVisible();

      const labels = await rail.locator('[data-financial-rail-label]').evaluateAll((nodes) =>
        nodes.map((node) => (node.textContent || '').trim())
      );
      expect(labels).toEqual(['수입', '생활비', '투자', '저축']);
      await expect(rail).not.toContainText('자동 저축');
      await expect(rail).not.toContainText('상태');

      const savingsCell = rail.locator('.financial-detail-rail__item').filter({ hasText: '저축' });
      await expect(savingsCell).toContainText('220만');
      const layout = await rail.evaluate((element) => {
        const boxes = Array.from(element.querySelectorAll('.financial-detail-rail__item')).map((node) =>
          (node as HTMLElement).getBoundingClientRect()
        );
        const rows = new Set(boxes.map((box) => Math.round(box.top)));
        const columns = new Set(boxes.map((box) => Math.round(box.left)));
        return {
          count: boxes.length,
          rows: rows.size,
          columns: columns.size,
          contained: element.scrollWidth <= element.clientWidth + 4,
        };
      });
      expect(layout).toEqual({ count: 4, rows: 2, columns: 2, contained: true });

      await modal.locator('#financialModalClose').click();
      await expect(modal).toBeHidden();
    }
  });

  test('Phase 10.6 mobile rows preserve amount visibility and pending bar safety', async ({ page }) => {
    await seedRegressionFlow(page);
    await page.evaluate(async () => {
      const [{ state }, { STORAGE_KEY }, { createRenderOrchestrator }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
      ]);
      state.inputs.incomes[0].name = '아주 긴 이름의 월급과 상여 수입 항목';
      state.inputs.expenseItems[1].name = '모바일에서 매우 긴 식비와 생활용품 비용';
      window.IsfStorageHub.saveLocal(STORAGE_KEY, state.inputs);
      createRenderOrchestrator().renderAll();
    });

    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const modal = await openFinancialDetail(page);
      const incomeRow = modal.locator('[data-modal-row-category="income"]').first();
      await expect(incomeRow).toContainText('420만');

      const readLayout = await incomeRow.evaluate((row) => {
        const name = row.querySelector('.financial-modal-row__header strong') as HTMLElement | null;
        const amount = row.querySelector('.financial-modal-row__summary span') as HTMLElement | null;
        const box = (row as HTMLElement).getBoundingClientRect();
        const amountBox = amount?.getBoundingClientRect();
        const amountStyle = amount ? window.getComputedStyle(amount) : null;
        const nameStyle = name ? window.getComputedStyle(name) : null;
        return {
          rowHeight: box.height,
          amountWrap: amountStyle?.whiteSpace,
          amountContained: Boolean(amountBox && amountBox.right <= box.right + 1 && amountBox.left >= box.left - 1),
          amountTextVisible: Boolean(amount && amount.scrollWidth <= amount.clientWidth + 4),
          nameOneLine: Boolean(name && name.scrollHeight <= name.clientHeight + 4),
          nameOverflow: nameStyle?.overflow,
        };
      });
      expect(readLayout.amountWrap).toBe('nowrap');
      expect(readLayout.amountContained).toBe(true);
      expect(readLayout.amountTextVisible).toBe(true);
      expect(readLayout.nameOneLine).toBe(true);
      expect(readLayout.nameOverflow).toBe('hidden');
      expect(readLayout.rowHeight).toBeLessThanOrEqual(viewport.width === 390 ? 76 : 84);

      await incomeRow.click();
      const editingRow = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]');
      await editingRow.locator('[data-financial-modal-field="amount"]').fill('4300000');
      const quickAffordance = await editingRow.locator('.financial-money-control .quick-amount-buttons').first().evaluate((element) => {
        const style = window.getComputedStyle(element as HTMLElement);
        return {
          overflowX: style.overflowX,
          maskImage: style.maskImage || style.webkitMaskImage || '',
        };
      });
      expect(quickAffordance.overflowX).toBe('auto');
      expect(quickAffordance.maskImage).toContain('linear-gradient');
      await expect(modal.locator('#financialModalPendingBar')).toBeVisible();
      await modal.locator('.financial-modal-row:last-of-type').evaluate((row) =>
        row.scrollIntoView({ block: 'end', inline: 'nearest' })
      );
      const pendingSafety = await modal.evaluate((element) => {
        const modalBody = element.querySelector('.modal-body') as HTMLElement | null;
        const pending = element.querySelector('#financialModalPendingBar') as HTMLElement | null;
        const lastRow = element.querySelector('.financial-modal-row:last-of-type') as HTMLElement | null;
        const save = element.querySelector('#financialModalSave') as HTMLElement | null;
        const cancel = element.querySelector('#financialModalCancel') as HTMLElement | null;
        const pendingBox = pending?.getBoundingClientRect();
        const rowBox = lastRow?.getBoundingClientRect();
        return {
          saveHeight: save?.getBoundingClientRect().height || 0,
          cancelHeight: cancel?.getBoundingClientRect().height || 0,
          bodyPadding: modalBody ? parseFloat(window.getComputedStyle(modalBody).paddingBottom) : 0,
          clearOfLastRow: Boolean(pendingBox && rowBox && pendingBox.top >= rowBox.bottom - 1),
        };
      });
      expect(pendingSafety.saveHeight).toBeGreaterThanOrEqual(44);
      expect(pendingSafety.cancelHeight).toBeGreaterThanOrEqual(44);
      expect(pendingSafety.bodyPadding).toBeGreaterThanOrEqual(96);
      expect(pendingSafety.clearOfLastRow).toBe(true);

      await modal.locator('#financialModalCancel').click();
      await modal.locator('#financialModalClose').click();
      await expect(modal).toBeHidden();
    }
  });

  test('Phase 10.6 regression preserves no-couple sanitizer persistence and Sankey contracts', async ({ page }) => {
    await seedRegressionFlow(page);
    await assertForbiddenCoupleUiAbsent(page);
    await expect(page.locator('.financial-modal-row')).toHaveCount(0);
    await expect(page.locator('[data-household-overview]')).toHaveCount(0);

    const forbiddenPhraseFound = await page.evaluate(async () => {
      const sources = await Promise.all([
        fetch('apps/main/index.html').then((response) => response.text()),
        fetch('apps/main/modules/financial-modal-controller.js').then((response) => response.text()),
      ]);
      return sources.some((source) => source.includes('신설 모달'));
    });
    expect(forbiddenPhraseFound).toBe(false);

    const modal = await openFinancialDetail(page);
    await assertForbiddenCoupleUiAbsent(page);

    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    const variableRow = modal.locator('[data-financial-variable-row]').filter({ hasText: '식비' });
    await variableRow.click();
    await variableRow.locator('[data-financial-modal-field="amount"]').fill('550000');
    await variableRow.locator('[data-financial-modal-field="varianceAmount"]').fill('80000');
    await expect(modal.locator('[data-financial-fixed-row]').filter({ hasText: '월세' }).locator('[data-financial-modal-field="varianceAmount"]')).toHaveCount(0);

    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="income"] [data-financial-modal-field="amount"]').fill('5000000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(5000000);
    expect(saved.expenseItems.find((item: any) => item.id === 'food')).toMatchObject({ amount: 550000, actualSpent: 210000, varianceAmount: 80000 });
    expect(saved.expenseItems.find((item: any) => item.id === 'rent')).not.toHaveProperty('actualSpent');
    expect(saved.expenseItems.find((item: any) => item.id === 'rent')).not.toHaveProperty('varianceAmount');

    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    await modal.locator('.financial-modal-row--editing[data-modal-row-category="income"] [data-financial-modal-field="amount"]').fill('5010000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(5010000);
    expect(saved.expenseItems.filter((item: any) => item.id === 'food')).toHaveLength(1);
    expect(saved.savingsItems.filter((item: any) => item.id === 'saving-main')).toHaveLength(1);
    expect(saved.investItems.filter((item: any) => item.id === 'invest-main')).toHaveLength(1);

    await modal.locator('#financialModalClose').click();
    await expect(modal).toBeHidden();
    await assertForbiddenCoupleUiAbsent(page);
    const labels = await page.locator('#sankeySvg .sankey-label').evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
    expect(labels).toEqual(expect.arrayContaining(['총수입', '고정비(고정지출)', '저축', '투자']));
    expect(labels).not.toEqual(expect.arrayContaining(['급여계좌', '생활비계좌', '투자계좌']));
    expect(labels.filter((label) => label.includes('적금')).length).toBeLessThanOrEqual(1);
    expect(labels.filter((label) => label.includes('ETF')).length).toBeLessThanOrEqual(1);
  });
});

test.describe('Phase 10.6.1 modal capability absorption', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  async function seedAbsorptionFlow(page: import('@playwright/test').Page) {
    await page.evaluate(async () => {
      const [
        { state },
        { sanitizeInputs },
        { buildMonthlySnapshot },
        { createRenderOrchestrator },
        { STORAGE_KEY },
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        annualSavingsYield: 3,
        horizonYears: 5,
        incomes: [{
          id: 'income-main',
          name: '급여',
          amount: 4200000,
          accountId: 'acc-salary',
          allocations: [{ accountId: 'acc-salary', amount: 4200000 }],
        }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-saving', name: '저축계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [
          { id: 'saving-main', name: '적금', amount: 500000, group: '저축', accountId: 'acc-saving' },
          { id: 'saving-fallback', name: '비상금', amount: 300000, group: '저축', accountId: 'acc-saving' },
        ],
        investItems: [{ id: 'invest-main', name: 'ETF', amount: 400000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      window.IsfStorageHub.saveLocal(STORAGE_KEY, state.inputs);
      createRenderOrchestrator().renderAll();
    });
  }

  async function openFinancialDetail(page: import('@playwright/test').Page) {
    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    return modal;
  }

  test('edits income destination allocations inside the modal and blocks mismatched allocation totals', async ({ page }) => {
    await seedAbsorptionFlow(page);

    const modal = await openFinancialDetail(page);
    const incomeRow = modal.locator('[data-modal-row-category="income"]').first();
    await expect(incomeRow).toContainText('급여');
    await expect(incomeRow).toContainText('420만');
    await expect(incomeRow).not.toContainText('생활비계좌');
    await expect(incomeRow.locator('[data-income-allocation-row]')).toHaveCount(0);

    await incomeRow.click();
    const editingIncome = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]');
    await expect(editingIncome.locator('[data-income-allocation-row]')).toHaveCount(1);
    await editingIncome.locator('[data-income-allocation-add]').click();
    await expect(editingIncome.locator('[data-income-allocation-row]')).toHaveCount(2);

    await editingIncome.locator('[data-income-allocation-row]').nth(0).locator('[data-income-allocation-amount]').fill('3000000');
    await editingIncome.locator('[data-income-allocation-row]').nth(1).locator('[data-income-allocation-account]').selectOption('acc-living');
    await editingIncome.locator('[data-income-allocation-row]').nth(1).locator('[data-income-allocation-amount]').fill('1300000');
    await modal.locator('#financialModalSave').click();
    await expect(editingIncome.locator('[data-financial-row-error]')).toContainText('수입 금액과 배분 합계가 일치해야 합니다.');
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes[0].allocations).toEqual([{ accountId: 'acc-salary', amount: 4200000 }]);

    await editingIncome.locator('[data-income-allocation-row]').nth(1).locator('[data-income-allocation-amount]').fill('500000');
    await modal.locator('#financialModalSave').click();
    await expect(editingIncome.locator('[data-financial-row-error]')).toContainText('수입 금액과 배분 합계가 일치해야 합니다.');
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes[0].allocations).toEqual([{ accountId: 'acc-salary', amount: 4200000 }]);

    await editingIncome.locator('[data-income-allocation-row]').nth(1).locator('[data-income-allocation-amount]').fill('1200000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes[0]).toMatchObject({
      amount: 4200000,
      accountId: 'acc-salary',
      allocations: [
        { accountId: 'acc-salary', amount: 3000000 },
        { accountId: 'acc-living', amount: 1200000 },
      ],
    });

    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    const reopenedIncome = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]');
    await reopenedIncome.locator('[data-income-allocation-row]').nth(1).locator('[data-income-allocation-remove]').click();
    await expect(reopenedIncome.locator('[data-income-allocation-row]')).toHaveCount(1);
    await modal.locator('#financialModalCancel').click();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes[0].allocations).toHaveLength(2);
  });

  test('persists savings maturity and one item yield while global fallback remains effective', async ({ page }) => {
    await seedAbsorptionFlow(page);

    const modal = await openFinancialDetail(page);
    await modal.getByRole('tab', { name: '저축', exact: true }).click();
    const savingRow = modal.locator('[data-modal-row-category="savings"]').filter({ hasText: '적금' });
    await savingRow.click();
    const editingSaving = modal.locator('.financial-modal-row--editing[data-modal-row-category="savings"]').filter({ hasText: '적금' });
    await expect(editingSaving.locator('[data-savings-additional-settings]')).toBeHidden();
    await editingSaving.locator('[data-savings-additional-toggle]').click();
    await expect(editingSaving.locator('[data-savings-additional-settings]')).toBeVisible();

    await editingSaving.locator('[data-financial-modal-field="annualRate"]').fill('5.5');
    await editingSaving.locator('[data-financial-modal-field="maturityMonth"]').fill('2027-03');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.savingsItems.find((item: any) => item.id === 'saving-main')).toMatchObject({
      annualRate: 5.5,
      maturityMonth: '2027-03',
    });
    expect(saved.savingsItems.find((item: any) => item.id === 'saving-fallback')).not.toHaveProperty('annualRate');

    const projectionProbe = await page.evaluate(async () => {
      const [{ sanitizeInputs }, { buildSavingsBuckets, simulateProjection }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
      ]);
      const now = new Date();
      const maturity = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const maturityMonth = `${maturity.getFullYear()}-${String(maturity.getMonth() + 1).padStart(2, '0')}`;
      const inputs = sanitizeInputs({
        modelVersion: 10,
        annualSavingsYield: 3,
        annualIncomeGrowth: 0,
        annualExpenseGrowth: 0,
        annualInvestReturn: 0,
        annualDebtInterest: 0,
        horizonYears: 1,
        startCash: 0,
        startSavings: 0,
        startInvest: 0,
        startDebt: 0,
        monthlyDebtPayment: 0,
        incomes: [{ id: 'income-main', name: '급여', amount: 5000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-saving', name: '저축계좌' },
        ],
        expenseItems: [],
        savingsItems: [
          { id: 'saving-maturity', name: '만기 적금', amount: 500000, accountId: 'acc-saving', maturityMonth, annualRate: 6 },
          { id: 'saving-fallback', name: '기본 금리 적금', amount: 0, accountId: 'acc-saving' },
        ],
        investItems: [],
      });
      const buckets = buildSavingsBuckets(inputs);
      const records = simulateProjection(inputs);
      const firstPositiveSavings = records.find((record: any) => record.monthIndex > 0 && record.savings > 0);
      const closedRecordIndex = records.findIndex((record: any, index: number) =>
        index > 0 && records[index - 1].savings > 0 && record.savings === 0
      );
      return {
        rates: buckets.map((bucket: any) => bucket.annualRate),
        maturityMonth,
        firstPositiveSavings: firstPositiveSavings?.savings || 0,
        closedSavings: closedRecordIndex >= 0 ? records[closedRecordIndex].savings : null,
        netAssetAfterClose: closedRecordIndex >= 0 ? records[closedRecordIndex].netAsset : 0,
        nextSavings: closedRecordIndex >= 0 ? records[closedRecordIndex + 1]?.savings : null,
      };
    });
    expect(projectionProbe.rates).toEqual([6, 3]);
    expect(projectionProbe.firstPositiveSavings).toBeGreaterThan(0);
    expect(projectionProbe.closedSavings).toBe(0);
    expect(projectionProbe.netAssetAfterClose).toBeGreaterThan(0);
    expect(projectionProbe.nextSavings).toBe(0);
  });

  test('routes surplus to the selected non-leading investment account', async ({ page }) => {
    const projection = await page.evaluate(async () => {
      const { simulateProjection } = await import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js');
      const records = simulateProjection({
        modelVersion: 10,
        horizonYears: 1,
        annualSavingsYield: 0,
        annualIncomeGrowth: 0,
        annualExpenseGrowth: 0,
        annualInvestReturn: 0,
        annualDebtInterest: 0,
        startCash: 0,
        startSavings: 0,
        startInvest: 0,
        startDebt: 0,
        monthlyExpense: 1000000,
        monthlySavings: 0,
        monthlyInvest: 1000000,
        monthlyDebtPayment: 0,
        surplusTransferAccountId: 'acc-stock-b',
        incomes: [{
          id: 'income-main',
          name: '급여',
          amount: 5000000,
          accountId: 'acc-salary',
          allocations: [{ accountId: 'acc-salary', amount: 5000000 }],
        }],
        expenseItems: [{ id: 'rent', name: '월세', amount: 1000000, group: '고정비', accountId: 'acc-salary' }],
        savingsItems: [],
        investItems: [
          { id: 'invest-a', name: 'ETF A', amount: 500000, group: '투자', accountId: 'acc-stock-a' },
          { id: 'invest-b', name: 'ETF B', amount: 500000, group: '투자', accountId: 'acc-stock-b' },
        ],
      } as any);

      return { firstMonthInvest: records[1].invest };
    });

    expect(projection.firstMonthInvest).toBe(4000000);
  });
});

test.describe('Phase 10.6.1 final regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  async function seedFinalRegressionFlow(page: import('@playwright/test').Page) {
    await page.evaluate(async () => {
      const [
        { state },
        { sanitizeInputs },
        { buildMonthlySnapshot },
        { createRenderOrchestrator },
        { STORAGE_KEY },
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        splitIncomeAccounts: true,
        annualSavingsYield: 3,
        annualIncomeGrowth: 0,
        annualExpenseGrowth: 0,
        annualInvestReturn: 0,
        annualDebtInterest: 0,
        horizonYears: 2,
        startCash: 0,
        startSavings: 0,
        startInvest: 0,
        startDebt: 0,
        monthlyDebtPayment: 0,
        incomes: [{
          id: 'income-main',
          name: '급여',
          amount: 4200000,
          accountId: 'acc-salary',
          allocations: [
            { accountId: 'acc-salary', amount: 3000000 },
            { accountId: 'acc-living', amount: 1200000 },
          ],
        }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-saving', name: '저축계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [{ id: 'rent', name: '월세', amount: 900000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [
          { id: 'saving-main', name: '적금', amount: 500000, group: '저축', accountId: 'acc-saving', annualRate: 5, maturityMonth: '2027-03' },
          { id: 'saving-fallback', name: '비상금', amount: 300000, group: '저축', accountId: 'acc-saving' },
        ],
        investItems: [{ id: 'invest-main', name: 'ETF', amount: 400000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      window.IsfStorageHub.saveLocal(STORAGE_KEY, state.inputs);
      createRenderOrchestrator().renderAll();
    });
  }

  async function openFinancialDetail(page: import('@playwright/test').Page) {
    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    return modal;
  }

  test('keeps absorbed modal fields through apply, storage, import envelope, and Sankey refresh', async ({ page }) => {
    await seedFinalRegressionFlow(page);

    const modal = await openFinancialDetail(page);
    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await modal.locator('[data-modal-row-category="income"]').first().click();
    const income = modal.locator('.financial-modal-row--editing[data-modal-row-category="income"]');
    await income.locator('[data-income-allocation-row]').nth(0).locator('[data-income-allocation-amount]').fill('2800000');
    await income.locator('[data-income-allocation-row]').nth(1).locator('[data-income-allocation-amount]').fill('1400000');

    await modal.getByRole('tab', { name: '저축', exact: true }).click();
    const saving = modal.locator('[data-modal-row-category="savings"]').filter({ hasText: '적금' });
    await saving.click();
    const editingSaving = modal.locator('.financial-modal-row--editing[data-modal-row-category="savings"]').filter({ hasText: '적금' });
    await editingSaving.locator('[data-savings-additional-toggle]').click();
    await editingSaving.locator('[data-financial-modal-field="annualRate"]').fill('6.1');
    await editingSaving.locator('[data-financial-modal-field="maturityMonth"]').fill('2027-04');
    await modal.locator('#financialModalSave').click();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes[0].allocations).toEqual([
      { accountId: 'acc-salary', amount: 2800000 },
      { accountId: 'acc-living', amount: 1400000 },
    ]);
    expect(saved.savingsItems.find((item: any) => item.id === 'saving-main')).toMatchObject({
      annualRate: 6.1,
      maturityMonth: '2027-04',
    });
    expect(saved.savingsItems.find((item: any) => item.id === 'saving-fallback')).not.toHaveProperty('annualRate');

    const labels = await page.locator('#sankeySvg .sankey-label').evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
    expect(labels).not.toEqual(expect.arrayContaining(['급여계좌', '생활비계좌']));

    const importProbe = await page.evaluate(async (storedInputs) => {
      const [
        { SHARE_STATE_KEY, SHARE_STATE_SCHEMA },
        { normalizeExternalStep1Inputs },
        { sanitizeInputs },
        { buildSankeyData },
        { buildMonthlySnapshot, buildSavingsBuckets },
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/external-input-guard.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
      ]);
      const envelope = window.IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, storedInputs);
      const imported = window.IsfShare.parseImportedJson(JSON.stringify(envelope), SHARE_STATE_KEY);
      const normalized = sanitizeInputs(normalizeExternalStep1Inputs('json-import', imported));
      const sankey = buildSankeyData(buildMonthlySnapshot(normalized), 'group');
      const buckets = buildSavingsBuckets(normalized);
      return {
        allocations: normalized.incomes[0].allocations,
        maturityMonth: normalized.savingsItems.find((item: any) => item.id === 'saving-main')?.maturityMonth,
        annualRate: normalized.savingsItems.find((item: any) => item.id === 'saving-main')?.annualRate,
        fallbackRate: buckets.find((bucket: any) => bucket.id === 'saving-fallback')?.annualRate,
        labels: sankey.nodes.map((node: any) => node.label),
      };
    }, saved);
    expect(importProbe.allocations).toEqual(saved.incomes[0].allocations);
    expect(importProbe.maturityMonth).toBe('2027-04');
    expect(importProbe.annualRate).toBe(6.1);
    expect(importProbe.fallbackRate).toBe(3);
    expect(importProbe.labels).not.toEqual(expect.arrayContaining(['급여계좌', '생활비계좌']));
  });

  test('audits source-first cleanup markers without treating dist as source', async ({ page }) => {
    const audit = await page.evaluate(async () => {
      const files = [
        'apps/main/modules/list-renderer.js',
        'apps/main/modules/state.js',
        'apps/main/modules/state-helpers.js',
        'apps/main/modules/financial-modal-controller.js',
        'apps/main/modules/persistence-controller.js',
        'apps/main/styles.css',
        'apps/main/index.html',
      ];
      const contents = await Promise.all(files.map(async (file) => ({
        file,
        text: await fetch(`/IndividualSavingsFlowUI/${file}`).then((response) => response.text()),
      })));
      const forbiddenCopy = [
        'main editor',
        'primary editor',
        'new modal',
        'advanced editor',
        'manual transfer',
        'separate transfer rule',
        'display-only maturity',
        'global savings yield',
      ];
      const staleMarkers = [
        'itemEditors',
        'getItemEditorSignature',
        'getActiveItemEditorGroupKey',
        'renderCreatorFormHtml',
        'data-field="allocationAccountId"',
        'data-remove-editor-item',
        '.pending-bar {',
        '#editIncomeItems',
      ];
      const sourceText = contents.map((entry) => entry.text).join('\n');
      return {
        sourceFilesFetched: contents.map((entry) => entry.file),
        forbiddenCopyHits: forbiddenCopy.filter((phrase) => sourceText.toLowerCase().includes(phrase)),
        staleMarkerHits: staleMarkers.filter((marker) => sourceText.includes(marker)),
        distFetched: contents.some((entry) => entry.file.startsWith('dist/')),
      };
    });

    expect(audit.sourceFilesFetched).toContain('apps/main/styles.css');
    expect(audit.distFetched).toBe(false);
    expect(audit.forbiddenCopyHits).toEqual([]);
    expect(audit.staleMarkerHits).toEqual([]);
  });
});

test.describe('Phase 10.5 regression hardening', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  async function seedRegressionFlow(page: import('@playwright/test').Page) {
    await page.evaluate(async () => {
      const [
        { state },
        { sanitizeInputs },
        { buildMonthlySnapshot },
        { createRenderOrchestrator },
        { STORAGE_KEY },
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/constants.js'),
      ]);
      state.inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-main', name: '급여', amount: 4200000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-saving', name: '저축계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [
          { id: 'rent', name: '월세', amount: 1000000, group: '고정비', actualSpent: 111111, accountId: 'acc-living' },
          { id: 'food', name: '식비', amount: 500000, group: '변동비', actualSpent: 210000, accountId: 'acc-living' },
        ],
        savingsItems: [{ id: 'saving-main', name: '적금', amount: 600000, group: '저축', accountId: 'acc-saving' }],
        investItems: [{ id: 'invest-main', name: 'ETF', amount: 500000, group: '투자', accountId: 'acc-stock' }],
      });
      state.snapshot = buildMonthlySnapshot(state.inputs);
      window.IsfStorageHub.saveLocal(STORAGE_KEY, state.inputs);
      createRenderOrchestrator().renderAll();
    });
  }

  async function openFinancialDetail(page: import('@playwright/test').Page) {
    const modal = page.locator('#financialModal');
    await page.locator('[data-financial-settings-detail]').click();
    await expect(modal).toBeVisible();
    return modal;
  }

  async function assertForbiddenCoupleUiAbsent(page: import('@playwright/test').Page) {
    await expect(page.locator('#householdBudgetPanel')).toHaveCount(0);
    await expect(page.locator('[data-household-overview]')).toHaveCount(0);
    await expect(page.locator('.household-mode-toggle')).toHaveCount(0);
    await expect(page.locator('.household-person-tabs')).toHaveCount(0);
    await expect(page.locator('[data-household-field="spouseMonthlyIncome"]')).toHaveCount(0);
    await expect(page.getByText('부부합산', { exact: true })).toHaveCount(0);
    await expect(page.getByText('본인 설정', { exact: true })).toHaveCount(0);
    await expect(page.getByText('배우자 설정', { exact: true })).toHaveCount(0);
    await expect(page.locator('.modal-overlay:not(#financialModal):visible')).toHaveCount(0);
  }

  async function editFirstAmount(modal: import('@playwright/test').Locator, category: string, value: string) {
    await modal.locator(`[data-modal-row-category="${category}"]`).first().click();
    const row = modal.locator(`.financial-modal-row--editing[data-modal-row-category="${category}"]`).first();
    await expect(row).toBeVisible();
    await row.locator('[data-financial-modal-field="amount"]').fill(value);
  }

  test('protects integrated save/cancel, Sankey, sanitizer, duplicate, and responsive contracts', async ({ page }) => {
    await seedRegressionFlow(page);
    await assertForbiddenCoupleUiAbsent(page);

    let modal = await openFinancialDetail(page);
    for (const label of ['월 수입', '월 생활비', '투자', '저축', '결과/자동 저축']) {
      await modal.getByRole('tab', { name: label, exact: true }).click();
      await expect(modal.locator('[data-financial-detail-rail]')).toBeVisible();
      await assertForbiddenCoupleUiAbsent(page);
    }

    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await editFirstAmount(modal, 'income', '5000000');

    await modal.getByRole('tab', { name: '월 생활비', exact: true }).click();
    const variableRow = modal.locator('[data-financial-variable-row]').filter({ hasText: '식비' });
    await variableRow.click();
    await modal.locator('[data-financial-modal-field="amount"]').fill('550000');
    await modal.locator('[data-financial-modal-field="varianceAmount"]').fill('80000');
    await expect(modal.locator('[data-financial-variable-detail]')).not.toContainText('월말 예상');
    await expect(modal.locator('[data-financial-modal-field="actualSpent"]')).toHaveCount(0);
    await expect(modal.locator('[data-financial-fixed-row]').filter({ hasText: '월세' }).locator('[data-financial-modal-field="varianceAmount"]')).toHaveCount(0);

    await modal.getByRole('tab', { name: '투자', exact: true }).click();
    await editFirstAmount(modal, 'invest', '4000000');
    await expect(modal.locator('[data-financial-overbudget-action]')).toBeVisible();
    await modal.locator('#financialModalSave').click();
    await expect(modal.locator('[data-financial-adjustment-feedback]')).toContainText('조정 방식을 선택');
    await modal.locator('[data-financial-adjustment-choice]').filter({ hasText: '투자 먼저 줄이기' }).click();
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();

    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(5000000);
    expect(saved.expenseItems.find((item: any) => item.id === 'food')).toMatchObject({ amount: 550000, actualSpent: 210000, varianceAmount: 80000 });
    expect(saved.expenseItems.find((item: any) => item.id === 'rent')).not.toHaveProperty('actualSpent');
    expect(saved.expenseItems.find((item: any) => item.id === 'rent')).not.toHaveProperty('varianceAmount');
    expect(saved.savingsItems.map((item: any) => item.id)).toEqual(['saving-main']);
    expect(saved.investItems.map((item: any) => item.id)).toEqual(['invest-main']);
    expect(saved.investItems[0].amount).toBe(2850000);

    await assertForbiddenCoupleUiAbsent(page);
    const order = await page.evaluate(() => {
      const cards = document.querySelector('#summaryCards');
      const sankey = document.querySelector('.sankey-panel');
      return Boolean(cards && sankey && cards.compareDocumentPosition(sankey) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
    const labels = await page.locator('#sankeySvg .sankey-label').evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
    expect(labels).toEqual(expect.arrayContaining(['총수입', '고정비(고정지출)', '저축', '투자']));
    expect(labels).not.toEqual(expect.arrayContaining(['급여계좌', '생활비계좌', '투자계좌']));
    expect(labels.filter((label) => label.includes('적금')).length).toBeLessThanOrEqual(1);
    expect(labels.filter((label) => label.includes('ETF')).length).toBeLessThanOrEqual(1);

    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await editFirstAmount(modal, 'income', '5010000');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeVisible();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(saved.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(5010000);
    expect(saved.expenseItems.filter((item: any) => item.id === 'food')).toHaveLength(1);
    expect(saved.savingsItems.filter((item: any) => item.id === 'saving-main')).toHaveLength(1);
    expect(saved.investItems.filter((item: any) => item.id === 'invest-main')).toHaveLength(1);

    await modal.getByRole('tab', { name: '월 수입', exact: true }).click();
    await editFirstAmount(modal, 'income', '6000000');
    await modal.locator('#financialModalCancel').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalPendingBar')).toBeHidden();
    const afterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(afterCancel.incomes.find((item: any) => item.id === 'income-main')?.amount).toBe(5010000);
    await assertForbiddenCoupleUiAbsent(page);
  });

  test('keeps every financial detail tab contained on desktop, tablet, and mobile', async ({ page }) => {
    await seedRegressionFlow(page);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);
      const modal = await openFinancialDetail(page);

      for (const label of ['월 수입', '월 생활비', '투자', '저축', '결과/자동 저축']) {
        await modal.getByRole('tab', { name: label, exact: true }).click();
        await page.waitForTimeout(80);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${label} tab should not create document overflow at ${viewport.width}px`).toBeLessThanOrEqual(4);
        const contained = await modal.evaluate((element) => {
          const nodes = [
            element.querySelector('[data-financial-detail-tabs]'),
            element.querySelector('[data-financial-detail-rail]'),
            element.querySelector('[data-financial-detail-panel]'),
          ].filter(Boolean);
          return nodes.every((node) => node.scrollWidth <= node.clientWidth + 4);
        });
        expect(contained, `${label} tab content should fit modal at ${viewport.width}px`).toBe(true);
      }

      await assertForbiddenCoupleUiAbsent(page);
      await modal.locator('#financialModalClose').click();
      await expect(modal).toBeHidden();
    }
  });
});

test.describe('Phase 09 final responsive user flow coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('apps/main/index.html');
    await page.waitForSelector('main');
  });

  test('keeps summary-first Sankey workflow usable without horizontal overflow', async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);

      await expect(page.locator('[data-financial-summary-group="core-metrics"]')).toContainText('년 후 순자산');
      await expect(page.locator('[data-financial-summary-group="core-metrics"]')).toContainText('미래자산 투입률');
      await expect(page.locator('[data-financial-summary-group="outflow"]')).toContainText('지출');
      await expect(page.locator('[data-financial-category]')).toHaveCount(3);

      const summaryBox = await page.locator('.summary-panel').boundingBox();
      const sankeyBox = await page.locator('.sankey-panel').boundingBox();
      expect(summaryBox).not.toBeNull();
      expect(sankeyBox).not.toBeNull();
      expect(sankeyBox!.y).toBeGreaterThan(summaryBox!.y);

      await expect(page.locator('#sankeyCorrectionRefresh')).toBeHidden();
      await page.locator('#showSankeyBasicBtn').click();
      await page.waitForTimeout(150);
      await expect(page.locator('#showSankeyBasicBtn')).toHaveClass(/is-active/);
      const basicLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
        labels.map((label) => label.textContent || '')
      );
      expect(basicLabels).toContain('총수입');
      expect(basicLabels.some((label) => label.includes('월급'))).toBe(false);

      await page.locator('#showSankeyDetailBtn').click();
      await page.locator('#sankeyGroupingExpense').selectOption('detail');
      await page.waitForTimeout(250);
      const detailLabels = await page.locator('#sankeySvg .sankey-label').evaluateAll((labels) =>
        labels.map((label) => label.textContent || '')
      );
      expect(detailLabels.some((label) => label.includes('주거비'))).toBe(true);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `no page overflow at ${viewport.width}px`).toBeLessThanOrEqual(4);
    }
  });
});

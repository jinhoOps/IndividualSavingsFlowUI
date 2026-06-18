import { test, expect } from '@playwright/test';

async function openControlsPanel(page: import('@playwright/test').Page) {
  const toggleButton = page.locator('#toggleControlsBtn');
  if (await toggleButton.getAttribute('aria-expanded') === 'false') {
    await toggleButton.click();
  }
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
    await page.locator('#mgmtTabSettings').click();
    await page.waitForTimeout(100);
    await expect(page.locator('#ratesAdvancedBlock')).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('중립형 연봉 5,000만 원');
      await dialog.accept();
    });
    await page.locator('#resetInputs').click();
    await expect(page.locator('#applyFeedback')).toContainText('중립형 연봉 5,000만 원');

    const savedInputs = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(savedInputs.incomes?.[0]?.amount).toBe(3550000);
    expect(savedInputs.startCash).toBe(1000000);
    expect(savedInputs.startSavings).toBe(40000000);
    expect(savedInputs.startInvest).toBe(10000000);
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
    await page.locator('#mgmtTabSettings').click();

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

    await page.locator('#mgmtTabFlow').click();
    const groupNames = await page.locator('#expenseAdvancedBlock .allocation-group__name').evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
    expect(groupNames).toEqual(expect.arrayContaining(['공과금', '통신비', '교통비', '식비', '여행', '취미']));
    expect(await page.locator('#savingsAdvancedBlock .allocation-group__name').first().textContent()).toContain('저축');
    expect(await page.locator('#investAdvancedBlock .allocation-group__name').first().textContent()).toContain('투자');
    expect(await page.locator('#expenseAdvancedBlock .allocation-group').count()).toBeGreaterThan(1);
    const utilityGroup = page.locator('#expenseAdvancedBlock .allocation-group').filter({ hasText: '공과금' }).first();
    await expect(utilityGroup).toBeVisible();
    if (await utilityGroup.locator('.allocation-group__items').isVisible()) {
      await utilityGroup.locator('summary').click();
    }
    await expect(utilityGroup.locator('.allocation-group__items')).not.toBeVisible();
    await utilityGroup.locator('summary').click();
    await expect(utilityGroup.locator('.allocation-group__items')).toBeVisible();
    await utilityGroup.locator('summary').click();
    await expect(utilityGroup.locator('.allocation-group__items')).not.toBeVisible();
  });

  test('Phase 07 controller modules expose focused interfaces', async ({ page }) => {
    const contracts = await page.evaluate(async () => {
      const [
        eventBindings,
        persistenceController,
        renderOrchestrator,
        visualizationController,
        itemEditorController,
      ] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/event-bindings.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/persistence-controller.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/render-orchestrator.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/visualization-controller.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/item-editor-controller.js'),
      ]);

      const source = await fetch('/IndividualSavingsFlowUI/apps/main/modules/bootstrap-controller.js').then((response) => response.text());
      return {
        exports: {
          bindStep1Events: typeof eventBindings.bindStep1Events,
          createPersistenceController: typeof persistenceController.createPersistenceController,
          createRenderOrchestrator: typeof renderOrchestrator.createRenderOrchestrator,
          createVisualizationController: typeof visualizationController.createVisualizationController,
          createItemEditorController: typeof itemEditorController.createItemEditorController,
        },
        bootstrapLineCount: source.split(/\r?\n/).length,
        blockedBodies: /function (bindControls|bindVisualizationAndTooltipEvents|renderAll|commitImmediateInputs|handleHashChange|applyItemEditor)\b/.test(source),
      };
    });

    expect(contracts.exports).toEqual({
      bindStep1Events: 'function',
      createPersistenceController: 'function',
      createRenderOrchestrator: 'function',
      createVisualizationController: 'function',
      createItemEditorController: 'function',
    });
    expect(contracts.bootstrapLineCount).toBeLessThanOrEqual(350);
    expect(contracts.blockedBodies).toBe(false);
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
    expect(optionInfo.some((option) => option.value?.includes('<img'))).toBe(true);
    expect(await page.evaluate(() => Boolean((window as any).__unsafeGroupOption))).toBe(false);
  });

  test('Phase 07 account select options escape imported account ids and names', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const unsafeWindow = window as any;
      unsafeWindow.__unsafeAccountOption = false;
      unsafeWindow.__unsafeAccountName = false;
      const maliciousAccountId = `acc"></option><img src=x onerror="window.__unsafeAccountOption = true"><option value="tail`;
      const maliciousAccountName = `계좌"><img src=x onerror="window.__unsafeAccountName = true">`;
      const [{ state }, { renderItemList }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/list-renderer.js'),
      ]);

      state.inputs.accounts = [{ id: maliciousAccountId, name: maliciousAccountName }];
      renderItemList('income', [{
        id: 'income-malicious-account',
        name: '수입',
        amount: 10000,
        accountId: maliciousAccountId,
        allocations: [{ accountId: maliciousAccountId, amount: 10000 }],
      }], { editing: true });
      renderItemList('expense', [{
        id: 'expense-malicious-account',
        name: '지출',
        amount: 10000,
        group: '테스트',
        accountId: maliciousAccountId,
      }], { editing: true });

      const incomeSelect = document.querySelector<HTMLSelectElement>('#incomeList select[data-field="allocationAccountId"]');
      const expenseSelect = document.querySelector<HTMLSelectElement>('#expenseList select[data-field="accountId"]');
      return {
        incomeOptionCount: incomeSelect?.querySelectorAll('option').length ?? 0,
        expenseOptionCount: expenseSelect?.querySelectorAll('option').length ?? 0,
        incomeValue: incomeSelect?.value ?? '',
        expenseValue: expenseSelect?.value ?? '',
        incomeText: incomeSelect?.selectedOptions[0]?.textContent ?? '',
        expenseText: expenseSelect?.selectedOptions[0]?.textContent ?? '',
        incomeMarkup: incomeSelect?.innerHTML ?? '',
        expenseMarkup: expenseSelect?.innerHTML ?? '',
        injectedImages: document.querySelectorAll('#incomeList img, #expenseList img').length,
        unsafeFlag: Boolean(unsafeWindow.__unsafeAccountOption || unsafeWindow.__unsafeAccountName),
      };
    });

    expect(result.incomeOptionCount).toBe(2);
    expect(result.expenseOptionCount).toBe(2);
    expect(result.incomeValue).toContain('<img');
    expect(result.expenseValue).toContain('<img');
    expect(result.incomeText).toContain('<img');
    expect(result.expenseText).toContain('<img');
    expect(result.incomeMarkup).not.toMatch(/<img/i);
    expect(result.expenseMarkup).not.toMatch(/<img/i);
    expect(result.injectedImages).toBe(0);
    expect(result.unsafeFlag).toBe(false);
  });

  test('Phase 07 allocation groups preserve user open state after render refresh', async ({ page }) => {
    await openControlsPanel(page);
    await page.locator('#mgmtTabFlow').click();
    const utilityGroup = page.locator('#expenseAdvancedBlock .allocation-group').filter({ hasText: '공과금' }).first();
    await expect(utilityGroup).toBeVisible();

    const summary = utilityGroup.locator('.allocation-group__summary');
    if (await utilityGroup.evaluate((element) => (element as HTMLDetailsElement).open)) {
      await summary.click();
    }
    await expect(utilityGroup.locator('.allocation-group__items')).not.toBeVisible();
    await page.locator('#expenseSortMode').selectOption('amount-desc');
    await page.waitForTimeout(250);
    await expect(utilityGroup.locator('.allocation-group__items')).not.toBeVisible();

    await summary.click();
    await expect(utilityGroup.locator('.allocation-group__items')).toBeVisible();
    await page.locator('#expenseSortMode').selectOption('name-asc');
    await page.waitForTimeout(250);
    await expect(utilityGroup.locator('.allocation-group__items')).toBeVisible();
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

  test('builds Sankey links around mandatory total-income node', async ({ page }) => {
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
        totalToAccount: sankey?.links.some((link: { source: string; target: string }) =>
          link.source === 'total-income' && link.target === 'acc-salary'
        ),
        accountToExpense: sankey?.links.some((link: { source: string; target: string }) =>
          link.source === 'acc-living' && link.target === 'expense-rent'
        ),
        labels: sankey?.nodes.map((node: { label: string }) => node.label) || [],
      };
    });

    expect(result.totalIncomeNode).toMatchObject({ id: 'total-income', label: '총수입', tone: 'income' });
    expect(result.incomeToTotal).toBe(true);
    expect(result.totalToAccount).toBe(true);
    expect(result.accountToExpense).toBe(true);
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

  test('Phase 09 manual Sankey account correction refresh repairs visible state', async ({ page }) => {
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
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    await expect(page.locator('#sankeyCorrectionStatus')).toContainText('보정');
    const savedInputs = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    expect(savedInputs.expenseItems?.[0]?.accountId).toBe('acc-living');
    await expect(page.locator('#sankeySvg .sankey-label')).toContainText(['총수입']);
    await expect(page.locator('#sankeySvg')).not.toContainText('미지정 계좌');
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
    expect(basicLabels).toEqual(expect.arrayContaining(['총수입', '급여계좌', '생활비계좌', '투자계좌', '고정비(고정지출)', '저축', '투자']));
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
    await expect(modal.locator('input[data-preset-percent="expense"]')).toHaveValue('42');
    await expect(modal.locator('input[data-preset-percent="savings"]')).toHaveValue('18');
    await expect(modal.locator('input[data-preset-percent="invest"]')).toHaveValue('40');

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

  test('builds and renders two summary groups with five category cards before Sankey', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const [{ buildFinancialSummaryGroups }, { renderFinancialSummaryGroups }, { sanitizeInputs }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/main/modules/financial-summary.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/financial-summary-renderer.js'),
        import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
      ]);
      const inputs = sanitizeInputs({
        modelVersion: 10,
        incomes: [{ id: 'income-test', name: '급여', amount: 3000000, accountId: 'acc-salary' }],
        accounts: [
          { id: 'acc-salary', name: '급여계좌' },
          { id: 'acc-living', name: '생활비계좌' },
          { id: 'acc-stock', name: '투자계좌' },
        ],
        expenseItems: [{ id: 'rent', name: '월세', amount: 800000, group: '고정비', accountId: 'acc-living' }],
        savingsItems: [{ id: 'saving', name: '청년적금', amount: 300000, group: '저축', accountId: 'acc-salary' }],
        investItems: [{ id: 'invest', name: 'ETF', amount: 200000, group: '투자', accountId: 'acc-stock' }],
      });
      const groups = buildFinancialSummaryGroups(inputs);
      const host = document.querySelector('#summaryCards');
      renderFinancialSummaryGroups(host, groups);
      const cardButtons = Array.from(document.querySelectorAll('[data-financial-category]'));
      const summaryPanel = document.querySelector('.summary-panel');
      const sankeyPanel = document.querySelector('.sankey-panel');
      return {
        groupTitles: groups.map((group: any) => group.title),
        categoryLabels: groups.flatMap((group: any) => group.cards.map((card: any) => card.label)),
        firstCard: groups[0].cards[0],
        cardCategories: cardButtons.map((button) => (button as HTMLElement).dataset.financialCategory),
        cardRoles: cardButtons.map((button) => button.getAttribute('role') || button.tagName.toLowerCase()),
        summaryBeforeSankey: Boolean(summaryPanel && sankeyPanel && summaryPanel.compareDocumentPosition(sankeyPanel) & Node.DOCUMENT_POSITION_FOLLOWING),
        renderedText: host?.textContent || '',
      };
    });

    expect(result.groupTitles).toEqual(['수입+계좌', '지출+저축+투자']);
    expect(result.categoryLabels).toEqual(['수입', '계좌', '지출', '저축', '투자']);
    expect(result.firstCard).toMatchObject({ category: 'income', label: '수입', count: 1, total: 3000000 });
    expect(result.firstCard.representatives).toEqual(expect.arrayContaining([expect.stringContaining('급여')]));
    expect(result.cardCategories).toEqual(['income', 'account', 'expense', 'savings', 'invest']);
    expect(result.cardRoles.every((role: string) => role === 'button')).toBe(true);
    expect(result.summaryBeforeSankey).toBe(true);
    expect(result.renderedText).toContain('월세');
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

  test('opens category modal for card detail editing and saves only after explicit confirm', async ({ page }) => {
    await page.locator('[data-financial-category="expense"]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#financialModalTitle')).toContainText('지출');
    await expect(modal.locator('[data-modal-row-category="expense"]').first()).toContainText('주거비');
    await expect(modal.locator('.financial-modal-account-badge').first()).toBeVisible();

    const firstName = modal.locator('[data-financial-modal-field="name"]').first();
    await firstName.fill('주거비 수정');
    await modal.locator('#financialModalCancel').click();
    await expect(modal).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}').expenseItems?.[0]?.name || '')).not.toBe('주거비 수정');

    await page.locator('[data-financial-category="expense"]').click();
    await modal.locator('[data-financial-modal-field="name"]').first().fill('주거비 수정');
    await modal.locator('#financialModalSave').click();
    await expect(modal).toBeHidden();

    const savedName = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}').expenseItems?.[0]?.name);
    expect(savedName).toBe('주거비 수정');
    await expect(page.locator('[data-financial-category="expense"]')).toContainText('주거비 수정');
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

  test('creates a new investment item with an inline account and final confirmation', async ({ page }) => {
    await page.locator('[data-financial-category="invest"]').click();
    const modal = page.locator('#financialModal');
    await expect(modal).toBeVisible();
    await modal.locator('#financialModalCreate').click();

    await expect(modal.locator('[data-create-step="details"]')).toBeVisible();
    await expect(modal.locator('#financialCreateAccountSelect')).toHaveValue('acc-stock');
    await modal.locator('[data-create-field="name"]').fill('테스트 ETF');
    await modal.locator('[data-create-field="amount"]').fill('100000');
    await modal.locator('[data-create-field="group"]').fill('투자');
    await modal.locator('#financialCreateNewAccountToggle').click();
    await modal.locator('[data-create-field="accountName"]').fill('연금계좌');
    await modal.locator('#financialCreateReview').click();

    const confirm = modal.locator('#financialCreateConfirm');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('테스트 ETF');
    await expect(confirm).toContainText('10만 원');
    await expect(confirm).toContainText('연금계좌');
    await expect(confirm).toContainText('투자');
    await modal.locator('#financialCreateSave').click();
    await expect(modal).toBeHidden();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}'));
    const createdAccount = saved.accounts.find((account: any) => account.name === '연금계좌');
    const createdItem = saved.investItems.find((item: any) => item.name === '테스트 ETF');
    expect(createdAccount).toBeTruthy();
    expect(createdItem).toMatchObject({ amount: 100000, group: '투자', accountId: createdAccount.id });
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

    const pathCount = await page.locator('#sankeySvg .sankey-path').count();
    let tooltipText = '';
    for (let index = 0; index < pathCount; index += 1) {
      const path = page.locator('#sankeySvg .sankey-path').nth(index);
      const box = await path.boundingBox();
      if (!box) continue;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const text = await page.locator('#sankeyTooltip').textContent();
      if (text?.includes('월세 <b>') && text.includes('관리비 & 공과금')) {
        tooltipText = text;
        break;
      }
    }

    expect(tooltipText).toContain('구성:');
    expect(tooltipText).toMatch(/구성:\n월세 <b> .*?\n관리비 & 공과금 /);
    expect(tooltipText).not.toContain(', 관리비');
    const tooltipMarkup = await page.locator('#sankeyTooltip').evaluate((element) => element.innerHTML);
    expect(tooltipMarkup).not.toContain('<b>');
    const whiteSpace = await page.locator('#sankeyTooltip').evaluate((element) => window.getComputedStyle(element).whiteSpace);
    expect(whiteSpace).toBe('pre-line');
  });
});

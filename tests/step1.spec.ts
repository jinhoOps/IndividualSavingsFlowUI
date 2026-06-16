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
});

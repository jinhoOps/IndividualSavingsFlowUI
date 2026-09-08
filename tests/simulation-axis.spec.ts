import { expect, test } from '@playwright/test';

const updatedAt = Date.UTC(2026, 8, 8);
const main = {
  schemaVersion: 2,
  updatedAt,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 800_000,
};

for (const years of [3, 20, 30]) {
  test(`${years}-year chart keeps readable, contained axis labels while resizing`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(({ main, years, updatedAt }) => {
      localStorage.setItem('isf-workspace-v4', JSON.stringify({
        schemaVersion: 4,
        revision: 1,
        updatedAt,
        main: { applied: main, setupProgress: null },
        simulation: {
          draft: {
            schemaVersion: 3,
            source: {
              monthlySavingsWon: main.monthlySavingWon,
              monthlyInvestmentWon: main.monthlyInvestmentWon,
              mainUpdatedAt: updatedAt,
            },
            initialInvestmentWon: 0,
            targetAmountWon: 100_000_000,
            years,
            expectedAnnualReturnPercent: 7,
            baseRatePercent: 2.75,
            inflationOffsetPercentPoints: -0.25,
            amountMode: 'nominal',
            updatedAt,
          },
        },
        portfolio: { plans: [], draft: null },
        locations: [],
        accountMap: { applied: null, draft: null },
      }));
    }, { main, years, updatedAt });
    await page.goto('apps/simulation/');
    const chart = page.getByRole('img', { name: '기간별 복리 성장 그래프' });
    await expect(chart).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const originalPaths = await chart.locator('.growth-chart__semantic-path')
      .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));

    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(async () => chart.locator('text').evaluateAll((labels) => (
        Math.min(...labels.map((label) => label.getBoundingClientRect().height))
      )), `${width}px axis labels must remain at least 12 CSS pixels tall`).toBeGreaterThanOrEqual(12);
      await expect.poll(async () => chart.locator('text').evaluateAll((labels) => (
        Math.max(...labels.map((label) => {
          const matrix = (label as SVGTextElement).getScreenCTM()!;
          return Number.parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.a, matrix.b);
        }))
      )), `${width}px axis labels must settle at a readable size after resizing`).toBeLessThanOrEqual(14);

      const axes = await chart.evaluate((svg) => {
        const bounds = svg.getBoundingClientRect();
        return Array.from(svg.querySelectorAll<SVGTextElement>('text')).map((text) => {
          const label = text.getBoundingClientRect();
          const matrix = text.getScreenCTM()!;
          return {
            text: text.textContent,
            fontSize: Number.parseFloat(getComputedStyle(text).fontSize) * Math.hypot(matrix.a, matrix.b),
            left: label.left - bounds.left,
            right: label.right - bounds.right,
            top: label.top - bounds.top,
            bottom: label.bottom - bounds.bottom,
          };
        });
      });
      for (const label of axes) {
        expect(label.fontSize, `${width}px ${label.text}`).toBeGreaterThanOrEqual(12);
        expect(label.fontSize, `${width}px ${label.text}`).toBeLessThanOrEqual(14);
        expect(label.left, `${width}px ${label.text}`).toBeGreaterThanOrEqual(-1);
        expect(label.right, `${width}px ${label.text}`).toBeLessThanOrEqual(1);
        expect(label.top, `${width}px ${label.text}`).toBeGreaterThanOrEqual(-1);
        expect(label.bottom, `${width}px ${label.text}`).toBeLessThanOrEqual(1);
      }
      await expect(chart.locator('.growth-chart__x-tick').first()).toHaveText('현재');
      await expect(chart.locator('.growth-chart__x-tick').last()).toHaveText(`${years}년`);
      expect(await chart.locator('.growth-chart__semantic-path')
        .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')))).toEqual(originalPaths);
      await page.locator('.growth-chart').screenshot({
        path: testInfo.outputPath(`simulation-axis-${years}years-${width}px.png`),
      });
    }
  });
}

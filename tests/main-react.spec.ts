import { expect, test } from '@playwright/test';

test('new user completes setup and sees summary', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '내 자금 계획을 시작합니다' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('수입 이름').fill('급여');
  await page.getByLabel('월 금액').fill('4200000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('생활비 이름').fill('생활비');
  await page.getByLabel('월 금액').fill('1800000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 저축 금액').fill('700000');
  await page.getByLabel('월 투자 금액').fill('500000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('계좌 이름').fill('급여통장');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '계획 적용' }).click();

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByText('투자 가능액')).toBeVisible();
});

import {expect, test, type BrowserContext} from '@playwright/test';
import {createEmptyWorkspace, type WorkspaceDocument} from '../src/workspace/domain/model';
import {workspacePayload} from '../src/workspace/infrastructure/workspaceRemote';

const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function plan(income = 3200000): WorkspaceDocument {
  return {...createEmptyWorkspace(1000), main: {applied: {
    schemaVersion: 2, updatedAt: 1000, monthlyNetIncomeWon: income, monthlyHousingWon: 800000,
    monthlyLivingWon: 1000000, monthlySavingWon: 300000, monthlyInvestmentWon: 200000,
  }, setupProgress: null}};
}
function mappedPlan(): WorkspaceDocument {
  return {...plan(), locations: [{id: 'living', shortName: '생활비통장', institution: {id: 'toss-bank', name: '토스뱅크'},
    kind: 'bank', roles: ['spending'], createdAt: 1000, updatedAt: 1000}],
    accountMap: {draft: null, applied: {schemaVersion: 2, sourceMainUpdatedAt: 1000, customPurposes: [],
      links: [{id: 'living', purposeId: 'system:living', locationId: 'living', monthlyAmountWon: 1000000,
        remainder: true, status: 'active', createdAt: 1000, updatedAt: 1000}], setupCompletedAt: 1000, updatedAt: 1000}}};
}
function fakeServer() {
  const rows = new Map<string, WorkspaceDocument>();
  const receipts = new Map<string, unknown>();
  let failRead = false;
  let failWrite = false;
  let loseResponse = false;
  const operations: string[] = [];
  const row = (user: string, workspace: WorkspaceDocument) => ({user_id: user, schema_version: 3,
    revision: workspace.revision, payload: workspacePayload(workspace), updated_at: new Date(workspace.updatedAt).toISOString(), created_at: new Date(1000).toISOString()});
  async function attach(context: BrowserContext, user: string | null) {
    if (user) await context.addInitScript(({user}) => {
      const key = 'sb-isf-test-auth-token';
      if (sessionStorage.getItem('test-auth-initialized')) return;
      localStorage.setItem(key, JSON.stringify({access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {id: user, aud: 'authenticated', role: 'authenticated', email: `${user.slice(0, 1)}@example.com`, app_metadata: {provider: 'google'}, user_metadata: {}, created_at: '2026-09-07T00:00:00Z'}}));
      sessionStorage.setItem('test-auth-initialized', '1');
    }, {user});
    await context.route('https://isf-test.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/auth/')) {
        await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({id: user})}); return;
      }
      if (!user) {await route.fulfill({status: 401, body: '{}'}); return;}
      const current = rows.get(user);
      if (url.pathname === '/rest/v1/user_workspaces') {
        if (failRead) {await route.fulfill({status: 400, json: {message: 'fixture read unavailable'}}); return;}
        await route.fulfill({json: current ? [row(user, current)] : []}); return;
      }
      const operation = url.pathname.split('/').at(-1)!;
      operations.push(operation);
      if (failWrite) {await route.abort('failed'); return;}
      const request = route.request().postDataJSON();
      const receiptKey = `${user}:${request.p_mutation_id}`;
      if (receipts.has(receiptKey)) {await route.fulfill({json: receipts.get(receiptKey)}); return;}
      if (operation === 'initialize_workspace' && current) {await route.fulfill({json: {status: 'exists', workspace: row(user, current)}}); return;}
      if (operation !== 'initialize_workspace' && current?.revision !== request.p_expected_revision) {
        await route.fulfill({json: {status: 'conflict', workspace: row(user, current!)}}); return;
      }
      const next = {...(current ?? createEmptyWorkspace()), ...request.p_payload, revision: current ? current.revision + 1 : 0, updatedAt: Date.now()};
      rows.set(user, next);
      const result = {status: 'saved', workspace: row(user, next), committed_revision: next.revision};
      receipts.set(receiptKey, result);
      if (loseResponse) {loseResponse = false; await route.abort('failed'); return;}
      await route.fulfill({json: result});
    });
  }
  return {rows, operations, attach, setFailRead(value: boolean) {failRead = value;}, setFailWrite(value: boolean) {failWrite = value;}, loseNextResponse() {loseResponse = true;}};
}

for (const width of [390, 768, 1280]) {
  test(`Google sign-in and first plan choice remain usable at ${width}px`, async ({page, context}) => {
    const server = fakeServer();
    await server.attach(context, null);
    await page.setViewportSize({width, height: 900});
    await page.goto('apps/main/');
    const google = page.getByRole('button', {name: 'Google로 계속하기'});
    await expect(google).toBeVisible();
    await google.focus(); await expect(google).toBeFocused();
    expect((await google.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    await page.screenshot({path: `test-results/cloud-login-${width}.png`, fullPage: true});
  });
}

test('imports this browser only after explicit choice and preserves its original', async ({page, context}) => {
  const server = fakeServer(); await server.attach(context, userA);
  await page.addInitScript(workspace => localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace)), plan());
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '이 브라우저 계획 가져오기'})).toBeVisible();
  expect(server.rows.has(userA)).toBe(false);
  await page.getByRole('button', {name: '이 브라우저 계획 가져오기'}).click();
  await expect(page.getByRole('button', {name: '월 소비 편집'})).toBeVisible();
  expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(3200000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-workspace-v3')!).revision)).toBe(0);
});

test('two browsers share edits and another Google account keeps its own plan', async ({browser, page, context, baseURL}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); server.rows.set(userB, plan(5000000));
  const second = await browser.newContext({baseURL}); const third = await browser.newContext({baseURL});
  try {
    await server.attach(context, userA); await server.attach(second, userA); await server.attach(third, userB);
    const other = await second.newPage(); const different = await third.newPage();
    await page.goto('apps/main/'); await other.goto('apps/main/'); await different.goto('apps/main/');
    await expect(other.getByRole('button', {name: '월 소비 편집'})).toContainText('180만 원');
    await page.getByRole('button', {name: '월 소비 편집'}).click();
    await page.getByLabel('월평균 생활비').fill('1100000');
    await page.getByRole('button', {name: '적용', exact: true}).click();
    await expect(page.getByRole('button', {name: '월 소비 편집'})).toContainText('190만 원');
    await other.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(other.getByRole('button', {name: '월 소비 편집'})).toContainText('190만 원');
    expect(server.rows.get(userB)?.main.applied?.monthlyLivingWon).toBe(1000000);
    await expect(different.getByRole('button', {name: '월 소비 편집'})).toContainText('180만 원');
    expect(server.operations).toContain('save_main');
  } finally {await second.close(); await third.close();}
});

test('lost save response retries once without applying the same edit twice', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1200000');
  server.loseNextResponse();
  await page.getByRole('button', {name: '적용', exact: true}).click();
  await expect(page.getByRole('button', {name: '저장 결과 다시 확인'})).toBeVisible();
  expect(server.rows.get(userA)?.revision).toBe(1);
  await page.getByRole('button', {name: '저장 결과 다시 확인'}).click();
  await expect(page.getByRole('button', {name: '월 소비 편집'})).toContainText('200만 원');
  expect(server.rows.get(userA)?.revision).toBe(1);
});

test('a concurrent edit retains input and requires explicit reapply', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1400000');
  const newer = plan(); newer.revision = 2; newer.main.applied!.monthlyHousingWon = 900000;
  server.rows.set(userA, newer);
  await page.getByRole('button', {name: '적용', exact: true}).click();
  await expect(page.getByRole('button', {name: '최신 상태에서 다시 적용'})).toBeVisible();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,400,000');
  expect(server.rows.get(userA)?.revision).toBe(2);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: '최신 상태에서 다시 적용'}).click();
  await expect(page.getByRole('button', {name: '월 소비 편집'})).toContainText('220만 원');
  expect(server.rows.get(userA)?.revision).toBe(3);
});

test('all four authenticated product entries fit mobile and use the account workspace', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({width, height: 900});
    for (const app of ['main', 'simulation', 'portfolio', 'account-map']) {
      await page.goto(`apps/${app}/`);
      await expect(page.getByTestId('app-shell')).toBeVisible();
      await expect(page.getByRole('button', {name: '내 계정', exact: true})).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path: `test-results/cloud-${app}-${width}.png`, fullPage: true});
    }
  }
  expect(server.operations.every(op => ['save_portfolio', 'save_simulation', 'save_account_map'].includes(op))).toBe(true);
});

test('read failure offers recovery rather than a new workspace', async ({page, context}) => {
  const server = fakeServer(); server.setFailRead(true); await server.attach(context, userA);
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '다시 불러오기'})).toBeVisible();
  await expect(page.getByRole('button', {name: '새로 시작', exact: true})).toHaveCount(0);
  expect(server.operations).toEqual([]);
});

test('static callback refresh scrubs OAuth errors and exposes a safe return link', async ({page}) => {
  await page.goto('apps/auth/callback/?error=access_denied&error_description=private');
  await expect(page.getByRole('link', {name: '로그인 화면으로 돌아가기'})).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  await page.reload();
  await expect(page.getByRole('link', {name: '로그인 화면으로 돌아가기'})).toHaveAttribute('href', '/IndividualSavingsFlowUI/apps/main/');
});

test('unsent Main input survives reload without changing the server', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1300000');
  await page.reload();
  await expect(page.getByText('이 계정에서 보내지 못한 입력을 복구했습니다.', {exact: false})).toBeVisible();
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,300,000');
  expect(server.operations).toEqual([]);
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1000000);
});

test('an authenticated offline revisit is read-only and does not upload cached data', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '월 소비 편집'})).toBeVisible();
  server.setFailRead(true);
  await page.reload();
  await expect(page.getByText('오프라인 · 마지막 저장 계획')).toBeVisible();
  await expect(page.getByRole('button', {name: '월 소비 편집'})).toBeDisabled();
  expect(server.operations).toEqual([]);
});

test('first creation race uses the existing server plan without marking a local import complete', async ({page, context}) => {
  const server = fakeServer(); await server.attach(context, userA);
  await page.addInitScript(workspace => localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace)), plan());
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '이 브라우저 계획 가져오기'})).toBeVisible();
  server.rows.set(userA, plan(6000000));
  await page.getByRole('button', {name: '이 브라우저 계획 가져오기'}).click();
  await expect(page.getByText('다른 기기에서 먼저 계획을 만들었습니다.', {exact: false})).toBeVisible();
  expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(6000000);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('isf-account-imported:')))).toBe(false);
});

test('local logout clears both tabs and account caches but preserves the migration source', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.addInitScript(workspace => localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace)), plan());
  const second = await context.newPage();
  await page.goto('apps/main/'); await second.goto('apps/main/');
  await expect(second.getByRole('button', {name: '월 소비 편집'})).toBeVisible();
  await page.getByRole('button', {name: '내 계정', exact: true}).click();
  await page.getByRole('button', {name: '이 브라우저에서 로그아웃'}).click();
  await expect(page.getByRole('button', {name: 'Google로 계속하기'})).toBeVisible();
  await expect(second.getByRole('button', {name: 'Google로 계속하기'})).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('isf-account-workspace-v1:')))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('isf-workspace-v3'))).not.toBeNull();
  await second.close();
});

test('a duplicated tab polling does not overwrite unsent input recovery', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '월 소비 편집'})).toBeVisible();
  const copiedId = await page.evaluate(() => sessionStorage.getItem('isf-account-tab-id'));
  const second = await context.newPage();
  await second.addInitScript(id => sessionStorage.setItem('isf-account-tab-id', id!), copiedId);
  await second.goto('apps/main/');
  await expect(second.getByRole('button', {name: '월 소비 편집'})).toBeVisible();
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1600000');
  await second.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('isf-account-workspace-v1:')).length)).toBe(2);
  await page.reload();
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,600,000');
  expect(server.operations).toEqual([]);
  await second.close();
});

test('automatic sign-out preserves an in-memory recovery download when cache is unavailable', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await page.evaluate(() => {Storage.prototype.setItem = () => {throw new DOMException('quota', 'QuotaExceededError');};});
  await page.getByLabel('월평균 생활비').fill('1700000');
  await page.evaluate(() => {
    const channel = new BroadcastChannel('sb-isf-test-auth-token');
    channel.postMessage({event: 'SIGNED_OUT', session: null}); channel.close();
  });
  await expect(page.getByRole('button', {name: 'Google로 다시 로그인'})).toBeVisible();
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: '미전송 입력 복구 파일'}).click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).drafts.main.value.monthlyLivingWon).toBe(1700000);
});

test('Account Map uses its domain reapply on a cloud conflict and preserves Main', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, mappedPlan()); await server.attach(context, userA);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('apps/account-map/');
  const node = page.getByRole('button', {name: /계좌·보관처 · 생활비통장 ·/}).first();
  await node.click(); await node.click();
  await page.getByRole('button', {name: '편집', exact: true}).click();
  await page.getByRole('textbox', {name: '표시 이름'}).fill('생활통장');
  const newer = mappedPlan(); newer.revision = 1; newer.main.applied!.monthlyNetIncomeWon = 4000000;
  server.rows.set(userA, newer);
  await page.getByRole('button', {name: '저장', exact: true}).click();
  await expect(page.getByRole('button', {name: '최신 상태에서 다시 적용'})).toHaveCount(1);
  await page.getByRole('button', {name: '최신 상태에서 다시 적용'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(server.rows.get(userA)?.locations[0].shortName).toBe('생활통장');
  expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(4000000);
  expect(server.operations).toEqual(['save_account_map', 'save_account_map']);
});

test('Account Map immediately drops replay on a refreshed Main-null cloud snapshot', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, mappedPlan()); await server.attach(context, userA);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('apps/account-map/');
  const node = page.getByRole('button', {name: /계좌·보관처 · 생활비통장 ·/}).first();
  await node.click(); await node.click();
  await page.getByRole('button', {name: '편집', exact: true}).click();
  await page.getByRole('textbox', {name: '표시 이름'}).fill('생활통장');
  server.rows.set(userA, {...createEmptyWorkspace(), revision: 2});
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', {name: '월 자금 계획이 먼저 필요해요'})).toBeVisible();
  await expect(page.getByRole('button', {name: '최신 상태에서 다시 적용'})).toHaveCount(0);
  expect(server.operations).toEqual([]);
});

test('a later tab can export closed-tab recovery without applying it to the account', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 소비 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1900000');
  await page.close();
  const later = await context.newPage();
  await later.goto('apps/main/');
  await expect(later.getByText('다른 탭 또는 이전 방문의 미전송 기록이 있습니다.', {exact: false})).toBeVisible();
  await later.getByRole('button', {name: '내 계정', exact: true}).click();
  const download = later.waitForEvent('download');
  await later.getByRole('button', {name: '미전송 입력 복구 파일'}).click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const file = JSON.parse(Buffer.concat(chunks).toString());
  expect(file.tabRecords.some((record: {drafts?: {main?: {value: {monthlyLivingWon: number}}}}) => record.drafts?.main?.value.monthlyLivingWon === 1900000)).toBe(true);
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1000000);
  expect(server.operations).toEqual([]);
});

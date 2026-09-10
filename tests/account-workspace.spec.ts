import {createExpenseDraft, EXPENSE_ITEMS} from '../src/main/domain/expenseAssistant';
import {withExpenseDraft} from '../src/main/infrastructure/expenseAssistantRepository';
import {expect, test, type BrowserContext} from '@playwright/test';
import {createEmptyWorkspace, type WorkspaceDocument} from '../src/workspace/domain/model';
import {workspacePayload} from '../src/workspace/infrastructure/workspaceRemote';
import {exportWorkspaceBackup} from '../src/workspace/infrastructure/workspaceBackup';

const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function plan(income = 3200000): WorkspaceDocument {
  return {...createEmptyWorkspace(1000), main: {expenseAssistant: null, applied: {
    schemaVersion: 2, updatedAt: 1000, monthlyNetIncomeWon: income, monthlyHousingWon: 800000,
    monthlyLivingWon: 1000000, monthlySavingWon: 300000, monthlyInvestmentWon: 200000,
  }, setupProgress: null}};
}
function mappedPlan(): WorkspaceDocument {
  return {...plan(), locations: [{id: 'living', shortName: '생활비통장', institution: {id: 'toss-bank', name: '토스뱅크'},
    kind: 'bank', roles: ['spending'], createdAt: 1000, updatedAt: 1000},
    {id: 'salary', shortName: '급여통장', kind: 'cash', roles: ['income'], createdAt: 1000, updatedAt: 1000}],
    accountMap: {draft: null, applied: {schemaVersion: 3, sourceMainUpdatedAt: 1000, customPurposes: [],
      transfers: [{id: 'salary-living', sourceLocationId: 'salary', targetLocationId: 'living',
        allocation: {kind: 'fixed', monthlyAmountWon: 1000000}, status: 'active', createdAt: 1000, updatedAt: 1000}],
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
  const row = (user: string, workspace: WorkspaceDocument) => ({user_id: user, schema_version: 5,
    revision: workspace.revision, payload: workspacePayload(workspace), updated_at: new Date(workspace.updatedAt).toISOString(), created_at: new Date(1000).toISOString()});
  async function attach(context: BrowserContext, user: string | null, passwordAccount?: {id: string; email: string; password: string}) {
    if (user) await context.addInitScript(({user}) => {
      const key = 'sb-isf-test-auth-token';
      if (sessionStorage.getItem('test-auth-initialized')) return;
      localStorage.setItem(key, JSON.stringify({access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {id: user, aud: 'authenticated', role: 'authenticated', email: `${user.slice(0, 1)}@example.com`, app_metadata: {provider: 'google'}, user_metadata: {}, created_at: '2026-09-07T00:00:00Z'}}));
      sessionStorage.setItem('test-auth-initialized', '1');
    }, {user});
    await context.route('https://isf-test.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        const credentials = route.request().postDataJSON();
        if (!passwordAccount || credentials.email !== passwordAccount.email || credentials.password !== passwordAccount.password) {
          await route.fulfill({status: 400, json: {code: 'invalid_credentials', msg: 'Invalid login credentials'}}); return;
        }
        user = passwordAccount.id;
        await route.fulfill({json: {access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600,
          user: {id: user, aud: 'authenticated', role: 'authenticated', email: passwordAccount.email,
            app_metadata: {provider: 'email', providers: ['email']}, user_metadata: {}, created_at: '2026-09-08T00:00:00Z'}}}); return;
      }
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
      if (request.p_schema_version !== 5) {await route.fulfill({json: {status: 'invalid'}}); return;}
      const receiptKey = `${user}:${request.p_mutation_id}`;
      if (receipts.has(receiptKey)) {await route.fulfill({json: receipts.get(receiptKey)}); return;}
      if (operation === 'initialize_workspace' && current) {await route.fulfill({json: {status: 'exists', workspace: row(user, current)}}); return;}
      if (operation !== 'initialize_workspace' && current?.revision !== request.p_expected_revision) {
        await route.fulfill({json: {status: 'conflict', workspace: row(user, current!)}}); return;
      }
      const candidate = current && ['save_expense_draft', 'apply_expense'].includes(operation)
        ? withExpenseDraft(current, request.p_payload.main.expenseAssistant.draft, operation === 'apply_expense', Date.now()) : {...(current ?? createEmptyWorkspace()), ...request.p_payload};
      const next = {...candidate, revision: current ? current.revision + 1 : 0, updatedAt: Date.now()};
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
  test(`password and Google sign-in remain usable at ${width}px`, async ({page, context}) => {
    const server = fakeServer();
    await server.attach(context, null);
    await page.setViewportSize({width, height: 900});
    await page.goto('apps/main/');
    const google = page.getByRole('button', {name: 'Google로 계속하기'});
    await expect(google).toBeVisible();
    const email = page.getByLabel('이메일', {exact: true});
    const password = page.getByLabel('비밀번호', {exact: true});
    const submit = page.getByRole('button', {name: '이메일로 로그인'});
    await google.focus(); await expect(google).toBeFocused();
    await page.keyboard.press('Tab'); await expect(email).toBeFocused();
    await page.keyboard.press('Tab'); await expect(password).toBeFocused();
    await page.keyboard.press('Tab'); await expect(submit).toBeFocused();
    for (const control of [email, password, submit]) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await google.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    await page.screenshot({path: `test-results/cloud-login-${width}.png`, fullPage: true});
  });
}

test('password login rejects wrong credentials and loads the same account workspace after success and reload', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan());
  const password = 'fixture-password-for-auth-test';
  await server.attach(context, null, {id: userA, email: 'okho04@gmail.com', password});
  await page.goto('apps/main/');
  await page.getByLabel('이메일', {exact: true}).fill('okho04@gmail.com');
  await page.getByLabel('비밀번호', {exact: true}).fill('wrong-password');
  await page.getByRole('button', {name: '이메일로 로그인'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('비밀번호', {exact: true})).toHaveValue('');
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toHaveCount(0);
  expect(server.operations).toEqual([]);
  await page.getByLabel('비밀번호', {exact: true}).fill(password);
  await page.getByLabel('비밀번호', {exact: true}).press('Enter');
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1100000');
  await page.getByRole('button', {name: '적용', exact: true}).click();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
  await page.reload();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1100000);
  expect(await page.evaluate(() => JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage}))).not.toContain(password);
  expect(page.url()).not.toContain(password);
});

test('password reauthentication restores unsent input without automatically saving it', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan());
  await server.attach(context, userA, {id: userA, email: 'a@example.com', password: 'fixture-reauth-password'});
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1700000');
  await page.evaluate(() => {
    const channel = new BroadcastChannel('sb-isf-test-auth-token');
    channel.postMessage({event: 'SIGNED_OUT', session: null}); channel.close();
  });
  await expect(page.getByRole('heading', {name: '계획을 계속 보려면 다시 로그인해주세요.'})).toBeVisible();
  await expect(page.getByLabel('이메일', {exact: true})).toHaveValue('a@example.com');
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  await page.getByLabel('비밀번호', {exact: true}).fill('fixture-reauth-password');
  await page.getByRole('button', {name: '이메일로 로그인'}).click();
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,700,000');
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1000000);
  expect(server.operations).toEqual([]);
});

test('imports this browser only after explicit choice and preserves its original', async ({page, context}) => {
  const server = fakeServer(); await server.attach(context, userA);
  await page.addInitScript(workspace => localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace)), {...plan(), schemaVersion: 3, main: {applied: plan().main.applied, setupProgress: null}});
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '이 브라우저 계획 가져오기'})).toBeVisible();
  expect(server.rows.has(userA)).toBe(false);
  await page.getByRole('button', {name: '이 브라우저 계획 가져오기'}).click();
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
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
    await expect(other.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('180만 원');
    await page.getByRole('button', {name: '월 금액 편집'}).click();
    await page.getByLabel('월평균 생활비').fill('1100000');
    await page.getByRole('button', {name: '적용', exact: true}).click();
    await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
    await other.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(other.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
    expect(server.rows.get(userB)?.main.applied?.monthlyLivingWon).toBe(1000000);
    await expect(different.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('180만 원');
    expect(server.operations).toContain('save_main');
  } finally {await second.close(); await third.close();}
});

test('lost save response retries once without applying the same edit twice', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1200000');
  server.loseNextResponse();
  await page.getByRole('button', {name: '적용', exact: true}).click();
  await expect(page.getByRole('button', {name: '저장 결과 다시 확인'})).toBeVisible();
  expect(server.rows.get(userA)?.revision).toBe(1);
  await page.getByRole('button', {name: '저장 결과 다시 확인'}).click();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('200만 원');
  expect(server.rows.get(userA)?.revision).toBe(1);
});

test('lost restore response reports uncertainty without falsely promising unchanged server data', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  await page.getByLabel('백업 가져오기').setInputFiles({name: 'restore.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({format: 'isf-workspace-backup', formatVersion: 4, exportedAt: Date.now(), workspace: plan(4800000)}))});
  server.loseNextResponse();
  await page.getByRole('button', {name: '백업으로 바꾸기', exact: true}).click();
  await expect(page.getByRole('dialog')).toContainText('복원 결과를 확인하지 못했습니다. 최신 저장 상태와 복구 안내를 확인해 주세요.');
  expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(4800000);
  expect(server.rows.get(userA)?.revision).toBe(1);
  await page.getByRole('dialog').getByRole('button', {name: '취소', exact: true}).click();
  await page.getByRole('button', {name: '저장 결과 다시 확인', exact: true}).click();
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  expect(server.rows.get(userA)?.revision).toBe(1);
  expect(server.operations).toEqual(['restore_workspace', 'restore_workspace']);
});

test('a concurrent edit retains input and requires explicit reapply', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1400000');
  const newer = plan(); newer.revision = 2; newer.main.applied!.monthlyHousingWon = 900000;
  server.rows.set(userA, newer);
  await page.getByRole('button', {name: '적용', exact: true}).click();
  await expect(page.getByRole('button', {name: '최신 상태에서 다시 적용'})).toBeVisible();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,400,000');
  expect(server.rows.get(userA)?.revision).toBe(2);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: '최신 상태에서 다시 적용'}).click();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('220만 원');
  expect(server.rows.get(userA)?.revision).toBe(3);
});

test('all four authenticated product entries fit mobile and use the account workspace', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({width, height: 900});
    for (const app of ['main', 'simulation', 'portfolio', 'account-map']) {
      await page.goto(`apps/${app}/`);
      await expect(page.getByTestId('app-shell')).toBeVisible();
      await expect(page.getByRole('button', {name: '내 계정', exact: true})).toHaveCount(0);
      const settings = page.getByRole('button', {name: '관리 메뉴', exact: true});
      await settings.click();
      await expect(page.getByRole('menuitem', {name: '이 브라우저에서 로그아웃'})).toBeVisible();
      const popover = page.locator('.journey-management__popover');
      const bounds = await popover.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(901);
      for (const control of await popover.getByRole('menuitem').all()) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({path: `test-results/account-settings-${app}-${width}.png`, fullPage: true});
      await page.keyboard.press('Escape');
      await expect(settings).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path: `test-results/cloud-${app}-${width}.png`, fullPage: true});
    }
  }
  expect(server.operations.every(op => ['save_portfolio', 'save_simulation', 'save_account_map'].includes(op))).toBe(true);
});

test('account actions stay inside settings and remain usable offline while edits are locked', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.setViewportSize({width: 390, height: 700});
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '내 계정', exact: true})).toHaveCount(0);
  await expect(page.getByRole('menuitem', {name: '현재 계정 계획 백업'})).toHaveCount(0);
  server.setFailRead(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeDisabled();
  const settings = page.getByRole('button', {name: '관리 메뉴', exact: true});
  await expect(settings).toBeEnabled(); await settings.click();
  await expect(page.getByRole('menuitem', {name: '처음부터 다시', exact: true})).toBeDisabled();
  await expect(page.getByLabel('백업 가져오기', {exact: true})).toBeDisabled();
  await expect(page.getByRole('group', {name: '계정', exact: true})).toContainText('a@example.com');
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', {name: '현재 계정 계획 백업'}).click();
  expect((await download).suggestedFilename()).toContain('.json');
  await settings.click();
  await page.getByRole('menuitem', {name: '이 브라우저에서 로그아웃'}).click();
  await expect(page.getByRole('button', {name: '이메일로 로그인'})).toBeVisible();
  expect(server.operations).toEqual([]);
});

test('settings remain available in authenticated Main setup', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, createEmptyWorkspace(1000)); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  await expect(page.getByRole('menuitem', {name: '이 브라우저에서 로그아웃'})).toBeVisible();
});

test('open backup import confirmation becomes read-only offline', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  await page.getByLabel('백업 가져오기', {exact: true}).setInputFiles({name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(exportWorkspaceBackup(plan(4000000)))});
  const confirm = page.getByRole('button', {name: '백업으로 바꾸기', exact: true});
  await expect(confirm).toBeEnabled();
  server.setFailRead(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(confirm).toBeDisabled();
  expect(server.operations).toEqual([]);
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
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1300000');
  await page.reload();
  await expect(page.getByText('이 계정에서 보내지 못한 입력을 복구했습니다.', {exact: false})).toBeVisible();
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,300,000');
  expect(server.operations).toEqual([]);
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1000000);
});

test('an authenticated offline revisit is read-only and does not upload cached data', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  server.setFailRead(true);
  await page.reload();
  await expect(page.getByText('오프라인 · 마지막 저장 계획')).toBeVisible();
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeDisabled();
  expect(server.operations).toEqual([]);
});

test('first creation race uses the existing server plan without marking a local import complete', async ({page, context}) => {
  const server = fakeServer(); await server.attach(context, userA);
  await page.addInitScript(workspace => localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace)), {...plan(), schemaVersion: 3, main: {applied: plan().main.applied, setupProgress: null}});
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
  await page.addInitScript(workspace => localStorage.setItem('isf-workspace-v3', JSON.stringify(workspace)), {...plan(), schemaVersion: 3, main: {applied: plan().main.applied, setupProgress: null}});
  const second = await context.newPage();
  await page.goto('apps/main/'); await second.goto('apps/main/');
  await expect(second.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  await page.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  await page.getByRole('menuitem', {name: '이 브라우저에서 로그아웃'}).click();
  await expect(page.getByRole('button', {name: 'Google로 계속하기'})).toBeVisible();
  await expect(second.getByRole('button', {name: 'Google로 계속하기'})).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => /^isf-account-workspace-v[123]:/.test(key)))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('isf-workspace-v3'))).not.toBeNull();
  await second.close();
});

test('a duplicated tab polling does not overwrite unsent input recovery', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  const copiedId = await page.evaluate(() => sessionStorage.getItem('isf-account-tab-id'));
  const second = await context.newPage();
  await second.addInitScript(id => sessionStorage.setItem('isf-account-tab-id', id!), copiedId);
  await second.goto('apps/main/');
  await expect(second.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1600000');
  await second.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('isf-account-workspace-v3:')).length)).toBe(2);
  await page.reload();
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,600,000');
  expect(server.operations).toEqual([]);
  await second.close();
});

test('automatic sign-out preserves an in-memory recovery download when cache is unavailable', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).click();
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

test('Account Map reviews latest state on a cloud location conflict and preserves Main', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, mappedPlan()); await server.attach(context, userA);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('apps/account-map/');
  const node = page.getByRole('button', {name: /계좌 생활비통장/});
  await node.click();
  await page.getByRole('button', {name: '계좌 정보 편집', exact: true}).click();
  await page.getByRole('textbox', {name: '표시 이름'}).fill('생활통장');
  const newer = mappedPlan(); newer.revision = 1; newer.main.applied!.monthlyNetIncomeWon = 4000000;
  server.rows.set(userA, newer);
  await page.getByRole('button', {name: '저장', exact: true}).click();
  await expect(page.getByRole('button', {name: '최신 상태에서 다시 검토'})).toHaveCount(1);
  await page.getByRole('button', {name: '최신 상태에서 다시 검토'}).click();
  await expect(page.getByRole('textbox', {name: '표시 이름'})).toHaveValue('생활통장');
  expect(server.operations).toEqual(['save_account_map']);
  await page.getByRole('button', {name: '다시 시도', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(server.rows.get(userA)?.locations[0].shortName).toBe('생활통장');
  expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(4000000);
  expect(server.operations).toEqual(['save_account_map', 'save_account_map']);
});

test('keeping latest Account Map conflict retires the rejected write before Main edits and reload', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, mappedPlan()); await server.attach(context, userA);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('apps/account-map/');
  await page.getByRole('button', {name: /계좌 급여통장/}).click();
  await page.getByRole('button', {name: '흐름 편집', exact: true}).first().click();
  const editor = page.getByRole('dialog', {name: '계좌 흐름 편집'});
  await editor.getByRole('textbox', {name: '월 이체 금액'}).fill('1200000');
  const newer = mappedPlan(); newer.revision = 1; newer.updatedAt = 2000;
  newer.main.applied!.updatedAt = 2000; newer.main.applied!.monthlyNetIncomeWon = 4000000;
  server.rows.set(userA, newer);
  await editor.getByRole('button', {name: '저장', exact: true}).click();
  await editor.getByRole('button', {name: '최신 값 유지', exact: true}).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', {name: 'Main 금액 수정', exact: true}).click();
  const overlay = page.getByRole('dialog', {name: '월 자금 계획 편집'});
  await overlay.getByLabel('월평균 생활비').fill('1100000');
  await overlay.getByRole('button', {name: '적용', exact: true}).click();
  await expect(overlay).toHaveCount(0);
  expect(server.operations).toEqual(['save_account_map', 'save_main']);
  expect(server.rows.get(userA)?.accountMap).toEqual(newer.accountMap);
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1100000);
  await page.reload();
  await expect(page.getByRole('button', {name: '저장 결과 다시 확인'})).toHaveCount(0);
  await page.getByRole('button', {name: /계좌 급여통장/}).click();
  await page.getByRole('button', {name: '흐름 편집', exact: true}).first().click();
  await expect(editor.getByRole('textbox', {name: '월 이체 금액'})).toHaveValue('1,000,000');
  await editor.getByRole('textbox', {name: '월 이체 금액'}).fill('1300000');
  await editor.getByRole('button', {name: '저장', exact: true}).click();
  await expect(editor).toHaveCount(0);
  expect(server.operations).toEqual(['save_account_map', 'save_main', 'save_account_map']);
  expect(server.rows.get(userA)?.accountMap.applied?.transfers?.[0].allocation).toEqual({kind: 'fixed', monthlyAmountWon: 1300000});
});

test('Account Map immediately drops replay on a refreshed Main-null cloud snapshot', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, mappedPlan()); await server.attach(context, userA);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('apps/account-map/');
  const node = page.getByRole('button', {name: /계좌 생활비통장/});
  await node.click();
  await page.getByRole('button', {name: '계좌 정보 편집', exact: true}).click();
  await page.getByRole('textbox', {name: '표시 이름'}).fill('생활통장');
  server.rows.set(userA, {...createEmptyWorkspace(), revision: 2});
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', {name: '월 자금 계획이 먼저 필요해요'})).toBeVisible();
  await expect(page.getByRole('button', {name: '최신 상태에서 다시 적용'})).toHaveCount(0);
  expect(server.operations).toEqual([]);
});

for (const width of [390, 768, 1280]) {
  test(`cloud v5 Journey overlay owns Main only and preserves local data at ${width}px`, async ({page, context}) => {
    const server = fakeServer(); const initial = mappedPlan(); initial.main.applied!.updatedAt = 2000;
    initial.updatedAt = 2000; server.rows.set(userA, initial);
    await server.attach(context, userA);
    const localRaw = JSON.stringify(plan(9000000));
    await page.addInitScript(raw => localStorage.setItem('isf-workspace-v5', raw), localRaw);
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('apps/account-map/');
    await expect(page.getByRole('button', {name: /계좌 급여통장/})).toBeVisible();
    const trigger = page.getByRole('button', {name: 'Main 금액 수정', exact: true});
    await trigger.click();
    const overlay = page.getByRole('dialog', {name: '월 자금 계획 편집'});
    await expect(overlay.getByLabel('월 실수령액')).toHaveValue('3,200,000');
    await expect(overlay.getByLabel('월 실수령액')).toBeFocused();
    await expect(page.getByTestId('account-map-journey-background')).toHaveAttribute('inert', '');
    await expect(page.locator('.account-flow-canvas')).toBeVisible();
    const bounds = await overlay.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(901);
    for (const control of await overlay.locator('input:visible,button:visible').all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      expect(await overlay.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await overlay.getByLabel('월평균 생활비').fill('1100000');
    await page.screenshot({path: `test-results/cloud-v4-overlay-${width}.png`, fullPage: true});
    await overlay.getByRole('button', {name: '적용', exact: true}).click();
    await expect(overlay).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('button', {name: '현재 Main 기준으로 확인'})).toBeVisible();
    expect(server.operations).toEqual(['save_main']);
    expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1100000);
    expect(server.rows.get(userA)?.accountMap).toEqual(initial.accountMap);
    expect(await page.evaluate(() => localStorage.getItem('isf-workspace-v5'))).toBe(localRaw);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(page.getByRole('button', {name: /계좌 급여통장/})).toBeVisible();
    expect(server.rows.get(userA)?.accountMap.applied?.transfers).toEqual(initial.accountMap.applied?.transfers);
  });
}

test('cloud overlay recovery survives reload and reauthentication without auto-saving', async ({page, context}) => {
  const server = fakeServer(); const initial = mappedPlan(); initial.main.applied!.updatedAt = 2000;
  initial.updatedAt = 2000; server.rows.set(userA, initial);
  await server.attach(context, userA, {id: userA, email: 'a@example.com', password: 'fixture-reauth-password'});
  await page.goto('apps/account-map/');
  await page.getByRole('button', {name: 'Main 금액 수정', exact: true}).click();
  const overlay = page.getByRole('dialog', {name: '월 자금 계획 편집'});
  await overlay.getByLabel('월평균 생활비').fill('1700000');
  server.setFailRead(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(overlay.getByLabel('월평균 생활비')).toBeDisabled();
  server.setFailRead(false);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(overlay.getByLabel('월평균 생활비')).toBeEnabled();
  await expect(overlay.getByLabel('월평균 생활비')).toHaveValue('1,700,000');
  await page.reload();
  await page.getByRole('button', {name: 'Main 금액 수정', exact: true}).click();
  await expect(overlay.getByLabel('월평균 생활비')).toHaveValue('1,700,000');
  await page.evaluate(() => {
    const channel = new BroadcastChannel('sb-isf-test-auth-token');
    channel.postMessage({event: 'SIGNED_OUT', session: null}); channel.close();
  });
  await expect(page.getByRole('heading', {name: '계획을 계속 보려면 다시 로그인해주세요.'})).toBeVisible();
  await page.getByLabel('비밀번호', {exact: true}).fill('fixture-reauth-password');
  await page.getByRole('button', {name: '이메일로 로그인'}).click();
  await page.getByRole('button', {name: 'Main 금액 수정', exact: true}).click();
  await expect(overlay.getByLabel('월평균 생활비')).toHaveValue('1,700,000');
  expect(server.operations).toEqual([]);
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1000000);
});

test('cloud v5 fixed and sweep input recover without replay and save only Account Map', async ({page, context}) => {
  const server = fakeServer(); const initial = mappedPlan(); server.rows.set(userA, initial);
  await server.attach(context, userA);
  await page.emulateMedia({reducedMotion: 'reduce'});
  const openTransfer = async () => {
    await page.getByRole('button', {name: /계좌 급여통장/}).click();
    await page.getByRole('button', {name: '흐름 편집', exact: true}).first().click();
  };
  await page.goto('apps/account-map/'); await openTransfer();
  const editor = page.getByRole('dialog', {name: '계좌 흐름 편집'});
  await editor.getByRole('textbox', {name: '월 이체 금액'}).fill('1200000');
  await page.reload(); await openTransfer();
  await expect(editor.getByRole('textbox', {name: '월 이체 금액'})).toHaveValue('1,200,000');
  await editor.getByRole('radio', {name: '남은 금액 전부'}).check();
  await page.reload(); await openTransfer();
  await expect(editor.getByRole('radio', {name: '남은 금액 전부'})).toBeChecked();
  expect(server.operations).toEqual([]);
  await editor.getByRole('button', {name: '저장', exact: true}).click();
  await expect(editor).toHaveCount(0);
  expect(server.operations).toEqual(['save_account_map']);
  expect(server.rows.get(userA)?.main).toEqual(initial.main);
  expect(server.rows.get(userA)?.accountMap.applied?.transfers?.[0].allocation).toEqual({kind: 'sweep'});
  await page.reload(); await openTransfer();
  await expect(editor.getByRole('radio', {name: '남은 금액 전부'})).toBeChecked();
});

test('cloud v5 setup keeps new location and custom-purpose input through reload without a write', async ({page, context}) => {
  const initial = mappedPlan();
  const {setupCompletedAt: _completed, ...applied} = initial.accountMap.applied!;
  initial.accountMap = {applied: null, draft: {...applied, schemaVersion: 2, step: 'locations'}};
  const server = fakeServer(); server.rows.set(userA, initial); await server.attach(context, userA);
  await page.goto('apps/account-map/');
  const openIncome = async () => page.locator('article').filter({has: page.getByRole('heading', {name: '수입', exact: true})}).getByRole('button', {name: '연결', exact: true}).click();
  await openIncome();
  const location = page.getByRole('dialog', {name: '수입 연결', exact: true});
  await location.getByRole('button', {name: '새 계좌·보관처 추가'}).click();
  await location.getByRole('button', {name: '현금', exact: true}).click();
  await location.getByRole('textbox', {name: '표시 이름'}).fill('임시 급여');
  await page.locator('article').filter({has: page.getByRole('heading', {name: '주거', exact: true})}).getByRole('button', {name: '연결', exact: true}).click();
  await expect(page.getByRole('dialog', {name: '주거 연결', exact: true}).getByRole('textbox', {name: '표시 이름'})).toHaveCount(0);
  await openIncome();
  await expect(location.getByRole('textbox', {name: '표시 이름'})).toHaveValue('임시 급여');
  await page.reload(); await openIncome();
  await expect(location.getByRole('textbox', {name: '표시 이름'})).toHaveValue('임시 급여');
  await expect(location.getByRole('button', {name: '현금', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await location.getByRole('button', {name: '취소', exact: true}).click();
  await page.getByRole('button', {name: '세부 목적 추가'}).click();
  const purpose = page.getByRole('dialog', {name: '세부 목적 추가'});
  await purpose.getByLabel('큰 목적').selectOption('system:saving');
  await purpose.getByLabel('목적 이름').fill('여행 적립');
  await purpose.getByRole('textbox', {name: '월 금액'}).fill('100000');
  await page.reload();
  await page.getByRole('button', {name: '세부 목적 추가'}).click();
  await expect(purpose.getByLabel('목적 이름')).toHaveValue('여행 적립');
  await expect(purpose.getByRole('textbox', {name: '월 금액'})).toHaveValue('100,000');
  expect(server.operations).toEqual([]);
  expect(server.rows.get(userA)).toEqual(initial);
});

test('cloud v5 location edit recovers its fields on reload without changing the map', async ({page, context}) => {
  const server = fakeServer(); const initial = mappedPlan(); server.rows.set(userA, initial);
  await server.attach(context, userA); await page.emulateMedia({reducedMotion: 'no-preference'});
  const openLocation = async () => {
    if (!await page.getByRole('button', {name: '계좌 정보 편집', exact: true}).isVisible()) {
      await page.getByRole('button', {name: /계좌 생활비통장/}).click();
    }
    await page.getByRole('button', {name: '계좌 정보 편집', exact: true}).click();
  };
  await page.goto('apps/account-map/'); await openLocation();
  await page.getByRole('textbox', {name: '표시 이름'}).fill('수정 중 계좌');
  await page.getByRole('button', {name: '현금', exact: true}).click();
  await page.reload(); await openLocation();
  await expect(page.getByRole('textbox', {name: '표시 이름'})).toHaveValue('수정 중 계좌');
  await expect(page.getByRole('button', {name: '현금', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(server.operations).toEqual([]);
  expect(server.rows.get(userA)).toEqual(initial);
  await page.getByRole('dialog').getByRole('button', {name: '닫기', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openLocation();
  await expect(page.getByRole('textbox', {name: '표시 이름'})).toHaveValue('생활비통장');
  expect(server.operations).toEqual([]);
});

test('a later tab can export closed-tab recovery without applying it to the account', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('1900000');
  await page.close();
  const later = await context.newPage();
  await later.goto('apps/main/');
  await expect(later.getByText('다른 탭 또는 이전 방문의 미전송 기록이 있습니다.', {exact: false})).toBeVisible();
  await later.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  const download = later.waitForEvent('download');
  await later.getByRole('menuitem', {name: '미전송 입력 복구 파일'}).click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const file = JSON.parse(Buffer.concat(chunks).toString());
  expect(file.tabRecords.some((record: {drafts?: {main?: {value: {monthlyLivingWon: number}}}}) => record.drafts?.main?.value.monthlyLivingWon === 1900000)).toBe(true);
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1000000);
  expect(server.operations).toEqual([]);
});

const expenseQuestions = [
  {label: '월세', amount: '600000'},
  {label: '주거 대출 이자', amount: '100000'},
  {label: '관리비', amount: '100000'},
  {label: '보험료', amount: '120000', annual: true},
  {label: '통신비', amount: '50000'},
  {label: '정기 구독', amount: '0'},
  {label: '공과금', amount: '1200000', annual: true},
  {label: '식비', amount: '400000'},
  {label: '교통비', amount: '50000'},
  {label: '경조사비', amount: '120000', annual: true},
  {label: '여가비', amount: '600000', annual: true},
  {label: '그 밖의 주거비', amount: '0'},
  {label: '그 밖의 생활비', amount: '30000'},
];

test('expense assistant remembers each answer, replaces rough totals only on completion and survives manual edits', async ({page, context, browser, baseURL}) => {
  const server = fakeServer(); const original = mappedPlan(); server.rows.set(userA, original);
  await server.attach(context, userA, {id: userA, email: 'a@example.com', password: 'fixture-reauth-password'});
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('apps/main/');
  const open = () => page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
  await open();
  const dialog = page.getByRole('dialog');
  for (let index = 0; index < expenseQuestions.length; index++) {
    const question = expenseQuestions[index];
    if (question.label === '관리비') await expect(page.getByRole('dialog')).toContainText('공용관리비(일반관리비), 수도세, 전기세, 가스비');
    const input = dialog.getByLabel(`${question.label} 금액`, {exact: true});
    await expect(input).toBeVisible();
    if (question.annual) await dialog.getByRole('button', {name: '1년 총액', exact: true}).click();
    await input.fill(question.amount);
    if (index === 1) {
      // Recovery keeps an unsent answer through reauthentication without a server write.
      await page.evaluate(() => {
        const channel = new BroadcastChannel('sb-isf-test-auth-token');
        channel.postMessage({event: 'SIGNED_OUT', session: null}); channel.close();
      });
      await page.getByLabel('비밀번호', {exact: true}).fill('fixture-reauth-password');
      await page.getByRole('button', {name: '이메일로 로그인'}).click();
      await open();
      await expect(input).toHaveValue('100,000');
      expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.housingInterest).toBeNull();
    }
    if (question.amount === '0') await dialog.getByRole('button', {name: '없어요', exact: true}).click();
    else await dialog.getByRole('button', {name: index === expenseQuestions.length - 1 ? '합계 확인' : '다음', exact: true}).click();
    await expect.poll(() => server.operations.filter(op => op === 'save_expense_draft').length).toBe(index + 1);
    expect(server.rows.get(userA)?.main.applied).toEqual(original.main.applied);
    if (index === 0) {
      await dialog.getByRole('button', {name: '도우미 닫기'}).click();
      await page.reload(); await open();
      await expect(dialog.getByLabel('주거 대출 이자 금액')).toHaveValue('');
      expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.rent?.amountWon).toBe(600000);
    }
  }
  await expect(dialog.getByRole('heading', {name: '한 달 지출을 확인해보세요'})).toBeVisible();
  await expect(dialog.locator('.expense-assistant__total')).toContainText('150만 원');
  await expect(dialog).toContainText('직접 입력한 주거비와 생활비를 이 합계로 바꿔요.');
  await dialog.getByRole('button', {name: '이 금액으로 반영'}).click();
  await expect(dialog).toHaveCount(0);
  const completed = server.rows.get(userA)!;
  expect(completed.revision).toBe(original.revision + 14);
  expect(completed.main.applied).toMatchObject({monthlyHousingWon: 900000, monthlyLivingWon: 600000, monthlyNetIncomeWon: 3200000, monthlySavingWon: 300000, monthlyInvestmentWon: 200000});
  for (const key of ['simulation', 'portfolio', 'locations', 'accountMap'] as const) expect(completed[key]).toEqual(original[key]);
  await expect(page.getByRole('button', {name: /^지출 계산 도우미 · 현재/})).toBeFocused();
  // A separate browser loads saved answers and can edit a single item directly.
  const secondContext = await browser.newContext({baseURL});
  try {
    await server.attach(secondContext, userA);
    const second = await secondContext.newPage(); await second.goto('apps/main/');
    await second.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
    await expect(second.getByRole('heading', {name: '한 달 지출을 확인해보세요'})).toBeVisible();
    await second.getByRole('button', {name: '경조사비 답변 수정'}).click();
    await expect(second.getByLabel('경조사비 금액')).toHaveValue('120,000');
    await expect(second.getByRole('button', {name: '1년 총액'})).toHaveAttribute('aria-pressed', 'true');
  } finally {await secondContext.close();}
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  await page.getByLabel('월평균 생활비').fill('2000000');
  await page.getByRole('button', {name: '적용', exact: true}).click();
  await page.getByRole('button', {name: '편집기 닫기'}).click();
  await open();
  await expect(dialog.getByRole('heading', {name: '한 달 지출을 확인해보세요'})).toBeVisible();
  await dialog.getByRole('button', {name: '식비 답변 수정'}).click();
  await expect(dialog.getByLabel('식비 금액')).toHaveValue('400,000');
  await dialog.getByLabel('식비 금액').fill('450000');
  await dialog.getByRole('button', {name: '도우미 닫기'}).click();
  await open();
  await expect(dialog.getByLabel('식비 금액')).toHaveValue('450,000');
  await dialog.getByRole('button', {name: '내역으로', exact: true}).click();
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(2000000);
  await dialog.getByRole('button', {name: '이 금액으로 반영'}).click();
  await expect(dialog).toHaveCount(0);
  expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(650000);
  await page.reload();
  await expect(page.getByRole('button', {name: /^지출 계산 도우미 · 현재/})).toContainText('155만 원');
});

for (const width of [390, 768, 1280]) {
  test(`expense entry and whole-plan editor have distinct contained controls and focus at ${width}px`, async ({page, context}) => {
    const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
    await page.setViewportSize({width, height: 844}); await page.goto('apps/main/');
    const edit = page.getByRole('button', {name: '월 금액 편집'});
    const expense = page.getByRole('button', {name: /^지출 계산 도우미 · 현재/});
    for (const button of [edit, expense]) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    if (width === 390) {
      const box = (await edit.boundingBox())!;
      expect(box.y).toBeGreaterThan(740); expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
    await expense.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading')).toBeFocused();
    await expect(page.getByTestId('dashboard-controls')).toHaveAttribute('inert', '');
    await dialog.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(844);
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', {name: '없어요', exact: true})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', {name: '도우미 닫기'})).toBeFocused();
    await dialog.getByRole('button', {name: '1년 총액'}).click();
    await expect(dialog.getByRole('button', {name: '다음', exact: true})).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(expense).toBeFocused();
    await edit.click(); await expect(page.getByRole('button', {name: '편집기 닫기'})).toBeFocused();
    await page.keyboard.press('Escape'); await expect(edit).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    server.setFailRead(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(edit).toBeDisabled(); await expect(expense).toBeDisabled();
  });
}

for (const failure of ['response-lost', 'conflict'] as const) {
  test(`expense completion recovers ${failure} inside the dialog without duplicate sums or stale Main writes`, async ({page, context}) => {
    const server = fakeServer();
    const draft = createExpenseDraft(1000); draft.step = 'review';
    for (const {id} of EXPENSE_ITEMS) draft.answers[id] = {amountWon: id === 'rent' ? 600000 : 0, period: 'month'};
    const original = withExpenseDraft(mappedPlan(), draft, false, 1000);
    server.rows.set(userA, original); await server.attach(context, userA);
    await page.goto('apps/main/');
    await page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
    if (failure === 'response-lost') server.loseNextResponse();
    else server.rows.set(userA, {...original, revision: original.revision + 1, updatedAt: 2000, main: {...original.main,
      applied: {...original.main.applied!, monthlyNetIncomeWon: 5500000, monthlySavingWon: 700000, updatedAt: 2000}}});
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: '이 금액으로 반영'}).click();
    const recovery = dialog.getByRole('button', {name: failure === 'response-lost' ? '저장 결과 다시 확인' : '최신 상태에서 다시 적용'});
    await expect(recovery).toBeVisible();
    if (failure === 'conflict') page.once('dialog', prompt => prompt.accept());
    await recovery.click(); await expect(dialog).toHaveCount(0);
    expect(server.rows.get(userA)?.revision).toBe(failure === 'response-lost' ? 1 : 2);
    expect(server.rows.get(userA)?.main.applied).toMatchObject({monthlyHousingWon: 600000, monthlyLivingWon: 0,
      monthlyNetIncomeWon: failure === 'response-lost' ? 3200000 : 5500000,
      monthlySavingWon: failure === 'response-lost' ? 300000 : 700000});
    expect(server.rows.get(userA)?.accountMap).toEqual(original.accountMap);
    await expect(page.getByRole('button', {name: /^지출 계산 도우미 · 현재/})).toContainText('60만 원');
    await page.getByRole('button', {name: '월 금액 편집'}).click();
    await page.getByLabel('월 투자액').fill('250000');
    await page.getByRole('button', {name: '적용', exact: true}).click();
    await expect.poll(() => server.rows.get(userA)?.main.applied?.monthlyInvestmentWon).toBe(250000);
    expect(server.rows.get(userA)?.main.expenseAssistant?.lastApplied?.answers.rent?.amountWon).toBe(600000);
  });
}

for (const width of [390, 768, 1280]) {
  test(`remaining allocation previews, cancels and persists partial additions at ${width}px`, async ({page, context}) => {
    const server = fakeServer();
    const original = mappedPlan();
    original.main.expenseAssistant = {schemaVersion: 1, draft: createExpenseDraft(1000), lastApplied: null};
    server.rows.set(userA, original); await server.attach(context, userA);
    await page.setViewportSize({width, height: 844});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('apps/main/');
    const opener = page.getByRole('button', {name: /^남는 돈 분배 도우미 · 현재/});
    await expect(opener).toContainText('90만 원');
    expect((await opener.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading')).toBeFocused();
    await expect(page.getByTestId('dashboard-controls')).toHaveAttribute('inert', '');
    await expect(dialog.getByRole('button', {name: '이렇게 나누기'})).toBeDisabled();
    await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', {name: '나중에'})).toBeFocused();
    await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', {name: '분배 도우미 닫기'})).toBeFocused();
    expect(server.operations).toEqual([]);
    await dialog.getByRole('button', {name: '저축에 전부'}).click();
    await expect(dialog.getByLabel('저축에 추가')).toHaveValue('900,000');
    await dialog.getByRole('button', {name: '투자에 전부'}).click();
    await expect(dialog.getByLabel('저축에 추가')).toHaveValue('');
    await expect(dialog.getByLabel('투자에 추가')).toHaveValue('900,000');
    await dialog.getByRole('button', {name: '반씩 나누기'}).click();
    await expect(dialog.getByLabel('저축에 추가')).toHaveValue('450,000');
    page.once('dialog', prompt => prompt.dismiss());
    await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    page.once('dialog', prompt => prompt.accept());
    await dialog.getByRole('button', {name: '나중에'}).click();
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    expect(server.rows.get(userA)).toEqual(original);
    await opener.click();
    await dialog.getByLabel('저축에 추가').fill('600000');
    await dialog.getByLabel('투자에 추가').fill('400000');
    await expect(dialog.getByRole('alert')).toContainText('남는 돈보다 많아요');
    await expect(dialog.getByRole('button', {name: '이렇게 나누기'})).toBeDisabled();
    await dialog.getByLabel('저축에 추가').fill('100000');
    await dialog.getByLabel('투자에 추가').fill('200000');
    await expect(dialog.locator('.expense-assistant__total')).toContainText('600,000원');
    await expect(dialog.locator('#remaining-saving-preview')).toContainText('반영 후 400,000원');
    await expect(dialog.locator('#remaining-investment-preview')).toContainText('반영 후 400,000원');
    const preview = (await dialog.locator('#remaining-investment-preview').boundingBox())!;
    const footer = (await dialog.locator('footer').boundingBox())!;
    expect(preview.y + preview.height).toBeLessThanOrEqual(footer.y);
    expect(server.rows.get(userA)).toEqual(original);
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(844);
    for (const control of await dialog.locator('input,button').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/remaining-allocation-${width}.png`, fullPage: true});
    await dialog.getByRole('button', {name: '이렇게 나누기'}).click();
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    await expect(opener).toContainText('60만 원');
    const saved = server.rows.get(userA)!;
    expect(saved.main.applied).toMatchObject({...original.main.applied, updatedAt: expect.any(Number), monthlySavingWon: 400000, monthlyInvestmentWon: 400000});
    for (const key of ['locations', 'accountMap', 'simulation', 'portfolio'] as const) expect(saved[key]).toEqual(original[key]);
    expect(saved.main.expenseAssistant).toEqual(original.main.expenseAssistant);
    expect(server.operations.filter(op => op === 'save_main')).toHaveLength(1);
    await page.reload(); await expect(opener).toContainText('60만 원');
    await opener.click();
    await dialog.getByRole('button', {name: '저축에 전부'}).click();
    await expect(dialog.getByLabel('저축에 추가')).toHaveValue('600,000');
    await dialog.getByRole('button', {name: '이렇게 나누기'}).click();
    await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    expect(server.rows.get(userA)?.main.applied?.monthlySavingWon).toBe(1000000);
    await opener.click();
    await expect(dialog.getByRole('heading')).toHaveText('지금은 나눌 돈이 없어요');
    await expect(dialog.locator('input')).toHaveCount(0);
    await dialog.getByRole('button', {name: '확인', exact: true}).click();
    await expect(opener).toBeFocused();
    server.setFailRead(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(opener).toBeDisabled();
  });
}

test('remaining allocation explains a deficit without writing or offering additions', async ({page, context}) => {
  const server = fakeServer(); const original = plan(2000000); server.rows.set(userA, original); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: /^남는 돈 분배 도우미 · 현재/}).click();
  await expect(page.getByRole('dialog')).toContainText('수입보다 나가는 돈이 많아요');
  await expect(page.getByRole('dialog').locator('input')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(server.operations).toEqual([]); expect(server.rows.get(userA)).toEqual(original);
});

for (const failure of ['response-lost', 'conflict'] as const) {
  test(`remaining allocation recovers ${failure} without adding twice or overwriting a newer plan`, async ({page, context}) => {
    const server = fakeServer(); const original = mappedPlan(); server.rows.set(userA, original); await server.attach(context, userA);
    await page.goto('apps/main/');
    const opener = page.getByRole('button', {name: /^남는 돈 분배 도우미 · 현재/});
    await opener.click(); const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', {name: '반씩 나누기'}).click();
    if (failure === 'response-lost') server.loseNextResponse();
    else server.rows.set(userA, {...original, revision: 1, updatedAt: 2000, main: {...original.main,
      applied: {...original.main.applied!, monthlyNetIncomeWon: 4000000, monthlySavingWon: 500000, updatedAt: 2000}}});
    await dialog.getByRole('button', {name: '이렇게 나누기'}).click();
    if (failure === 'response-lost') {
      await dialog.getByRole('button', {name: '저장 결과 다시 확인'}).click();
      await expect(dialog).toHaveCount(0);
      expect(server.rows.get(userA)?.revision).toBe(1);
      expect(server.rows.get(userA)?.main.applied).toMatchObject({monthlySavingWon: 750000, monthlyInvestmentWon: 650000});
    } else {
      await expect(dialog.getByLabel('저축에 추가')).toHaveValue('450,000');
      await dialog.getByRole('button', {name: '닫고 저장 상태 확인'}).click();
      expect(server.rows.get(userA)?.revision).toBe(1);
      page.once('dialog', prompt => prompt.accept());
      await page.getByRole('button', {name: '최신 저장 계획 보기'}).click();
      await expect(opener).toContainText('150만 원'); await opener.click();
      await dialog.getByRole('button', {name: '투자에 전부'}).click();
      await expect(dialog.getByLabel('투자에 추가')).toHaveValue('1,500,000');
      await dialog.getByRole('button', {name: '이렇게 나누기'}).click(); await expect(dialog).toHaveCount(0);
      expect(server.rows.get(userA)?.main.applied).toMatchObject({monthlyNetIncomeWon: 4000000, monthlySavingWon: 500000, monthlyInvestmentWon: 1700000});
      expect(server.rows.get(userA)?.revision).toBe(2);
    }
    expect(server.rows.get(userA)?.accountMap).toEqual(original.accountMap);
  });
}

test('canceling an initially invalid remaining allocation releases account edits for remote refresh', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  const opener = page.getByRole('button', {name: /^남는 돈 분배 도우미 · 현재/});
  for (const [index, raw] of ['9999999', '-10'].entries()) {
    await opener.click();
    await page.getByRole('dialog').getByLabel('저축에 추가').fill(raw);
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', {name: '이렇게 나누기'})).toBeDisabled();
    page.once('dialog', prompt => prompt.accept());
    await page.getByRole('dialog').getByRole('button', {name: '나중에'}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const next = plan(4000000 + index * 1000000);
    next.revision = index + 1; next.updatedAt = 2000 + index;
    server.rows.set(userA, next);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(opener).toContainText(index === 0 ? '170만 원' : '270만 원');
    expect(server.operations).toEqual([]);
  }
});

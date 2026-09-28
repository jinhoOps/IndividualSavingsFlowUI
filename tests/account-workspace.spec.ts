import {parseNickname} from '../src/lounge/domain/profile';
import type {Publication} from '../src/lounge/domain/publication';
import {createExpenseDraft, EXPENSE_ITEMS} from '../src/main/domain/expenseAssistant';
import {withExpenseDraft} from '../src/main/infrastructure/expenseAssistantRepository';
import {expect, test, type BrowserContext} from '@playwright/test';
import {createEmptyWorkspace, type WorkspaceDocument} from '../src/workspace/domain/model';
import {workspacePayload} from '../src/workspace/infrastructure/workspaceRemote';
import {buildResultCardModel} from '../src/journey/result-card/model';
import {renderResultCardSvg} from '../src/journey/result-card/renderResultCardSvg';
import {writeFile} from 'node:fs/promises';

async function preventsLeaving(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const event = new Event('beforeunload', {cancelable: true});
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

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
function planWithExpenseHistory(): WorkspaceDocument {
  const workspace = mappedPlan();
  const draft = createExpenseDraft(1000);
  for (const {id} of EXPENSE_ITEMS) draft.answers[id] = {amountWon: id === 'rent' ? 800000 : 0, period: 'month'};
  workspace.main.expenseAssistant = {schemaVersion: 1, lastApplied: {answers: structuredClone(draft.answers), appliedAt: 1000},
    draft: {...draft, step: 'food', answers: {...draft.answers, food: null}}};
  return workspace;
}
function fakeServer() {
  const publications = new Map<string, {owner: string; post: Publication}>();
  const loungeWrites: unknown[] = [];
  const profiles = new Map<string, {nickname: string}>([[userA,{nickname:'나의별명'}],[userB,{nickname:'차곡차곡'}]]);
  const profileWrites: unknown[] = [];
  const nicknameWrites: unknown[] = [];
  const profileVersions = new Map<string, number>();
  const profileChangeTimes = new Map<string, number>();
  let nicknameClock: number | null = null;
  const nicknameSettings = (user: string) => profiles.has(user) ? {nickname: profiles.get(user)!.nickname, version: profileVersions.get(user) ?? 1,
    nextChangeAt: profileChangeTimes.has(user) ? new Date(profileChangeTimes.get(user)! + 48 * 3600000).toISOString() : null,
    serverNow: new Date(nicknameClock ?? Date.now()).toISOString()} : null;
  let failProfileRead = false;
  const rows = new Map<string, WorkspaceDocument>();
  const receipts = new Map<string, unknown>();
  const sharePolicy = {hours: 48, failures: [] as Array<{status: number; code: string}>};
  const shares = new Map<string, {png: Buffer; expiresAt: string}>();
  let failRead = false;
  let readBarrier: Promise<void> | null = null;
  let writeBarrier: Promise<void> | null = null;
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
      if (url.pathname === '/functions/v1/result-card-share') {
        if (route.request().method() === 'POST') {
          const failure = sharePolicy.failures.shift();
          if (failure) {await route.fulfill({status: failure.status, json: {code: failure.code}}); return;}
          const token = route.request().headers()['x-result-card-token'];
          const png = route.request().postDataBuffer();
          if (route.request().headers()['content-type'] !== 'image/png' || !token || !png?.length) {
            await route.fulfill({status: 400, json: {error: 'invalid'}}); return;
          }
          const expiresAt = new Date(Date.now() + sharePolicy.hours * 60 * 60 * 1000).toISOString();
          shares.set(token, {png, expiresAt});
          await route.fulfill({status: 201, json: {token, expiresAt}}); return;
        }
        const token = route.request().headers()['x-result-card-share'];
        const share = token ? shares.get(token) : undefined;
        if (!share) {await route.fulfill({status: 410}); return;}
        await route.fulfill({status: 200, contentType: 'image/png', body: share.png, headers: {
          'access-control-expose-headers': 'x-result-card-expires-at', 'cache-control': 'no-store',
          'x-result-card-expires-at': share.expiresAt,
        }}); return;
      }
      const current = rows.get(user);
      if (url.pathname === '/rest/v1/user_workspaces') {
        await readBarrier;
        if (failRead) {await route.fulfill({status: 400, json: {message: 'fixture read unavailable'}}); return;}
        await route.fulfill({json: current ? [row(user, current)] : []}); return;
      }
      const operation = url.pathname.split('/').at(-1)!;
      if (operation==='get_lounge_profile') {
        if(failProfileRead) {await route.abort('failed');return;}
        await route.fulfill({json:profiles.get(user)??null});return;
      }
      if (operation==='get_lounge_profile_v2') {
        if(failProfileRead) {await route.abort('failed');return;}
        await route.fulfill({json:nicknameSettings(user)});return;
      }
      if (operation==='change_lounge_nickname') {
        const args=route.request().postDataJSON();nicknameWrites.push(args);await writeBarrier;
        if(failWrite) {await route.abort('failed');return;}
        const nickname=parseNickname(args.p_nickname),profile=nicknameSettings(user);
        if(!nickname||!Number.isSafeInteger(args.p_expected_version)||args.p_expected_version<1) {await route.fulfill({json:{status:'invalid'}});return;}
        if(!profile) {await route.fulfill({json:{status:'profile-required'}});return;}
        if(nickname===profile.nickname) {await route.fulfill({json:{status:'unchanged',profile}});return;}
        if(args.p_expected_version!==profile.version) {await route.fulfill({json:{status:'conflict',profile}});return;}
        if(profile.nextChangeAt&&Date.parse(profile.nextChangeAt)>Date.parse(profile.serverNow)) {await route.fulfill({json:{status:'cooldown',profile}});return;}
        if([...profiles].some(([id,p])=>id!==user&&p.nickname.toLowerCase()===nickname.toLowerCase())) {await route.fulfill({json:{status:'taken'}});return;}
        profiles.set(user,{nickname});profileVersions.set(user,profile.version+1);profileChangeTimes.set(user,nicknameClock??Date.now());
        for(const p of publications.values()) if(p.owner===user&&p.post.alias!==nickname) p.post={...p.post,alias:nickname,version:p.post.version+1};
        if(loseResponse) {loseResponse=false;await route.abort('failed');return;}
        await route.fulfill({json:{status:'saved',profile:nicknameSettings(user)}});return;
      }
      if (operation==='register_lounge_nickname') {
        const args=route.request().postDataJSON();profileWrites.push(args);
        if(failWrite) {await route.abort('failed');return;}
        const existing=profiles.get(user);
        if(existing) {await route.fulfill({json:{status:'exists',profile:existing}});return;}
        const nickname=parseNickname(args.p_nickname);
        if(!nickname) {await route.fulfill({json:{status:'invalid'}});return;}
        if([...profiles.values()].some(p=>p.nickname.toLowerCase()===nickname.toLowerCase())) {await route.fulfill({json:{status:'taken'}});return;}
        const profile={nickname};profiles.set(user,profile);
        for(const p of publications.values()) if(p.owner===user&&p.post.alias!==nickname) {p.post={...p.post,alias:nickname,version:p.post.version+1};}
        if(loseResponse) {loseResponse=false;await route.abort('failed');return;}
        await route.fulfill({json:{status:'saved',profile}});return;
      }
      if (operation.includes('lounge_portfolio')) {
        const args=route.request().postDataJSON();
        const own=[...publications.values()].find(p=>p.owner===user);
        const view=(p: {owner:string;post:Publication})=>({...p.post,isMine:p.owner===user});
        if (operation==='list_lounge_portfolios_v2') {
          const list=[...publications.values()].filter(p=>!args.p_mine||p.owner===user).sort((a,b)=>b.post.updatedAt.localeCompare(a.post.updatedAt)||b.post.id.localeCompare(a.post.id));
          const start=args.p_before_id ? list.findIndex(p=>p.post.id===args.p_before_id)+1 : 0;
          await route.fulfill({json:list.slice(start,start+args.p_limit).map(view)}); return;
        }
        if (operation==='get_lounge_portfolio_v2') {const p=publications.get(args.p_id); await route.fulfill({json:p?view(p):null});return;}
        loungeWrites.push(args);
        if (failWrite) {await route.abort('failed');return;}
        if (operation==='publish_lounge_portfolio_v3') {
          if(!profiles.has(user)) {await route.fulfill({json:{status:'profile-required'}});return;}
          if ((own?.post.version??null)!==args.p_expected_version) {await route.fulfill({json:{status:'conflict'}});return;}
          const post:Publication={id:own?.post.id??'dddddddd-dddd-4ddd-8ddd-dddddddddddd',title:args.p_title,alias:profiles.get(user)!.nickname,note:args.p_note,allocation:args.p_allocation,assetBand:args.p_asset_band,version:(own?.post.version??0)+1,updatedAt:new Date().toISOString(),isMine:true};
          publications.set(post.id,{owner:user,post});await route.fulfill({json:{status:'saved',post}});return;
        }
        if (operation==='delete_lounge_portfolio') {
          const p=publications.get(args.p_id);if(p?.owner===user) publications.delete(args.p_id);
          await route.fulfill({json:{status:'deleted'}});return;
        }
      }
      operations.push(operation);
      await writeBarrier;
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
  return {rows, operations, publications, loungeWrites, profiles, profileWrites, profileVersions, profileChangeTimes, nicknameWrites, setNicknameTime(value: number) {nicknameClock=value;}, setFailProfileRead(value: boolean) {failProfileRead=value;}, shares, sharePolicy, attach, holdWrites() {
    let release!: () => void;
    writeBarrier = new Promise<void>(resolve => {release = resolve;});
    return () => {writeBarrier = null; release();};
  }, holdReads() {
    let release!: () => void;
    readBarrier = new Promise<void>(resolve => {release = resolve;});
    return () => {readBarrier = null; release();};
  }, setFailRead(value: boolean) {failRead = value;}, setFailWrite(value: boolean) {failWrite = value;}, loseNextResponse() {loseResponse = true;}};
}

function resultCardPlan(): WorkspaceDocument {
  const workspace = plan();
  workspace.simulation.draft = {
    schemaVersion: 3,
    source: {monthlySavingsWon: 300000, monthlyInvestmentWon: 200000, mainUpdatedAt: 1000},
    initialInvestmentWon: 15000000, targetAmountWon: 100000000, years: 5,
    expectedAnnualReturnPercent: 9, baseRatePercent: 3, inflationOffsetPercentPoints: -0.25,
    amountMode: 'nominal', updatedAt: 1001,
  };
  workspace.portfolio.plans = [{
    schemaVersion: 2, scope: {type: 'aggregate'},
    items: [{id: 'index', name: '글로벌 인덱스', shareUnits: 700000, order: 0, classification: 'growth', classificationOrigin: 'automatic'}],
    cashShareUnits: 300000, cashMode: 'automatic', syncedInvestmentWon: 200000, appliedAt: 1002, updatedAt: 1002,
  }];
  return workspace;
}

for (const viewport of [
  {width: 390, height: 844},
  {width: 390, height: 600},
  {width: 320, height: 568},
  {width: 768, height: 1024},
  {width: 1280, height: 900},
]) {
  test(`creates and opens a 48-hour result-card link without changing the workspace at ${viewport.width}x${viewport.height}`, async ({page, context}, testInfo) => {
    const server = fakeServer();
    const workspace = resultCardPlan();
    server.rows.set(userA, structuredClone(workspace));
    await server.attach(context, userA);
    await page.setViewportSize(viewport);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('apps/portfolio/');

    const expectSurface = async (dialog: import('@playwright/test').Locator) => {
      await expect(dialog).toHaveAttribute('data-presentation', viewport.width < 768 ? 'sheet' : 'modal');
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      if (viewport.width < 768) {
        expect(box!.height).toBeLessThanOrEqual(viewport.height * 0.88 + 1);
        expect(box!.x).toBe(0);
        expect(box!.width).toBe(viewport.width);
        expect(box!.y + box!.height).toBeCloseTo(viewport.height, 0);
        await expect(dialog.locator('.responsive-dialog__drag-handle')).toBeVisible();
      } else {
        expect(box!.x + box!.width / 2).toBeCloseTo(viewport.width / 2, 0);
        expect(box!.y + box!.height / 2).toBeCloseTo(viewport.height / 2, 0);
        await expect(dialog.locator('.responsive-dialog__drag-handle')).toBeHidden();
      }
      await expect(dialog.getByRole('button', {name: '닫기', exact: true})).toBeFocused();
      expect(await page.locator('html').evaluate(html => html.scrollWidth <= innerWidth)).toBe(true);
    };

    await page.getByRole('button', {name: '저장하기'}).click();
    const saveDialog = page.getByRole('dialog', {name: '계획 이미지 저장'});
    await expect(saveDialog).toBeVisible();
    await expectSurface(saveDialog);
    const saveActions = saveDialog.locator('[data-surface-footer] .responsive-dialog__actions');
    const saveButton = saveActions.getByRole('button', {name: '이미지 저장'});
    expect((await saveButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(saveButton).toBeInViewport();
    await expect(saveDialog.getByRole('button', {name: '이미지 저장'})).toBeEnabled({timeout: 10_000});
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      saveDialog.getByRole('button', {name: '이미지 저장'}).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ISF-plan-\d{4}-\d{2}-\d{2}\.png$/);
    expect(server.shares.size).toBe(0);
    await saveDialog.getByRole('button', {name: '닫기', exact: true}).click();

    await page.getByRole('button', {name: '공유하기'}).click();
    const dialog = page.getByRole('dialog', {name: '계획 이미지 공유'});
    await expect(dialog).toBeVisible();
    await expectSurface(dialog);
    const toggle = dialog.getByRole('switch', {name: '금액 포함'});
    await expect(toggle).toBeVisible();
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport();
    const toggleLabelBox = await dialog.locator('.result-card-preview__amounts').boundingBox();
    expect(toggleLabelBox).not.toBeNull();
    expect(toggleLabelBox!.height).toBeGreaterThanOrEqual(44);
    await expect(dialog.getByText('공유 링크는 최대 2일 동안 열 수 있어요. 정확한 만료 시각은 생성 후 표시돼요.')).toBeVisible();
    const createButton = dialog.getByRole('button', {name: '공유 링크 만들기'});
    await expect(createButton).toBeEnabled({timeout: 10_000});
    expect((await createButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(createButton).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    expect(await preventsLeaving(page)).toBe(false);
    await dialog.getByRole('switch', {name: '금액 포함'}).click();
    await expect(dialog.getByRole('button', {name: '공유 링크 만들기'})).toBeEnabled();
    expect(await preventsLeaving(page)).toBe(false);
    await page.screenshot({path: testInfo.outputPath(`share-preview-${viewport.width}x${viewport.height}.png`)});

    await dialog.getByRole('button', {name: '공유 링크 만들기'}).click();
    const link = dialog.getByRole('textbox', {name: '공유 링크'});
    await expect(link).toBeVisible();
    const url = await link.inputValue();
    expect(new URL(url).hash).toMatch(/^#[A-Za-z0-9_-]{32,}$/);
    expect(server.operations).toEqual([]);
    expect(server.rows.get(userA)).toEqual(workspace);
    expect(server.shares.size).toBe(1);

    await page.goto(url);
    await expect(page.getByRole('img', {name: '공유된 나의 자금 계획 이미지'})).toBeVisible();
    await expect(page.getByText(/까지 볼 수 있어요/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test.describe('result preview touch controls', () => {
  test.use({viewport: {width: 390, height: 844}, hasTouch: true});

  test('toggles amount visibility with a real touch while keeping the sheet open', async ({page, context}) => {
    const server = fakeServer();
    server.rows.set(userA, resultCardPlan());
    await server.attach(context, userA);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('apps/portfolio/');
    await page.getByRole('button', {name: '공유하기'}).click();
    const dialog = page.getByRole('dialog', {name: '계획 이미지 공유'});
    const toggle = dialog.getByRole('switch', {name: '금액 포함'});
    const before = await toggle.isChecked();
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport();
    const box = await toggle.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(toggle).toHaveJSProperty('checked', !before);
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toHaveAttribute('data-sheet-exiting', 'true');
  });
});

for (const includeAmounts of [true, false]) {
  test(`result-card text keeps natural glyphs and separate rows (amounts: ${includeAmounts})`, async ({page, context}, testInfo) => {
    const workspace = resultCardPlan();
    workspace.portfolio.plans![0]!.items = Array.from({length: 10}, (_, index) => ({
      id: `asset-${index}`, name: index === 0 ? '금' : index === 1 ? 'SCHD' : '아주 긴 투자 대상 이름과 글로벌 인덱스 펀드',
      shareUnits: 90000, order: index, classification: 'stable', classificationOrigin: 'automatic',
    }));
    workspace.portfolio.plans![0]!.cashShareUnits = 100000;
    const built = buildResultCardModel(workspace, {includeAmounts});
    expect(built.kind).toBe('ready');
    if (built.kind !== 'ready') throw new Error('card fixture');
    const svg = renderResultCardSvg(built.model);
    const server = fakeServer();
    server.rows.set(userA, workspace);
    await server.attach(context, userA);
    await page.goto('apps/portfolio/');
    await page.setViewportSize({width: 1080, height: 1440});
    await page.setContent(`<style>body{margin:0}</style>${svg}`);
    await expect(page.locator('svg path')).toHaveCount(0);
    await expect(page.locator('svg')).toContainText(includeAmounts ? '예상 수익' : '누적 수익률');
    await expect(page.locator('svg')).not.toContainText('안정');
    await page.screenshot({path: testInfo.outputPath('card.png')});
    const boxes = await page.locator('svg text').evaluateAll(elements => elements.map(element => {
      const box = (element as SVGGraphicsElement).getBBox();
      return {text: element.textContent, className: element.getAttribute('class'), x: box.x, y: box.y, width: box.width, height: box.height};
    }));
    const gold = boxes.find(box => box.text === '금')!;
    expect(gold.width).toBeLessThan(40);
    for (const box of boxes) {
      expect(box.x, box.text!).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, box.text!).toBeLessThanOrEqual(1080);
      expect(box.y + box.height, box.text!).toBeLessThanOrEqual(1440);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (const next of boxes.slice(i + 1)) {
        const box = boxes[i]!;
        const overlap = box.x < next.x + next.width && box.x + box.width > next.x
          && box.y < next.y + next.height && box.y + box.height > next.y;
        expect(overlap, `${box.text} overlaps ${next.text}`).toBe(false);
      }
    }
    const png = await page.evaluate(async svg => {
      const modulePath = '/IndividualSavingsFlowUI/src/journey/result-card/files.ts';
      const {renderResultCardPng} = await import(modulePath);
      return Array.from(new Uint8Array(await (await renderResultCardPng(svg)).arrayBuffer()));
    }, svg);
    expect(png.length).toBeLessThanOrEqual(1_000_000);
    const output = testInfo.outputPath('exported-card.png');
    await writeFile(output, Buffer.from(png));
    await testInfo.attach('exported-card.png', {path: output, contentType: 'image/png'});
  });
}

for (const width of [390, 768, 1280]) {
  test(`retired Account Map URLs redirect without writes and preserve stored data after Main editing at ${width}px`, async ({page, context}) => {
    const initial = mappedPlan();
    const server = fakeServer();
    server.rows.set(userA, initial);
    await server.attach(context, userA);
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({reducedMotion: 'reduce'});

    for (const path of ['apps/account-map/', 'apps/account-map/index.html']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/apps\/main\/$/);
      const launcher = page.getByRole('navigation', {name: 'ISF 앱'});
      await expect(launcher.getByRole('link')).toHaveCount(4);
      await expect(launcher.getByRole('link', {name: /자금 흐름 \(Main\).*현재 위치/})).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
      expect(server.operations).toEqual([]);
      expect(server.rows.get(userA)).toEqual(initial);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const link of await launcher.getByRole('link').all()) {
        const bounds = await link.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
    }

    await page.getByRole('button', {name: '월 금액 편집'}).click();
    await page.getByLabel('월평균 생활비').fill('1100000');
    await page.getByRole('button', {name: '적용', exact: true}).click();
    await expect.poll(() => server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1100000);
    expect(server.operations).toEqual(['save_main']);
    expect(server.rows.get(userA)?.accountMap).toEqual(initial.accountMap);
    expect(server.rows.get(userA)?.locations).toEqual(initial.locations);
    await page.reload();
    await page.getByRole('button', {name: '월 금액 편집'}).click();
    await expect(page.getByLabel('월평균 생활비')).toHaveValue('1,100,000');
    expect(server.operations).toEqual(['save_main']);
    expect(server.rows.get(userA)?.accountMap).toEqual(initial.accountMap);
    expect(server.rows.get(userA)?.locations).toEqual(initial.locations);
  });
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

test('lost browser migration response stays uncertain and retries idempotently', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.addInitScript(workspace => localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace)), plan(4800000));
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  server.loseNextResponse();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: '브라우저 계획으로 전체 교체'}).click();
  await expect(page.getByRole('button', {name: '저장 결과 다시 확인', exact: true})).toBeVisible();
  expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(4800000);
  expect(server.rows.get(userA)?.revision).toBe(1);
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
  expect(server.rows.get(userA)?.revision).toBe(2);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', {name: '최신 상태에서 다시 적용'}).click();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('220만 원');
  expect(server.rows.get(userA)?.revision).toBe(3);
});

test('simulation target edits persist through the account save path without changing other apps', async ({page, context}) => {
  const workspace = mappedPlan();
  workspace.simulation.draft = {
    schemaVersion: 3, source: {monthlySavingsWon: 300000, monthlyInvestmentWon: 200000, mainUpdatedAt: 1000},
    initialInvestmentWon: 2000000, years: 20, expectedAnnualReturnPercent: 8, baseRatePercent: 2.5,
    inflationOffsetPercentPoints: -0.5, amountMode: 'nominal', targetAmountWon: 100000000, updatedAt: 1000,
  };
  const server = fakeServer(); server.rows.set(userA, workspace); await server.attach(context, userA);
  await page.goto('apps/simulation/');
  await page.getByRole('button', {name: '조건 편집'}).click();
  const conditions = page.getByRole('dialog', {name: '시뮬레이션 조건'});
  await conditions.getByText('목표와 가정', {exact: true}).click();
  const target = conditions.getByRole('textbox', {name: '목표 금액'});
  expect(await preventsLeaving(page)).toBe(false);
  await target.fill('150000000');
  expect(await preventsLeaving(page)).toBe(true);
  await target.press('Enter');
  await expect.poll(() => server.rows.get(userA)?.simulation.draft?.targetAmountWon).toBe(150000000);
  await expect.poll(() => preventsLeaving(page)).toBe(false);
  await page.reload();
  await page.getByRole('button', {name: '조건 편집'}).click();
  await page.getByRole('dialog', {name: '시뮬레이션 조건'}).getByText('목표와 가정', {exact: true}).click();
  await expect(target).toHaveValue('150,000,000');
  await expect(page.locator('#simulation-result-title')).toContainText('1억 5,000만 원');
  await page.getByRole('dialog', {name: '시뮬레이션 조건'}).getByRole('group', {name: '목표 금액 빠른 조정'}).getByRole('button', {name: '+1천만'}).click();
  await expect.poll(() => server.rows.get(userA)?.simulation.draft?.targetAmountWon).toBe(160000000);
  const saved = server.rows.get(userA)!;
  for (const key of ['main', 'portfolio', 'locations', 'accountMap'] as const) expect(saved[key]).toEqual(workspace[key]);
  expect(saved.simulation.draft).toMatchObject({...workspace.simulation.draft, targetAmountWon: 160000000, updatedAt: expect.any(Number)});
  expect(server.operations).toEqual(['save_simulation', 'save_simulation']);
});

test('Main leave guard protects actual edits and pending or failed saves, then releases after success', async ({page, context}) => {
  const server = fakeServer();
  server.rows.set(userA, plan());
  await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).click();
  expect(await preventsLeaving(page)).toBe(false);
  const living = page.getByLabel('월평균 생활비');
  await living.fill('1100000');
  expect(await preventsLeaving(page)).toBe(true);
  await living.fill('1000000');
  expect(await preventsLeaving(page)).toBe(false);
  await living.fill('1200000');
  const release = server.holdWrites();
  server.setFailWrite(true);
  await page.getByRole('button', {name: '적용', exact: true}).click();
  expect(await preventsLeaving(page)).toBe(true);
  release();
  await expect(page.getByRole('button', {name: '저장 결과 다시 확인'})).toBeVisible();
  expect(await preventsLeaving(page)).toBe(true);
  server.setFailWrite(false);
  await page.getByRole('button', {name: '저장 결과 다시 확인'}).click();
  await expect.poll(() => preventsLeaving(page)).toBe(false);
  await expect.poll(() => server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1200000);
});

test('uncommitted remaining-money input is protected and discarding it restores clean browsing', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: /^남는 돈 분배 도우미 · 현재/}).click();
  const dialog = page.getByRole('dialog', {name: '남는 돈 분배'});
  expect(await preventsLeaving(page)).toBe(false);
  await dialog.getByLabel('저축에 추가').fill('9999999');
  await expect(dialog.getByRole('button', {name: '이렇게 나누기'})).toBeDisabled();
  expect(await preventsLeaving(page)).toBe(true);
  page.once('dialog', confirm => confirm.accept());
  await dialog.getByRole('button', {name: '나중에'}).click();
  await expect(dialog).not.toBeVisible();
  expect(await preventsLeaving(page)).toBe(false);
  expect(server.operations).toEqual([]);
});

for (const configured of [false, true]) {
  test(`all three authenticated product entries fit mobile with ${configured ? 'configured' : 'initial'} app menus`, async ({page, context}) => {
  const workspace = configured ? mappedPlan() : plan();
  if (configured) {
    workspace.simulation.draft = {
      schemaVersion: 3, source: {monthlySavingsWon: 300000, monthlyInvestmentWon: 200000, mainUpdatedAt: 1000},
      initialInvestmentWon: 2000000, years: 20, expectedAnnualReturnPercent: 8, baseRatePercent: 2.5,
      inflationOffsetPercentPoints: -0.5, amountMode: 'nominal', targetAmountWon: 100000000, updatedAt: 1000,
    };
    workspace.portfolio.plans = [{schemaVersion: 2, scope: {type: 'aggregate'},
      items: [{id: 'index', name: '인덱스', shareUnits: 700000, order: 0, classification: 'growth', classificationOrigin: 'automatic'}],
      cashShareUnits: 300000, cashMode: 'automatic', syncedInvestmentWon: 200000, appliedAt: 1000, updatedAt: 1000}];
  }
  const server = fakeServer(); server.rows.set(userA, workspace); await server.attach(context, userA);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({width, height: 900});
    for (const app of ['main', 'simulation', 'portfolio']) {
      await page.goto(`apps/${app}/`);
      await expect(page.getByTestId('app-shell')).toBeVisible();
      await expect(page.getByRole('button', {name: '내 계정', exact: true})).toHaveCount(0);
      const settings = page.getByRole('button', {name: '관리 메뉴', exact: true});
      await settings.click();
      const popover = page.getByRole('dialog', { name: '관리 메뉴' });
      await expect(popover.getByRole('button', {name: '이 브라우저에서 로그아웃'})).toBeVisible();
      await expect(popover.getByText(/백업|앱 아이콘 안내/)).toHaveCount(0);
      await expect(popover.locator('input[type="file"]')).toHaveCount(0);
      const expectedItems: Record<string, string[]> = {
        main: ['처음부터 다시', '이 브라우저에서 로그아웃'],
        simulation: ['시뮬레이션 다시 설정', '이 브라우저에서 로그아웃'],
        portfolio: ['투자 배분 처음부터 다시', '이 브라우저에서 로그아웃'],
      };
      await expect(popover.locator('.journey-management__actions > button')).toHaveText(expectedItems[app]);
      if (app === 'portfolio') {
        await expect(popover.getByRole('switch', {name: '금액 보기'})).toBeVisible();
        await expect(popover.getByRole('radio')).toHaveCount(2);
      }

      await expect(popover).toHaveCSS('opacity', '1');
      if (width < 768) await expect.poll(async () => {
        const box = await popover.boundingBox();
        return box === null ? Infinity : Math.abs(box.y + box.height - 900);
      }).toBeLessThan(0.5);
      const bounds = await popover.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(901);
      if (width < 768) expect(bounds!.y + bounds!.height).toBeCloseTo(900, 0);
      else {
        expect(bounds!.x + bounds!.width / 2).toBeCloseTo(width / 2, 0);
        expect(bounds!.y + bounds!.height / 2).toBeCloseTo(450, 0);
      }
      for (const control of await popover.locator('.journey-management__actions > button').all()) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({path: `test-results/account-settings-${configured ? 'configured' : 'initial'}-${app}-${width}.png`, fullPage: true});
      await page.keyboard.press('Escape');
      await expect(settings).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path: `test-results/cloud-${configured ? 'configured' : 'initial'}-${app}-${width}.png`, fullPage: true});
    }
  }
  expect(server.operations.every(op => ['save_portfolio', 'save_simulation'].includes(op))).toBe(true);
});

}

test('account actions stay inside settings and remain usable offline while edits are locked', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.setViewportSize({width: 390, height: 700});
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '내 계정', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: '현재 계정 계획 백업'})).toHaveCount(0);
  server.setFailRead(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeDisabled();
  const settings = page.getByRole('button', {name: '관리 메뉴', exact: true});
  await expect(settings).toBeEnabled(); await settings.click();
  await expect(page.getByRole('button', {name: '처음부터 다시', exact: true})).toBeDisabled();
  await expect(page.getByLabel('백업 가져오기', {exact: true})).toHaveCount(0);
  await expect(page.getByRole('group', {name: '계정', exact: true})).toContainText('a@example.com');
  await expect(page.getByRole('button', {name: '현재 계정 계획 백업'})).toHaveCount(0);
  await page.getByRole('button', {name: '이 브라우저에서 로그아웃'}).click();
  await expect(page.getByRole('button', {name: '이메일로 로그인'})).toBeVisible();
  expect(server.operations).toEqual([]);
});

for (const surface of [
  {name: 'monthly', path: 'main', opener: /^월 금액 편집$/, dialog: '월 자금 계획 편집'},
  {name: 'expense', path: 'main', opener: /지출 계산 도우미/, dialog: '지출 계산 도우미'},
  {name: 'remaining', path: 'main', opener: /남는 돈 분배 도우미/, dialog: '남는 돈 분배'},
  {name: 'simulation', path: 'simulation', opener: /^조건 편집$/, dialog: '시뮬레이션 조건'},
] as const) {
  test(`${surface.name} portaled editor locks open financial controls when account goes offline`, async ({page, context}) => {
    const server = fakeServer();
    const workspace = plan();
    workspace.simulation.draft = {
      schemaVersion: 3, source: {monthlySavingsWon: 300000, monthlyInvestmentWon: 200000, mainUpdatedAt: 1000},
      initialInvestmentWon: 0, years: 20, expectedAnnualReturnPercent: 9,
      baseRatePercent: 3, inflationOffsetPercentPoints: -0.25, amountMode: 'nominal',
      targetAmountWon: 100000000, updatedAt: 1000,
    };
    server.rows.set(userA, workspace); await server.attach(context, userA);
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`apps/${surface.path}/`);
    await page.getByRole('button', {name: surface.opener}).click();
    const dialog = page.getByRole('dialog', {name: surface.dialog, exact: true});
    const input = dialog.locator('input').first();
    await expect(input).toBeEnabled();
    const previousValue = await input.inputValue();
    server.setFailRead(true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue(previousValue);
    for (const control of await dialog.locator('input, button').all()) await expect(control).toBeDisabled();
    expect(server.operations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', {name: '관리 메뉴', exact: true})).toBeEnabled();
  });
}

test('settings remain available in authenticated Main setup', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, createEmptyWorkspace(1000)); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  await expect(page.getByRole('button', {name: '이 브라우저에서 로그아웃'})).toBeVisible();
});

test('open restart confirmation becomes read-only offline', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan()); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '관리 메뉴', exact: true}).click();
  await page.getByRole('button', {name: '처음부터 다시', exact: true}).click();
  const confirm = page.getByRole('button', {name: '다시 시작', exact: true});
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
  await page.getByRole('button', {name: '이 브라우저에서 로그아웃'}).click();
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
  await later.getByRole('button', {name: '미전송 입력 복구 파일'}).click();
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
  {label: '공용관리비', amount: '100000'},
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

test('expense assistant advances blank and explicit zero answers while preserving Main until completion', async ({page, context}) => {
  const server = fakeServer(); const original = mappedPlan(); server.rows.set(userA, original);
  await server.attach(context, userA);
  await page.goto('apps/main/');
  const open = () => page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
  await open();
  const dialog = page.getByRole('dialog');
  const next = dialog.getByRole('button', {name: '다음', exact: true});
  await expect(dialog.getByLabel('월세 금액')).toHaveValue('');
  expect(server.operations).toEqual([]);
  // Malformed input must not become an implicit zero answer.
  await dialog.getByLabel('월세 금액').fill('abc');
  await expect(next).toBeDisabled();
  await dialog.getByLabel('월세 금액').fill('0');
  await dialog.getByLabel('월세 금액').fill('');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(dialog.getByLabel('주거 대출 이자 금액')).toBeVisible();
  expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.rent).toEqual({amountWon: 0, period: 'month'});
  await dialog.getByLabel('주거 대출 이자 금액').fill('0');
  await next.click();
  await expect(dialog.getByLabel('공용관리비 금액')).toBeVisible();
  await dialog.getByRole('button', {name: '1년 총액', exact: true}).click();
  expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.maintenance).toBeNull();
  await next.click();
  await expect(dialog.getByLabel('보험료 금액')).toBeVisible();
  expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.maintenance).toEqual({amountWon: 0, period: 'year'});
  expect(server.rows.get(userA)?.main.applied).toEqual(original.main.applied);
  await dialog.getByRole('button', {name: '닫기'}).click();
  await page.reload(); await open();
  await expect(dialog.getByLabel('보험료 금액')).toBeVisible();
  expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.insurance).toBeNull();
  expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.housingInterest).toEqual({amountWon: 0, period: 'month'});
});

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
    if (question.label === '공용관리비') await expect(page.getByRole('dialog')).toContainText('공용관리비(일반관리비)만 입력해주세요.');
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
    await dialog.getByRole('button', {name: index === expenseQuestions.length - 1 ? '합계 확인' : '다음', exact: true}).click();
    await expect.poll(() => server.operations.filter(op => op === 'save_expense_draft').length).toBe(index + 1);
    expect(server.rows.get(userA)?.main.applied).toEqual(original.main.applied);
    if (index === 0) {
      await dialog.getByRole('button', {name: '닫기'}).click();
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
  await expect(page.getByRole('dialog', {name: '월 자금 계획 편집'})).toHaveCount(0);
  await open();
  await expect(dialog.getByRole('heading', {name: '한 달 지출을 확인해보세요'})).toBeVisible();
  await dialog.getByRole('button', {name: '식비 답변 수정'}).click();
  await expect(dialog.getByLabel('식비 금액')).toHaveValue('400,000');
  await dialog.getByLabel('식비 금액').fill('450000');
  await dialog.getByRole('button', {name: '닫기'}).click();
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
  test(`expense entry and whole-plan editor have distinct contained controls and focus at ${width}px`, async ({page, context}, testInfo) => {
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
    await expect(dialog.getByRole('heading', {name: '매달 월세로 얼마를 내나요?'})).toBeFocused();
    await expect(page.getByTestId('dashboard-controls')).toHaveAttribute('inert', '');
    await expect.poll(() => dialog.evaluate((element) => (
      element.style.opacity === '' && element.style.transform === ''
        && element.style.translate === '' && element.style.scale === ''
    ))).toBe(true);
    await expect(dialog).toHaveCSS('opacity', '1');
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(844);
    await page.screenshot({path: testInfo.outputPath(`expense-assistant-${width}.png`), fullPage: true});
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', {name: '다음', exact: true})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', {name: '닫기'})).toBeFocused();
    const adjustments = dialog.getByRole('group', {name: '금액 빠른 조정'});
    const amount = dialog.getByLabel('월세 금액');
    await expect(adjustments.getByRole('button')).toHaveText(['-50만', '-10만', '+10만', '+50만']);
    await expect(adjustments.getByRole('button', {name: '-10만', exact: true})).toBeDisabled();
    for (const button of await adjustments.getByRole('button').all()) {
      const target = (await button.boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.x).toBeGreaterThanOrEqual(box.x); expect(target.x + target.width).toBeLessThanOrEqual(box.x + box.width);
    }
    const addSmall = adjustments.getByRole('button', {name: '+10만', exact: true});
    await addSmall.focus(); await page.keyboard.press('Enter');
    await expect(amount).toHaveValue('100,000');
    await expect(dialog.locator('.expense-assistant__total')).toContainText('10만 원');
    await adjustments.getByRole('button', {name: '-50만', exact: true}).click();
    await expect(amount).toHaveValue('0');
    await amount.fill('');
    await dialog.getByRole('button', {name: '1년 총액'}).click();
    await expect(dialog.getByRole('button', {name: '다음', exact: true})).toBeEnabled();
    await adjustments.getByRole('button', {name: '+50만', exact: true}).click();
    await addSmall.click();
    await expect(amount).toHaveValue('600,000');
    await expect(dialog.locator('#expense-input-note')).toContainText('월평균 약 5만 원');
    await adjustments.getByRole('button', {name: '-10만', exact: true}).click();
    await expect(amount).toHaveValue('500,000');
    await addSmall.click();
    expect(server.operations).toEqual([]);
    await page.mouse.move(0, 0);
    await page.screenshot({path: `test-results/expense-adjustments-${width}.png`, fullPage: true});
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.rent).toEqual({amountWon: 600000, period: 'year'});
    expect(server.rows.get(userA)?.main.applied).toEqual(plan().main.applied);
    await expense.click();
    await expect(amount).toHaveValue('600,000');
    await expect(dialog.getByRole('button', {name: '1년 총액'})).toHaveAttribute('aria-pressed', 'true');
    await amount.fill(String(Number.MAX_SAFE_INTEGER));
    await expect(addSmall).toBeDisabled();
    await expect(adjustments.getByRole('button', {name: '+50만', exact: true})).toBeDisabled();
    await amount.fill('600000');
    await page.keyboard.press('Escape');
    await expect(expense).toBeFocused();
    await edit.click(); await expect(page.getByRole('button', {name: '닫기'})).toBeFocused();
    await page.keyboard.press('Escape'); await expect(edit).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expense.click();
    for (let step = 1; step <= 6; step++) {
      await dialog.getByRole('button', {name: '다음', exact: true}).click();
      if (step !== 2 && step !== 6) continue;
      await expect(dialog.locator('h3')).toBeFocused();
      const hint = dialog.locator('#expense-question-hint');
      await expect(hint).toContainText(step === 2 ? '공용관리비(일반관리비)만 입력해주세요.' : '전기·도시가스·상하수도요금과 소득세·재산세·자동차세');
      await expect(hint).toContainText(step === 2 ? '고지서에 함께 나와도 빼고, 뒤의 공과금에서 따로 입력해요.' : '관리비 고지서에 포함된 사용요금도 여기에 입력해요.');
      await expect(dialog.locator('h3')).toContainText('수도·전기·가스');
      const example = dialog.locator('#expense-question-example');
      await expect(example).toContainText(step === 2 ? '여기에는 12만 원만 입력해요.' : '공용관리비 12만 원은 다시 더하지 않아요.');
      await expect(dialog.locator('#expense-answer')).toHaveAttribute('aria-describedby', /expense-question-example/);
      const bounds = (await dialog.boundingBox())!;
      const hintBounds = (await hint.boundingBox())!;
      const nextBounds = (await dialog.getByRole('button', {name: '다음', exact: true}).boundingBox())!;
      expect(hintBounds.x).toBeGreaterThanOrEqual(bounds.x);
      expect(hintBounds.x + hintBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(hintBounds.y + hintBounds.height).toBeLessThanOrEqual(nextBounds.y);
      expect(nextBounds.y + nextBounds.height).toBeLessThanOrEqual(844);
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await adjustments.scrollIntoViewIfNeeded();
      await expect(adjustments).toBeInViewport();
      const quickBounds = (await dialog.getByRole('group', {name: '금액 빠른 조정'}).boundingBox())!;
      const footerBounds = (await dialog.locator('.expense-assistant__footer').boundingBox())!;
      expect(quickBounds.y + quickBounds.height).toBeLessThanOrEqual(footerBounds.y);
      await page.screenshot({path: `test-results/expense-${step === 2 ? 'maintenance' : 'utilities'}-${width}.png`});
    }
    await page.keyboard.press('Escape');
    await expect(expense).toBeFocused();
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
    await expect(dialog.getByRole('heading', {name: '남는 돈을 더 모아볼까요?'})).toBeFocused();
    await expect(page.getByTestId('dashboard-controls')).toHaveAttribute('inert', '');
    await expect(dialog.getByRole('button', {name: '이렇게 나누기'})).toBeDisabled();
    await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', {name: '나중에'})).toBeFocused();
    await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', {name: '닫기'})).toBeFocused();
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
    await expect(dialog.locator('h3')).toHaveText('지금은 나눌 돈이 없어요');
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

for (const width of [390, 768, 1280]) {
  test(`Main reset waits 2.5 seconds without a countdown and preserves other data at ${width}px`, async ({page, context}, testInfo) => {
    const server = fakeServer();
    const initial = planWithExpenseHistory();
    server.rows.set(userA, initial);
    await server.attach(context, userA);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.setViewportSize({width, height: 900});
    await page.goto('apps/main/');
    const trigger = page.getByRole('button', {name: '관리 메뉴'});
    await trigger.click();
    await expect(page.getByText('a@example.com', {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: '이 브라우저에서 로그아웃'})).toBeVisible();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.getByRole('button', {name: '처음부터 다시'}).click();
    const dialog = page.getByRole('dialog', {name: '처음부터 다시 할까요?'});
    const reset = dialog.getByRole('button', {name: '초기화', exact: true});
    const cancel = dialog.getByRole('button', {name: '취소', exact: true});
    const restart = dialog.getByRole('button', {name: '다시 시작', exact: true});
    await expect(cancel).toBeFocused();
    await expect(reset).toBeDisabled();
    await page.clock.runFor(2499);
    await expect(reset).toBeDisabled();
    await page.clock.runFor(1);
    await expect(reset).toBeEnabled();
    await cancel.click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('button', {name: '처음부터 다시'}).click();
    await expect(reset).toBeDisabled();
    await page.clock.runFor(2500);
    await expect(reset).toBeEnabled();
    await page.keyboard.press('Shift+Tab');
    await expect(reset).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(restart).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(reset).toBeFocused();
    const boxes = await Promise.all([dialog, reset, cancel, restart].map(item => item.boundingBox()));
    const [modal, left, middle, right] = boxes;
    if (width < 768) {
      expect(modal!.x).toBeCloseTo(0, 0);
      expect(modal!.x + modal!.width).toBeCloseTo(width, 0);
      expect(modal!.y + modal!.height).toBeCloseTo(900, 0);
    } else {
      expect(modal!.x).toBeGreaterThanOrEqual(16);
      expect(modal!.x + modal!.width).toBeLessThanOrEqual(width - 16);
    }
    expect(left!.x + left!.width).toBeLessThanOrEqual(middle!.x);
    expect(middle!.x + middle!.width).toBeLessThanOrEqual(right!.x);
    for (const box of [left, middle, right]) expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: testInfo.outputPath(`main-reset-${width}.png`)});
    await page.clock.resume();
    await reset.click();
    await expect(dialog).not.toBeVisible();
    expect(server.rows.get(userA)!.main.applied).toEqual(initial.main.applied);
    expect(server.rows.get(userA)!.main.setupProgress).toMatchObject({kind: 'restart', step: 'welcome', draft: {
      updatedAt: initial.main.applied!.updatedAt, monthlyNetIncomeWon: 0, monthlyHousingWon: 0,
      monthlyLivingWon: 0, monthlySavingWon: 0, monthlyInvestmentWon: 0,
    }});
    expect(server.rows.get(userA)!.main.expenseAssistant).toBeNull();
    for (const key of ['simulation', 'portfolio', 'locations', 'accountMap'] as const) {
      expect(server.rows.get(userA)![key]).toEqual(initial[key]);
    }
    expect(server.operations).toContain('reset_main_setup');
    await page.reload();
    await expect(page.locator('.setup-flow-surface')).toBeVisible();
    await expect(page.getByRole('button', {name: '월 금액 편집'})).not.toBeVisible();
    await page.getByRole('button', {name: '설정 취소', exact: true}).click();
    await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
    expect(server.rows.get(userA)!.main.applied).toEqual(initial.main.applied);
    expect(server.rows.get(userA)!.main.setupProgress).toBeNull();
    await page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
    await expect(page.getByRole('dialog').getByLabel('월세 금액')).toHaveValue('');
    await expect(page.getByRole('dialog')).toContainText('1 / 13');
  });
}

test('Main reset keeps the dialog and existing plan when account save fails', async ({page, context}) => {
  const server = fakeServer(); const initial = planWithExpenseHistory();
  server.rows.set(userA, initial); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '관리 메뉴'}).click();
  await page.getByRole('button', {name: '처음부터 다시'}).click();
  const dialog = page.getByRole('dialog', {name: '처음부터 다시 할까요?'});
  const reset = dialog.getByRole('button', {name: '초기화', exact: true});
  await expect(reset).toBeEnabled();
  server.setFailWrite(true);
  await reset.click();
  await expect(dialog.getByRole('alert')).toContainText('초기화하지 못했습니다');
  expect(server.rows.get(userA)).toEqual(initial);
  await expect(dialog).toBeVisible();
});

for (const failure of ['response-lost', 'conflict'] as const) {
  test(`Main reset clears all assistant history after ${failure} recovery`, async ({page, context}) => {
    const server = fakeServer(); const initial = planWithExpenseHistory();
    server.rows.set(userA, initial); await server.attach(context, userA);
    await page.goto('apps/main/');
    await page.getByRole('button', {name: '관리 메뉴'}).click();
    await page.getByRole('button', {name: '처음부터 다시'}).click();
    const dialog = page.getByRole('dialog', {name: '처음부터 다시 할까요?'});
    const reset = dialog.getByRole('button', {name: '초기화', exact: true});
    await expect(reset).toBeEnabled();
    if (failure === 'response-lost') server.loseNextResponse();
    else server.rows.set(userA, {...initial, revision: 1, main: {...initial.main,
      applied: {...initial.main.applied!, monthlySavingWon: 500000, updatedAt: 2000}}});
    await reset.click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByRole('button', {name: '취소', exact: true}).click();
    if (failure === 'conflict') page.once('dialog', prompt => prompt.accept());
    await page.getByRole('button', {name: failure === 'response-lost' ? '저장 결과 다시 확인' : '최신 상태에서 다시 적용', exact: true}).click();
    await expect.poll(() => server.rows.get(userA)!.main.expenseAssistant).toBeNull();
    expect(server.rows.get(userA)!.revision).toBe(failure === 'response-lost' ? 1 : 2);
    expect(server.rows.get(userA)!.main.applied!.monthlySavingWon).toBe(failure === 'response-lost' ? 300000 : 500000);
    await page.reload();
    await expect(page.locator('.setup-flow-surface')).toBeVisible();
    await page.getByRole('button', {name: '설정 취소', exact: true}).click();
    await page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
    await expect(page.getByRole('dialog').getByLabel('월세 금액')).toHaveValue('');
  });
}


for (const width of [390, 768, 1280]) {
  test(`app launch landing and internal navigation use distinct screens at ${width}px`, async ({page, context}, testInfo) => {
    const server = fakeServer(); server.rows.set(userA, plan());
    const release = server.holdReads();
    await server.attach(context, userA);
    await page.setViewportSize({width, height: 844});
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.goto('apps/main/');
    const landing = page.getByTestId('brand-welcome');
    await expect(landing).toBeVisible();
    const skip = page.getByRole('button', {name: '화면을 눌러 건너뛰기'});
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // The completed frame is brief before automatic dismissal; observe each
    // browser frame instead of the assertion's increasingly spaced retries.
    await page.waitForFunction(() => {
      const dot = document.querySelector('[data-testid="brand-welcome"] [data-brand-terminal-dot]');
      return dot !== null && getComputedStyle(dot).opacity === '1';
    });
    const bounds = await page.getByTestId('brand-visual').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: testInfo.outputPath(`launch-${width}.png`)});
    // The scene ends on its own, even while the request remains held.
    await expect(landing).toHaveCount(0);
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    await expect(page.getByText('계정의 계획을 불러오고 있어요.', {exact: true})).toBeVisible();
    release();
    await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();

    await context.addInitScript(() => {
      (window as typeof window & {brandFlashed?: boolean}).brandFlashed = false;
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="brand-visual"]'))
          (window as typeof window & {brandFlashed?: boolean}).brandFlashed = true;
      }).observe(document, {childList: true, subtree: true});
    });
    for (const name of ['미래 성장 (Simulation)', '투자 배분 (Portfolio)', '자금 흐름 (Main)']) {
      // Simulate cache lock ID rotation; it must not become a new visual launch.
      await page.evaluate(() => sessionStorage.setItem('isf-account-tab-id', crypto.randomUUID()));
      const releaseNext = server.holdReads();
      await page.getByRole('link', {name, exact: true}).click();
      await expect(page.getByText('계정의 계획을 불러오고 있어요.', {exact: true})).toBeVisible();
      await expect(page.getByTestId('brand-visual')).toHaveCount(0);
      releaseNext();
      await expect(page.getByTestId('app-shell')).toBeVisible();
      expect(await page.evaluate(() => (window as typeof window & {brandFlashed?: boolean}).brandFlashed)).toBe(false);
    }
    await page.evaluate(() => {
      sessionStorage.removeItem('isf-brand-entry-tab');
      sessionStorage.setItem('isf-account-tab-id', crypto.randomUUID());
    });
    await page.reload();
    await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
    expect(await page.evaluate(() => (window as typeof window & {brandFlashed?: boolean}).brandFlashed)).toBe(false);
    await page.goBack();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    expect(await page.evaluate(() => (window as typeof window & {brandFlashed?: boolean}).brandFlashed)).toBe(false);
  });
}

test('signed-out launch leads to login without replaying the landing after password success', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan());
  const release = server.holdReads();
  await server.attach(context, null, {id: userA, email: 'a@example.com', password: 'fixture-login'});
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('apps/main/');
  await expect(page.getByTestId('brand-welcome')).toBeVisible();
  await page.getByRole('button', {name: '화면을 눌러 건너뛰기'}).click();
  await expect(page.getByRole('heading', {name: '로그인', exact: true})).toBeFocused();
  await page.getByLabel('이메일', {exact: true}).fill('a@example.com');
  await page.getByLabel('비밀번호', {exact: true}).fill('fixture-login');
  await page.getByRole('button', {name: '이메일로 로그인'}).click();
  await expect(page.getByText('계정의 계획을 불러오고 있어요.', {exact: true})).toBeVisible();
  await expect(page.getByTestId('brand-visual')).toHaveCount(0);
  release();
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
});

test('OAuth return continues the launch without another brand screen', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan());
  const release = server.holdReads();
  await server.attach(context, userA);
  await context.addInitScript(() => sessionStorage.setItem('isf-login-loading-once', String(Date.now())));
  await page.goto('apps/main/');
  await expect(page.getByText('계정의 계획을 불러오고 있어요.', {exact: true})).toBeVisible();
  await expect(page.getByTestId('brand-visual')).toHaveCount(0);
  release();
  await expect(page.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('isf-login-loading-once'))).toBeNull();
});

test('Main restart replays only after confirmation and a resumed setup does not replay', async ({page, context}) => {
  const server = fakeServer(); const initial = planWithExpenseHistory(); server.rows.set(userA, initial);
  await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).waitFor();
  await page.getByRole('button', {name: '관리 메뉴'}).click();
  await page.getByRole('button', {name: '처음부터 다시'}).click();
  await expect(page.getByTestId('brand-welcome')).toHaveCount(0);
  await page.getByRole('button', {name: '다시 시작', exact: true}).click();
  await expect(page.getByTestId('brand-welcome')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', {name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.'})).toBeFocused();
  await expect.poll(() => server.rows.get(userA)!.main.setupProgress?.step).toBe('welcome');
  expect(server.rows.get(userA)!.main.applied).toEqual(initial.main.applied);
  expect(server.rows.get(userA)!.main.expenseAssistant).toEqual(initial.main.expenseAssistant);
  await page.reload();
  await expect(page.locator('.setup-flow-surface')).toBeVisible();
  await expect(page.getByTestId('brand-welcome')).toHaveCount(0);
});

test('reduced motion skips the landing and a failed initial read still exposes recovery', async ({page, context}) => {
  const server = fakeServer(); server.setFailRead(true);
  await server.attach(context, userA);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('apps/main/');
  await expect(page.getByRole('button', {name: '다시 불러오기'})).toBeVisible();
  await expect(page.getByTestId('brand-welcome')).toHaveCount(0);
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
});


test('a newly opened tab gets its own launch landing even with cloned session storage', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, plan());
  await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: '월 금액 편집'}).waitFor();
  const originalId = await page.evaluate(() => sessionStorage.getItem('isf-account-tab-id'));
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate(() => window.open(window.location.href, '_blank'));
  const popup = await popupPromise;
  await expect(popup.getByTestId('brand-welcome')).toBeVisible();
  expect(await popup.evaluate(() => sessionStorage.getItem('isf-account-tab-id'))).not.toBe(originalId);
  await popup.getByRole('button', {name: '화면을 눌러 건너뛰기'}).click();
  await expect(popup.getByRole('button', {name: '월 금액 편집'})).toBeVisible();
  await popup.close();
});

for (const width of [390, 768, 1280]) {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`Main saving overlay preserves layout at ${width}px with ${reducedMotion}`, async ({page, context}, testInfo) => {
      await page.setViewportSize({width, height: 900});
      await page.emulateMedia({reducedMotion});
      const server = fakeServer(); server.rows.set(userA, plan());
      await server.attach(context, userA);
      await page.goto('apps/main/');
      await page.getByRole('button', {name: '월 금액 편집'}).click();
      await page.getByLabel('월평균 생활비').fill('1100000');
      const apply = page.getByRole('button', {name: '적용', exact: true});
      await apply.focus();
      const editor = width < 768
        ? page.locator('dialog[data-presentation="sheet"]')
        : page.getByRole('dialog', { name: '월 자금 계획 편집' });
      await expect(editor).toBeVisible();
      await expect.poll(() => editor.evaluate((element) => (
        element.style.opacity === '' && element.style.transform === ''
          && element.style.translate === '' && element.style.scale === ''
      ))).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      const before = await apply.boundingBox();
      const footer = page.locator('.main-apply-bar');
      const footerBefore = await footer.boundingBox();
      const release = server.holdWrites();
      try {
        await apply.click();
        await expect(apply).toBeDisabled();
        const overlay = footer.getByRole('status');
        await expect(overlay).toHaveText('저장 중');
        await expect(overlay).toHaveCSS('opacity', '1');
        expect(await apply.boundingBox()).toEqual(before);
        expect(await footer.boundingBox()).toEqual(footerBefore);
        const box = (await overlay.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height).toBeLessThanOrEqual(900);
        expect(before!.height).toBeGreaterThanOrEqual(44);
        await expect(page.locator('.cashflow-allocation__chart')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await overlay.evaluate(element => element.contains(document.activeElement))).toBe(false);
        await page.screenshot({path: testInfo.outputPath('main-saving-overlay.png'), fullPage: true});
      } finally { release(); }
      await expect(page.locator('.main-saving-overlay')).toHaveCount(0);
      await expect(page.locator('.cashflow-metric').filter({hasText: '월 지출'})).toContainText('190만 원');
      expect(server.rows.get(userA)?.main.applied?.monthlyLivingWon).toBe(1100000);
    });
  }
}

function portfolioEditorPlan(): WorkspaceDocument {
  const workspace = mappedPlan();
  workspace.portfolio.plans = [{schemaVersion: 2, scope: {type: 'aggregate'},
    items: [{id: 'index', name: '인덱스', shareUnits: 600000, order: 0, classification: 'growth', classificationOrigin: 'automatic'}],
    cashShareUnits: 400000, cashMode: 'automatic', syncedInvestmentWon: 200000, appliedAt: 1000, updatedAt: 1000}];
  return workspace;
}

for (const failure of ['save-failure', 'conflict'] as const) {
  test(`Portfolio editor preserves completed draft and Main ownership after ${failure}`, async ({page, context}) => {
    const server = fakeServer();
    const original = portfolioEditorPlan();
    server.rows.set(userA, original); await server.attach(context, userA);
    await page.goto('apps/portfolio/');
    await page.locator('.portfolio-allocation-row__select').first().click();
    await page.getByRole('button', {name: /인덱스 편집/}).click();
    const item = page.getByRole('region', {name: '투자 대상 수정'});
    await item.getByLabel('금액', {exact: true}).fill('110000');
    if (failure === 'save-failure') server.setFailWrite(true);
    else {
      server.rows.set(userA, {...original, revision: original.revision + 1, main: {...original.main,
        applied: {...original.main.applied!, monthlyNetIncomeWon: 4000000, monthlyInvestmentWon: 300000, updatedAt: 2000}}});
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(item.getByLabel('금액', {exact: true})).toHaveValue('110,000');
    }
    await item.getByRole('button', {name: '완료'}).click();
    const editor = page.getByRole('dialog', {name: '투자 배분 수정'});
    await expect(editor.getByRole('alert')).toContainText('저장하지 못했습니다');
    await expect(editor.getByRole('button', {name: /인덱스 편집/})).toContainText('110,000원');
    expect(server.rows.get(userA)?.portfolio.plans).toEqual(original.portfolio.plans);
    expect(server.operations.every(operation => operation === 'save_portfolio')).toBe(true);
    expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(failure === 'conflict' ? 4000000 : 3200000);
    expect(server.rows.get(userA)?.main.applied?.monthlyInvestmentWon).toBe(failure === 'conflict' ? 300000 : 200000);
    expect(server.rows.get(userA)?.locations).toEqual(original.locations);
    expect(server.rows.get(userA)?.accountMap).toEqual(original.accountMap);
    await editor.getByRole('button', {name: /인덱스 편집/}).click();
    await expect(page.getByLabel('금액', {exact: true})).toHaveValue('110,000');
  });
}

test('Portfolio viewing stays clean and server-saved edits no longer block leaving', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, portfolioEditorPlan()); await server.attach(context, userA);
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('apps/portfolio/');
  await page.locator('.portfolio-allocation-row__select').first().click();
  const editor = page.getByRole('dialog', {name: '투자 배분 수정'});
  expect(await preventsLeaving(page)).toBe(false);
  await editor.getByRole('button', {name: '샘플로 구성하기'}).click();
  await page.getByRole('button', {name: 'VOO 70 · 금 30', exact: true}).click();
  expect(await preventsLeaving(page)).toBe(false);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(editor).toBeVisible();
  await editor.getByRole('button', {name: /인덱스 편집/}).click();
  const item = page.getByRole('region', {name: '투자 대상 수정'});
  const amount = item.getByLabel('금액', {exact: true});
  expect(await preventsLeaving(page)).toBe(false);
  await amount.fill('110000');
  expect(await preventsLeaving(page)).toBe(true);
  await item.getByRole('button', {name: '완료'}).click();
  await expect.poll(() => server.operations.includes('save_portfolio')).toBe(true);
  await expect.poll(() => preventsLeaving(page)).toBe(false);
  await page.reload();
  expect(await preventsLeaving(page)).toBe(false);
});

test('Portfolio editor recovers unsent item input and retains offline locks in portaled dialogs', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, portfolioEditorPlan()); await server.attach(context, userA);
  await page.goto('apps/portfolio/');
  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.getByRole('button', {name: /인덱스 편집/}).click();
  await page.getByLabel('투자 대상 이름').fill('아직 완료하지 않은 이름');
  await page.getByLabel('금액', {exact: true}).fill('110000');
  await page.reload();
  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.getByRole('button', {name: /인덱스 편집/}).click();
  await expect(page.getByLabel('투자 대상 이름')).toHaveValue('아직 완료하지 않은 이름');
  await expect(page.getByLabel('금액', {exact: true})).toHaveValue('110,000');
  expect(server.operations).toEqual([]);
  server.setFailRead(true);
  await page.reload();
  await expect(page.getByText('오프라인 · 마지막 저장 계획')).toBeVisible();
  await expect(page.locator('.portfolio-allocation-row__select').first()).toBeDisabled();
  expect(server.operations).toEqual([]);
});

test('Portfolio editor locks an already open item dialog when account refresh goes offline', async ({page, context}) => {
  const server = fakeServer(); server.rows.set(userA, portfolioEditorPlan()); await server.attach(context, userA);
  await page.goto('apps/portfolio/');
  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.getByRole('button', {name: /인덱스 편집/}).click();
  server.setFailRead(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const item = page.getByRole('region', {name: '투자 대상 수정'});
  await expect(item.getByLabel('금액', {exact: true})).toBeDisabled();
  await expect(item.getByRole('button', {name: '완료'})).toBeDisabled();
  await expect(item.getByLabel('금액', {exact: true})).toHaveValue('120,000');
  expect(server.operations).toEqual([]);
});

for (const width of [390, 768, 1280]) {
  test(`storage budget failures keep local saving and respect 24-hour expiry at ${width}px`, async ({page, context}, testInfo) => {
    const server = fakeServer();
    const workspace = resultCardPlan();
    server.rows.set(userA, structuredClone(workspace));
    server.sharePolicy.hours = 24;
    server.sharePolicy.failures.push({status:503,code:'capacity_reached'}, {status:202,code:'share_pending'}, {status:410,code:'share_expired'});
    await server.attach(context,userA);
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({reducedMotion:'reduce'});
    const requests:string[]=[];
    page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/functions/v1/result-card-share')) requests.push(request.headers()['x-result-card-request-id']);});
    await page.goto('apps/portfolio/');
    await page.getByRole('button',{name:'공유하기'}).click();
    const dialog=page.getByRole('dialog',{name:'계획 이미지 공유'});
    const create=dialog.getByRole('button',{name:'공유 링크 만들기'});
    await expect(create).toBeEnabled();await create.click();
    await expect(dialog.getByText('지금은 공유 링크를 만들 수 없어요. 이미지로 저장해 주세요.')).toBeVisible();
    const save=dialog.getByRole('button',{name:'이미지 저장',exact:true});
    await expect(save).toBeVisible();
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const download=page.waitForEvent('download');await save.click();await download;
    await page.screenshot({path:testInfo.outputPath(`storage-budget-${width}.png`)});
    await create.click();await expect(dialog.getByText('공유 링크를 준비하고 있어요. 잠시 뒤 다시 시도해 주세요.')).toBeVisible();
    await create.click();await expect(dialog.getByText('이전 공유 요청이 끝났어요. 새 링크를 만들어 주세요.')).toBeVisible();
    await create.click();const input=dialog.getByRole('textbox',{name:'공유 링크'});await expect(input).toBeVisible();
    expect(requests[0]).toBe(requests[1]);expect(requests[1]).toBe(requests[2]);expect(requests[3]).not.toBe(requests[2]);
    const url=await input.inputValue(),record=server.shares.get(new URL(url).hash.slice(1))!;
    expect(Date.parse(record.expiresAt)-Date.now()).toBeGreaterThan(23.9*3600_000);
    expect(Date.parse(record.expiresAt)-Date.now()).toBeLessThanOrEqual(24*3600_000);
    expect(server.rows.get(userA)).toEqual(workspace);expect(await preventsLeaving(page)).toBe(false);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    record.expiresAt=new Date(Date.now()+5000).toISOString();
    await page.clock.install();await page.goto(url);
    await expect(page.getByRole('img',{name:'공유된 나의 자금 계획 이미지'})).toBeVisible();
    await page.clock.fastForward(6000);
    await expect(page.getByRole('heading',{name:'공유 기간이 끝났거나 사용할 수 없는 링크예요.'})).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
  });
}

function housingLoanFixture(): WorkspaceDocument {
  const workspace = mappedPlan();
  const draft = createExpenseDraft(1000);
  for (const {id} of EXPENSE_ITEMS) draft.answers[id] = {amountWon: 0, period: 'month'};
  draft.answers.rent = {amountWon: 500000, period: 'month'};
  draft.answers.housingInterest = {amountWon: 300000, period: 'month'};
  draft.step = 'housingInterest';
  workspace.main.expenseAssistant = {schemaVersion: 1, draft, lastApplied: {answers: structuredClone(draft.answers), appliedAt: 1000}};
  return workspace;
}
for (const width of [390, 768, 1280]) {
  test(`housing loan planner explains methods, saves and restores conditions at ${width}`, async ({page, context}, testInfo) => {
    const server = fakeServer(); const original = housingLoanFixture(); server.rows.set(userA, original);
    await server.attach(context, userA); await page.setViewportSize({width, height: 900});
    await page.goto('apps/main/');
    await page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
    await page.getByRole('button', {name: '상환방식으로 대출 설정', exact: false}).click();
    let dialog = page.getByRole('dialog', {name: '대출 설정', exact: true});
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await dialog.getByRole('button', {name: '대출 추가'}).click();
    await expect(dialog.getByRole('radio')).toHaveCount(3);
    await expect(dialog.getByRole('img', {name: /개념도/})).toHaveCount(3);
    const method = width === 390 ? '원금균등분할상환' : width === 768 ? '원리금균등분할상환' : '만기일시상환';
    await dialog.getByRole('radio', {name: new RegExp(method)}).check();
    await page.screenshot({path: testInfo.outputPath(`loan-methods-${width}.png`)});
    await dialog.getByRole('button', {name: '조건 입력'}).click();
    await dialog.getByLabel('현재 남은 원금', {exact: true}).fill('100000000');
    await dialog.getByLabel('남은 기간 (개월)', {exact: true}).fill(width === 1280 ? '1' : '120');
    await dialog.getByLabel('다음 납입월', {exact: true}).fill('2026-09');
    await dialog.getByRole('button', {name: '상환 일정 확인'}).click();
    await expect(dialog.getByRole('img', {name: /월별 정기 납입액/})).toBeVisible();
    await dialog.getByRole('checkbox', {name: /월세·기타 주거비/}).check();
    await expect.poll(() => dialog.locator('clipPath rect').evaluate(element => (element as SVGGraphicsElement).getBBox().width)).toBe(600);
    await dialog.locator('[data-surface-body]').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({path: testInfo.outputPath(`loan-result-${width}.png`)});
    const geometry = await dialog.evaluate(node => ({dialog: node.getBoundingClientRect().toJSON(), body: document.documentElement.scrollWidth,
      graph: node.querySelector('.loan-repayment-chart')!.getBoundingClientRect().toJSON()}));
    expect(geometry.body).toBeLessThanOrEqual(width);
    expect(geometry.dialog.left).toBeGreaterThanOrEqual(0);
    expect(geometry.dialog.right).toBeLessThanOrEqual(width);
    expect(geometry.graph.width).toBeGreaterThan(200);
    await dialog.getByRole('button', {name: '대출 조건 저장'}).click();
    await expect(dialog.getByRole('button', {name: '대출 추가'})).toBeVisible();
    expect(server.rows.get(userA)?.main.expenseAssistant?.schemaVersion).toBe(2);
    expect(server.rows.get(userA)?.main.applied).toEqual(original.main.applied);
    expect(server.rows.get(userA)?.main.expenseAssistant?.draft.answers.housingInterest?.amountWon).toBe(300000);
    await dialog.getByLabel('주거비에 반영할 월').fill('2026-09');
    await expect.poll(() => server.rows.get(userA)?.main.expenseAssistant?.draft.housingLoans?.month).toBe('2026-09');
    await dialog.getByRole('button', {name: '지출 내역으로'}).click();
    await page.getByRole('button', {name: '내역으로', exact: true}).click();
    await page.getByRole('button', {name: '이 금액으로 반영'}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const expected = width === 390 ? 1166666 : width === 768 ? 1012451 : 333333;
    expect(server.rows.get(userA)?.main.applied?.monthlyHousingWon).toBe(500000 + expected);
    for (const key of ['simulation', 'portfolio', 'locations', 'accountMap'] as const) expect(server.rows.get(userA)?.[key]).toEqual(original[key]);
    await page.reload();
    await page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
    await page.getByRole('button', {name: '주거 대출 이자 답변 수정'}).click();
    await page.getByRole('button', {name: /대출 1건/}).click();
    dialog = page.getByRole('dialog', {name: '대출 설정', exact: true});
    await expect(dialog.getByText(method, {exact: false})).toBeVisible();
    if (width === 1280) await expect(dialog.getByText('100,000,000원', {exact: true})).toBeVisible();
    expect(await preventsLeaving(page)).toBe(false);
    const beforeClose = server.operations.length;
    await dialog.getByRole('button', {name: '닫기', exact: true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(server.operations).toHaveLength(beforeClose);
  });
}
test('housing loan planner guards only changed unsaved form input and preserves parent answers', async ({page, context}) => {
  const server = fakeServer(); const original = housingLoanFixture(); server.rows.set(userA, original); await server.attach(context, userA);
  await page.goto('apps/main/');
  await page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
  await page.getByRole('button', {name: /상환방식으로 대출 설정/}).click();
  let dialog = page.getByRole('dialog', {name: '대출 설정', exact: true});
  await dialog.getByRole('button', {name: '대출 추가'}).click();
  await dialog.getByRole('button', {name: '닫기', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(server.operations).toEqual([]);
  await page.getByRole('button', {name: /^지출 계산 도우미 · 현재/}).click();
  await page.getByRole('button', {name: /상환방식으로 대출 설정/}).click();
  dialog = page.getByRole('dialog', {name: '대출 설정', exact: true});
  await dialog.getByRole('button', {name: '대출 추가'}).click();
  await dialog.getByRole('button', {name: '조건 입력'}).click();
  await dialog.getByLabel('현재 남은 원금', {exact: true}).fill('70000000');
  await dialog.getByRole('button', {name: '닫기', exact: true}).click();
  const confirmation = page.getByRole('dialog', {name: '입력 중인 대출 조건을 버릴까요?'});
  await confirmation.getByRole('button', {name: '계속 입력'}).click();
  await expect(dialog.getByLabel('현재 남은 원금', {exact: true})).toHaveValue('70,000,000');
  await dialog.getByRole('button', {name: '뒤로', exact: true}).click();
  await confirmation.getByRole('button', {name: '입력 버리기'}).click();
  await expect(page.getByRole('dialog', {name: '지출 계산 도우미'})).toBeVisible();
  expect(server.rows.get(userA)).toEqual(original);
  expect(server.operations).toEqual([]);
});

function appliedHousingLoanFixture(): WorkspaceDocument {
  const workspace = housingLoanFixture();
  return withExpenseDraft(workspace, {...workspace.main.expenseAssistant!.draft, housingLoans: {
    month: '2026-09', paymentOverrideWon: null, loans: [{id: 'home', name: '주택 대출', method: 'equal-payment',
      basis: 'remaining', principalWon: 100000000, annualRateBps: 400, rateType: 'fixed', months: 120,
      graceMonths: 0, firstPaymentMonth: '2026-09'}],
  }}, true, 2000);
}

test('housing loan Main shortcut returns focus and applies a confirmed monthly amount only on request', async ({page, context}) => {
  const server = fakeServer(); const original = appliedHousingLoanFixture(); server.rows.set(userA, original); await server.attach(context, userA);
  await page.goto('apps/main/');
  const opener = page.getByRole('region', {name: '주거 대출 계획'}).getByRole('button');
  await opener.click();
  const dialog = page.getByRole('dialog', {name: '대출 설정', exact: true});
  await dialog.getByRole('button', {name: '지출 내역으로'}).click();
  await expect(page.getByRole('button', {name: '주거 대출 이자 답변 수정'})).toBeFocused();
  await page.getByRole('dialog').getByRole('button', {name: '닫기', exact: true}).click();
  await expect(opener).toBeFocused();
  expect(server.operations).toEqual([]);
  await opener.click();
  await dialog.getByText('은행 납입액과 다를 때', {exact: true}).click();
  await dialog.getByLabel('확인한 정기 납입액', {exact: true}).fill('990000');
  expect(server.operations).toEqual([]);
  expect(await preventsLeaving(page)).toBe(true);
  await dialog.getByRole('button', {name: '선택 월에 보정 적용'}).click();
  await expect.poll(() => server.rows.get(userA)?.main.expenseAssistant?.draft.housingLoans?.paymentOverrideWon).toBe(990000);
  expect(server.rows.get(userA)?.main.applied).toEqual(original.main.applied);
  expect(server.rows.get(userA)?.main.expenseAssistant?.draft.housingLoans?.loans).toEqual(original.main.expenseAssistant?.draft.housingLoans?.loans);
  await expect.poll(() => preventsLeaving(page)).toBe(false);
  await dialog.getByRole('button', {name: '지출 내역으로'}).click();
  await page.getByRole('button', {name: '이 금액으로 반영'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(server.rows.get(userA)?.main.applied?.monthlyHousingWon).toBe(1490000);
});

for (const failure of ['response-lost', 'conflict'] as const) {
  test(`housing loan editor recovers ${failure} inside the surface without losing newer Main values`, async ({page, context}) => {
    const server = fakeServer(); const original = appliedHousingLoanFixture(); server.rows.set(userA, original); await server.attach(context, userA);
    await page.goto('apps/main/');
    await page.getByRole('region', {name: '주거 대출 계획'}).getByRole('button').click();
    const dialog = page.getByRole('dialog', {name: '대출 설정', exact: true});
    await dialog.getByRole('button', {name: /주택 대출 원리금균등/}).click();
    await dialog.getByLabel('현재 남은 원금', {exact: true}).fill('90000000');
    await dialog.getByRole('button', {name: '상환 일정 확인'}).click();
    if (failure === 'response-lost') server.loseNextResponse();
    else server.rows.set(userA, {...original, revision: original.revision + 1, main: {...original.main,
      applied: {...original.main.applied!, monthlyNetIncomeWon: 4000000, monthlySavingWon: 500000, updatedAt: 3000}}});
    await dialog.getByRole('button', {name: '대출 조건 저장'}).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    if (failure === 'conflict') page.once('dialog', prompt => prompt.accept());
    await dialog.getByRole('button', {name: failure === 'response-lost' ? '저장 결과 다시 확인' : '최신 상태에서 다시 적용'}).click();
    await expect.poll(() => server.rows.get(userA)?.main.expenseAssistant?.draft.housingLoans?.loans[0].principalWon).toBe(90000000);
    await expect.poll(() => preventsLeaving(page)).toBe(false);
    expect(server.rows.get(userA)?.revision).toBe(original.revision + (failure === 'response-lost' ? 1 : 2));
    expect(server.rows.get(userA)?.main.applied?.monthlyNetIncomeWon).toBe(failure === 'response-lost' ? 3200000 : 4000000);
    expect(server.rows.get(userA)?.main.applied?.monthlySavingWon).toBe(failure === 'response-lost' ? 300000 : 500000);
    expect(server.rows.get(userA)?.main.applied?.monthlyHousingWon).toBe(original.main.applied?.monthlyHousingWon);
    expect(server.rows.get(userA)?.accountMap).toEqual(original.accountMap);
  });
}

const sharedPortfolio: Publication = {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title:'배당과 금의 균형',alias:'차곡차곡',note:'매달 같은 비율로 나눠요.',assetBand:'100m',
  allocation:{items:[{name:'SCHD',shareUnits:500000},{name:'금',shareUnits:500000}],cashShareUnits:0},version:1,updatedAt:'2026-09-28T01:00:00Z',isMine:false};
for (const width of [390,768,1280]) {
  test(`Lounge authenticated sharing and explicit Portfolio draft copy at ${width}px`, async ({page,context}, testInfo) => {
    const server=fakeServer(); const original=resultCardPlan(); server.rows.set(userA,structuredClone(original));
    server.publications.set(sharedPortfolio.id,{owner:userB,post:sharedPortfolio});
    await server.attach(context,userA);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('apps/lounge/'); await expect(page.getByRole('heading',{name:'포트폴리오 라운지',exact:true})).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.getByRole('button',{name:'배당과 금의 균형 상세 보기'})).toBeVisible();
    await expect(page.getByRole('button',{name:'배당과 금의 균형 상세 보기'})).toHaveAccessibleDescription('자산 규모 · 1억원대');
    expect(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`lounge-list-${width}.png`),fullPage:true});
    const open=page.getByRole('button',{name:'배당과 금의 균형 상세 보기'});await open.click();
    let dialog=page.getByRole('dialog'); await expect(dialog).toHaveAttribute('data-presentation',width<768?'sheet':'modal');
    const box=(await dialog.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.height).toBeLessThanOrEqual(900*.88+1);
    await expect(dialog.getByRole('button',{name:'닫기',exact:true})).toBeFocused();
    await expect(dialog.getByRole('button',{name:'공유 삭제'})).toHaveCount(0);
    await expect(dialog.getByText('자산 규모 · 1억원대',{exact:true})).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`lounge-detail-${width}.png`)});
    expect(server.operations).toEqual([]); expect(server.rows.get(userA)).toEqual(original);
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(open).toBeFocused();
    // Viewing does not trigger unsaved-input protection.
    expect(await preventsLeaving(page)).toBe(false);
    await open.click(); await page.getByRole('link',{name:'이 비율로 시작하기'}).click();
    dialog=page.getByRole('dialog',{name:'내 투자금으로 미리보기'});await expect(dialog).toBeVisible();
    await expect(dialog.getByText('내 월 투자금 200,000원 기준')).toBeVisible();
    await expect(dialog.getByText('100,000원',{exact:true})).toHaveCount(2);
    expect(server.operations).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`lounge-import-${width}.png`)});
    await dialog.getByRole('button',{name:'초안으로 가져오기'}).click();
    await expect(page.getByRole('dialog',{name:'투자 배분 수정'})).toBeVisible();
    await expect.poll(()=>server.rows.get(userA)?.portfolio.draft?.items[0].name).toBe('SCHD');
    expect(server.rows.get(userA)?.portfolio.plans).toEqual(original.portfolio.plans);
    for(const field of ['main','simulation','locations','accountMap'] as const) expect(server.rows.get(userA)?.[field]).toEqual(original[field]);
    expect(server.operations.every(op=>op==='save_portfolio')).toBe(true);
    // Publishing has its own table: no further workspace mutation.
    await page.goto('apps/lounge/');const before=structuredClone(server.rows.get(userA));
    await page.getByRole('button',{name:'내 포트폴리오 공유',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'내 포트폴리오 공유'});await expect(dialog).toBeVisible();
    await expect(dialog.getByText('로그인한 모든 사용자에게 공개 · 정확한 금액 제외')).toBeVisible();
    await dialog.getByLabel('제목',{exact:true}).fill('나만의 배분');await expect(dialog.getByLabel('공유할 별명')).toHaveCount(0);await expect(dialog.getByText('나의별명',{exact:true})).toBeVisible();
    const assetSwitch = dialog.getByRole('switch',{name:'자산 규모 표시'});
    await expect(assetSwitch).not.toBeChecked();
    await expect(dialog.getByLabel('공유할 자산 규모')).toHaveCount(0);
    await assetSwitch.check();
    await expect(dialog.getByLabel('공유할 자산 규모')).toHaveValue('10m');
    await dialog.getByLabel('공유할 자산 규모').selectOption('20m');
    await expect(dialog.getByText('자산 규모 · 2천만원대',{exact:true})).toBeVisible();
    const toggleBox = (await assetSwitch.boundingBox())!;
    expect(toggleBox.width).toBeGreaterThanOrEqual(44);expect(toggleBox.height).toBeGreaterThanOrEqual(44);
    const editorBox = (await dialog.boundingBox())!;
    expect(editorBox.x).toBeGreaterThanOrEqual(0);expect(editorBox.x+editorBox.width).toBeLessThanOrEqual(width+1);
    expect(editorBox.height).toBeLessThanOrEqual(900*.88+1);
    expect(await preventsLeaving(page)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`lounge-publish-${width}.png`)});
    await dialog.getByRole('button',{name:'라운지에 공유',exact:true}).click(); await expect(dialog).toHaveCount(0);
    await expect.poll(()=>preventsLeaving(page)).toBe(false);
    expect(server.rows.get(userA)).toEqual(before);
    expect(JSON.stringify(server.loungeWrites)).not.toMatch(/p_alias|syncedInvestmentWon|initialInvestmentWon|15000000|monthly|amountWon|@|classification|sourceMain|accountMap/);
    expect(server.loungeWrites[0]).toMatchObject({p_asset_band:'20m'});
    await expect(page.getByText('자산 규모 · 2천만원대',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'내 포트폴리오 공유',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'공유 포트폴리오 갱신'});
    await expect(dialog.getByRole('switch',{name:'자산 규모 표시'})).toBeChecked();
    await expect(dialog.getByLabel('공유할 자산 규모')).toHaveValue('20m');
    await dialog.getByRole('switch',{name:'자산 규모 표시'}).uncheck();
    await dialog.getByRole('button',{name:'이 내용으로 갱신'}).click();await expect(dialog).toHaveCount(0);
    expect(server.loungeWrites[1]).toMatchObject({p_asset_band:null});
    await expect(page.getByText('자산 규모 · 2천만원대',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'내 공유',exact:true}).click();await page.getByRole('button',{name:'나만의 배분 상세 보기'}).click();
    await page.getByRole('button',{name:'공유 삭제',exact:true}).click();dialog=page.getByRole('dialog',{name:'공유를 삭제할까요?'});
    await dialog.getByRole('button',{name:'공유 삭제',exact:true}).click();await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'아직 공유한 포트폴리오가 없어요'})).toBeVisible();
    expect(server.rows.get(userA)).toEqual(before); expect(server.publications.has(sharedPortfolio.id)).toBe(true);
  });
}
test('Lounge requires login; deleted link and cancelled copy never write',async({page,context})=>{
  const server=fakeServer();await server.attach(context,null);await page.goto(`apps/lounge/?post=${sharedPortfolio.id}`);
  await expect(page.getByRole('button',{name:/Google로/})).toBeVisible(); await expect(page.getByRole('heading',{name:'포트폴리오 라운지',exact:true})).toHaveCount(0);
  expect(server.operations).toEqual([]);
});
test('Lounge publish failure keeps inputs; unchanged view closes quietly and changed input asks',async({page,context})=>{
  const server=fakeServer();server.rows.set(userA,resultCardPlan());await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('apps/lounge/');await page.getByRole('button',{name:'내 포트폴리오 공유',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'내 포트폴리오 공유'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'내 포트폴리오 공유',exact:true}).click();let dialog=page.getByRole('dialog');
  await dialog.getByLabel('제목',{exact:true}).fill('보존할 제목');server.setFailWrite(true);
  await dialog.getByRole('button',{name:'라운지에 공유',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('제목',{exact:true})).toHaveValue('보존할 제목');
  await page.keyboard.press('Escape');dialog=page.getByRole('dialog',{name:'작성 중인 내용을 닫을까요?'});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'그만두기'}).click();await expect(dialog).toHaveCount(0);
  expect(server.publications.size).toBe(0);
  await page.goto(`apps/portfolio/?publication=${sharedPortfolio.id}`);await expect(page.getByRole('alert').filter({hasText:'삭제되었거나'})).toBeVisible();
  await page.keyboard.press('Escape');expect(server.operations).toEqual([]);
});

test('Lounge allows a signed-in new account to browse without initializing a workspace', async({page,context})=>{
  const server=fakeServer();server.publications.set(sharedPortfolio.id,{owner:userB,post:sharedPortfolio});await server.attach(context,userA);
  await page.goto('apps/lounge/');await expect(page.getByRole('button',{name:'배당과 금의 균형 상세 보기'})).toBeVisible();
  expect(server.rows.has(userA)).toBe(false);expect(server.operations).toEqual([]);
  await expect(page.getByRole('link',{name:'내 포트폴리오 만들기',exact:true})).toBeVisible();
});
for (const initial of [null, 0]) {
  test(`Lounge asset scale stays optional with initial assets ${initial}`,async({page,context})=>{
    const server=fakeServer();const original=resultCardPlan();
    if(initial===null) original.simulation.draft=null; else original.simulation.draft!.initialInvestmentWon=initial;
    server.rows.set(userA,original);await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('apps/lounge/');const open=page.getByRole('button',{name:'내 포트폴리오 공유',exact:true});await open.click();
    const dialog=page.getByRole('dialog');const toggle=dialog.getByRole('switch',{name:'자산 규모 표시'});
    await expect(toggle).not.toBeChecked();await expect.poll(()=>preventsLeaving(page)).toBe(false);
    await toggle.check();await expect.poll(()=>preventsLeaving(page)).toBe(true);
    await expect(dialog.getByLabel('공유할 자산 규모')).toHaveValue(initial===null?'':'under_10m');
    if(initial===null) {await expect(dialog.getByRole('button',{name:'라운지에 공유',exact:true})).toBeDisabled();await dialog.getByLabel('공유할 자산 규모').selectOption('under_10m');}
    await expect(dialog.getByText('자산 규모 · 1천만원 미만',{exact:true})).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'작성 중인 내용을 닫을까요?'})).toBeVisible();
    await dialog.getByRole('button',{name:'계속 작성'}).click();await toggle.uncheck();
    await expect.poll(()=>preventsLeaving(page)).toBe(false);
    await dialog.getByRole('button',{name:'라운지에 공유',exact:true}).click();await expect(dialog).toHaveCount(0);
    expect(server.loungeWrites[0]).toMatchObject({p_asset_band:null});expect(server.rows.get(userA)).toEqual(original);
    await expect(page.locator('.lounge-asset-badge')).toHaveCount(0);
  });
}
test('Lounge paginates without repeats and updates its one shared post',async({page,context})=>{
  const server=fakeServer();server.rows.set(userA,resultCardPlan());await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});
  for(let i=0;i<13;i++) {const post={...sharedPortfolio,id:`eeeeeeee-eeee-4eee-8eee-${String(i).padStart(12,'0')}`,title:`구성 ${i+1}`};server.publications.set(post.id,{owner:userB,post});}
  const own={...sharedPortfolio,id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',isMine:true,title:'내 이전 공유'};server.publications.set(own.id,{owner:userA,post:own});
  await page.goto('apps/lounge/');await expect(page.locator('.lounge-card')).toHaveCount(12);await page.getByRole('button',{name:'더 보기',exact:true}).click();await expect(page.locator('.lounge-card')).toHaveCount(14);
  await page.getByRole('button',{name:'내 포트폴리오 공유',exact:true}).click();const dialog=page.getByRole('dialog',{name:'공유 포트폴리오 갱신'});
  await dialog.getByLabel('제목',{exact:true}).fill('갱신한 공유');await dialog.getByRole('button',{name:'이 내용으로 갱신'}).click();await expect(dialog).toHaveCount(0);
  expect(server.publications.size).toBe(14);expect(server.publications.get(own.id)?.post.version).toBe(2);expect(server.operations).toEqual([]);
});

for (const width of [390,768,1280]) {
  test(`Lounge nickname landing, confirmation and saved return at ${width}px`, async ({page,context},testInfo)=>{
    const server=fakeServer();server.profiles.delete(userA);await server.attach(context,userA);
    await page.setViewportSize({width,height:844});
    await page.goto('apps/lounge/');
    const heading=page.getByRole('heading',{name:'서로의 투자 구성을 만나보세요'});
    await expect(heading).toBeVisible();await expect(heading).toBeFocused();
    expect(await preventsLeaving(page)).toBe(false);
    const input=page.getByLabel('라운지에서 사용할 닉네임');
    const confirm=page.getByRole('button',{name:'닉네임 확인',exact:true});
    await expect(confirm).toBeDisabled();
    for(const invalid of ['a','a b','name_1','😊이름','-.@','a'.repeat(21)]) {
      await input.fill(invalid);await expect(input).toHaveAttribute('aria-invalid','true');await expect(confirm).toBeDisabled();
    }
    await input.fill('Kim-지호.1@');await expect(input).toHaveAttribute('aria-invalid','false');
    expect(await preventsLeaving(page)).toBe(true);
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:testInfo.outputPath(`lounge-nickname-landing-${width}.png`),fullPage:true});
    await confirm.click();const dialog=page.getByRole('dialog',{name:'이 닉네임으로 시작할까요?'});
    await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('data-presentation',width<768?'sheet':'modal');
    await expect(dialog.getByRole('button',{name:'닫기',exact:true})).toBeFocused();
    await expect(dialog.getByText('닉네임을 변경하면 48시간 동안 다시 바꿀 수 없어요.',{exact:true})).toBeVisible();
    await expect(dialog).toHaveCSS('transform','none');await expect(dialog).toHaveCSS('opacity','1');
    const box=(await dialog.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.height).toBeLessThanOrEqual(844*.88+1);expect(box.y+box.height).toBeLessThanOrEqual(845);
    await dialog.getByRole('button',{name:'이 닉네임으로 시작',exact:true}).focus();await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button',{name:'닫기',exact:true})).toBeFocused();
    expect(server.profileWrites).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`lounge-nickname-confirm-${width}.png`)});
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(confirm).toBeFocused();await expect(input).toHaveValue('Kim-지호.1@');
    await confirm.click();await dialog.getByRole('button',{name:'이 닉네임으로 시작',exact:true}).click();
    await expect(page.getByRole('heading',{name:'포트폴리오 라운지',exact:true})).toBeFocused();
    await expect(page.getByLabel('내 라운지 닉네임')).toHaveText('Kim-지호.1@');
    expect(server.profileWrites).toEqual([{p_nickname:'Kim-지호.1@'}]);
    expect(server.rows.size).toBe(0);expect(server.operations).toEqual([]);expect(await preventsLeaving(page)).toBe(false);
    await page.reload();await expect(page.getByRole('heading',{name:'포트폴리오 라운지',exact:true})).toBeVisible();
    await expect(input).toHaveCount(0);expect(server.profileWrites).toHaveLength(1);
  });
}

test('Lounge nickname duplicate, failed save and response-lost retry preserve identity and linked post',async({page,context})=>{
  const server=fakeServer();server.profiles.delete(userA);server.profiles.set(userB,{nickname:'Used.Name'});
  const oldPost={...sharedPortfolio,alias:'예전별명',isMine:true};server.publications.set(oldPost.id,{owner:userA,post:oldPost});
  await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`apps/lounge/?post=${oldPost.id}`);
  const input=page.getByLabel('라운지에서 사용할 닉네임');const confirm=page.getByRole('button',{name:'닉네임 확인',exact:true});
  await input.fill('used.name');await confirm.click();
  const dialog=page.getByRole('dialog',{name:'이 닉네임으로 시작할까요?'});const save=dialog.getByRole('button',{name:'이 닉네임으로 시작',exact:true});
  await save.click();await expect(dialog.getByRole('alert')).toContainText('이미 사용 중');expect(server.profiles.has(userA)).toBe(false);
  await dialog.getByRole('button',{name:'다시 입력',exact:true}).click();await expect(input).toHaveValue('used.name');
  await input.fill('새닉네임');await confirm.click();server.setFailWrite(true);await save.click();await expect(dialog.getByRole('alert')).toContainText('다시 시도');
  server.setFailWrite(false);server.loseNextResponse();await save.click();await expect.poll(()=>server.profiles.get(userA)?.nickname).toBe('새닉네임');
  await expect(dialog.getByRole('alert')).toContainText('다시 시도');await save.click();
  await expect(page.getByLabel('내 라운지 닉네임')).toHaveText('새닉네임');await expect(dialog).toHaveCount(0);
  const detail=page.getByRole('dialog',{name:oldPost.title});await expect(detail).toBeVisible();await expect(detail.getByText(/^새닉네임 ·/)).toBeVisible();
  expect(server.publications.get(oldPost.id)?.post).toEqual({...oldPost,alias:'새닉네임',version:2});
  expect(server.rows.size).toBe(0);expect(server.operations).toEqual([]);expect(await preventsLeaving(page)).toBe(false);
});

test('Lounge profile read failure cannot start onboarding, and concurrent registration uses the first name',async({page,context})=>{
  const server=fakeServer();server.profiles.delete(userA);server.setFailProfileRead(true);await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('apps/lounge/');await expect(page.getByRole('heading',{name:'라운지를 불러오지 못했어요'})).toBeVisible();
  await expect(page.getByLabel('라운지에서 사용할 닉네임')).toHaveCount(0);expect(server.profileWrites).toEqual([]);
  server.setFailProfileRead(false);await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();
  await page.getByLabel('라운지에서 사용할 닉네임').fill('이쪽이름');await page.getByRole('button',{name:'닉네임 확인',exact:true}).click();
  server.profiles.set(userA,{nickname:'먼저등록'});
  await page.getByRole('button',{name:'이 닉네임으로 시작',exact:true}).click();
  await expect(page.getByLabel('내 라운지 닉네임')).toHaveText('먼저등록');expect(server.profiles.get(userA)?.nickname).toBe('먼저등록');
});

for(const width of [390,768,1280]) {
  test(`Lounge nickname change, 48h server lock and publication refresh at ${width}px`,async({page,context},testInfo)=>{
    const server=fakeServer();const original=resultCardPlan();server.rows.set(userA,original);
    const oldPost={...sharedPortfolio,alias:'나의별명',isMine:true};server.publications.set(oldPost.id,{owner:userA,post:oldPost});
    server.setNicknameTime(Date.parse('2026-09-28T12:00:00Z'));
    await server.attach(context,userA);await page.setViewportSize({width,height:844});await page.goto('apps/lounge/');
    const open=page.getByRole('button',{name:'닉네임 변경',exact:true});await open.click();
    const dialog=page.getByRole('dialog',{name:'닉네임 변경',exact:true});
    await expect(dialog).toHaveAttribute('data-presentation',width<768?'sheet':'modal');await expect(dialog).toHaveCSS('transform','none');
    const input=dialog.getByLabel('새 닉네임'),save=dialog.getByRole('button',{name:'변경하기',exact:true});
    await expect(input).toHaveValue('나의별명');await expect(save).toBeDisabled();expect(await preventsLeaving(page)).toBe(false);
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
    await open.click();await expect(input).toHaveValue('나의별명');
    for(const bad of ["x';DROP TABLE x--",'<svg/onload=alert(1)>','a\u202eb']) {await input.fill(bad);await expect(save).toBeDisabled();}
    await input.fill('새로운-Kim.1@');await expect(save).toBeEnabled();
    await expect(dialog).toHaveCSS('transform','none');await expect(dialog).toHaveCSS('opacity','1');
    const box=(await dialog.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.y+box.height).toBeLessThanOrEqual(845);
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`nickname-change-${width}.png`)});
    await save.click();await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
    await expect(page.getByLabel('내 라운지 닉네임')).toHaveText('새로운-Kim.1@');
    await expect(page.getByRole('button',{name:`${oldPost.title} 상세 보기`})).toContainText('새로운-Kim.1@');
    expect(server.nicknameWrites).toEqual([{p_nickname:'새로운-Kim.1@',p_expected_version:1}]);
    expect(server.publications.get(oldPost.id)?.post).toEqual({...oldPost,alias:'새로운-Kim.1@',version:2});
    expect(server.rows.get(userA)).toEqual(original);expect(server.operations).toEqual([]);expect(await preventsLeaving(page)).toBe(false);
    await open.click();await expect(input).toBeDisabled();await expect(save).toBeDisabled();await expect(dialog.getByText(/다음 변경 가능/)).toBeVisible();
    await expect(dialog).toHaveCSS('transform','none');await expect(dialog).toHaveCSS('opacity','1');
    await page.screenshot({path:testInfo.outputPath(`nickname-cooldown-${width}.png`)});
    await page.keyboard.press('Escape');server.setNicknameTime(Date.parse('2026-09-30T11:59:00Z'));
    await open.click();await expect(input).toBeDisabled();await page.keyboard.press('Escape');
    server.setNicknameTime(Date.parse('2026-09-30T12:00:00Z'));await open.click();await expect(input).toBeEnabled();
    await input.fill('다음-이름');await save.click();await expect(dialog).toHaveCount(0);expect(server.profileVersions.get(userA)).toBe(3);
  });
}

test('Lounge nickname failed load, duplicate and lost-response retry preserve input and do not renew lock',async({page,context})=>{
  const server=fakeServer();await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('apps/lounge/');const open=page.getByRole('button',{name:'닉네임 변경',exact:true});
  await expect(open).toBeVisible();server.setFailProfileRead(true);await open.click();
  const dialog=page.getByRole('dialog',{name:'닉네임 변경',exact:true}),save=dialog.getByRole('button',{name:'변경하기',exact:true});
  await expect(dialog.getByRole('alert')).toBeVisible();await expect(save).toBeDisabled();
  server.setFailProfileRead(false);await dialog.getByRole('button',{name:'다시 불러오기',exact:true}).click();
  const input=dialog.getByLabel('새 닉네임');await input.fill('차곡차곡');await save.click();await expect(dialog.getByRole('alert')).toContainText('이미 사용 중');
  await input.fill('보존할이름');server.setFailWrite(true);await save.click();await expect(dialog.getByRole('alert')).toContainText('다시 시도');await expect(input).toHaveValue('보존할이름');
  server.setFailWrite(false);server.loseNextResponse();await save.click();await expect(dialog.getByRole('alert')).toContainText('다시 시도');
  const changedAt=server.profileChangeTimes.get(userA);expect(changedAt).toBeDefined();await save.click();await expect(dialog).toHaveCount(0);
  expect(server.profileVersions.get(userA)).toBe(2);expect(server.profileChangeTimes.get(userA)).toBe(changedAt);
  expect(await preventsLeaving(page)).toBe(false);
});

test('Lounge nickname concurrent update is shown without overwriting and dirty cancel is explicit',async({page,context})=>{
  const server=fakeServer();await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('apps/lounge/');
  const open=page.getByRole('button',{name:'닉네임 변경',exact:true});await open.click();const dialog=page.getByRole('dialog',{name:'닉네임 변경',exact:true});
  await dialog.getByLabel('새 닉네임').fill('내입력');await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'입력 중인 닉네임을 버릴까요?'})).toBeVisible();await page.getByRole('button',{name:'계속 입력',exact:true}).click();
  server.profiles.set(userA,{nickname:'다른기기이름'});server.profileVersions.set(userA,2);server.profileChangeTimes.set(userA,Date.now());
  await dialog.getByRole('button',{name:'변경하기',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('다른 곳에서');
  await expect(dialog.getByLabel('새 닉네임')).toHaveValue('내입력');await expect(dialog.getByLabel('새 닉네임')).toBeDisabled();
  await expect(page.getByLabel('내 라운지 닉네임')).toHaveText('다른기기이름');expect(server.profiles.get(userA)?.nickname).toBe('다른기기이름');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'입력 버리기',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await preventsLeaving(page)).toBe(false);await expect(open).toBeFocused();
});

test('Lounge renders hostile published text as text without executable HTML',async({page,context})=>{
  const server=fakeServer();const hostile={...sharedPortfolio,title:'<img src=x onerror=alert(1)>',note:"<script>alert(1)</script> '; DROP TABLE lounge_profiles; --"};
  server.publications.set(hostile.id,{owner:userB,post:hostile});await server.attach(context,userA);await page.emulateMedia({reducedMotion:'reduce'});
  const dialogs:string[]=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await page.goto('apps/lounge/');await page.getByRole('button',{name:`${hostile.title} 상세 보기`}).click();const dialog=page.getByRole('dialog',{name:hostile.title});
  await expect(dialog.getByText(hostile.note,{exact:true})).toBeVisible();await expect(dialog.locator('script,img')).toHaveCount(0);expect(dialogs).toEqual([]);expect(server.operations).toEqual([]);
});

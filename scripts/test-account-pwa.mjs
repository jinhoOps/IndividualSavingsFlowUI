import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

// Real production service worker, fake HTTP account boundary, no remote DB.
const directory = mkdtempSync(resolve(tmpdir(), 'isf-account-pwa-'));
const vite = resolve('node_modules/vite/bin/vite.js');
const port = 16437;
const origin = `http://127.0.0.1:${port}`;
const base = `${origin}/IndividualSavingsFlowUI/`;
let server;
let browser;
try {
  execFileSync(process.execPath, [vite, 'build', '--outDir', directory, '--emptyOutDir'], {
    stdio: 'pipe', env: {...process.env, VITE_SUPABASE_URL: 'https://isf-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_pwa_fixture'},
  });
  server = spawn(process.execPath, [vite, 'preview', '--outDir', directory, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {stdio: 'pipe'});
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview could not start');
    try {if ((await fetch(base)).ok) {ready = true; break;}} catch { /* Wait for this owned preview. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, 'preview must become ready');
  browser = await chromium.launch();
  const context = await browser.newContext({serviceWorkers: 'allow'});
  let online = true;
  const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await context.addInitScript(user => {
    if (sessionStorage.getItem('pwa-auth-seeded')) return;
    localStorage.setItem('sb-isf-test-auth-token', JSON.stringify({access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {id: user, email: 'pwa@example.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated'}}));
    sessionStorage.setItem('pwa-auth-seeded', '1');
  }, user);
  await context.route('https://isf-test.supabase.co/**', route => !online ? route.abort('internetdisconnected') : route.fulfill({json: [{user_id: user, schema_version: 3, revision: 0, created_at: new Date(1000).toISOString(), updated_at: new Date(1000).toISOString(), payload: {
    main: {applied: {schemaVersion: 2, updatedAt: 1000, monthlyNetIncomeWon: 3200000, monthlyHousingWon: 800000, monthlyLivingWon: 1000000, monthlySavingWon: 300000, monthlyInvestmentWon: 200000}, setupProgress: null},
    simulation: {draft: null}, portfolio: {plans: [], draft: null}, locations: [], accountMap: {applied: null, draft: null},
  }}]}));
  const page = await context.newPage();
  await page.goto(`${base}apps/main/`);
  await page.getByRole('button', {name: '월 소비 편집'}).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole('button', {name: '월 소비 편집'}).waitFor();
  await page.goto(`${base}apps/auth/callback/?code=fixture-unused-code&error=access_denied`);
  await page.getByRole('link', {name: '로그인 화면으로 돌아가기'}).waitFor();
  assert.equal(new URL(page.url()).search, '');
  const cachedUrls = await page.evaluate(async () => {
    const urls = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    return urls;
  });
  assert.ok(cachedUrls.length > 0, 'the production shell is actually cached');
  assert.ok(cachedUrls.every(url => !url.includes('supabase.co') && !new URL(url).searchParams.has('code')), 'auth/data and OAuth code URLs must never be cached');
  online = false;
  await context.setOffline(true);
  await page.goto(`${base}apps/main/`);
  await page.getByText('오프라인 · 마지막 저장 계획').waitFor();
  assert.ok(await page.getByRole('button', {name: '월 소비 편집'}).isDisabled(), 'offline plan must be read-only');
  console.log(`PASS: production PWA ${cachedUrls.length} shell cache entries; no Auth/Data/code cache; authenticated offline Main is read-only.`);
} finally {
  await browser?.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
  rmSync(directory, {recursive: true, force: true});
}

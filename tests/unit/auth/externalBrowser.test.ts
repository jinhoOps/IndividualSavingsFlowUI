import {describe, expect, it} from 'vitest';
import {externalBrowserLinks, isKakaoBrowser} from '../../../src/auth/externalBrowser';

const base = '/IndividualSavingsFlowUI/';
const origin = 'https://example.com';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
describe('Kakao browser continuation', () => {
  it('detects Kakao without treating ordinary mobile browsers as embedded', () => {
    expect(isKakaoBrowser('Mozilla/5.0 (iPhone) Mobile KAKAOTALK/26.9.0')).toBe(true);
    expect(isKakaoBrowser('Mozilla/5.0 (Linux; Android 15) kakaotalk 26.9')).toBe(true);
    for (const ua of ['', 'Mozilla/5.0 (iPhone) Version/18 Safari/604.1', 'Mozilla/5.0 (Android) Chrome/128']) expect(isKakaoBrowser(ua)).toBe(false);
  });
  it('keeps only same-site app routes and approved publication identifiers', () => {
    for (const [app, key] of [['lounge', 'post'], ['portfolio', 'publication']]) {
      const links = externalBrowserLinks(`${origin}${base}apps/${app}/index.html?${key}=${id}&next=https://evil.com&code=private&access_token=secret#refresh_token=hidden`, base)!;
      expect(links.url).toBe(`${origin}${base}apps/${app}/?${key}=${id}`);
      expect(new URL(links.kakao).searchParams.get('url')).toBe(links.url);
      expect(links.kakao).toMatch(/^kakaotalk:\/\/web\/openExternal\?url=https%3A/);
    }
  });
  it('strips bad identifiers, redirect injection and unrelated query or fragment values', () => {
    for (const suffix of ['?post=javascript:alert(1)', '?post=abc%26url=https://evil.com', '?next=//evil.com#token', '?post=%0A']) {
      expect(externalBrowserLinks(`${origin}${base}apps/lounge/${suffix}`, base)?.url).toBe(`${origin}${base}apps/lounge/`);
    }
    expect(externalBrowserLinks(`${origin}/other?next=https://evil.com`, base)?.url).toBe(`${origin}${base}apps/main/`);
  });
  it('never offers callback-code or credential-bearing URL handoff', () => {
    for (const href of ['javascript:alert(1)', 'file:///apps/main/', 'not a URL', 'https://user:pass@example.com/apps/main/',
      `${origin}${base}apps/auth/callback/?code=one`, `${origin}${base}apps/auth/callback/index.html#access_token=secret`]) {
      expect(externalBrowserLinks(href, base)).toBeNull();
    }
  });
});

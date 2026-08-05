# Icon App Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 텍스트 details 메뉴를 네 앱 아이콘과 narrow 도움말로 구성된 한 줄 AppLauncher로 교체한다.

**Architecture:** 앱 metadata와 inline SVG는 순수 모듈로 분리하고 AppLauncher가 tooltip, 도움말 패널과 long-press 일시 상태를 소유한다. 앱 route와 데이터 계약은 그대로 두며 CSS는 일반 44×44 아이콘 버튼과 정보성 narrow 30/32×44 규격을 명시적으로 구현한다.

**Tech Stack:** React 19, TypeScript, inline SVG, Tailwind design tokens/existing CSS, Vitest, Testing Library, Playwright

## Global Constraints

- 승인 spec: `docs/superpowers/specs/2026-08-03-icon-app-navigation-design.md`
- 화면 명칭은 `자금 흐름 (Main)`, `미래 성장 (Simulation)`, `투자 배분 (Portfolio)`, `계좌 연결 (Account Map)` 그대로 사용한다.
- 아이콘은 집, 우상향 꺾은선+화살표, 분할 도넛, 펼친 통장이다.
- 새 icon dependency를 추가하지 않는다.
- 앱 버튼은 44×44px, narrow 도움말은 시각 30×30px·선택영역 32×44px이다.
- 모바일 long press 기준은 450ms이며 성공한 long press의 click/context menu만 억제한다.
- Account Map만 `준비 중`이며 route와 독립 저장 경계는 변경하지 않는다.
- 390px, 768px, desktop에서 한 줄과 overflow·focus·touch 규격을 검증한다.
- 사용자와 다른 작업자의 변경을 보존한다.

---

### Task 1: Navigation Metadata, Icons, and Static Launcher

**Files:**
- Create: `src/journey/ui/appNavigation.ts`
- Create: `src/journey/ui/AppNavigationIcon.tsx`
- Modify: `src/journey/ui/AppLauncher.tsx`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`

**Interfaces:**
- Produces: `APP_NAV_ITEMS: ReadonlyArray<AppNavigationItem>`
- Produces: `AppNavigationIcon({ app }: { app: JourneyApp }): JSX.Element`
- `AppNavigationItem`: `{ id: JourneyApp; accessibleLabel: string; shortLabel: string; availability: 'available' | 'readiness' }`

- [ ] **Step 1: Replace the old launcher test with a failing icon contract**

```tsx
it.each([
  ['main', '자금 흐름 (Main)'],
  ['simulation', '미래 성장 (Simulation)'],
  ['portfolio', '투자 배분 (Portfolio)'],
  ['account-map', '계좌 연결 (Account Map)'],
] satisfies ReadonlyArray<[JourneyApp, string]>)('renders icon navigation for %s', (currentApp, label) => {
  const { container } = render(<AppLauncher currentApp={currentApp} />);
  expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
  expect(screen.getByRole('link', { name: new RegExp(`${escapeRegExp(label)}.*현재 위치`) }))
    .toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: /계좌 연결 \(Account Map\).*준비 중/ })).toBeVisible();
  expect(container.querySelector('details, summary')).toBeNull();
  expect(screen.queryByText('사용 중')).not.toBeInTheDocument();
  expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4);
});
```

Add `escapeRegExp()` in the test because labels contain parentheses.

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/journey/AppLauncher.test.tsx`

Expected: FAIL because the old English text/details UI remains.

- [ ] **Step 3: Implement metadata and four decorative SVGs**

```ts
export const APP_NAV_ITEMS = [
  { id: 'main', accessibleLabel: '자금 흐름 (Main)', shortLabel: '자금 흐름', availability: 'available' },
  { id: 'simulation', accessibleLabel: '미래 성장 (Simulation)', shortLabel: '미래 성장', availability: 'available' },
  { id: 'portfolio', accessibleLabel: '투자 배분 (Portfolio)', shortLabel: '투자 배분', availability: 'available' },
  { id: 'account-map', accessibleLabel: '계좌 연결 (Account Map)', shortLabel: '계좌 연결', availability: 'readiness' },
] as const satisfies ReadonlyArray<AppNavigationItem>;
```

Each SVG uses `viewBox="0 0 24 24"`, `aria-hidden="true"`, `focusable="false"`, `fill="none"`, `stroke="currentColor"`, `strokeLinecap="round"`, and `strokeLinejoin="round"`. The Account Map icon must visibly resemble an open passbook rather than a generic network node.

- [ ] **Step 4: Replace details with semantic icon links**

Render `<ul>` directly inside `<nav aria-label="ISF 앱">`. Each anchor receives an exact accessible label composed from metadata plus `, 현재 위치` and/or `, 준비 중`, and current anchor receives `aria-current="page"`. Render no visible app-name text and no `ISF` brand label.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm run test:unit -- tests/unit/journey/AppLauncher.test.tsx && npm run check`

```bash
git add src/journey/ui tests/unit/journey/AppLauncher.test.tsx
git commit -m "feat(journey): add icon app navigation"
```

### Task 2: Tooltip, Narrow Help, and Mobile Long Press

**Files:**
- Modify: `src/journey/ui/AppLauncher.tsx`
- Modify: `tests/unit/journey/AppLauncher.test.tsx`

**Interfaces:**
- Launcher state: `activeTooltip: JourneyApp | null`, `helpOpen: boolean`
- Constants: `LONG_PRESS_MS = 450`, `TOOLTIP_CLOSE_MS = 80`
- Refs: long-press timer, close timer, pointer id, independent suppress-next-click/contextmenu flags, launcher root

- [ ] **Step 1: Add failing tooltip and help tests**

```tsx
it('shows equivalent pointer, focus and narrow-help labels', () => {
  render(<AppLauncher currentApp="portfolio" />);
  const main = screen.getByRole('link', { name: /자금 흐름 \(Main\)/ });
  fireEvent.mouseEnter(main);
  expect(screen.getByRole('tooltip')).toHaveTextContent('자금 흐름 (Main)');
  fireEvent.keyDown(main, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.focus(main);
  expect(screen.getByRole('tooltip')).toHaveTextContent('자금 흐름 (Main)');

  const help = screen.getByRole('button', { name: '앱 아이콘 도움말' });
  expect(help).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(help);
  expect(help).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: '앱 아이콘 안내' })).toHaveTextContent('계좌 연결 (Account Map)준비 중');
});
```

- [ ] **Step 2: Add failing fake-timer long-press tests**

Use `vi.useFakeTimers()` and restore real timers after each test. Cover:

```tsx
fireEvent.pointerDown(link, { pointerId: 1, pointerType: 'touch' });
vi.advanceTimersByTime(449);
expect(screen.queryByRole('tooltip')).toBeNull();
vi.advanceTimersByTime(1);
expect(screen.getByRole('tooltip')).toHaveTextContent('미래 성장 (Simulation)');
const click = new MouseEvent('click', { bubbles: true, cancelable: true });
expect(link.dispatchEvent(click)).toBe(false);
```

Separate tests prove pointer up before 450ms, pointer move and pointer cancel do not open tooltip. A successful touch long press suppresses one contextmenu; mouse contextmenu remains unmodified.

- [ ] **Step 3: Verify RED**

Run: `npm run test:unit -- tests/unit/journey/AppLauncher.test.tsx`

Expected: FAIL because tooltip/help/long-press behavior does not exist.

- [ ] **Step 4: Implement interaction state**

- Pointer enter/focus opens the fixed-value tooltip.
- Pointer leave/blur schedules the 80ms close and re-entry cancels it.
- Escape closes tooltip and help.
- The narrow `?` button uses `aria-expanded`, `aria-controls`, and toggles a non-modal `role="region"` panel.
- Document `pointerdown` outside the launcher closes help; component cleanup removes listeners and timers.
- Touch pointer down starts 450ms timer; up/move/cancel clears it.
- Timer success opens tooltip and sets independent one-shot click and contextmenu suppression flags so either browser event order is safe.
- Do not prevent a normal short click or a mouse right click.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm run test:unit -- tests/unit/journey/AppLauncher.test.tsx && npm run check`

```bash
git add src/journey/ui/AppLauncher.tsx tests/unit/journey/AppLauncher.test.tsx
git commit -m "feat(journey): explain app icons"
```

### Task 3: Bedrock Styling, Responsive E2E, and Design Contract

**Files:**
- Modify: `src/journey/ui/journey.css`
- Modify: `tests/app-journey.spec.ts`
- Modify: `tests/unit/portfolio/legacyIsolation.test.ts` only if its retired-selector list names removed launcher selectors
- Modify: `DESIGN.md`

**Interfaces:**
- CSS contracts: `.journey-launcher__app-link` 44×44; `.journey-launcher__help-hit` 32×44; `.journey-launcher__help-visual` 30×30; `.journey-launcher__help-panel` 220px max `calc(100vw - 32px)`
- Preserves: `.journey-launcher`, `aria-current`, `ISF 앱` navigation name

- [ ] **Step 1: Update E2E expectations first and verify RED**

Replace old `summary` interactions and English status names. At 390×844, 768×900 and 1280×900 assert:

```ts
const appLinks = page.locator('.journey-launcher__app-link');
await expect(appLinks).toHaveCount(4);
for (const link of await appLinks.all()) {
  const box = await link.boundingBox();
  expect(box?.width).toBe(44);
  expect(box?.height).toBe(44);
}
const helpHit = page.getByRole('button', { name: '앱 아이콘 도움말' });
expect(await helpHit.evaluate((element) => {
  const hit = element.getBoundingClientRect();
  const visual = element.querySelector('[data-help-visual]')!.getBoundingClientRect();
  return { hit: [hit.width, hit.height], visual: [visual.width, visual.height] };
})).toEqual({ hit: [32, 44], visual: [30, 30] });
```

Also assert one-line geometry, no horizontal overflow, current `aria-current`, focus ring, desktop hover tooltip, keyboard tooltip, help-panel width ≤220 and viewport containment, touch long press tooltip without navigation, short click route navigation, and reduced-motion transition durations of `0s`.

Run: `npx playwright test tests/app-journey.spec.ts --reporter=list`

Expected: FAIL against the unstyled/old E2E contract.

- [ ] **Step 2: Replace launcher CSS with the approved visual system**

- Remove details/summary and desktop media-query rules.
- Use one borderless inline-flex/list row with a subtle bottom divider.
- Keep all four app hit areas 44×44 and help hit area 32×44.
- Size app SVGs consistently; current icon uses stronger color/stroke and a stable 22×2 underline.
- Keep readiness dot visually secondary.
- Tooltip uses compact fixed positioning/anchoring without intercepting pointer events.
- Help panel is 220px, `max-width: calc(100vw - 32px)`, padding 8px, compact rows, natural wrapping for English names, and viewport-safe alignment.
- Add visible focus states and `prefers-reduced-motion` transition removal.

- [ ] **Step 3: Update DESIGN**

Document the four exact labels/icons, icon-only navigation, normal versus narrow size rules, tooltip/focus/long-press/help equivalence, Account Map readiness dot, and required responsive viewports. Remove statements describing the old details launcher.

- [ ] **Step 4: Run focused and full verification**

```bash
npm run check
npm run test:unit -- tests/unit/journey/AppLauncher.test.tsx tests/unit/portfolio/legacyIsolation.test.ts
npx playwright test tests/app-journey.spec.ts --reporter=list
npm run test:unit
npm run test:e2e -- --reporter=list
git diff --check
```

Expected: all active tests pass; intentional legacy skips remain skips.

- [ ] **Step 5: Perform visual inspection**

Use Orca Browser when its runtime is available. Inspect Main, Simulation, Portfolio and Account Map at 390px, 768px and desktop for icon recognizability, current underline, tooltip/help containment, density and focus. If Orca runtime remains unavailable, capture equivalent Playwright screenshots and record that fallback rather than claiming Orca inspection.

- [ ] **Step 6: Commit**

```bash
git add src/journey/ui/journey.css tests/app-journey.spec.ts tests/unit/portfolio/legacyIsolation.test.ts DESIGN.md
git commit -m "style(journey): polish app navigation"
```

- [ ] **Step 7: Request final review**

Review the full range from the plan base through HEAD against the approved spec. Resolve Critical/Important findings and rerun affected tests; repeat full verification after production changes.

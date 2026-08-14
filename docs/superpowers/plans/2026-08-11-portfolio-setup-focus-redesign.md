# Portfolio Setup Focus Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portfolio 최초 설정 2/3과 3/3을 금액 중심의 summary-first 모바일 흐름으로 재설계한다.

**Architecture:** 기존 `PortfolioDraft`와 저장 계약은 유지하고, `materializeAllocation` 결과를 setup 전용 라이브 요약과 검토 목록으로 표현한다. 편집 동작은 `AllocationEditor`에 유지하며 setup presentation에만 시각 계층을 추가한다.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, Playwright

## Global Constraints

- Main 투자금은 읽기 전용이며 Portfolio draft/apply 저장 계약을 바꾸지 않는다.
- 2/3은 총 투자금과 성장·안정 비율을 먼저 보여주고 입력은 그 아래 둔다.
- 3/3은 성장·안정 합계와 모든 대상의 금액·비율을 함께 보여준다.
- 현금은 안정 및 자동 배분 상태를 텍스트로 표시한다.
- 390px, 768px, desktop에서 가로 overflow 없이 44px touch target을 유지한다.
- 강조는 화면당 핵심 제목, 핵심 합계, 주요 CTA에 집중한다.

---

### Task 1: Setup 요약과 검토 행동 계약

**Files:**
- Modify: `tests/unit/portfolio/PortfolioApp.test.tsx`
- Modify: `src/portfolio/ui/PortfolioSetupFlow.tsx`
- Modify: `src/portfolio/ui/AllocationEditor.tsx`

**Interfaces:**
- Consumes: `materializeAllocation(draft, investmentWon)`, `stableShareUnits(items, cashShareUnits)`
- Produces: setup 라이브 요약 region과 대상별 검토 list

- [ ] **Step 1: Write the failing test**

```tsx
it('shows a live strategy summary during allocation and reviews every amount with its percentage', async () => {
  // 최초 setup에서 성장 60%, 안정 40%가 입력과 검토에 노출되는지 검증한다.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx`
Expected: FAIL because the setup strategy summary and review allocation list do not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
<section className="portfolio-setup-summary" aria-label="현재 배분 요약">...</section>
<ul className="portfolio-setup-review__list">...</ul>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx`
Expected: PASS.

### Task 2: 선택과 집중 시각 계층과 반응형 동작

**Files:**
- Modify: `src/portfolio/ui/portfolio.css`
- Modify: `tests/portfolio.spec.ts`

**Interfaces:**
- Consumes: Task 1 semantic class names and accessible regions
- Produces: 390px/768px/desktop summary-first layout

- [ ] **Step 1: Write the failing browser assertion**

```ts
await expect(page.getByRole('region', { name: '배분 검토' })).toContainText('120,000원');
await expect(page.getByRole('region', { name: '배분 검토' })).toContainText('60%');
```

- [ ] **Step 2: Run focused Playwright test to verify it fails**

Run: `npx playwright test tests/portfolio.spec.ts -g "creates one allocation"`
Expected: FAIL because the review region is absent.

- [ ] **Step 3: Implement the responsive styles and browser contract**

```css
.portfolio-setup-summary { /* quiet flat summary above controls */ }
.portfolio-setup-review__item { /* name/classification left, amount/ratio right */ }
```

- [ ] **Step 4: Run focused unit and browser verification**

Run: `npm run test:unit -- tests/unit/portfolio/PortfolioApp.test.tsx tests/unit/portfolio/AllocationEditor.test.tsx`
Run: `npx playwright test tests/portfolio.spec.ts -g "creates one allocation"`
Expected: PASS.

### Task 3: Full verification

**Files:**
- Verify only

**Interfaces:**
- Consumes: completed UI and tests
- Produces: release evidence

- [ ] **Step 1: Run static and focused verification**

Run: `npm run check`
Run: `git diff --check`
Expected: exit 0.

- [ ] **Step 2: Run Portfolio test coverage**

Run: `npm run test:unit -- tests/unit/portfolio`
Run: `npx playwright test tests/portfolio.spec.ts`
Expected: all selected tests pass.

- [ ] **Step 3: Visually inspect required viewports**

Inspect setup 2/3 and 3/3 at 390px, 768px, and desktop for overflow, focus visibility, touch targets, and hierarchy.

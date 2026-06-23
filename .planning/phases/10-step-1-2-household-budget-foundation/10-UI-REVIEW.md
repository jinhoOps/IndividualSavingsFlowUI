# Phase 10 - UI Review

**Audited:** 2026-06-23
**Baseline:** `10-UI-SPEC.md`
**Screenshots:** not captured (no dev server on localhost:3000, 5173, 8080, or 5174)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 1/4 | Required UI-SPEC labels are missing or replaced by generic legacy copy. |
| 2. Visuals | 1/4 | The required default household budget panel and detailed Phase 10 household modal are not present. |
| 3. Color | 2/4 | Status colors exist partially, but Phase 10 adds gradients and hardcoded colors outside the contract. |
| 4. Typography | 2/4 | Phase 10 additions use many undeclared rem sizes and heavy weights instead of the four-size, two-weight contract. |
| 5. Spacing | 2/4 | Amount input sizing and compact spacing do not meet the 176px/14ch readability and 4px scale rules. |
| 6. Experience Design | 1/4 | Core Phase 10 task flow is incomplete: no entry panel, no actual-spending controls, no budget modal save/cancel workflow. |

**Overall: 9/24**

---

## Top 3 Priority Fixes

1. **Restore the Phase 10 household budget entry and modal contract** - users cannot complete the specified Step 1.2 budget workflow - add `#householdBudgetPanel`, `#openHouseholdBudgetModal`, `#householdBudgetModal`, `renderHouseholdBudgetPanel()`, and `createHouseholdBudgetController()` or update the UI-SPEC/tests to match the integrated financial-modal design.
2. **Implement the big-flow financial settings surface exactly as specified** - current copy and layout do not show income, living outflow, investment, and read-only automatic savings in order - retitle the modal to `재무설정 상세` or `월 현금흐름 설정`, use `재무설정 저장`, and render `월수입`, `월 생활비`, `월 투자`, `자동 저축`, `부부 합산`, `본인 설정`, and `배우자 설정`.
3. **Expose variable target/actual budget controls and projection UI** - Phase 10 data helpers exist but users cannot edit actual spending or see `월말 예상` from the UI - render only variable rows with `data-household-budget-target`, `data-household-budget-actual`, remaining, status, and the projection helper copy.

---

## Detailed Findings

### Pillar 1: Copywriting (1/4)

**BLOCKER:** The UI-SPEC requires the default household labels `신혼부부 예산` and `예산 상세 편집`, but the actual default summary area contains only `재무 설정 요약` and `#summaryCards` in `apps/main/index.html:44-53`. The grep scan found `신혼부부 예산` only in tests, not in `apps/main`.

**BLOCKER:** The financial settings modal still initializes as `재무 항목 상세` with generic buttons `취소` and `저장` in `apps/main/index.html:692-715`. UI-SPEC requires `재무설정 상세`, `편집 취소`, and `재무설정 저장` for the integrated financial settings flow.

**WARNING:** The integrated household board uses `부부 현황 설정`, `단독/부부 모드와 월소득을 이 재무설정 안에서 바로 관리합니다.`, `급여`, `생활비`, `고정지출 합계`, and `월저축` in `apps/main/modules/financial-modal-controller.js:383-473`. These do not match the copy contract for `월수입`, `월 생활비`, `월 투자`, `자동 저축`, `부부 합산`, `본인 설정`, and `배우자 설정`.

**WARNING:** The required empty state `추적할 변동비가 없습니다` and body copy are absent from `apps/main`; existing empty copy is generic visualization/list text such as `표시할 흐름이 없습니다.` in `apps/main/index.html:460`.

### Pillar 2: Visuals (1/4)

**BLOCKER:** The executed summaries say `#householdBudgetPanel` was added before `#summaryCards`, but the current DOM has no host there. `apps/main/index.html:44-53` goes directly from the section heading to `#summaryCards`, and `apps/main/modules/dom.js:87-90` registers no `householdBudgetPanel`.

**BLOCKER:** The expected new files `apps/main/modules/household-budget-renderer.js` and `apps/main/modules/household-budget-controller.js` do not exist in the current tree. The actual wiring remains `renderFinancialSummaryGroups(dom.summaryCards, ...)` in `apps/main/modules/render-orchestrator.js:41-46` and `createFinancialModalController(...)` in `apps/main/modules/event-bindings.js:97-100`.

**WARNING:** The integrated household overview is not the specified big-flow matrix. It renders a two-column overview board plus seven metric cells in `apps/main/modules/financial-modal-controller.js:367-476`, not the required row order of income, monthly living outflow, monthly investment, and read-only automatic savings.

### Pillar 3: Color (2/4)

**WARNING:** UI-SPEC requires flat white panels with solid borders and no gradients. Phase 10-related CSS uses `background:linear-gradient(...)` for `.household-overview-board` in `apps/main/styles.css:195`, violating the flat-panel rule.

**WARNING:** Budget status colors are partially present for `여유` and `주의` in `apps/main/styles.css:200-201`, but the default `.household-overview-ratio` over state uses hardcoded red/brown values in `apps/main/styles.css:199` rather than the declared `#991b1b` / `#fee2e2` over-budget pair.

**WARNING:** Active `단독`/`부부` segmented controls use a white active state with shadow in `apps/main/styles.css:226-228`; UI-SPEC reserves `var(--tone-primary)` for active segmented options and focus rings.

### Pillar 4: Typography (2/4)

**WARNING:** Phase 10 contract declares exactly four sizes: 16px, 14px, 18px, and 24px. The audit found many CSS font sizes in `apps/main/styles.css`, including `0.72rem`, `0.76rem`, `0.8rem`, `0.84rem`, `0.86rem`, `0.96rem`, `1rem`, `1.32rem`, and `1.45rem`. Phase 10 selectors specifically use `1rem`, `0.76rem`, `1.32rem`, and `0.96rem` in `apps/main/styles.css:197-207`.

**WARNING:** The contract allows weights 400 and 700. Phase 10-related selectors use heavier weights such as `font-weight:800` and `font-weight:900` in `apps/main/styles.css:202`, `206`, `215`, `222`, and `227`.

**WARNING:** The global theme still contains negative letter spacing in `shared/styles/step-theme.css:61`, `159`, and `192`; new Phase 10 selectors do not explicitly normalize letter spacing to `0`, so they inherit a contract violation for headings.

### Pillar 5: Spacing (2/4)

**WARNING:** Amount field layout rules require 176px preferred width and 14ch minimum. The financial modal edit grid uses `minmax(150px,1.1fr) minmax(170px,1fr) minmax(190px,1.25fr)` in `apps/main/styles.css:220`, and inputs are set to `min-width:0` in `apps/main/styles.css:223`, so editable money fields can shrink below the specified readable minimum.

**WARNING:** The integrated household board uses compact hardcoded values such as `gap:10px`, `padding:12px`, `min-height:70px`, `gap:3px`, and `padding:8px 10px` in `apps/main/styles.css:195-205`. These are not consistently from the declared 4/8/16/24/32 spacing scale.

**WARNING:** Existing Step 1 amount/editor controls still include extensive inline styles and fixed widths, for example stepper buttons in `apps/main/modules/list-renderer.js:199-227` and creator fields in `apps/main/modules/list-renderer.js:530-620`. These weaken the Phase 10 amount-readability acceptance criteria because they bypass the centralized spacing and sizing contract.

### Pillar 6: Experience Design (1/4)

**BLOCKER:** The implemented tests currently assert `#householdBudgetPanel` has count `0` in `tests/step1.spec.ts:1430`, directly contradicting the Phase 10 plan and UI-SPEC requirement for a default Step 1.2 entry/status panel.

**BLOCKER:** No UI route exposes `data-household-budget-row`, `data-household-budget-target`, or `data-household-budget-actual`; the grep scan found those selectors only in tests at `tests/step1.spec.ts:1458-1459`. The user cannot edit variable actual spending, so BUD-01/BUD-02 are data-only, not usable UI.

**BLOCKER:** The projection helper exists in `apps/main/modules/household-budget.js:20` and is tested at `tests/step1.spec.ts:1404`, but there is no UI copy for `월말 예상` or `현재 사용 속도를 단순 환산한 참고값입니다.` in `apps/main`. BUD-04 is not visible to users.

**WARNING:** Save/cancel behavior exists through the generic financial modal save path in `apps/main/modules/financial-modal-controller.js:879-897`, but the labels, modality, and fields are not the required Phase 10 `예산 저장` / `편집 취소` household budget lifecycle described in Plans 10-03 and UI-SPEC.

---

## Files Audited

- `.planning/phases/10-step-1-2-household-budget-foundation/10-CONTEXT.md`
- `.planning/phases/10-step-1-2-household-budget-foundation/10-UI-SPEC.md`
- `.planning/phases/10-step-1-2-household-budget-foundation/10-01-PLAN.md`
- `.planning/phases/10-step-1-2-household-budget-foundation/10-02-PLAN.md`
- `.planning/phases/10-step-1-2-household-budget-foundation/10-03-PLAN.md`
- `.planning/phases/10-step-1-2-household-budget-foundation/10-01-SUMMARY.md`
- `.planning/phases/10-step-1-2-household-budget-foundation/10-02-SUMMARY.md`
- `.planning/phases/10-step-1-2-household-budget-foundation/10-03-SUMMARY.md`
- `apps/main/index.html`
- `apps/main/styles.css`
- `apps/main/modules/dom.js`
- `apps/main/modules/event-bindings.js`
- `apps/main/modules/render-orchestrator.js`
- `apps/main/modules/input-sanitizer.js`
- `apps/main/modules/household-budget.js`
- `apps/main/modules/financial-summary.js`
- `apps/main/modules/financial-modal-controller.js`
- `tests/step1.spec.ts`

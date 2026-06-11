# Phase 13: Core Refactoring & Stability - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

app.js(step1) 핵심 로직의 3계층(상태/헬퍼/UI) 모듈화 완성 + 단위 정합성(만원/원) 전면 점검 + 과세 경고 임계값 콘스턴트화 + 미사용 코드(step1~shared/) 전면 제거.

bindControls 이벤트 바인딩 분리는 이번 Phase 범위 밖이며 Phase 14 이후로 미룬다.
</domain>

<decisions>
## Implementation Decisions

### 모듈화 경계 (REF-01)
- **D-01:** `renderCards`, `renderProjectionTable`, `renderItemList`, `renderAllocationItemHtml`, `renderIncomeItemHtml`, `renderInputHints`, `getPendingSummaryText` 등 순수 UI 렌더 함수(약 200줄)를 `apps/step1/modules/list-renderer.js`로 추출한다.
- **D-02:** step2의 `renderers.js` 임포트 패턴을 참조하여 `app.js`가 `list-renderer.js`를 단일 임포트로 사용하도록 한다.
- **D-03:** `bindControls` 및 그 내부 이벤트 핸들러 분리는 이번 Phase에서 수행하지 않는다. (Phase 14 이후 범위)

### 에이전트 판단 영역
- **모듈 파일명:** `list-renderer.js` (step2의 `renderers.js` 패턴과 대응, 명칭을 더 구체화함)
- **안전망 방식:** 런타임 검증 코드 추가 없이, PLAN.md에 수동 체크리스트를 포함한다. (단순성 우선)

### 안정성 점검 우선순위 (STAB-01 → STAB-02)
- **D-04:** STAB-01(단위 정합성) 먼저 점검한다. 점검 방식은 "입력 → 정제 → 계산 → 저장" 전 구간 시나리오를 직접 조성하는 수동 점검으로 한다.
- **D-05:** STAB-01 완료 후 STAB-02(과세 경고) 점검으로 이어간다.
- **D-06:** STAB-02 점검 핵심 포인트는 `getFinancialIncomeStatus` 내 임계값(1,900만 원 / 3,400만 원)이 하드코딩된 숫자인지 `constants.js`에 정의된 상수인지 확인하는 것이다. 하드코딩 시 상수로 전환한다.

### 미사용 코드 정리 범위 (REF-02)
- **D-07:** 정리 범위는 step1뿐만 아니라 `shared/` 폴더까지 포함한다.
- **D-08:** 제거 기준은 ESLint `no-unused-vars` 레벨의 항목화이며, AI 기능 잔재 스텁/주석뿐 아니라 비호출 함수도 전부 제거한다.
- **D-09:** `shared/components/data-hub-modal.js`의 Phase 10 AI 기능 잔재가 우선 감사 대상이다.

### 리팩터링 안전망
- **D-10:** PLAN.md에 다음 6종 핵심 헬퍼 함수를 포함한 체크리스트를 반드시 포함한다: `hasPendingChanges`, `markPendingChanges`, `commitImmediateInputs`, `getVisibleInputs`, `markDirty`, `markClean`. 리팩터링 전/후 이 함수들이 정상적으로 export되고 app.js에서 호출 가능한 상태인지 대조 확인한다.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 핵심 규칙 및 원칙
- `GEMINI.md` — 단위 정합성(만원/원), 물리적 무결성(절삭 방지), 3계층 구조 보존 원칙 정의
- `.gemini/knowledge/wiki/INDEX.md` — 프로젝트 메타 지식 마스터 인덱스

### 요구사항 및 계획
- `.planning/REQUIREMENTS.md` — REF-01, REF-02, STAB-01, STAB-02 요건 정의
- `.planning/ROADMAP.md` — Phase 13 성공 기준 4가지 명시
- `.planning/codebase/ARCHITECTURE.md` — 3계층 구조 및 단위 정합성 제약 사항
- `.planning/codebase/CONCERNS.md` — 핵심 헬퍼 유실 위험, AI 코드 잔재, 비대화된 app.js 기술 부채 기록

### 참조 코드 파일
- `apps/step1/app.js` — 리팩터링 주 대상 파일 (868줄, 렌더 함수 200줄 추출 대상)
- `apps/step1/modules/state-helpers.js` — 이미 분리된 헬퍼 모듈 (패턴 참조)
- `apps/step1/modules/ui-controller.js` — 이미 분리된 UI 동기화 모듈 (패턴 참조)
- `apps/step2/app.js` — 경량화된 오케스트레이터 패턴 참조 (renderers.js 임포트 방식)
- `shared/components/data-hub-modal.js` — AI 기능 잔재 감사 우선 대상
- `shared/core/utils.js` — IsfUtils.toWon, toMan, formatMoney 변환 함수 정의
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/step1/modules/state-helpers.js`: markDirty, markClean, hasPendingChanges 등 14종 헬퍼 이미 분리 완료. 추가 추출 시 이 파일 패턴을 그대로 따른다.
- `apps/step2/modules/renderers.js`: step2의 렌더 함수 모듈화 선례. list-renderer.js 설계 시 참조.
- `apps/step1/modules/ui-controller.js`: syncViewModeUi 등 UI 동기화 함수 이미 분리. list-renderer.js가 담당할 영역과 명확히 구분되어야 함(동기화 vs. HTML 렌더링).

### Established Patterns
- `import * as helpers from "./modules/state-helpers.js"`: 현재 app.js의 헬퍼 임포트 방식. list-renderer.js 추출 후에도 동일한 네임스페이스 임포트 패턴을 유지한다.
- 단위 변환 패턴: `IsfUtils.toWon(value)` / `IsfUtils.toMan(value)` 사용 — 직접 `* 10000` 또는 `/ 10000` 산술 금지.
- No-build 지향: 추출된 모듈은 반드시 ES Module (`export` / `import`) 기반 상대 경로를 사용하여 브라우저에서 빌드 없이 직접 실행 가능해야 한다.

### Integration Points
- `app.js`의 `renderAll()` 함수가 `renderCards`, `renderProjectionTable`, `renderItemList` 등을 직접 호출 중. 추출 후 `renderAll()`이 `list-renderer.js`에서 import한 함수를 호출하도록 수정.
- `getFinancialIncomeStatus` 호출: `app.js` L741에서 `IsfUtils.getFinancialIncomeStatus(r.annualFinancialIncome)` 사용 중. STAB-02 점검 시 이 호출 경로가 올바른지 확인.
</code_context>

<specifics>
## Specific Ideas

- 과세 임계값 상수명 제안: `FINANCIAL_INCOME_WARN_THRESHOLD` (19,000,000원), `FINANCIAL_INCOME_CRIT_THRESHOLD` (34,000,000원) → `apps/step1/modules/constants.js`에 정의
- list-renderer.js에서 IsfUtils.escapeHtml을 통해 모든 사용자 입력 렌더링 시 XSS 방지를 유지해야 한다. (기존 app.js 코드에서 이미 사용 중이므로 그대로 이식)
</specifics>

<deferred>
## Deferred Ideas

- **bindControls 이벤트 핸들러 분리** — Phase 14 이후 범위. applyPreset 클릭 핸들러 등 이벤트 바인딩을 feature-controllers.js 확장으로 이동하는 작업.
- **step3 app.js 모듈화** — 이번 Phase는 step1과 shared/ 집중. step3 감사는 별도 Phase에서 진행.

None — 그 외 논의는 Phase 13 범위 내에서 진행됨.
</deferred>

---

*Phase: 13-Core Refactoring & Stability*
*Context gathered: 2026-05-20*

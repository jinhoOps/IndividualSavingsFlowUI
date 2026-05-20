# Phase 13: Core Refactoring & Stability - Discussion Log

**Session date:** 2026-05-20
**Areas discussed:** 모듈화 경계, STAB 오류 수정 우선순위, 미사용 코드 정리 범위, 리팩터링 안전망

---

## Area 1: 모듈화 경계

**Question 1:** renderCards / renderProjectionTable / renderAllocationItemHtml 등 app.js 잔류 UI 렌더 함수(약 200줄)를 어떻게 처리할까요?
- Options: 새 모듈로 추출 (item-renderer.js) / app.js에 유지 / You decide
- **Selected:** You decide — 에이전트 판단에 맡김
- **Agent discretion:** list-renderer.js로 추출. step2의 renderers.js 패턴 참조. app.js 경량화 및 3계층 경계 명확화 목적.

**Question 2:** bindControls 내 이벤트 핸들러 일부도 이번 Phase 13에서 분리할까요?
- Options: feature-controllers.js로 이동 / app.js에 유지 / 이 단계에서는 범위 밖
- **Selected:** 이 단계에서는 bindControls 분리가 범위 밖 — 다음 페이즈로 미룸

---

## Area 2: STAB 오류 수정 우선순위

**Question 1:** STAB-01(단위 정합성)과 STAB-02(과세 경고 로직) 중 어느 것을 먼저 점검할까요?
- Options: STAB-01 먼저 / STAB-02 먼저 / 병렬 점검
- **Selected:** STAB-01 먼저 — 단위 정합성(만원/원) 전면 점검 후 STAB-02 과세 경고 비즈니스 로직 점검

**Question 2:** STAB-01 점검 방식은?
- Options: IsfUtils 호출 누락 여부만 확인 / 데이터 흐름 전 구간 테스트 / You decide
- **Selected:** 데이터 흐름 전 구간 테스트 — 입력에서 저장까지 단위가 지켜지는지 시나리오를 직접 조성하여 수동 점검

**Question 3:** STAB-02 과세 경고 로직 점검 핵심 포인트는?
- Options: getFinancialIncomeStatus 함수 로직과 임계값 두 가지 모두 확인 / 임계값 콘스턴트화 여부만 확인 / status-badge 렌더링 일관성 확인
- **Selected:** 임계값 콘스턴트화 여부만 확인 — 하드코딩된 숫자 vs. constants.js 정의 여부

---

## Area 3: 미사용 코드 정리 범위 (REF-02)

**Question 1:** 정리 범위를 어디까지 할까요?
- Options: step1만 감사 / step1~3 모두 감사 / shared/ 폴더까지 포함
- **Selected:** shared/ 폴더까지 포함 — data-hub-modal.js 등 공유 코드도 정리

**Question 2:** shared/ 폴더 정리 시 제거 대상 기준은?
- Options: AI 잔재만 제거 / 비호출 함수도 전부 제거 / You decide
- **Selected:** 비호출 함수도 전부 제거 — ESLint no-unused-vars 레벨로 항목화 후 전면 제거

---

## Area 4: 리팩터링 안전망

**Question 1:** 핵심 헬퍼 14종 유실 방지 방법은?
- Options: 수동 체크리스트 / 런타임 검증 코드 추가 / You decide
- **Selected:** You decide — 에이전트 판단에 맡김
- **Agent discretion:** PLAN.md에 수동 체크리스트 포함. 핵심 6종(hasPendingChanges, markPendingChanges, commitImmediateInputs, getVisibleInputs, markDirty, markClean) 리팩터링 전/후 대조 의무화.

**Question 2:** 체크리스트에서 가장 중요한 항목은?
- Options: state-helpers.js 분리 완료 여부 확인 / 직접 정의된 헬퍼 추가 추출 판단 / 핵심 비즈니스 참조 함수 전체 포함
- **Selected:** User Skipped
- **Agent discretion:** 6종 핵심 헬퍼 포함으로 처리.

---

## Deferred Ideas

- bindControls 이벤트 핸들러 분리 — Phase 14 이후 범위
- step3 app.js 모듈화 — 별도 Phase

---

*Discussion log generated: 2026-05-20*

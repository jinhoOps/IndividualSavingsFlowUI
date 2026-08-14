# Account Map PR Review Closure Design

**Date:** 2026-08-14

**Status:** Approved for implementation

**Scope:** Account Map PR 후보 `86ac553`의 최신 main 통합과 병합 차단 리뷰 finding 해소

## 1. Goal

Account Map 지원 제품 브랜치를 최신 `origin/main`과 통합하고, 저장소 작업 계약·신규 금융 위치 생성·지도 접근성의 남은 불일치를 해소한 뒤 전체 검증과 반응형 QA를 거쳐 GitHub PR을 만든다.

## 2. Ordered Delivery

작업 순서는 다음과 같으며 앞 단계가 검증되기 전 다음 단계로 넘어가지 않는다.

1. 최신 `origin/main` 병합과 충돌 해결
2. `AGENTS.md` 제품 계약 정렬
3. 위치 종류 생성과 접근성 명칭 보완
4. 전체 unit·E2E·build 및 390px·768px·desktop QA
5. PR 생성

`artifacts/`는 사용자 소유 산출물로 취급해 읽거나 수정하거나 커밋하지 않는다.

## 3. Main Integration Contract

- published branch를 rebase하거나 force-push하지 않고 최신 `origin/main`을 no-ff merge한다.
- conflict는 파일 전체 선택이 아니라 field-level로 해결한다.
- 최신 main의 브랜드 웰컴 인트로, PWA 아이콘·manifest, 공통 reduced-motion hook과 런처 측정 계약을 보존한다.
- Account Map의 지원 React 경로, workspace v2, Portfolio 위치 UI 제거, 승인 spec과 회귀 테스트를 보존한다.
- 통합 뒤 PRD의 `최신 origin/main 통합` 완료 표시는 실제 branch 상태 및 검증 증거와 일치해야 한다.

## 4. Repository Contract Alignment

`AGENTS.md`는 Account Map을 준비 화면이 아니라 현재 지원 제품으로 설명한다.

- Account Map은 최신 Main 다섯 월 금액을 읽기 전용으로 사용한다.
- Account Map은 `workspace.locations`와 `workspace.accountMap`만 갱신한다.
- Main·Simulation·Portfolio에는 write-back하지 않는다.
- Portfolio는 aggregate 배분만 소유하고 위치 관리 UI를 제공하지 않는다.

PRD·README·DESIGN·승인된 Account Map spec과 같은 제품 경계를 사용한다.

## 5. Financial Location Creation

신규 `계좌·보관처 추가`는 기존 `FinancialLocationKind` 전체를 표현한다.

- `bank`: 은행 계좌. 기존 9개 빠른 기관과 직접 입력 기관을 사용한다.
- `brokerage`: 증권 계좌. 기관 직접 입력과 표시 이름을 받는다.
- `cash`: 현금·기타 보관처. 기관을 저장하지 않고 표시 이름만 받는다.

종류 선택은 생성 form 안의 단일 선택 control로 제공한다. 기존 active location 선택, archived duplicate 복원, purpose role의 원자적 추가와 연결 저장 계약은 바꾸지 않는다. 중복 판정은 기존 institution comparison key를 그대로 사용하며 현금·기타는 `institution:none + normalizedShortName`으로 비교한다.

## 6. Accessible Amount Meaning

계좌·보관처 node의 accessible name은 표시 금액을 `활성 월 연결 합계`라고 명시한다. 잔액·거래액으로 오해할 표현을 사용하지 않는다.

Purpose node는 현재 Main 기준 또는 custom target 의미를 유지한다. 종류·이름·금액 의미·활성 연결 수·상태를 accessible name에 포함한다.

## 7. Verification and QA

- 병합 직후 충돌 marker와 reverse deletion을 확인한다.
- 위치 종류와 accessible name은 TDD로 RED→GREEN 증거를 남긴다.
- `npm run check`, 전체 unit, 전체 E2E, production Vite build와 `git diff --check`를 실행한다.
- 390×844, 768×1024, 1280×900에서 setup, 위치 종류별 생성, 지도 node, modal, focus, touch target, overflow와 reduced motion을 확인한다.
- Critical·Important가 없는 최종 코드 리뷰 뒤에만 PR을 만든다.

## 8. Non-goals

- Account Map과 Portfolio의 연결
- 계좌번호·잔액·거래·금융기관 실연동
- 위치 종류 schema 확장
- 최초 설정의 선택/필수 문구 재설계
- 제품 분석 지표 또는 telemetry 추가
- `artifacts/` 변경

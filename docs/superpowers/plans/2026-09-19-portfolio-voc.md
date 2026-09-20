# Portfolio VOC Implementation Plan

> **For agentic workers:** 사용자 승인 후 `superpowers:executing-plans`로 아래 작업을 순서대로 수행한다. 이번 작업은 계획에 따라 제품 구현과 검증을 함께 진행한다. 병렬 에이전트 실행을 전제로 하지 않는다.

**Goal:** 투자 대상 입력의 갑작스러운 위치 이동을 없애고, Simulation의 5%·9%·13% 선택에서 기존 Portfolio 샘플 상세로 이어준다. 세 앱 결과 화면의 중복 설명은 제거하고 UI로 의미를 전달한다.
**Architecture:** 항목 입력을 현재 배분 편집 영역의 하위 화면으로 옮긴다. 앱 연결은 허용된 URL 의도와 정적 매핑으로 기존 샘플 탐색을 초기화하며 Portfolio 적용은 기존 명시적 절차를 사용한다.
**Tech Stack:** React, TypeScript, 기존 CSS 토큰·Anime.js·native dialog, URLSearchParams, Vitest, Playwright.
**Spec:** [VOC 설계 제안 및 레퍼런스·캡처](../specs/2026-09-19-portfolio-voc-design.md).
**Status:** 구현 완료·검증 완료(2026-09-19). 사용자 확인: VOC는 버튼 위치가 아니라 **열리는 입력 폼 위치**다. 5% 시작 구성은 사용자 정정에 따라 SCHD 50 · 금 50이다. 화면 전환·샘플 연결·중복 설명 제거를 구현하고 검증했다.
**Baseline:** `0e08c2554cb6ad7f2e265da6c34bdcc166da7695`. 기존 미추적 `2026-09-16-portfolio-editor-hierarchy.md`는 다른 작업물로 보존한다.

## Global Constraints

- Main 소유 다섯 월간 값, Portfolio의 aggregate-only plan/draft, 최대 10개 대상, schema v5·protocol 5·보존 accountMap/locations·원자적 복원 계약을 유지한다.
- 새 DB 테이블·RPC·migration·localStorage key·추천 API·시세 수집·수익률별 새로운 포트폴리오를 만들지 않는다.
- 결과 화면에서 이미 보이는 금액·비율·선택 상태를 반복하는 설명 문장을 제거한다. 필요한 라벨·단위·접근성 이름·오류·저장/적용 상태는 유지한다.
- 추가 버튼은 현금 다음의 현재 위치를 유지한다. 핵심 문제는 새로운 입력 패널의 위치·중첩이다.
- 768px 이하 sheet, 769px 이상 panel의 **부모** 계약과 샘플 탐색의 1100px 분기를 유지한다.
- Simulation 연결 매핑은 정확히 5 → `schd-gold`의 SCHD 50 · 금 50 초기 구성, 9 → `qqqm-schd`의 70/30, 13 → `qld-schd-gold`의 50/30/20. 다른 유효 값은 전체 목록을 열며 가까운 숫자로 반올림하지 않는다.
- 자동 미리선택은 draft 변경이 아니며 기존 계획은 명시적 교체·적용 전까지 보존한다.
- 현재 제품 문서는 구현 변경과 함께 갱신한다. PRD·DESIGN에 인라인 입력, 샘플 연결, 결과 UI 계약을 반영한다.
- 커밋 시 `git var GIT_AUTHOR_IDENT`로 `KIM JINHO <okho04@gmail.com>`을 확인하고 해당 작업 파일만 stage한다.

## Review Focus

| 실패하기 쉬운 조건 | 사용자가 기대하는 결과 | 담당 검증 |
| --- | --- | --- |
| 최초 설정과 결과 재편집의 부모 화면이 다름 | 두 경로 모두 추가 폼이 현재 영역에 남음 | Task 1 단위·브라우저 |
| 항목 입력 중 Escape/폭 변경/계정 세션 만료 | 입력·focus 보존, 부모 편집기까지 연달아 닫히지 않음 | Task 1, Task 5 cloud |
| 자동 샘플 선택과 기존 미완료 draft가 함께 존재 | 자동 선택만으로 dirty·교체·저장이 발생하지 않음 | Task 3 |
| 13% 선택 직후 연속 클릭·저장 실패 | 화면 값과 이동 intent 일치, 설정 저장 유실·중복 탐색 없음 | Task 2, Task 5 cloud |
| 로그인 복귀·잘못된 URL·직접 입력 8.75%·0원 투자 | 의도 파싱과 기존 gate가 안전하게 작동, 임의 샘플 확정 없음 | Task 2–3, Task 5 |

## 실행 단위

**A(Task 1)는 독립적으로 배포 가능한 UX 개선**, **B(Task 2–3)는 독립적으로 검증 가능한 앱 연결**이다. B는 A의 새 폼 컴포넌트에 의존하지 않게 한다. 파일 소유가 겹치는 Portfolio UI는 같은 작업자가 순서대로 수정한다. **C(Task 4)는 세 앱 결과의 중복 문구 정리**이며 독립적으로 검증한다. Task 5는 결합 회귀 검증이다.

## Task 1: 현재 영역 안의 추가·수정 입력

**Files**

- Modify: `src/portfolio/ui/AllocationEditor.tsx` — 항목 선택·완료·복귀와 목록 스크롤/focus.
- Modify: `src/portfolio/ui/PortfolioItemSheet.tsx` — 기존 항목 필드·검증·미전송 복구를 유지하면서 inline 렌더 경로를 추가한다. standalone 경로의 dialog 계약은 유지한다.
- Modify: `src/portfolio/ui/PortfolioEditSurface.tsx`, `src/portfolio/ui/PortfolioSetupFlow.tsx`, `src/portfolio/ui/portfolio.css` — 현재 부모의 제목·본문·footer 전환.
- Test: `tests/unit/portfolio/AllocationEditor.test.tsx`, `tests/unit/portfolio/PortfolioItemSheet.test.tsx`, `tests/portfolio.spec.ts`.
- Docs: `DESIGN.md`, PRD, 두 2026-09-16 승인 spec의 대체 범위 표기.

**Interfaces**

- Consumes: 기존 `PortfolioItemSheetValue`의 name/amountWon/classification/classificationOrigin, `PortfolioAction`의 `draft-item-committed`·`draft-item-removed`.
- Produces: 기존 `PortfolioItemSheetValue`와 `onComplete(value): string | void`, `onClose()` 계약을 inline 경로에서도 사용한다. 부모는 목록/항목/샘플 중 한 화면만 활성화하고 전체 적용 행동은 목록에서만 노출.
- 현재 필드 검증과 복구 key를 이관한다. 동일 검증 함수를 새로 만들거나 범용 wizard/overlay 프레임워크를 만들지 않는다.

- [x] `git status --short`와 현재 ref 확인. 기존 작업물 보존. spec §4와 현재 DESIGN의 차이를 확정하고 문서 변경에 반영했다.
- [x] 단위 테스트: 추가를 열 때 aggregate 항목 수는 그대로, 완료 1회에 action 1회, 중복 이름·금액 오류는 입력 유지. 기존 자동/수동 분류와 빠른 이름 focus 테스트를 유지했다.
- [x] 브라우저 회귀를 추가했다. 최초 설정 및 재편집 × 390/768/1280에서 목록→입력 시 새 항목 dialog 없이 부모 안에서 전환하고 완료·취소 후 올바른 행/추가 버튼으로 복귀한다.
- [x] 기존 form 콘텐츠·검증·계정 복구를 `PortfolioItemSheet`의 inline 경로로 연결했다. standalone dialog 경로와 외부 panel 계약은 유지했다.
- [x] 항목별 임시 입력과 전체 draft를 분리하고, 폐기 확인·Escape·부모 drag/닫기 차단·focus/scroll 복귀를 단일 경로로 연결했다.
- [x] 첫 항목·10개·긴 이름·현금 오류·reduced motion을 포함한 회귀를 확인했다. 3개 항목 전용 케이스는 기존 샘플/단위 fixture로 확인했다.
- [x] `npm run check`, 전체 단위 테스트, `tests/portfolio.spec.ts`를 실행했다.
- [x] 390/640/768/1280 브라우저에서 overflow·단일 본문 스크롤·focus·touch target을 확인했다. 실제 모바일 키보드·스크린리더는 미검증으로 남긴다.
- [x] 변경 파일·검증·제한을 plan과 ledger에 기록했다. 별도 커밋은 만들지 않았다.

## Task 2: 정적 매핑과 Simulation의 명시적 이동

**Files**

- Create: `src/journey/portfolioSampleIntent.ts` — URL 생성·허용값 파싱만 담당.
- Create: `src/portfolio/domain/samplePreset.ts` — 3개 preset과 기존 샘플 ID·구간 대응.
- Modify: `src/simulation/ui/SimulationApp.tsx`, `src/simulation/ui/simulation.css` — 결과 아래 연결 영역·저장 상태에 따른 이동.
- Modify only if needed: `src/simulation/ui/SimulationControls.tsx` — raw 입력 유효성 전달. 저장 모델에 UI flag를 넣지 않음.
- Test: new `tests/unit/journey/portfolioSampleIntent.test.ts`, `tests/unit/portfolio/portfolioExamples.test.ts`, `tests/unit/simulation/SimulationControls.test.tsx`, `tests/simulation.spec.ts`.
- Docs: PRD의 연결 요구사항, DESIGN의 결과 연결 위치, README의 기능 설명.

**Interfaces**

- `SimulationSamplePreset = 5 | 9 | 13`.
- `portfolioSampleHref(rate: number, base?: string): string` — 정확한 세 값은 `samplePreset`, 다른 유효 값은 `samples=all`; 기존 `appPath` base 처리 재사용.
- `parsePortfolioSampleIntent(search: string): { preset: SimulationSamplePreset | null } | null` — 외부 null은 의도 없음/invalid, 내부 preset null은 명시적 전체 탐색. 중복 key·두 모드 동시 전달은 invalid.
- `sampleForPreset(preset)` — 기존 `PORTFOLIO_EXAMPLES`의 명시적 ID와 초기 주력 비율을 반환(5: `schd-gold`/50, 9: `qqqm-schd`/70, 13: `qld-schd-gold`/50). 배열 순서에 의존하지 않음. Simulation에서 Portfolio 도메인·repository를 import하지 않음.

- [x] 단위 테스트 작성: 5/9/13 매핑, 8.75/0/30 전체 탐색, 직접 입력 9 동등성, `/`와 `/IndividualSavingsFlowUI/` base, invalid/빈/중복 query를 확인했다. 대표 ID·구간과 5% 50/50 재배분도 검증했다.
- [x] 순수 함수와 상수로 구현했으며 새 저장소·네트워크 호출·의존성을 추가하지 않았다.
- [x] Simulation 조건 UI에 정확한 5/9/13 CTA와 다른 값의 전체 샘플 링크를 연결했다. 직접 입력이 정확한 preset 값이 된 경우에도 링크를 보여주고 invalid raw 입력 중에는 숨긴다.
- [x] 계산 불가·Main 복구 화면에는 CTA를 추가하지 않았고 일반 런처 동작을 유지했다.
- [x] 저장 모델·queue를 변경하지 않고 URL 이동만 제공했다. intent는 중복 소비하지 않으며 query의 intent key만 제거하고 다른 query/hash는 보존한다.
- [x] 관련 단위 테스트와 전체 Simulation E2E를 실행했다.

## Task 3: 기존 샘플 상세로 진입하고 초안 보호

**Files**

- Modify: `src/portfolio/ui/PortfolioApp.tsx` — 준비된 상태에서 URL intent를 한 번 소비.
- Modify: `src/portfolio/ui/PortfolioSetupFlow.tsx`, `src/portfolio/ui/PortfolioEditSurface.tsx` — 최초 설정/재편집 샘플 진입 초기화.
- Modify: `src/portfolio/ui/PortfolioExamplePicker.tsx`, `src/portfolio/ui/portfolio.css` — 구간·대표 상세 미리선택, 안내, 초기 선택과 사용자 변경 구분.
- Test: `tests/unit/portfolio/PortfolioApp.test.tsx`, `tests/unit/portfolio/PortfolioExamplePicker.test.tsx`, `tests/portfolio.spec.ts`, `tests/app-journey.spec.ts`.
- Docs: 2026-09-16 샘플 탐색 spec에 명시적 Simulation 진입의 예외와 본 spec 연결.

**Interfaces**

- Consumes: Task 2 `parsePortfolioSampleIntent`, `sampleForPreset`.
- Produces: picker의 선택적 `initialExampleId`, `initialRiskBand`, `initialLeadPercentage`, `sourcePreset` 입력. 초기 UI 상태이며 저장 스키마 필드가 아님. 일반 진입은 모두 생략.
- 기존 `onAction({type: 'draft-replaced', draft})`는 초안 반영 확인 뒤에만 호출한다. 기존 `PortfolioExampleNavigation`의 back/hasChanges 의미는 자동 초기화와 사용자 편집을 구분하도록 조정.

- [x] 5%·9% preset의 setup/edit 진입과 5% 대표 상세를 브라우저 테스트로 확인했다. 기존 applied 편집 상태와 cash-only setup 상태를 모두 보존한다.
- [x] 자동 미리선택이 `draft-replaced`나 추가 저장을 만들지 않음을 상태·브라우저 회귀로 확인했다. 기존 bootstrap의 합법적인 Main 투자금 동기화는 유지한다.
- [x] App→setup/edit→picker 초기 선택을 연결하고 재렌더·StrictMode 중복 재선택을 막았다.
- [x] 5% 진입에서 SCHD/금 50/50 제목·미리보기·금액을 만들고, 일반 카탈로그의 SCHD 70 · 금 30은 유지했다.
- [x] 자동 초기 선택은 `hasChanges=false`로 두고 사용자의 선택·비율·직접 조합 변경만 탐색 변경으로 취급한다. 부모 draft dirty는 별도로 보존한다.
- [x] 좁은 화면 상세와 1100px 이상 목록+상세 동작 및 기존 샘플 탐색 회귀를 확인했다.
- [x] intent key만 `replaceState`로 제거하고 다른 query/hash를 보존한다. 단일 소비와 잘못된 URL 파싱을 단위·브라우저 테스트로 확인했다.
- [x] 기존 초안 교체 확인·취소·초안 반영·최종 적용 경계를 유지했다.
- [x] Main 미설정·투자 0원·stale·오프라인 기존 gate를 변경하지 않았다.
- [x] `npm run check`, 관련 단위 테스트, Portfolio·Simulation·app journey E2E를 실행했다.
- [x] B의 연결 요구사항과 대표 선택·검증 결과를 PRD·DESIGN·관련 spec에 반영했다. 별도 커밋은 만들지 않았다.

## Task 4: 결과 화면의 중복 설명 제거

**Files**

- Modify: `src/main/ui/dashboard/SummaryDashboard.tsx`, `src/main/ui/main.css` — 결과 설명과 남은 여백 정리.
- Modify: `src/simulation/ui/SimulationApp.tsx`, `src/simulation/ui/simulation.css` — 명목/실질 설명 문단 제거, 선택 상태와 그래프 표시 연결 확인.
- Modify: `src/portfolio/ui/PortfolioSummary.tsx`, `src/portfolio/ui/portfolio.css` — 최대 비중을 반복하는 동적 문장 제거. 해당 문장에서만 사용하는 파생값·wrapper는 참조 확인 후 정리.
- Test: 기존 `tests/unit/main/SummaryDashboard.test.tsx`, `tests/unit/simulation/SimulationApp.test.tsx`, `tests/unit/portfolio/PortfolioSummary.test.tsx`, `tests/main-react.spec.ts`, `tests/simulation.spec.ts`, `tests/portfolio.spec.ts`의 영향 기대값.
- Docs: `DESIGN.md`, PRD, 관련 승인 spec의 결과 설명·명목/실질 해설·최대 비중 문장 계약을 실제 변경과 일치시킨다.

**Interfaces:** 데이터·계산·저장 인터페이스 변경 없음. 기존 접근성 이름과 상태 표현을 유지하며 불필요한 설명 DOM과 여백만 정리한다.

- [x] spec §6과 현재 결과 화면을 대조해 세 문구의 제거 범위를 확정했다.
- [x] Main의 `수입과 지출, 저축, 투자 뒤에 남는 돈을 확인하세요.`를 제거하고 남는 돈/적자 라벨·수치·수입 기준선을 유지했다.
- [x] Simulation의 명목·실질 설명 두 분기를 제거하고 선택 상태·그래프·표시 금액을 유지했다.
- [x] Portfolio의 `{largest.name}에 {largest.percentage}를 배분해요` 동적 문장과 전용 CSS/파생값을 제거했다. 대상 이름·비율·배분 막대는 유지했다.
- [x] 빈 wrapper·전용 여백을 정리했으며 새 반복 설명 문장으로 대체하지 않았다.
- [x] 문구 제거 기대값을 단위·E2E 테스트에 반영하고 Main/Simulation/Portfolio 의미 검증을 보존했다.
- [x] `npm run check`, 전체 단위 테스트, Simulation·Portfolio E2E를 실행했다.
- [x] 390/768/desktop의 overflow·focus·선택 상태·시각화 가시성을 브라우저 회귀로 확인했다. 실제 모바일 키보드·스크린리더는 미검증으로 남긴다.
- [x] PRD·DESIGN·관련 spec의 현재 동작 주장을 갱신했다.

## Task 5: 결합 UX·계정 저장 회귀와 인계

**Files:** `tests/account-workspace.spec.ts`, 필요 시 앞의 focused test, `docs/superpowers/evidence/2026-09-19-portfolio-voc/` 아래 구현 이후 별도 evidence 문서·캡처. 현재 조사 PNG를 변경 후 증거로 덮어쓰지 않는다.

- [x] 계정 workspace 회귀에서 저장 지연·실패·인증·refresh/focus와 Portfolio 편집 잠금/복구를 확인했다. 로컬 호환성 fixture를 서버 검증으로 대신하지 않았다.
- [x] 항목 폼 입력 중 오프라인 잠금·복구와 기존 cloud editor 회귀를 확인했다.
- [x] Main·Simulation·retained accountMap/locations 보존과 샘플 미리선택→취소·교체·적용 경계를 기존 계정/여정 테스트로 확인했다.
- [x] 390×844·390×600·768×1024·1024×600·1280 desktop에서 핵심 흐름, 긴 이름·10개 대상·현금 오류·reduced motion·Tab/Escape/focus 복원을 확인했다.
- [x] `npm run check`, `npm run test:unit`, `npm run test:e2e -- --reporter=line`을 실행했다. 전체 E2E 216 passed, 1 skipped(PWA 환경 조건)였다.
- [ ] 사용자가 추가 위치와 적용 의미를 설명 없이 이해하는지 spec §8의 짧은 VOC 재확인 과제는 참여자 검증 전까지 미완료다.
- [x] 상대 링크와 `git diff --check`를 확인하고 PRD·DESIGN·README·관련 spec의 현재 동작 주장을 대조했다.
- [x] 변경 파일·실행한 명령/결과·미검증 항목·남은 위험을 이 plan과 ledger에 기록했다. 자동 배포나 데이터 파이프라인 작업은 포함하지 않았다.

## 계획 작성 및 구현 중간 기록

- 현재 Git 상태·기준 ref·관련 코드/테스트·canonical 문서 확인.
- 로컬 브라우저에서 390/768/1280 편집, 데스크톱/모바일 추가 폼, 기존 성장 샘플 상세를 캡처 후 직접 확인.
- DWP·Carbon·M1·MOJ 공식 자료 및 사용자 지정 Stock Snowball README 확인. 채택 근거·한계는 spec §3에 기록.
- 문서 검증: 상대 링크 15개 존재 확인 PASS, 새 문서 2개의 `git diff --no-index --check /dev/null <file>` PASS, `git diff --check` PASS. PRD·DESIGN·README와 대조해 새 동작은 제안으로만 표시했다.
- 구현 파일은 계획의 A–C 범위 안에서만 변경했으며 schema·storage contract와 백테스트/Supabase pipeline은 변경하지 않았다.
- 최종 검증 기록: `npm run check` 통과, `npm run test:unit` 121 files/1,092 tests 통과, `npm run test:e2e -- --reporter=line` 216 passed·1 skipped(PWA 환경 조건). Portfolio 44개·Simulation 17개와 390/640/768/1280 브라우저의 인라인 입력·focus·scroll·overflow 회귀를 확인했다. 참여자 VOC 재확인은 별도 미검증으로 남긴다.

**후속 소유자:** 제품/UX 검토자. 참여자 VOC 재확인과 실제 모바일 키보드·스크린리더 검증을 진행할 때 이 plan의 미완료 항목을 이어서 확인한다.

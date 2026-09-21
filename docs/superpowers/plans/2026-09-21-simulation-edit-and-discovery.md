# Simulation Edit and Discovery Implementation Plan — B

> **For agentic workers:** A의 공통 dialog가 검증된 뒤 `superpowers:executing-plans`로 직렬 구현한다. 금융 모델 v3는 유지하고 UI 편집/확정 상태를 분리한다.

**Goal:** Simulation 조건을 모바일 하단 시트/웹 모달에서 조정하고 결과 하단에서 Portfolio 샘플로 이어준다.
**Architecture:** 편집 중에는 local candidate만 계산하고 적용 때 기존 repository/queue로 한 번 저장한다. 하단 제안은 저장된 result rate를 받아 URL 탐색만 수행한다.
**Tech Stack:** 기존 React/TypeScript, ResponsiveDialog, 기존 projection/validation, JourneyEntryCard, Vitest/Playwright.
**Spec:** [설계 §5.2–5.3](../specs/2026-09-21-responsive-overlays-and-result-card-design.md).

## Global Constraints

[총괄](2026-09-21-responsive-experience.md)의 제약을 따른다. 월 저축·투자는 Main 읽기 전용이다. Simulation schema v3/workspace v5/protocol 5, 기존 onboarding과 명목/실질 직접 선택, 자동 Main 동기화와 미전송 복구는 유지한다. 현재 조건 자동 저장을 `취소/적용`으로 바꾸는 것은 PRD/설계 변경에 명시한다.

## Review Focus

- raw 입력이 invalid인데 마지막 valid candidate가 저장됨: B1의 submit parsing/validity.
- 저장 실패 뒤 modal만 닫혀서 이전 결과와 새 CTA가 섞임: B1/B2의 confirmed result.
- 외부 Main 갱신·복구 입력 재진입: B1의 source guard와 cloud tests.
- graph/slider 조작이 다음 단계 reveal/이동을 발생시킴: B2/B3.
- 모바일 고정 편집 bar가 하단 CTA를 가림: B2의 scroll padding과 viewport 검증.

## Task B1: 조건 편집 상태와 표면

**Files**

- Create: `src/simulation/ui/SimulationEditSurface.tsx`, `useSimulationEditor.ts`.
- Modify: `src/simulation/ui/SimulationApp.tsx`, `SimulationControls.tsx`, `AdvancedSettings.tsx`, `simulation.css`.
- Reuse: `src/simulation/domain/validation.ts`, `projection.ts`, `src/auth/AccountDraftContext.tsx`, `AccountManagementContext.tsx`.
- Test: new `tests/unit/simulation/SimulationEditSurface.test.tsx`; existing `SimulationApp.test.tsx`, `SimulationControls.test.tsx`, `AdvancedSettings.test.tsx`, `tests/simulation.spec.ts`, `tests/account-workspace.spec.ts`.

**Interfaces**

```ts
// 신규 UI 전용 계약; domain model/schema는 변경하지 않는다.
type ApplySimulation = (next: CompoundSimulationDraft) => Promise<'saved' | 'error'>;
interface SimulationEditSurfaceProps {
  draft: CompoundSimulationDraft; // 열 때 확정된 값
  readOnly: boolean;
  sourceChanged: boolean;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  onApply: ApplySimulation;
  onClose(): void;
}
```

`useSimulationEditor`는 candidate, raw fields, field errors, dirty, saving을 소유한다. `SimulationControls`와 `AdvancedSettings`는 폼 부분을 재사용하며 부모가 field validity를 알 수 있게 callback을 추가한다. 별도 중첩 details와 내부 sample link는 제거한다. `getValidatedCandidate()`는 현재 raw 전부를 검증한 draft 또는 null만 반환한다.

- [ ] 단위 테스트를 먼저 작성한다: 9→13 선택 후 취소하면 onApply 0회, 적용하면 1회, 오류 raw/목표≤시작 자산이면 0회, 저장 Promise 미완료 동안 close 차단, reject 후 draft 유지.
- [ ] App의 결과 상태와 editor candidate를 분리한다. `projectCompoundGrowth(candidate)`와 `findTargetReachMonth(candidate)`로 미리보기 수치만 계산하며 이 단계에서 repository.save를 호출하지 않는다.
- [ ] footer submit에서 모든 raw 입력을 검증한 뒤 immutable candidate를 캡처한다. blur→state 반영 순서에 의존하지 않는다. 오류 focus/description을 제공한다. 기존 0~30년/0~30%·소수 2자리/목표 단위·범위 validation을 재사용한다.
- [ ] 현재 persistenceQueue를 유지하면서 `applyDraft(next): Promise<'saved'|'error'>`를 제공한다. 적용 때 대기 중 amountMode/기존 autosave를 먼저 정리하고, 해당 operation token의 saved만 성공으로 취급한다. 저장 성공 후에만 resultDraft 교체와 modal close를 수행한다.
- [ ] 기존 `'simulation'` recovery key와 충돌하지 않게 editor 전용 `'simulation-editor'` record를 사용한다. 이는 기존 recovery 컨테이너의 UI record이며 새 localStorage key/schema가 아니다. 원래 base/source와 candidate/raw를 검증해서 복구하고, 취소/성공에 해당 record만 지운다. 소스가 달라지면 재검토를 요구한다.
- [ ] resize나 app rerender가 candidate를 초기화하지 않게 한다. 계정이 offline/expired 되면 editor 입력/적용은 잠그고 recovery 보존한다. 외부 Main source 변경은 banner와 재검토로 처리하며 침묵 덮어쓰기를 막는다.
- [ ] 모바일 하단 bar/desktop 오른쪽 버튼을 배치하고 sheet 내부 `기간·수익률 → 시작·목표 → 금리·물가` 순서를 구현한다. 기존 결과의 명목/실질은 바로 조작 가능하게 남긴다.

**핵심 브라우저 기대값** — `tests/simulation.spec.ts`의 기존 `seedMain/openFirstResult`를 사용한다.

```ts
await seedMain(page);
await openFirstResult(page);
const before = await page.locator('#simulation-result-title').textContent();
await page.getByRole('button', {name:'조건 편집', exact:true}).click();
const dialog = page.getByRole('dialog', {name:'조건 편집', exact:true});
await dialog.getByRole('button', {name:'연 기대수익률 13%'}).click();
await expect(page.locator('#simulation-result-title')).toHaveText(before!);
await dialog.getByRole('button', {name:'취소', exact:true}).click();
// dirty 확인에서 '변경 버리기'를 선택한 뒤에도 확정 headline은 그대로다.
await page.getByRole('button', {name:'변경 버리기', exact:true}).click();
await expect(page.locator('#simulation-result-title')).toHaveText(before!);
```

- [ ] `npm run check`, `npm run test:unit -- tests/unit/simulation`, `npm run test:e2e -- tests/simulation.spec.ts tests/account-workspace.spec.ts` 실행.
- [ ] PRD Simulation, DESIGN Simulation, 목표 도달 관련 2026-08-21 spec의 최신 확장에 편집/확정/자동저장 대체 범위를 기록한다.

## Task B2: 결과 하단의 Portfolio 진입

**Files**

- Modify: `src/journey/ui/JourneyEntryCard.tsx`, `journey.css`, `src/main/ui/MainApp.tsx`, `src/main/ui/main.css`, `src/simulation/ui/SimulationApp.tsx`, `simulation.css`.
- Reuse: `src/journey/portfolioSampleIntent.ts`, `src/portfolio/domain/samplePreset.ts`.
- Test: `tests/unit/journey/JourneyEntryCard.test.tsx`, `tests/unit/journey/portfolioSampleIntent.test.ts`, `tests/unit/simulation/SimulationApp.test.tsx`, `tests/app-journey.spec.ts`, `tests/simulation.spec.ts`.

**Interfaces:** Main 전용 문구를 props로 바꾸고 `useId`로 제목 ID를 생성한다. 기존 caller는 현재 Main 문구를 명시 전달한다.

```ts
interface JourneyEntryCardProps {
  enabled: boolean;
  blocked?: boolean; // 편집기·saving·미해결 error
  title: string;
  actionLabel: string;
  description?: string;
  onContinue(): void;
}
```

- [ ] 기존 Main reveal 계약 tests를 유지하고 `blocked=true`이면 wheel/touch/focus로 노출 또는 이동하지 않는 테스트를 추가한다. card 렌더 여부와 focusable 여부를 일치시킨다.
- [ ] 기존 bottom gesture(새 wheel 64px, touch 56px)와 keyboard focus reveal을 재사용한다. CSS 이름을 공통으로 옮길 때 Main 모바일 하단 편집 바 여백이 사라지지 않게 한다.
- [ ] Simulation 조건 옆 `<a>`를 완전히 제거하고 결과 마지막에 card 한 개를 둔다. 결과 조건 요약에는 숫자만 남긴다.
- [ ] 확정 rate 5/9/13은 `연 N%를 가정했다면, 이 구성부터 볼까요?`와 기존 URL intent를 사용한다. 나머지는 전체 샘플. dirty candidate의 rate를 props로 전달하지 않는다.
- [ ] pending/error일 때 이동을 막고 명확한 저장 재시도를 제공한다. 클릭 직전에도 현재 operation token과 확정 draft가 일치하는지 확인한다. 유효한 최신 결과만 `location.assign(portfolioSampleHref(rate))`로 탐색한다.
- [ ] 하단 bar + safe-area만큼 여백을 예약한다. 손가락/마우스 스크롤은 reveal만 하고 자동 탐색하지 않는다. 차트 내부 touch selection과 구분한다.

```ts
const beforeUrl = page.url();
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
// 새로운 gesture를 시작하도록 이전 gesture가 끝난 뒤 수행한다.
await page.mouse.wheel(0, 100);
await expect(page.getByRole('button', {name:'포트폴리오 샘플 보기'})).toBeInViewport();
expect(page.url()).toBe(beforeUrl);
await page.getByRole('button', {name:'포트폴리오 샘플 보기'}).click();
await expect(page.getByRole('heading', {name:'QQQM 70 · SCHD 30'})).toBeVisible();
```

- [ ] `npm run check`, `npm run test:unit -- tests/unit/journey tests/unit/simulation`, `npm run test:e2e -- tests/main-react.spec.ts tests/simulation.spec.ts tests/app-journey.spec.ts tests/portfolio.spec.ts` 실행.
- [ ] PRD Journey·Simulation/README/DESIGN 및 2026-09-11 하단 탐색, 2026-09-19 VOC 문서에 새 위치와 저장 경계를 명시한다.

## Task B3: 결합 상태와 인수 검증

**Files:** `tests/account-workspace.spec.ts`, `tests/motion-system.spec.ts`, 기존 Simulation/여정 tests; `docs/superpowers/evidence/2026-09-21-responsive-overlays/`에 구현 이후 자료를 별도 이름으로 추가.

- [ ] authenticated flow에서 save failure/response lost/conflict를 주입하고 시트 draft 유지·retry·single write·confirmed CTA를 확인한다. 같은 파일의 `fakeServer`를 재사용한다.
- [ ] rate를 바꾸고 적용하는 도중 연속 CTA 클릭·명목/실질 변경 요청이 데이터 유실을 만들지 않는지 확인한다. 저장 전 성공 화면으로 닫히지 않아야 한다.
- [ ] 0년, 30년, 8.75%, 0/30%, 목표 미도달, Main 월 투자 0원, 새 Main revision, 불완전 raw 입력을 각각 확인한다.
- [ ] 390/768/1280, 200% 확대, reduced motion, Tab으로 reveal, graph touch→page scroll→CTA reveal을 확인한다. overlay 닫은 뒤 스크롤 관성이 reveal을 일으키지 않아야 한다.
- [ ] `npm run check`, `npm run test:unit`, `npm run test:e2e -- --reporter=line` 실행하고 실제 결과·skip 사유와 실기기 미검증 범위를 기록한다.

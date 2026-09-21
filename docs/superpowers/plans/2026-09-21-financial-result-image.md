# Financial Result Image Implementation Plan — C

> **For agentic workers:** A/B의 확정 저장·공통 dialog 계약을 확인한 뒤 `superpowers:executing-plans`로 실행한다. 이 기능은 read-only export이며 금융 slice를 저장하지 않는다.

**Goal:** Portfolio 결과에서 월 자금 흐름·미래 성장·투자 배분을 1080×1440 PNG로 미리 보고 보관한다.
**Architecture:** account의 단일 ready snapshot → 일관성 검증 → 금액 포함/제외 출력 모델 → SVG → PNG → 동일 PNG 미리보기/다운로드/공유. 모델·renderer·파일 전달을 분리한다.
**Tech Stack:** 기존 TypeScript/React, SVG/Canvas/Blob, Web Share API, 기존 금융 계산 함수, Vitest/Playwright. 서버·렌더 서비스·새 이미지 캡처 라이브러리 없음.
**Spec:** [설계 §6](../specs/2026-09-21-responsive-overlays-and-result-card-design.md), [3:4 배치 구상](../evidence/2026-09-21-responsive-overlays/07-result-card-concept.png).

## Global Constraints

[총괄](2026-09-21-responsive-experience.md)을 따른다. 같은 snapshot의 Main applied/Simulation saved draft/Portfolio applied plan만 사용한다. draft·미완료 지출 답변·오래된 localStorage를 섞지 않는다. 계정 식별자/원문 recovery/보존 accountMap·locations를 export에 넘기지 않는다. 금액 숨김은 출력 모델에서 처리하며 CSS 숨김으로 대체하지 않는다.

## Review Focus

- snapshot 내부에도 Main과 다른 앱 source가 불일치할 수 있음: C1.
- preview 중 다른 탭 저장·로그아웃·옵션 변경 후 이전 Blob 저장: C3.
- 폰트 fallback/긴 이름/10개+현금/큰 금액의 잘림: C2.
- redacted image의 축/metadata/tooltip·경로에 원화 노출: C1/C2.
- 비동기 생성이 사용자 활성화를 소모하여 iOS share 실패: C3의 사전 Blob 준비.

## Task C1: 확정 스냅샷과 출력 모델

**Files**

- Create: `src/journey/result-card/model.ts`, `buildResultCardModel.ts`, `resultCardSource.ts`.
- Modify: `src/auth/productRepositories.ts`, `src/portfolio/ui/PortfolioApp.tsx` (새 read-only prop), 필요 시 `src/portfolio/main.tsx` 전달 타입.
- Reuse: `src/workspace/domain/model.ts`, `src/workspace/infrastructure/accountWorkspaceSession.ts`의 snapshot/status/subscribe, `src/main/domain/cashflow.ts`, `src/simulation/domain/projection.ts`, `src/portfolio/domain/allocation.ts`.
- Test: new `tests/unit/journey/resultCardModel.test.ts`, `resultCardSource.test.ts`.

**Interfaces:** 아래 선언은 신규 파일의 계약이다. 기존 scope writer를 exporter에 전달하지 않는다.

```ts
interface ResultCardSource {
  read(): {kind:'ready'; workspace: WorkspaceDocument}
    | {kind:'blocked'; reason:'unavailable'|'pending'};
  subscribe(listener: () => void): () => void;
}
interface ResultCardOptions {
  includeAmounts: boolean;
  displayNames: Readonly<Record<string,string>>;
}
interface ResultCardRow { label: string; value: string }
interface ResultCardModel {
  revision: number; // 내부 stale 감지용; 출력 SVG/PNG metadata에 넣지 않음
  basisDate: string;
  mode: 'amounts'|'ratios';
  monthly: {headline:string; rows:ResultCardRow[]; segments:{id:string; ratio:number}[]};
  growth: {headline:string; rows:ResultCardRow[]; points:{x:number; plan:number; baseline:number}[]};
  allocation: {headline:string; rows:{id:string; name:string; percentage:string; amount?:string; color:string}[]};
  notes: string[];
}
type ResultCardBuild = {kind:'ready'; model:ResultCardModel}
  | {kind:'blocked'; reason:'main-required'|'simulation-required'|'portfolio-required'|'source-mismatch'|'invalid-values'};
// buildResultCardModel(workspace: WorkspaceDocument, options: ResultCardOptions): ResultCardBuild
```

renderer에 넘어가는 chart 좌표는 정규화 값이며 원화 누락 모드는 절대 금액 문자열·축·금액별 tooltip을 가지지 않는다. displayNames는 export session 안에서만 쓰고 원래 이름을 저장하지 않는다.

- [ ] tests에서 `createEmptyWorkspace`와 각 domain 생성/계산 함수를 사용해 완성 fixture를 만든다. 최대 대상·현금, source mismatch, main-null, simulation-null, plan-null을 실패 사례로 작성한다.
- [ ] 순수 builder는 입력 workspace를 변경하지 않는다. Main `updatedAt`와 savings/investment, Portfolio `syncedInvestmentWon`, 유한 projection, 합계/잔액을 검사하고 blocked 결과를 반환한다.
- [ ] 출력 수치 계산은 `calculateCashflow`, `projectCompoundGrowth`, `findTargetReachMonth`, `materializeAllocation`을 사용한다. 기존 원화 포맷터를 재사용하고 `round` 정책을 renderer에 중복 구현하지 않는다.
- [ ] 금액 제외 모델은 문자열/축 모두 redacted인지 고유한 큰 금액 fixture로 검사한다. 단계별 원화값을 지우고 비율·배율·기간·가정만 전달한다. 0원 분모는 `미설정`으로 처리한다.
- [ ] production adapter는 ready snapshot을 clone하고 pending/local edit/recovery 상태를 검사한다. compatibility UI는 기존 BrowserWorkspaceRepository를 read-only adapter로 주입한다. production에서 account 없이 fallback하지 않는다.
- [ ] baseline snapshot, build 후 snapshot, 모든 slice를 비교해 export가 revision/소유 데이터에 쓰지 않음을 검증한다.

```ts
const before = structuredClone(workspace); // 이 테스트의 완성 fixture
const exported = buildResultCardModel(workspace, {includeAmounts:false, displayNames:{}});
expect(workspace).toEqual(before);
expect(exported.kind).toBe('ready');
if (exported.kind === 'ready') {
  expect(exported.model.mode).toBe('ratios');
  expect(exported.model.allocation.rows.every(row => row.amount === undefined)).toBe(true);
}
```

- [ ] `npm run check`, `npm run test:unit -- tests/unit/journey/resultCardModel.test.ts tests/unit/journey/resultCardSource.test.ts` 실행.

## Task C2: 고정 비율 renderer와 시각 검증

**Files**

- Create: `src/journey/result-card/renderResultCardSvg.ts`, `renderResultCardPng.ts`, `resultCardLayout.ts`.
- Reuse: 기존 font assets/금액 utility/Portfolio 색상 매핑. 폰트 경로는 `src/styles/app-foundation.css`와 실제 asset 참조에서 확인하고 고정한다.
- Test: new `tests/unit/journey/resultCardLayout.test.ts`, `renderResultCardSvg.test.ts`, new `tests/result-card.spec.ts`.

**Interfaces**

```ts
// renderResultCardSvg(model: ResultCardModel, embeddedFontCss: string): string
// renderResultCardPng(svg: string): Promise<Blob> // type=image/png, 1080×1440
// selectResultCardLayout(rowCount: number): 'spacious'|'dense'
```

- [ ] 1080×1440, 1/4/10대상+현금, 100자 한글·영문 이름, 0/큰 금액, 양수/적자, 0년/30년·명목/실질·목표 미도달 fixture로 layout tests를 만든다. 빈 배열/finite 실패는 생성 차단한다.
- [ ] 출력 레이아웃에 header/monthly/growth/allocation/footer의 bounds를 둔다. dense variant는 행 공간을 확보하고 보조 정보의 배치를 바꾸되 항목을 `기타`로 합치지 않는다. 어떤 variant도 비율/금액을 truncate하지 않는다.
- [ ] 자유 이름을 XML escape하고 foreignObject·외부 URL을 출력하지 않는다. 표시명이 너무 길면 최대 두 줄의 measured ellipsis와 미리보기 경고를 제공한다. 32px보다 작은 글자로 줄이지 않는다.
- [ ] 폰트를 데이터로 embedding한 SVG를 decode한 뒤 Canvas 1080×1440에서 PNG로 만든다. `document.fonts.ready`만으로 SVG 내 font embedding이 보장된다고 가정하지 않는다. decode/toBlob 실패를 명시적으로 reject한다.
- [ ] 최종 Blob의 PNG 헤더/IHDR와 이미지를 검사한다. Playwright download의 dimensions를 검증하는 예:

```ts
const download = await downloadPromise; // C3 UI의 PNG 저장 click 전에 등록
const bytes = await fs.promises.readFile((await download.path())!);
expect(bytes.subarray(1, 4).toString()).toBe('PNG');
expect(bytes.readUInt32BE(16)).toBe(1080);
expect(bytes.readUInt32BE(20)).toBe(1440);
```

- [ ] 생성 PNG 원본과 390px 축소 상태를 직접 열어 한글·범례·대상 색·음수 부호·작은 수치를 검토한다. SVG string snapshot만으로 시각 QA를 통과 처리하지 않는다. 실제 Safari 렌더와 font failure도 확인한다.
- [ ] `npm run check`, `npm run test:unit -- tests/unit/journey/resultCardLayout.test.ts tests/unit/journey/renderResultCardSvg.test.ts`, `npm run test:e2e -- tests/result-card.spec.ts` 실행.

## Task C3: 미리보기·저장·공유 흐름

**Files**

- Create: `src/portfolio/ui/PortfolioResultCardPreview.tsx`, `src/journey/result-card/saveResultCard.ts`.
- Modify: `src/portfolio/ui/PortfolioApp.tsx`, `PortfolioSummary.tsx`, `portfolio.css`.
- Test: new `tests/unit/portfolio/PortfolioResultCardPreview.test.tsx`, `tests/unit/journey/saveResultCard.test.ts`; existing `tests/portfolio.spec.ts`, `tests/account-workspace.spec.ts`; new `tests/result-card.spec.ts`.

**Interfaces:** `PortfolioResultCardPreview`에는 `source: ResultCardSource`, `initialIncludeAmounts: boolean`, `returnFocusRef`, `onClose`만 전달한다. 앱 write repository를 전달하지 않는다. `saveResultCard.ts`는 `downloadResultCard(blob, filename)`와 `shareResultCard(blob, filename): Promise<'shared'|'cancelled'|'unsupported'|'error'>`를 제공한다.

- [ ] Portfolio 결과 아래 `계획 이미지 저장` 진입을 추가한다. missing source 상태에서 왜 생성할 수 없는지와 올바른 앱 링크를 제공한다. initial setup/미적용 상태를 성공 카드로 표현하지 않는다.
- [ ] 공통 wide dialog에 실제 PNG 미리보기·금액 포함 스위치·필요한 표시명 수정·PNG 저장·가능한 경우 공유를 배치한다. 웹 2열/모바일 한 열, 하단 동작 고정, 원본 보기 제공.
- [ ] 초기 금액 옵션은 현재 Portfolio preferences에서 가져오되 토글 변경은 session 안에만 둔다. 옵션 변경 → 기존 Blob 무효화 → 새 렌더의 generation token 순으로 처리해 이전 작업의 늦은 완료가 최신 미리보기를 덮어쓰지 않게 한다.
- [ ] source.subscribe로 revision/계정 준비 상태를 관찰한다. preview 중 달라지면 저장/공유 잠금, `다시 만들기`로 새 snapshot을 명시적으로 읽는다. logout/unmount에서는 Blob URL·이미지·이름 정보를 해제한다.
- [ ] `navigator.canShare({files})`로 file-share 지원을 판정한다. 지원되지 않는 경우 공유 버튼을 제공하지 않고 PNG 저장을 남긴다. 준비된 File을 버튼 click 안에서 share해 transient activation을 유지한다. AbortError는 cancelled로 반환한다.
- [ ] 파일명은 `ISF-plan-YYYY-MM-DD.png`로 고정하고 금융금액/계정 ID를 포함하지 않는다. 다운로드 trigger 뒤에는 `다운로드를 요청했어요` 수준으로 표시한다. OS 사진함 저장 성공을 추정하지 않는다.
- [ ] 테스트에서 여러 옵션 변경·연속 다운로드·render rejection·share unsupported/reject/cancel·revision update·expired 계정을 검증한다. `URL.revokeObjectURL`이 현재 이미지 사용 중 너무 일찍 호출되지 않는지도 확인한다.
- [ ] cloud E2E에 `fakeServer`를 사용해 preview 전후 서버 revision/operation log가 동일한지 확인한다. 로컬 fixture PNG test는 인증/계정 source 검증을 대신하지 않는다.
- [ ] `npm run check`, `npm run test:unit`, `npm run test:e2e -- --reporter=line` 실행. Safari/Android 실기기 파일 저장·공유와 보조기술은 별도 수동 확인한다.

## Task C4: 제품 계약·인수·인계

**Files:** Product PRD의 Portfolio/Journey/데이터 읽기/Future Product Direction, `DESIGN.md`, `README.md`, 본 총괄 계획, 구현 이후 evidence.

- [ ] PRD에 새 읽기 전용 종합 카드와 지원/미지원 상태를 현재 구현과 일치시켜 등록한다. 과거 폐기된 4앱 카드 계획과 구분한다.
- [ ] DESIGN에 이미지 비율·색·서체·금액 포함·샘플 가정의 표현, README에 결과 저장과 사용 방법을 추가한다.
- [ ] 동일 applied 값과 PNG 숫자를 대조하고, 최대 대상/긴 이름/금액 숨김 원본 이미지를 인계 자료로 보관한다. 실제 개인정보 캡처를 evidence로 커밋하지 않는다.
- [ ] 상대 링크, `git diff --check`, schema/storage write 부재 확인과 총괄 결합 검증을 완료한다. 실기기·사용자 VOC 검증의 수행 여부를 분리해 기록한다.

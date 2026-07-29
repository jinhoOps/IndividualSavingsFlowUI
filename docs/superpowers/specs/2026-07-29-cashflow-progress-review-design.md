# Cashflow Progress and Review Design

## Goal

Main 빠른 설정의 자금 계획 표시를 두 역할로 분리한다.

- 입력 단계: 월 수입 대비 현재 계획을 읽는 단순 progress bar
- 6/6 확인 단계: 소비·저축·투자·남는 돈 또는 초과를 비교하는 segmented bar와 표

모바일에서 bar 주변 텍스트가 뒤섞이지 않게 상세 정보는 semantic table로 분리한다. Bar는 시각적 비율과 직접 탐색만 담당한다.

## Input Progress Bar

`FlowContextSummary`는 `role="progressbar"`를 사용한다.

- `aria-valuemin`: `0`
- `aria-valuemax`: `100`
- `aria-valuenow`: 화면에 표시하는 0–100 범위 값
- `aria-valuetext`: 실제 계획액과 실제 수입 대비 비율

Tooltip 문구:

```text
현재 계획 230만 원 · 수입의 76.7%
```

수입이 0원이면 진행률을 계산하지 않고 `수입을 먼저 입력해주세요.`를 제공한다.

## Review Segmented Bar

6/6 확인 단계에서 다음 항목을 표시한다.

- 소비
- 저축
- 투자
- 남는 돈
- 초과 상태에서는 남는 돈 대신 초과

금액과 표의 비율은 항상 월 수입을 분모로 계산한다. 따라서 초과 상태의 소비·저축·투자 비율 합계는 100%를 넘을 수 있다.

Bar의 시각 segment는 100% track 안에서 잘리지 않게 배치한다.

- 정상 상태: 수입 기준 비율을 그대로 사용한다.
- 초과 상태: 소비·저축·투자를 계획 지출 합계 기준으로 normalize해 track 안에 표시한다.
- 표와 tooltip은 normalize하지 않은 실제 수입 대비 비율을 표시한다.

Segment hover, keyboard focus, tap tooltip:

```text
소비 · 180만 원 · 60.0%
```

## Review Table

Bar 아래에 semantic `<table>`을 둔다.

Columns:

- 종류
- 금액
- 수입 대비

모바일과 데스크톱 모두 같은 table을 사용한다. 모바일에서는 전체 너비, 짧은 label, 우측 정렬 숫자로 표시한다. 기존 list legend는 제거한다.

Table은 bar segment의 크기와 관계없이 모든 항목을 항상 표시한다. 0원 항목도 `0원`, `0.0%`로 표시한다. Segment가 44px보다 작아 독립적인 bar target을 만들 수 없으면 해당 table 행의 항목명을 tooltip fallback button으로 사용한다.

## Pressure Overflow

현재 계획이 수입을 넘으면 progress bar와 review bar 오른쪽 끝에 `압력 초과` 상태를 표시한다.

- track은 100%에서 가득 찬다.
- 오른쪽 끝에 둥근 pressure cap을 표시한다.
- cap 아래 작은 droplet 두 개를 표시한다.
- 끝부분에 사선 overflow pattern을 표시한다.
- `수입보다 20만 원 초과` 문구를 bar 아래에 표시한다.

Effect는 container 내부에서만 렌더링해 가로 page overflow를 만들지 않는다.

Motion:

- 기본 상태에서 pressure cap과 pattern에 짧고 느린 CSS animation을 허용한다.
- `prefers-reduced-motion: reduce`에서는 animation을 제거한다.
- 정보는 motion이나 색에 의존하지 않는다.

## Interaction

- Pointer hover는 현재 segment tooltip을 연다.
- Keyboard focus는 같은 tooltip을 연다.
- Touch tap은 tooltip을 toggle한다.
- 다른 segment tap은 기존 tooltip을 교체한다.
- 바깥 click, wrapper 밖 focus 이동은 tooltip을 닫는다.
- 시각 segment가 44px 이상이면 bar 위에 독립 target을 둔다.
- 44px보다 작은 segment는 인접 bar target을 겹치지 않고 table 항목명 button으로 hover·focus·tap fallback을 제공한다.

## Components

- Modify: `src/main/ui/setup/FlowContextSummary.tsx`
- Modify: `src/main/ui/setup/AllocationBar.tsx`
- Modify: `src/main/ui/common/PercentageTooltip.tsx` only if rich text support needs a generic value contract
- Modify: `src/main/ui/main.css`
- Test: `tests/unit/main/FlowContextSummary.test.tsx`
- Test: `tests/unit/main/AllocationBar.test.tsx`
- Test: `tests/main-react.spec.ts`

## Out of Scope

- Main schema or storage changes
- New chart dependency
- Canvas or SVG particle effects
- Continuous physics animation
- Dashboard information architecture changes

## Verification

- FlowContextSummary focused unit tests
- AllocationBar focused unit tests
- TypeScript check
- Full unit suite
- Main Playwright mobile and desktop flows
- CSS page-overflow and reduced-motion assertions

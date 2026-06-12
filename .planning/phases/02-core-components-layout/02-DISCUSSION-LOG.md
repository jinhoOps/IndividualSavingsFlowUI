# Phase 2: Core Components & Layout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 02-core-components-layout
**Areas discussed:** Form Layout & Spacing, Inline Expand Card, Tab Navigation Style, Input Focus Effect

---

## Form Layout & Spacing (입력 폼 그리드 및 여백 개편)

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | 3열 와이드 그리드 + 수직 카드 스택 + 에디토리얼 여백 개편 (데스크톱 중심의 시원한 배치) | |
| Option 2 | 2열 스택 구조 + 수직 라벨 정렬 (콤팩트하고 수직 지향적인 형태) | |
| Option 3 (Mobile-First) | 모바일 1열 스택 최적화 및 768px 이상 PC 화면에서 3열 그리드로 반응형 확장 (모바일 우선 설계) | ✓ |

**User's choice:** 모바일 기준으로 만들어놓고 PC 화면 확장하는 식으로 개발중이라 반영한 개선 방안 다시 제시해 달라고 요청함.
**Notes:** 프로젝트의 기본 개발 기조가 Mobile-First에 두고 있으므로, 모바일(<= 760px) 1열 스택 배치를 기본 레이아웃으로 삼고 데스크톱에서 3열 그리드로 스케일링하는 반응형 구현 방식으로 개편안을 수정 합의함.

---

## Inline Expand Card (모바일 항목 편집 모드)

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | 기존 가로 1줄 유지 (가로 찌그러짐 현상 감수) | |
| Option 2 | 모바일 전용 Inline Expandable Card 적용 (세로 3층 구조로 늘어나는 폼) | ✓ |

**User's choice:** 모바일 1열 스택 및 세로 확장 편집 카드 적용에 최종 동의함.
**Notes:** 좁은 모바일 가로 화면에서 폼이 깨지지 않도록 편집 활성화 시 카드가 아래로 펼쳐지며 3단 세로 스택(1층: 이름, 2층: 계좌/금액, 3층: 적용/삭제 버튼) 형태로 입력 필드를 넓게 배치하는 구조에 동의함.

---

## Tab Navigation Style (입력 탭의 에디토리얼 스타일 개편)

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | Swipeable Underline Tab (모바일 가로 스크롤 및 정갈한 아래 실선 스타일) | ✓ |
| Option 2 | Minimal Pill 스타일 유지 (가로 래핑 및 기존 테두리 형태) | |

**User's choice:** 모바일 Swipeable Underline Tab 적용에 최종 동의함.
**Notes:** 탭이 모바일 화면에서 줄바꿈되는 현상을 해결하고, Anthropic 에디토리얼 룩을 살리기 위해 가로 슬라이더 형태의 언더라인 탭을 채택함.

---

## Input Focus Effect & Component Border (입력창 포커스 및 테두리 스펙)

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1 | Flat Hairline Border (그림자 제거, 1px 연한 테두리만 사용) + 포인트 컬러 포커스 링 | ✓ |
| Option 2 | 기존 섀도우 유지 + 기본 아웃라인 링 | |

**User's choice:** Flat Hairline 및 포인트 컬러 포커스 링 적용에 최종 동의함.
**Notes:** Glassmorphism 제거 기조에 따라 불필요한 그림자를 제거해 평면 에디토리얼 룩을 완성하고, 포커스 시 브랜딩 오렌지/그린 컬러 링을 둘러 피드백을 제공하기로 함.

---

## Claude's Discretion

- 모바일 1열 스택 시 개별 카드 간 정교한 마이크로 간격(Margin/Padding) 수치 조정.
- 가로 스크롤이 적용되는 탭 컴포넌트의 모바일 터치 감쇠 및 스크롤바 숨김 스타일.
- 입력 필드 포커스 링의 애니메이션 트랜지션 시간 제어.

## Deferred Ideas

- None — discussion stayed within phase scope

---

*Phase: 02-core-components-layout*
*Discussion log generated: 2026-06-12*

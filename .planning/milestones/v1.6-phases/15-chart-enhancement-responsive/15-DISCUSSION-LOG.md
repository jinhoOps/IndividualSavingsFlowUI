# Phase 15: Chart Enhancement & Responsive - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 15-Chart Enhancement & Responsive
**Areas discussed:** Sankey Chart 라벨링 & 텍스트 겹침 방지 설계, Sankey 차트 노드 & 링크 컬러 테마 고도화, 모바일 반응형 뷰포트 최적화 및 줌 제어

---

## Sankey Chart 라벨링 & 텍스트 겹침 방지 설계

| Option | Description | Selected |
|--------|-------------|----------|
| Option A (안정 지향) | 노드 높이가 아주 작아 글자 겹침 위험이 있는 경우, 수치 표시를 과감히 툴팁으로 제한하고 라벨명만 미려하게 노출하는 기존 방식을 고수하되 텍스트 크기를 10px까지 유동적으로 축소하는 다이내믹 폰트 스케일 적용 | |
| Option B (가독성 지향) | 노드 높이가 작더라도 수치를 항상 강제 표기하되, 노드 배치 간격(nodeGap)과 높이 배율 스케일을 화면 높이에 비례하여 동적으로 넓혀 정보 손실 방지 | |
| Option C (절충안 - 1.c) | 모바일 환경(<=768px)에서는 차트 라벨을 좌/우측 정렬이 아닌 노드 상단에 얹는 말풍선/배지 스타일로 배치하여 텍스트 겹침 차단 | ✓ |

**User's choice:** Option C (1.c 절충안)
**Notes:** 모바일 화면 가독성을 최우선으로 확보하기 위해 텍스트 정렬을 좌/우 배치 대신 노드 상단 말풍선/배지 스타일로 전환하여 겹침을 방지함.

---

## Sankey 차트 노드 & 링크 컬러 테마 고도화

| Option | Description | Selected |
|--------|-------------|----------|
| Option A (비주얼 WOW 지향) | 자금의 유입과 유출 링크(path)에 Sunset에서 Deep Sea로 흐르는 부드러운 그라디언트(linearGradient) 효과를 적용하여 미려하고 고급스러운 프리미엄 비주얼 연출 | ✓ |
| Option B (가독성 지향) | 평소에는 차분한 단색 반투명(rgba) 톤을 유지하고, 마우스 오버(Hover) 시에만 해당 흐름의 전체 링크가 강렬한 포인트 톤으로 강조되도록 동적 컬러 전환 구현 | |
| Option C (미니멀 지향) | 현재의 tone-primary, tone-accent 시스템을 유지하되, 테두리에 미세한 보더 효과를 주어 Glassmorphism 배경 위에서 명도 대조만 극대화 | |

**User's choice:** Option A (Sunset/Deep Sea 그라디언트)
**Notes:** 가시성과 시각적인 임팩트를 동시에 부여하기 위해 흘러가는 그라디언트 스타일링 적용.

---

## 모바일 반응형 뷰포트 최적화 및 줌 제어

| Option | Description | Selected |
|--------|-------------|----------|
| Option A (비율 보존형) | 모바일 세로 모드(<= 768px)에서는 차트 본래의 비율을 해치지 않기 위해 가로 스크롤이 가능한 슬라이드 패널(.sankey-wrap)로 감싸고, 사용자가 스와이프하여 넓은 차트를 볼 수 있도록 지원 | |
| Option B (화면 맞춤형) | 스크롤 없이 모바일 가로 너비에 무조건 100% 맞추어 반응하도록 하고, 대신 모바일 전용 압축 컬럼 스텝 크기(SANKEY_MOBILE_MIN_COLUMN_STEP 등)를 더욱 촘촘하게 세밀 튜닝 | ✓ |

**User's choice:** Option B (화면 맞춤형 고밀도 튜닝)
**Notes:** 스크롤 레이아웃에 의해 시각 전반의 조화가 흐트러지지 않도록 가로 너비 100% 화면 맞춤을 고수하며, 촘촘한 배율 세밀 조정을 선택함.

---

## Claude's Discretion
- SVG `linearGradient` 구성 방식 및 DOM 인라인 적용
- 배지 라벨 박스의 패딩, 선 두께, 투명도 등의 정형화 디자인 세부 조정

## Deferred Ideas
None.

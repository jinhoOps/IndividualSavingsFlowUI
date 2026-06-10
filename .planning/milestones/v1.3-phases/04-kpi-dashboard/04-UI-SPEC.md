# Phase 4 UI Specification: KPI Cards & Table Cleanup

## 1. KPI Grid & Cards
시뮬레이션 대시보드 상단에 배치되는 핵심 요약 영역입니다.

### Layout
- **Container (`.kpi-grid`)**:
    - `display: grid`
    - `grid-template-columns: repeat(3, 1fr)` (Desktop)
    - `grid-template-columns: 1fr` (Mobile < 760px)
    - `gap: 16px`
- **Card (`.kpi-card`)**:
    - `padding: 20px`
    - `background: var(--panel)`
    - `backdrop-filter: blur(10px)`
    - `border: 1px solid var(--line)`
    - `border-radius: var(--rd-md)`
    - `display: flex; flex-direction: column; align-items: center; text-align: center;`

### Typography & Colors
- **Label**: `font-size: var(--text-caption); color: var(--muted); font-weight: 700; margin-bottom: 8px;`
- **Value**: `font-size: 1.5rem; font-family: var(--font-display); font-weight: 800; color: var(--tone-primary);`
- **Unit**: `font-size: 0.9rem; color: var(--muted); margin-left: 4px;`
- **Return Rate Accent**: 수익률이 (+)인 경우 `var(--tone-accent)` 색상 적용 고려.

## 2. Table Refinement
- **Header Removal**: 테이블 헤더 내의 "(명목)", "(실질)", "(만원)" 등의 텍스트를 제거하거나 툴팁으로 이동시킵니다.
- **Header Alignment**: `text-align: center`로 통일하여 깔끔한 인상을 줍니다.
- **Simplified Structure**:
    - 연차 | 누적 원금 | 자산(PR) | 자산(TR) | 배당(PR) | 배당(TR)
    - (세부 '명목/실질' 구분은 필요한 경우에만 툴팁 또는 토글로 처리하는 방향 검토 - 이번 단계에서는 우선 텍스트 제거에 집중)

## 3. Interaction
- 시뮬레이션 파라미터(슬라이더 또는 입력값) 변경 시 KPI 카드의 수치가 부드럽게 갱신되어야 합니다.
- 모바일에서 KPI 카드가 화면 너비를 꽉 채우도록 배치하여 가독성을 높입니다.

# Phase 4 Research: KPI Dashboard & UI Refinement

## 1. Current UI Analysis (Step 2)
- **Data Flow**: `calculator.js`의 `calculateDividendProjection()` 함수가 시뮬레이션 전체 데이터를 배열 형태로 반환합니다.
- **Data Availability**:
    - **Final Asset**: `data[data.length - 1].assetNominalTR`
    - **Final Annual Dividend**: `data[data.length - 1].dividendNominalTR`
    - **Cumulative Return**: `(assetNominalTR / principal - 1) * 100` 계산 필요.
- **Table Structure**: 현재 `thead`에 "(만원)" 단위가 반복적으로 표시되어 시각적 잡음이 발생하고 있습니다. DESIGN.md 원칙에 따라 단위는 문서 상단 또는 KPI 카드 등에서 한 번만 명시하고 헤더는 간결하게 유지해야 합니다.
- **Responsiveness**: 테이블의 열이 많아(10열) 모바일에서 가로 스크롤이 필수적이나, 핵심 수치는 스크롤 없이도 한눈에 보여야 합니다.

## 2. KPI 정의 및 매핑
| KPI 항목 | 데이터 필드 (마지막 연도) | UI 표시 단위 |
| :--- | :--- | :--- |
| **최종 자산** | `assetNominalTR` | 만원 |
| **최종 연 배당금** | `dividendNominalTR` | 만원 |
| **누적 수익률** | `(assetNominalTR / principal - 1) * 100` | % |

## 3. 기술적 제약 사항
- **Real-time Sync**: `renderDividendSimulation`이 호출될 때마다 KPI 카드도 즉시 갱신되어야 합니다.
- **No-build**: 외부 차트 라이브러리 대신 기존 SVG 차트 및 순수 CSS/JS를 사용합니다.
- **Glassmorphism**: `shared/styles/step-theme.css`의 `--panel` 및 `backdrop-filter`를 활용하여 일관된 배경 스타일을 적용합니다.

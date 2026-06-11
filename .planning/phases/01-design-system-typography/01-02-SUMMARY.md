# Phase 1 - Wave 2 작업 요약 (01-02-SUMMARY)

본 문서 작업은 **Phase 1 - Wave 2**의 설계 사양에 맞추어 디자인 시스템의 타이포그래피와 레이아웃 평탄화(Flat Panel) 작업을 수행한 내용의 요약입니다.

## 1. shared/styles/step-theme.css 수정
- **구글 폰트 Import 변경**:
  - 기존 폰트 목록에서 `Black Han Sans`를 제외하고 `Gowun Batang`을 추가하여 `Gowun Batang + Gowun Dodum` 조합의 URL로 업데이트하였습니다.
- **:root 테마 변수 변경**:
  - `--bg`의 색상을 `#f9f6f0`로 변경하였습니다.
  - `--panel`의 투명 배경을 `#ffffff` (불투명)로 변경하였습니다.
  - `--line` 색상의 투명도를 조정하여 `rgba(16, 34, 32, 0.12)`로 업데이트하였습니다.
  - `--font-display`를 `"Gowun Batang", serif`로 변경하였습니다.
  - 기본 마진 및 간격을 보정하기 위해 `--sp-md`를 `16px`로 수정하였습니다.
  - 플랫(Flat) 스타일을 강조하기 위해 `--sh-float` 그림자를 `0 2px 8px rgba(16, 34, 32, 0.04)`로 약화하였습니다.
- **backdrop-filter 제거**:
  - `.app-header`, `.launcher-menu`, `.card`, `.modal-overlay`, `.floating-btn` 등의 클래스에서 `backdrop-filter` 및 `-webkit-backdrop-filter` 속성을 전면 제거하였습니다.
- **카드 스타일 강화**:
  - `.card`에서 불투명 배경(`var(--panel)`)과 테두리(`1px solid var(--line)`) 속성이 안전하게 적용되도록 확인하였습니다.
- **반응형 미디어 쿼리 보존**:
  - 파일 하단의 모바일 레이아웃 미디어 쿼리가 손상되거나 잘리지(Truncate) 않도록 확인하였습니다.

## 2. shared/components/data-hub-modal.js 수정
- **Shadow DOM 내 테마 색상 변경**:
  - Shadow DOM 스타일 내 `:host`의 `--panel` 색상을 `#ffffff`로 변경하였습니다.
- **backdrop-filter 제거**:
  - `#modalOverlay` 및 `#modalContent`에서 `backdrop-filter` 및 `-webkit-backdrop-filter` 속성을 전면 제거하여 플랫한 다이얼로그 형태로 수정하였습니다.

## 3. apps/step1, step2, step3 CSS 파일 수정
- **backdrop-filter 제거**:
  - 모든 하위 CSS 파일에서 반투명 효과를 주는 `backdrop-filter` 및 `-webkit-backdrop-filter` 속성을 완전히 제거하였습니다.
  - 대상 클래스:
    - **step1**: `.controls-block`, `.sankey-wrap`, `.legend-group`, `.formula`, `.projection-table thead th`, `.onboarding-overlay`, `.onboarding-tooltip.is-mobile`, `.surplus-transfer-banner`
    - **step2**: `.sync-banner`, `.sim-chart-wrap`, `.chart-tooltip`, `.projection-table th`
    - **step3**: `.account-card`
- **플랫 패널 스타일 적용**:
  - 반투명 배경을 가진 패널 요소들의 배경을 불투명 `var(--panel)`로 통일하고 테두리(`1px solid var(--line)`)를 추가하거나 유지하여 일관된 플랫 디자인을 완성했습니다.
  - 대상 요소:
    - **step1**: `.control`, `.advanced-block`, `.surplus-transfer-banner`, `.account-row`, `.income-row:not(.is-editing)`, `.formula` (점선에서 실선 border로 변경)
    - **step2**: `.sim-inputs-container`
    - **step3**: `guide-item`, `snapshot-item`
- **미디어 쿼리 무결성**:
  - 각 CSS 파일 하단의 반응형 미디어 쿼리 선언부가 훼손되지 않도록 정상 반영되었습니다.
